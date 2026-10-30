import React, { useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import { useEnviarCronogramaSgqAuditoria } from '../../hooks/useSgqAuditorias';
import type { SgqAuditoria } from '../../types/domain';

interface SGQAuditoriaCronogramaEmailModalProps {
  auditoria: SgqAuditoria;
  onClose: () => void;
}

const SGQAuditoriaCronogramaEmailModal: React.FC<SGQAuditoriaCronogramaEmailModalProps> = ({ auditoria, onClose }) => {
  const enviar = useEnviarCronogramaSgqAuditoria();
  const { data: contactsData } = useGoogleContacts(true);
  const contacts = contactsData?.contacts ?? [];
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const temCronograma = (auditoria.planejamento?.length ?? 0) > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    const to = toTags.map((tag) => tag.email);
    if (!temCronograma) {
      setErrorMsg('Lance o planejamento da auditoria antes de enviar o cronograma.');
      return;
    }
    if (to.length === 0) {
      setErrorMsg('Informe ao menos um destinatário.');
      return;
    }
    enviar.mutate(
      { id: auditoria.id, to, cc: ccTags.map((tag) => tag.email) },
      {
        onSuccess: (res) => setSuccess(res.message ?? 'Cronograma enviado.'),
        onError: (err: unknown) => {
          const data = (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
          setErrorMsg(data?.detail || data?.error || 'Não foi possível enviar o cronograma.');
        },
      },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !enviar.isPending) onClose(); }}
    >
      <div className="search-modal-card search-modal-card--allow-overflow" style={{ width: '500px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Enviar cronograma</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        {success ? (
          <div style={{ padding: '20px 24px 24px' }}>
            <div style={{ padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#166534' }}>{success}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="reports-action-btn primary" style={{ fontSize: '12.5px', height: '36px' }} onClick={onClose}>
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form style={{ padding: '20px 24px 24px' }} onSubmit={handleSubmit}>
            <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
              O cronograma de <strong>{auditoria.codigo}</strong> — {auditoria.titulo} segue como um convite, com a agenda da auditoria.
            </p>
            {!temCronograma && (
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#b91c1c' }}>
                Esta auditoria ainda não tem atividades no planejamento.
              </p>
            )}
            <EmailTagsInput
              id="sgq-cronograma-email-to"
              label="Para"
              value={toTags}
              onChange={setToTags}
              contacts={contacts}
              disabled={enviar.isPending || !temCronograma}
              placeholder="Adicionar destinatário..."
              hint={contacts.length > 0 ? 'Digite para buscar contatos Google vinculados.' : 'Vincule sua conta Google no perfil para autocomplete de contatos.'}
              required
            />
            <EmailTagsInput
              id="sgq-cronograma-email-cc"
              label="Cópia (opcional)"
              value={ccTags}
              onChange={setCcTags}
              contacts={contacts}
              disabled={enviar.isPending || !temCronograma}
              placeholder="Adicionar cópia..."
            />
            {errorMsg && (
              <div style={{ marginBottom: '14px', marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={enviar.isPending} style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}>
                Cancelar
              </button>
              <button type="submit" className="reports-action-btn primary" disabled={enviar.isPending || !temCronograma} style={{ fontSize: '12.5px', height: '36px' }}>
                {enviar.isPending ? 'Enviando...' : 'Enviar cronograma'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SGQAuditoriaCronogramaEmailModal;
