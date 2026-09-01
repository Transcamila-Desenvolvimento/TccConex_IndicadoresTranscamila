import React, { useEffect, useState } from 'react';
import EmailTagsInput, { type EmailTagValue } from '../../components/EmailTagsInput';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import { useEnviarResumoSgqPesquisas, useSgqResumoAnos } from '../../hooks/useSgqPesquisas';

interface SGQResumoEmailModalProps {
  onClose: () => void;
}

const SGQResumoEmailModal: React.FC<SGQResumoEmailModalProps> = ({ onClose }) => {
  const anosQuery = useSgqResumoAnos();
  const enviarResumo = useEnviarResumoSgqPesquisas();
  const [ano, setAno] = useState<number | ''>('');
  const [toTags, setToTags] = useState<EmailTagValue[]>([]);
  const [ccTags, setCcTags] = useState<EmailTagValue[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: contactsData } = useGoogleContacts(true);
  const contacts = contactsData?.contacts ?? [];
  const anos = anosQuery.data?.anos ?? [];
  const anoPadrao = anosQuery.data?.anoPadrao;

  useEffect(() => {
    if (ano === '' && anoPadrao != null) {
      setAno(anoPadrao);
    }
  }, [ano, anoPadrao]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const to = toTags.map((tag) => tag.email);
    if (to.length === 0) {
      setErrorMsg('Informe ao menos um destinatário.');
      return;
    }
    if (ano === '') {
      setErrorMsg('Selecione o ano de referência.');
      return;
    }

    enviarResumo.mutate(
      { to, cc: ccTags.map((tag) => tag.email), ano },
      {
        onSuccess: (res) => setSuccess(res.message ?? 'Resumo enviado com sucesso.'),
        onError: (err: unknown) => {
          const detail =
            (err as { response?: { data?: { detail?: string; error?: string } } })?.response?.data?.detail
            ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? 'Falha ao enviar o resumo. Tente novamente.';
          setErrorMsg(detail);
        },
      },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !enviarResumo.isPending) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '500px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Pesquisa de Satisfação</h3>
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
              O resumo será enviado com as pesquisas de{' '}
              <strong>Ibiporã e Rondonópolis</strong> do <strong>ano selecionado</strong>,
              independentemente da filial da sessão, dos filtros da lista
              e das filiais liberadas no seu acesso ao SGQ.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="sgq-resumo-ano" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Ano de referência
              </label>
              <select
                id="sgq-resumo-ano"
                className="rh-period-select"
                value={ano === '' ? '' : String(ano)}
                onChange={(e) => setAno(e.target.value ? Number(e.target.value) : '')}
                disabled={anosQuery.isLoading || enviarResumo.isPending}
                aria-label="Ano de referência do resumo"
              >
                {anosQuery.isLoading && <option value="">Carregando anos...</option>}
                {!anosQuery.isLoading && anos.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                Lista os anos com lançamento. O padrão é o ano atual.
              </p>
            </div>

            <EmailTagsInput
              id="sgq-resumo-email-to"
              label="Para"
              value={toTags}
              onChange={setToTags}
              contacts={contacts}
              disabled={enviarResumo.isPending}
              placeholder="Adicionar destinatário..."
              hint={contacts.length > 0 ? 'Digite para buscar contatos Google vinculados.' : 'Vincule sua conta Google no perfil para autocomplete de contatos.'}
              required
            />

            <EmailTagsInput
              id="sgq-resumo-email-cc"
              label="Cópia (opcional)"
              value={ccTags}
              onChange={setCcTags}
              contacts={contacts}
              disabled={enviarResumo.isPending}
              placeholder="Adicionar cópia..."
            />

            {errorMsg && (
              <div style={{ marginBottom: '14px', marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={enviarResumo.isPending} style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}>
                Cancelar
              </button>
              <button
                type="submit"
                className="reports-action-btn primary"
                disabled={enviarResumo.isPending || anosQuery.isLoading || ano === ''}
                style={{ fontSize: '12.5px', height: '36px' }}
              >
                {enviarResumo.isPending ? 'Enviando...' : 'Enviar resumo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SGQResumoEmailModal;
