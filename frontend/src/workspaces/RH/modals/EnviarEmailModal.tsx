import React, { useState } from 'react';
import type { LoteMovimentacaoRH } from '../../../types/domain';
import EmailTagsInput, { type EmailTagValue } from '../../../components/EmailTagsInput';
import { useGoogleContacts } from '../../../hooks/useGoogleContacts';
import { useEnviarEmailRH, getRHErrorMessage } from '../../../hooks/useRH';

interface EnviarEmailModalProps {
  lotes: LoteMovimentacaoRH[];
  defaultLoteId?: string;
  onClose: () => void;
}

const EnviarEmailModal: React.FC<EnviarEmailModalProps> = ({ lotes, defaultLoteId, onClose }) => {
  const enviarEmail = useEnviarEmailRH();
  const [loteId, setLoteId] = useState(defaultLoteId ?? lotes[0]?.id ?? '');
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: contactsData } = useGoogleContacts(true);
  const contacts = contactsData?.contacts ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loteId) {
      setErrorMsg('Selecione um lote de referência.');
      return;
    }

    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setErrorMsg('Informe ao menos um destinatário.');
      return;
    }

    enviarEmail.mutate(
      { loteId, to, cc: ccTags.map((tag) => tag.email) },
      {
        onSuccess: (res) => setSuccess(res.message ?? 'E-mail enviado com sucesso.'),
        onError: (err: unknown) => setErrorMsg(getRHErrorMessage(err, 'Falha ao enviar o e-mail.')),
      },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !enviarEmail.isPending) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '500px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Enviar Relatório de Movimentação</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        {success ? (
          <div style={{ padding: '20px 24px 24px 24px' }}>
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
          <form style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmit}>
            <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
              O relatório será agrupado por filial e conterá estatísticas de pessoal, folha e movimentações do período selecionado.
            </p>

            <div className="login-group" style={{ marginBottom: '14px' }}>
              <label htmlFor="rh-email-lote">Lote de referência</label>
              <select id="rh-email-lote" required value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={enviarEmail.isPending}>
                <option value="" disabled>Selecione um lote...</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>{String(lote.mes).padStart(2, '0')}/{lote.ano}</option>
                ))}
              </select>
            </div>

            <EmailTagsInput
              id="rh-email-to"
              label="Para"
              value={toTags}
              onChange={setToTags}
              contacts={contacts}
              disabled={enviarEmail.isPending}
              placeholder="Adicionar destinatário..."
              hint={contacts.length > 0 ? 'Digite para buscar contatos Google vinculados.' : 'Vincule sua conta Google no perfil para autocomplete de contatos.'}
              required
            />

            <EmailTagsInput
              id="rh-email-cc"
              label="Cópia (opcional)"
              value={ccTags}
              onChange={setCcTags}
              contacts={contacts}
              disabled={enviarEmail.isPending}
              placeholder="Adicionar cópia..."
            />

            {errorMsg && (
              <div style={{ marginBottom: '14px', marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={enviarEmail.isPending} style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}>
                Cancelar
              </button>
              <button
                type="submit"
                className="reports-action-btn primary"
                disabled={enviarEmail.isPending}
                style={{ fontSize: '12.5px', height: '36px' }}
              >
                {enviarEmail.isPending ? 'Enviando...' : 'Enviar Relatório'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EnviarEmailModal;
