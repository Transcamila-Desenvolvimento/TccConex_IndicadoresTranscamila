import React from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useHistoricoSituacoesProposta } from '../../hooks/useComercialClientes';
import type { PropostaComercial, PropostaComercialSituacao } from '../../types/domain';
import { PROPOSTA_COMERCIAL_SITUACAO_LABEL } from '../../types/domain';

interface ComercialPropostaSituacaoHistoricoModalProps {
  proposta: PropostaComercial;
  badgeClass: (situacao: PropostaComercialSituacao) => string;
  onClose: () => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ComercialPropostaSituacaoHistoricoModal: React.FC<ComercialPropostaSituacaoHistoricoModalProps> = ({
  proposta,
  badgeClass,
  onClose,
}) => {
  const historicoQuery = useHistoricoSituacoesProposta(proposta.id);
  const itens = historicoQuery.data ?? [];

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3100 }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" role="dialog" aria-modal="true" aria-labelledby="historico-situacao-titulo" style={{ width: '560px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 id="historico-situacao-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
              Histórico da situação
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Proposta {proposta.numeroIdentificacao || ''}
            </p>
          </div>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>
        <div style={{ padding: '8px 24px 22px' }}>
          <QueryDataPanel
            query={historicoQuery}
            variant="compact"
            refreshVariant="overlay"
            loadingMessage="Carregando histórico..."
            errorMessage="Não foi possível carregar o histórico."
          >
            {itens.length === 0 ? (
              <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#64748b' }}>Nenhum registro de situação.</p>
            ) : (
              <div className="proposta-situacao-trilha">
                <ol>
                  {itens.map((item, index) => (
                    <li key={`${item.em}-${index}`}>
                      <span className="proposta-situacao-trilha-marca" aria-hidden="true" />
                      <div>
                        <p className="proposta-situacao-trilha-quando">{formatDateTime(item.em)}</p>
                        <span className={`proposta-status-badge ${badgeClass(item.situacao)}`} style={{ marginTop: 6 }}>
                          {PROPOSTA_COMERCIAL_SITUACAO_LABEL[item.situacao] || item.situacao}
                        </span>
                        {item.resumo ? <p className="proposta-situacao-trilha-resumo">{item.resumo}</p> : null}
                        {item.usuario ? <p className="proposta-situacao-trilha-usuario">{item.usuario}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </QueryDataPanel>
        </div>
      </div>
    </div>
  );
};

export default ComercialPropostaSituacaoHistoricoModal;
