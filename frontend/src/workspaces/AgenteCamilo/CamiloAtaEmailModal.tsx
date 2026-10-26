import React, { useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useAuth } from '../../contexts/AuthContext';
import { useEnviarEmailCamiloAta } from '../../hooks/useCamiloAgentes';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import type { CamiloAta } from '../../types/domain';
import { blobCamiloAtaPdf } from './camiloAtaPdf';

interface CamiloAtaEmailModalProps {
  ata: CamiloAta;
  onClose: () => void;
}

const CamiloAtaEmailModal: React.FC<CamiloAtaEmailModalProps> = ({ ata, onClose }) => {
  const { user } = useAuth();
  const googleEmail = (user?.googleEmail || '').trim();
  const enviar = useEnviarEmailCamiloAta();
  const { data: contactsData } = useGoogleContacts(Boolean(googleEmail));
  const contacts = (contactsData?.contacts ?? []).filter(
    (contact) => contact.email.trim().toLowerCase() !== googleEmail.toLowerCase(),
  );
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [observacao, setObservacao] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const busy = gerando || enviar.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (!googleEmail) {
      setErrorMsg('Vincule sua conta Google no perfil para enviar a ata pelo seu e-mail.');
      return;
    }
    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setErrorMsg('Informe ao menos um destinatário.');
      return;
    }
    setGerando(true);
    let pdf: Blob;
    try {
      pdf = await blobCamiloAtaPdf(ata);
    } catch {
      setErrorMsg('Não foi possível gerar o PDF da ata.');
      setGerando(false);
      return;
    }
    setGerando(false);
    enviar.mutate(
      {
        to,
        cc: ccTags.map((tag) => tag.email).filter((email) => email.toLowerCase() !== googleEmail.toLowerCase()),
        titulo: ata.titulo,
        observacao,
        pdf,
      },
      {
        onSuccess: (res) => setSuccess(res.message ?? 'Ata enviada.'),
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          setErrorMsg(detail || 'Não foi possível enviar a ata.');
        },
      },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3100 }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div className="search-modal-card search-modal-card--allow-overflow" style={{ width: '520px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Enviar ata</h3>
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
          <form style={{ padding: '20px 24px 24px' }} onSubmit={handleSubmit}>
            <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
              O PDF sai com a logo da empresa e é enviado pelo Gmail vinculado ao seu perfil.
            </p>
            <EmailTagsInput
              id="camilo-ata-email-to"
              label="Para"
              value={toTags}
              onChange={setToTags}
              contacts={contacts}
              disabled={busy}
              placeholder="Adicionar destinatário..."
              hint={contacts.length > 0 ? 'Digite para buscar contatos Google vinculados.' : 'Vincule sua conta Google no perfil para autocomplete de contatos.'}
              required
            />
            <EmailTagsInput
              id="camilo-ata-email-cc"
              label="Cópia (opcional)"
              value={ccTags}
              onChange={setCcTags}
              contacts={contacts}
              disabled={busy}
              placeholder="Adicionar cópia..."
            />
            <label htmlFor="camilo-ata-observacao" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', margin: '12px 0 6px' }}>
              Observação (opcional)
            </label>
            <textarea
              id="camilo-ata-observacao"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              disabled={busy}
              rows={3}
              style={{ width: '100%', resize: 'vertical', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, font: 'inherit' }}
            />
            {errorMsg && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="reports-action-btn primary" disabled={busy}>
                {gerando ? 'Gerando PDF...' : enviar.isPending ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CamiloAtaEmailModal;
