import React, { useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import {
  getComercialErrorMessage,
  useEnviarRepassePropostaComercial,
} from '../../hooks/useComercialClientes';
import type { ClienteComercial, PropostaComercial } from '../../types/domain';
import { generatePropostaComercialPdfBlob } from './printPropostaComercial';

interface ComercialPropostaRepasseModalProps {
  proposta: PropostaComercial;
  cliente: ClienteComercial | null | undefined;
  onClose: () => void;
}

// Acima disso o upload/Gmail costuma falhar; compacta o PDF antes de enviar.
const PDF_EMAIL_SAFE_BYTES = 5.5 * 1024 * 1024;

const ComercialPropostaRepasseModal: React.FC<ComercialPropostaRepasseModalProps> = ({
  proposta,
  cliente,
  onClose,
}) => {
  const { user } = useAuth();
  const googleEmail = (user?.googleEmail || '').trim();
  const googleEmailNorm = googleEmail.toLowerCase();
  const enviarRepasse = useEnviarRepassePropostaComercial();
  const { data: contactsData } = useGoogleContacts(Boolean(googleEmail));
  const contacts = (contactsData?.contacts ?? []).filter(
    (contact) => contact.email.trim().toLowerCase() !== googleEmailNorm,
  );
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [observacao, setObservacao] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleToChange = (tags: EmailTagValue[]) => {
    setToTags(tags);
    setErrorMsg(null);
  };

  const handleCcChange = (tags: EmailTagValue[]) => {
    setCcTags(tags);
    setErrorMsg(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!googleEmail) {
      setErrorMsg('Vincule sua conta Google no perfil para enviar o repasse pelo seu e-mail.');
      return;
    }
    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setErrorMsg('Informe ao menos um destinatário da operação.');
      return;
    }

    setGeneratingPdf(true);
    let pdf: Blob;
    try {
      pdf = await generatePropostaComercialPdfBlob(proposta, cliente, { compact: false });
      if (pdf.size > PDF_EMAIL_SAFE_BYTES) {
        pdf = await generatePropostaComercialPdfBlob(proposta, cliente, { compact: true });
      }
    } catch {
      setErrorMsg('Não foi possível gerar o PDF da proposta.');
      setGeneratingPdf(false);
      return;
    }
    setGeneratingPdf(false);

    try {
      const res = await enviarRepasse.mutateAsync({
        id: proposta.id,
        to,
        cc: ccTags.map((tag) => tag.email).filter((email) => email.toLowerCase() !== googleEmailNorm),
        observacao,
        pdf,
        versao: proposta.dataAtualizacao || undefined,
      });
      setSuccess(res.message ?? 'Repasse Operacional enviado.');
    } catch (err) {
      setErrorMsg(getComercialErrorMessage(err));
    }
  };

  const busy = generatingPdf || enviarRepasse.isPending;

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3100 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="search-modal-card search-modal-card--allow-overflow" style={{ width: '540px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Repasse Operacional — {proposta.numeroIdentificacao || ''}
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
              Envia à equipe operacional, pelo seu Gmail vinculado
              {googleEmail ? <> (<strong>{googleEmail}</strong>)</> : null}, o aviso de que{' '}
              <strong>{proposta.clienteNome || cliente?.razaoSocial || 'o cliente'}</strong> aceitou a proposta, com o PDF
              da proposta e a planilha Excel com tarifas e condições em anexo.
            </p>
            {!googleEmail ? (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c' }}>
                Vincule sua conta Google no perfil antes de enviar.
              </p>
            ) : null}
            <EmailTagsInput
              id="proposta-repasse-to"
              label="Para"
              value={toTags}
              onChange={handleToChange}
              contacts={contacts}
              disabled={busy}
              placeholder="E-mails da equipe operacional..."
              required
            />
            <EmailTagsInput
              id="proposta-repasse-cc"
              label="Cópia"
              value={ccTags}
              onChange={handleCcChange}
              contacts={contacts}
              disabled={busy}
              placeholder="Outros destinatários em cópia (opcional)..."
            />
            <div className="form-group">
              <label htmlFor="proposta-repasse-observacao">
                Observações <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small>
              </label>
              <textarea
                id="proposta-repasse-observacao"
                className="form-input"
                rows={4}
                maxLength={2000}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={busy}
                placeholder="Instruções para a operação: início previsto, contatos do cliente, particularidades..."
                style={{ resize: 'vertical', minHeight: 90 }}
              />
            </div>
            {errorMsg ? (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c' }}>{errorMsg}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" className="reports-action-btn secondary" disabled={busy} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="reports-action-btn primary" disabled={busy}>
                {generatingPdf ? 'Gerando PDF...' : enviarRepasse.isPending ? 'Enviando...' : 'Enviar repasse'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ComercialPropostaRepasseModal;
