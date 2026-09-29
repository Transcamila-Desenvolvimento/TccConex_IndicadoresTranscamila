import React, { useEffect, useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import {
  getComercialErrorMessage,
  useEnviarEmailPropostaComercial,
} from '../../hooks/useComercialClientes';
import type { ClienteComercial, PropostaComercial } from '../../types/domain';
import { generatePropostaComercialPdfBlob } from './printPropostaComercial';

interface ComercialPropostaEmailModalProps {
  propostas: PropostaComercial[];
  clienteFor: (proposta: PropostaComercial) => ClienteComercial | null | undefined;
  onClose: () => void;
}

const ComercialPropostaEmailModal: React.FC<ComercialPropostaEmailModalProps> = ({
  propostas,
  clienteFor,
  onClose,
}) => {
  const proposta = propostas[0];
  const cliente = proposta ? clienteFor(proposta) : null;
  const { user } = useAuth();
  const googleEmail = (user?.googleEmail || '').trim();
  const googleEmailNorm = googleEmail.toLowerCase();
  const enviarEmail = useEnviarEmailPropostaComercial();
  const { data: contactsData } = useGoogleContacts(Boolean(googleEmail));
  const contacts = (contactsData?.contacts ?? []).filter(
    (contact) => contact.email.trim().toLowerCase() !== googleEmailNorm,
  );
  const destinoInicial = (proposta?.clienteEmail || cliente?.email || '').trim();
  const [toTags, setToTags] = useState<EmailTagValue[]>(
    destinoInicial ? [{ email: destinoInicial }] : [],
  );
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [observacao, setObservacao] = useState('');
  const [confirmacaoLeitura, setConfirmacaoLeitura] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const numeros = (() => {
    const parts = propostas.map((item) => item.numeroIdentificacao).filter(Boolean);
    if (parts.length <= 1) return parts[0] || '';
    if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  })();

  useEffect(() => {
    setErrorMsg(null);
  }, [toTags, ccTags]);

  if (!proposta) return null;

  // Só falha de transporte (sem resposta ou proxy 502/504); erro devolvido pelo backend deve aparecer como veio.
  const isErroRede = (err: unknown) => {
    const axiosErr = err as { code?: string; response?: { status?: number } };
    return (
      !axiosErr.response
      || axiosErr.code === 'ERR_NETWORK'
      || axiosErr.code === 'ECONNABORTED'
      || axiosErr.response.status === 502
      || axiosErr.response.status === 504
    );
  };

  // Acima disso o upload/Gmail costuma falhar (revisão alonga o fechamento).
  const PDF_EMAIL_SAFE_BYTES = 5.5 * 1024 * 1024;

  const gerarPdfs = async (compact: boolean) => {
    const pdfs: Blob[] = [];
    for (const item of propostas) {
      pdfs.push(await generatePropostaComercialPdfBlob(item, clienteFor(item), { compact }));
    }
    return pdfs;
  };

  const tamanhoTotal = (pdfs: Blob[]) => pdfs.reduce((acc, pdf) => acc + pdf.size, 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!googleEmail) {
      setErrorMsg('Vincule sua conta Google no perfil para enviar a proposta pelo seu e-mail.');
      return;
    }
    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setErrorMsg('Informe o e-mail do cliente ou outro destinatário.');
      return;
    }
    const payloadBase = {
      ids: propostas.map((item) => item.id),
      revisoes: propostas.map((item) => item.revisao || ''),
      to,
      cc: ccTags.map((tag) => tag.email).filter((email) => email.toLowerCase() !== googleEmailNorm),
      observacao,
      confirmacaoLeitura,
    };

    setGeneratingPdf(true);
    let pdfs: Blob[];
    try {
      // Qualidade normal primeiro (igual à impressão).
      pdfs = await gerarPdfs(false);
      // Revisão/ajustes podem inflar o anexo: compacta antes de subir se passar do limite seguro.
      if (tamanhoTotal(pdfs) > PDF_EMAIL_SAFE_BYTES) {
        pdfs = await gerarPdfs(true);
      }
    } catch {
      setErrorMsg('Não foi possível gerar o PDF da proposta.');
      setGeneratingPdf(false);
      return;
    }
    setGeneratingPdf(false);

    try {
      const res = await enviarEmail.mutateAsync({ ...payloadBase, pdfs });
      setSuccess(res.message ?? 'Proposta enviada com sucesso.');
      return;
    } catch (err) {
      if (!isErroRede(err)) {
        setErrorMsg(getComercialErrorMessage(err));
        return;
      }
    }

    // Retry automático com PDF mais leve só se a rede/proxy falhou.
    setGeneratingPdf(true);
    try {
      pdfs = await gerarPdfs(true);
    } catch {
      setErrorMsg(
        'Falha de conexão ao enviar. Não foi possível gerar o PDF reduzido. Use Imprimir e anexe no Gmail.',
      );
      setGeneratingPdf(false);
      return;
    }
    setGeneratingPdf(false);

    try {
      const res = await enviarEmail.mutateAsync({ ...payloadBase, pdfs });
      setSuccess(res.message ?? 'Proposta enviada com sucesso.');
    } catch (err) {
      const msg = getComercialErrorMessage(err);
      setErrorMsg(
        isErroRede(err)
          ? 'Falha de conexão ao enviar (PDF grande ou tempo esgotado). Tente de novo; se persistir, use Imprimir e anexe o PDF no Gmail.'
          : msg,
      );
    }
  };

  const busy = generatingPdf || enviarEmail.isPending;

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3100 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="search-modal-card search-modal-card--allow-overflow" style={{ width: '520px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {propostas.length > 1 ? `Enviar propostas ${numeros}` : `Enviar proposta ${proposta.numeroIdentificacao || ''}`}
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        {success ? (
          <div style={{ padding: '20px 24px 24px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 14 }}>
              {success}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="reports-action-btn primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              {propostas.length > 1
                ? 'As propostas selecionadas do mesmo cliente serão enviadas no mesmo e-mail, pelo seu Gmail vinculado'
                : 'A proposta será enviada pelo seu Gmail vinculado'}
              {googleEmail ? <> (<strong>{googleEmail}</strong>)</> : null},
              com o mesmo PDF da impressão em anexo. Os demais envios do sistema continuam pelo e-mail corporativo.
            </p>
            {!googleEmail ? (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c' }}>
                Vincule sua conta Google no perfil antes de enviar.
              </p>
            ) : null}
            <EmailTagsInput
              id="proposta-email-to"
              label="Para"
              value={toTags}
              onChange={setToTags}
              contacts={contacts}
              disabled={busy}
              placeholder="E-mail do cliente..."
              required
            />
            <EmailTagsInput
              id="proposta-email-cc"
              label="Cópia"
              value={ccTags}
              onChange={setCcTags}
              contacts={contacts}
              disabled={busy}
              placeholder="Outros destinatários em cópia (opcional)..."
            />
            <div className="form-group">
              <label htmlFor="proposta-email-observacao">
                Observação <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small>
              </label>
              <textarea
                id="proposta-email-observacao"
                className="form-input"
                rows={3}
                maxLength={2000}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={busy}
                placeholder="Aparece no corpo do e-mail como OBS:, logo após a apresentação da proposta..."
                style={{ resize: 'vertical', minHeight: 72 }}
              />
            </div>
            <label
              htmlFor="proposta-email-confirmacao"
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', color: '#334155', cursor: busy ? 'default' : 'pointer' }}
            >
              <input
                type="checkbox"
                id="proposta-email-confirmacao"
                checked={confirmacaoLeitura}
                onChange={(e) => setConfirmacaoLeitura(e.target.checked)}
                disabled={busy}
                style={{ marginTop: 3 }}
              />
              <span>
                Solicitar confirmação de leitura
                <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11.5px', lineHeight: 1.4 }}>
                  O cliente decide se confirma; a confirmação chega no seu Gmail. Gmail pessoal costuma ignorar o pedido.
                </small>
              </span>
            </label>
            {errorMsg ? (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c' }}>{errorMsg}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" className="reports-action-btn secondary" disabled={busy} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="reports-action-btn primary" disabled={busy}>
                {generatingPdf ? 'Gerando PDF...' : enviarEmail.isPending ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ComercialPropostaEmailModal;
