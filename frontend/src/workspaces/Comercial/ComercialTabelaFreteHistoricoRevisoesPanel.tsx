import React from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useTabelaFreteHistoricoRevisoes } from '../../hooks/useComercialClientes';
import ComercialTabelaFreteStatusBadge from './ComercialTabelaFreteStatusBadge';

interface Props {
  tabelaId: string;
  tabelaNome: string;
  onClose: () => void;
  onOpenRevisao?: (id: string) => void;
}

const formatWhen = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
};

export default function ComercialTabelaFreteHistoricoRevisoesPanel({
  tabelaId,
  tabelaNome,
  onClose,
  onOpenRevisao,
}: Props) {
  const historicoQuery = useTabelaFreteHistoricoRevisoes(tabelaId);
  const historico = historicoQuery.data;
  const totalRevisoes = historico?.revisoes.length ?? 0;

  return (
    <div className="tabela-frete-historico-drawer-root" role="presentation">
      <button
        type="button"
        className="tabela-frete-historico-backdrop"
        aria-label="Fechar histórico"
        onClick={onClose}
      />
      <aside className="tabela-frete-historico-drawer erp-card" aria-label="Histórico de revisões">
        <header className="tabela-frete-historico-panel-header">
          <div>
            <h3>
              <i className="bi bi-clock-history" aria-hidden />
              Histórico de revisões
            </h3>
            <p className="tabela-frete-historico-panel-subtitle">
              {historico?.codigo ? `${historico.codigo} · ` : ''}{tabelaNome || historico?.nome}
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar histórico">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <QueryDataPanel
          className="tabela-frete-historico-panel-query"
          query={historicoQuery}
          variant="compact"
          loadingMessage="Carregando revisões..."
          errorMessage="Não foi possível carregar o histórico."
        >
          {totalRevisoes === 0 ? (
            <p className="tabela-frete-historico-empty">Nenhuma revisão registrada.</p>
          ) : (
            <>
              <p className="tabela-frete-historico-count">
                {totalRevisoes} revisão{totalRevisoes === 1 ? '' : 'ões'}
              </p>
              <ul className="tabela-frete-historico-timeline">
                {historico?.revisoes.map((item, index) => {
                  const clickable = !item.atual && Boolean(onOpenRevisao);
                  const when = formatWhen(item.dataAtualizacao || item.dataCriacao);

                  return (
                    <li
                      key={item.id}
                      className={`tabela-frete-historico-entry${item.atual ? ' is-current' : ''}${clickable ? ' is-clickable' : ''}`}
                    >
                      <div className="tabela-frete-historico-entry-rail" aria-hidden>
                        <span className="tabela-frete-historico-entry-dot" />
                        {index < totalRevisoes - 1 ? <span className="tabela-frete-historico-entry-line" /> : null}
                      </div>

                      {clickable ? (
                        <button
                          type="button"
                          className="tabela-frete-historico-entry-body"
                          onClick={() => onOpenRevisao?.(item.id)}
                        >
                          <div className="tabela-frete-historico-entry-top">
                            <span className="tabela-frete-historico-entry-rev">Revisão {item.revisao}</span>
                            <ComercialTabelaFreteStatusBadge status={item.status} />
                          </div>
                          <p className="tabela-frete-historico-entry-meta">
                            <i className="bi bi-calendar3" aria-hidden />
                            {when}
                          </p>
                          <p className="tabela-frete-historico-entry-meta">
                            <i className="bi bi-person" aria-hidden />
                            {item.usuarioNome || 'Usuário não registrado'}
                          </p>
                        </button>
                      ) : (
                        <div className="tabela-frete-historico-entry-body">
                          <div className="tabela-frete-historico-entry-top">
                            <span className="tabela-frete-historico-entry-rev">
                              Revisão {item.revisao}
                              {item.atual ? <span className="tabela-frete-historico-atual">Em exibição</span> : null}
                            </span>
                            <ComercialTabelaFreteStatusBadge status={item.status} />
                          </div>
                          <p className="tabela-frete-historico-entry-meta">
                            <i className="bi bi-calendar3" aria-hidden />
                            {when}
                          </p>
                          <p className="tabela-frete-historico-entry-meta">
                            <i className="bi bi-person" aria-hidden />
                            {item.usuarioNome || 'Usuário não registrado'}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </QueryDataPanel>
      </aside>
    </div>
  );
}
