import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useSgqAuditorias } from '../../hooks/useSgqAuditorias';
import type { SgqAuditoria, SgqAuditoriaQueryParams } from '../../types/domain';
import { SGQ_AUDITORIA_STATUS_LABEL } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function percentual(auditoria: SgqAuditoria) {
  if (!auditoria.totalPerguntas) return 0;
  return Math.round((auditoria.perguntasRespondidas / auditoria.totalPerguntas) * 100);
}

const SGQQuestionarios: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const navigate = useNavigate();
  const canAnswer = userHasFuncao(user, 'SGQ', 'executar-auditorias');

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const params: SgqAuditoriaQueryParams = {
    page,
    pageSize,
    search: buscaAplicada,
    ordering: '-data_inicio',
  };
  const listaQuery = useSgqAuditorias(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const paginaAtual = Math.min(page, totalPaginas);

  const abrir = (auditoria: SgqAuditoria) => {
    navigate(`/sgq/auditorias/minhas-acoes/${auditoria.id}`);
  };

  return (
    <div className="fat-list-compact sgq-lista">
      <header className="view-header sgq-lista-header">
        <div className="sgq-lista-titulo">
          <span className="sgq-lista-marcador" aria-hidden="true" />
          <h1 className="view-page-title">Questionário</h1>
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <i className="bi bi-search search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar auditoria..."
              title="Busca por código, título, norma ou auditor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar auditorias"
            />
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{total}</strong> {total === 1 ? 'Auditoria' : 'Auditorias'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando questionários..."
        refreshingMessage="Atualizando questionários..."
        errorMessage="Não foi possível carregar os questionários. Tente novamente."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela sgq-quest-tabela">
              <colgroup>
                <col className="sgq-quest-col-codigo" />
                <col className="sgq-quest-col-titulo" />
                <col className="sgq-quest-col-norma" />
                <col className="sgq-quest-col-status" />
                <col className="sgq-quest-col-progresso" />
                <col className="sgq-quest-col-acao" />
              </colgroup>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Auditoria</th>
                  <th>Norma</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="comercial-browse-empty">
                      {buscaAplicada ? 'Nenhuma auditoria encontrada para a busca.' : 'Não há auditorias registradas.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((auditoria) => {
                    const normas = auditoria.normas.map((norma) => norma.nome);
                    const pct = percentual(auditoria);
                    const somenteLeitura = auditoria.status === 'concluida' || !canAnswer;
                    return (
                      <tr key={auditoria.id} className="sgq-quest-linha">
                        <td><span className="sgq-aud-codigo">{auditoria.codigo}</span></td>
                        <td>
                          <button type="button" className="sgq-quest-titulo" onClick={() => abrir(auditoria)} title={auditoria.titulo}>
                            {auditoria.titulo}
                          </button>
                        </td>
                        <td>
                          {normas.length ? (
                            <div className="sgq-aud-normas">
                              {normas.slice(0, 2).map((norma) => <span key={norma} className="sgq-aud-chip" title={norma}>{norma}</span>)}
                              {normas.length > 2 && (
                                <span className="sgq-aud-chip is-more" title={normas.slice(2).join(', ')}>+{normas.length - 2}</span>
                              )}
                            </div>
                          ) : <span className="sgq-aud-muted">—</span>}
                        </td>
                        <td>
                          <span className={`sgq-aud-status is-${auditoria.status}`}>
                            {SGQ_AUDITORIA_STATUS_LABEL[auditoria.status]}
                          </span>
                        </td>
                        <td>
                          {auditoria.totalPerguntas > 0 ? (
                            <div className="sgq-quest-progresso" title={`${auditoria.perguntasRespondidas} de ${auditoria.totalPerguntas} perguntas respondidas`}>
                              <div className="sgq-quest-progresso-topo">
                                <span>{auditoria.perguntasRespondidas} de {auditoria.totalPerguntas}</span>
                                <strong>{pct}%</strong>
                              </div>
                              <div className={`sgq-quest-barra${pct >= 100 ? ' is-completa' : ''}`} aria-hidden="true">
                                <span style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="sgq-aud-muted">Sem perguntas</span>
                          )}
                        </td>
                        <td className="sgq-quest-acao">
                          <button
                            type="button"
                            className={`reports-action-btn ${somenteLeitura ? 'secondary' : 'primary'} sgq-quest-abrir`}
                            onClick={() => abrir(auditoria)}
                          >
                            {somenteLeitura ? 'Ver respostas' : 'Responder'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="sgq-questionarios-page-size">Itens por página</label>
            <select
              id="sgq-questionarios-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          </div>
          <span className="sgq-lista-pagina">
            Página <span className="erp-pagination-current">{paginaAtual}</span> de{' '}
            <span className="erp-pagination-current">{totalPaginas}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>
          <button type="button" className="reports-action-btn secondary sgq-lista-pag-btn" disabled={paginaAtual <= 1} onClick={() => setPage(paginaAtual - 1)}>
            <i className="bi bi-chevron-left" aria-hidden="true" />
            Anterior
          </button>
          <button type="button" className="reports-action-btn secondary sgq-lista-pag-btn" disabled={paginaAtual >= totalPaginas} onClick={() => setPage(paginaAtual + 1)}>
            Próximo
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default SGQQuestionarios;
