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
    let pdfs: Blob[];
    setGeneratingPdf(true);
    try {
      pdfs = [];
      for (const item of propostas) {
        pdfs.push(await generatePropostaComercialPdfBlob(item, clienteFor(item), { cargo: user?.cargo }));
      }
    } catch {
      setErrorMsg('Não foi possível gerar o PDF da proposta.');
      setGeneratingPdf(false);
      return;
    }
    setGeneratingPdf(false);
    enviarEmail.mutate(
      {
        ids: propostas.map((item) => item.id),
        to,
        cc: ccTags.map((tag) => tag.email).filter((email) => email.toLowerCase() !== googleEmailNorm),
        pdfs,
      },
      {
        onSuccess: (res) => setSuccess(res.message ?? 'Proposta enviada com sucesso.'),
        onError: (err) => {
          const msg = getComercialErrorMessage(err);
          const axiosErr = err as { code?: string; message?: string; response?: unknown };
          const rede =
            !axiosErr.response
            || axiosErr.code === 'ERR_NETWORK'
            || /ECONNRESET|timeout|Network Error|status code 50[245]/i.test(msg);
          setErrorMsg(
            rede
              ? 'Falha de conexão ao enviar (PDF grande ou tempo esgotado). Tente de novo; se persistir, use Imprimir e anexe o PDF no Gmail.'
              : msg,
          );
        },
      },
    );
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
