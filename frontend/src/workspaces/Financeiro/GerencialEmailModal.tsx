import React, { useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import { useSendGerencialEmail } from '../../hooks/useIndicadores';

interface GerencialEmailModalProps {
  initialDate: string;
  batchLabel?: string;
  onClose: () => void;
}

const GerencialEmailModal: React.FC<GerencialEmailModalProps> = ({ initialDate, batchLabel, onClose }) => {
  const [gerencialDate, setGerencialDate] = useState(initialDate);
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const { data: contactsData } = useGoogleContacts(true);
  const contacts = contactsData?.contacts ?? [];
  const { mutateAsync, isPending } = useSendGerencialEmail();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!gerencialDate) {
      setFeedback({ type: 'error', text: 'Informe a data de referência do relatório.' });
      return;
    }

    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setFeedback({ type: 'error', text: 'Informe ao menos um destinatário válido.' });
      return;
    }

    try {
      const result = await mutateAsync({
        gerencialDate,
        to,
        cc: ccTags.map((tag) => tag.email),
      });
      setFeedback({ type: 'success', text: result.message });
      window.setTimeout(onClose, 1500);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Não foi possível enviar o relatório. Tente novamente.';
      setFeedback({ type: 'error', text: detail });
    }
  };

  return (
    <div
      className="search-backdrop cashflow-detail-backdrop"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="search-modal-card gerencial-email-modal">
        <header className="cashflow-detail-header">
          <div>
            <h2>Enviar relatório gerencial</h2>
            <p>
              HTML + Excel (30 dias)
              {batchLabel ? ` · Lote ${batchLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="cashflow-detail-close"
            onClick={onClose}
            disabled={isPending}
            aria-label="Fechar"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form className="gerencial-email-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="gerencial-email-date">Data de referência</label>
            <input
              id="gerencial-email-date"
              type="date"
              value={gerencialDate}
              onChange={(e) => setGerencialDate(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <EmailTagsInput
            id="gerencial-email-to"
            label="Para"
            value={toTags}
            onChange={setToTags}
            contacts={contacts}
            disabled={isPending}
            placeholder="Adicionar destinatário..."
            hint={contacts.length > 0 ? 'Digite para buscar contatos Google vinculados.' : 'Vincule sua conta Google no perfil para autocomplete de contatos.'}
            required
          />

          <EmailTagsInput
            id="gerencial-email-cc"
            label="Cópia (opcional)"
            value={ccTags}
            onChange={setCcTags}
            contacts={contacts}
            disabled={isPending}
            placeholder="Adicionar cópia..."
          />

          {feedback && (
            <div className={`gerencial-email-feedback gerencial-email-feedback--${feedback.type}`}>
              {feedback.text}
            </div>
          )}

          <div className="gerencial-email-actions">
            <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </button>
            <button type="submit" className="reports-action-btn primary" disabled={isPending || !gerencialDate}>
              {isPending ? 'Enviando...' : 'Enviar e-mail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GerencialEmailModal;
