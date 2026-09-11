import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  useClienteComercial,
  useClientesComercial,
  useHomologacaoHistoricoCliente,
  useHomologarClienteComercial,
} from '../../hooks/useComercialClientes';
import type { ClienteComercial, ClienteComercialCompatibilidade } from '../../types/domain';
import {
  CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS,
  CLIENTE_COMERCIAL_GRUPO_EMBALAGEM_OPTIONS,
} from '../../types/domain';
import ComercialHomologacaoBadge from './ComercialHomologacaoBadge';
import { alteracoesDoEvento, HOMOLOGACAO_ALTERACAO_LABEL } from './diffHomologacaoProdutos';

type FiltroValidacao = 'pendente' | 'homologado' | 'reprovado' | 'todos';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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

const statusHistorico = (status: string): ClienteComercialCompatibilidade => {
  if (status === 'homologado' || status === 'reprovado') return status;
  return 'pendente_validacao';
};

const labelClasse = (value: string) =>
  CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS.find((item) => item.value === value)?.label || value || '—';

const hrefFispq = (value: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const labelGrupo = (value: string) =>
  CLIENTE_COMERCIAL_GRUPO_EMBALAGEM_OPTIONS.find((item) => item.value === value)?.label || value || '—';

const conformidadeLabel = (status?: string) => {
  if (status === 'bloqueado') return 'Bloqueado';
  if (status === 'carga_perigosa') return 'Carga perigosa';
  return 'Não perigoso';
};

const resumoProdutos = (cliente: ClienteComercial) => {
  const qtd = cliente.homologacaoResumo?.produtosVinculados ?? cliente.produtosCount ?? cliente.produtos.length;
  const perigosos = cliente.homologacaoResumo?.produtosPerigosos ?? 0;
  if (!qtd) return '—';
  if (perigosos) return `${qtd} · ${perigosos} perigosa${perigosos === 1 ? '' : 's'}`;
  return String(qtd);
};

const resumoPendencia = (cliente: ClienteComercial) =>
  cliente.homologacaoResumo?.resumoPendencia || '—';

const ComercialValidacaoClientes: React.FC = () => {
  const { user } = useAuth();
  const canValidate = userHasFuncao(user, 'Comercial', 'validar-clientes');
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filtro, setFiltro] = useState<FiltroValidacao>('todos');
  const [selected, setSelected] = useState<ClienteComercial | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const clienteLinkId = (searchParams.get('cliente') || '').trim() || null;
  const clienteLinkQuery = useClienteComercial(clienteLinkId);

  const clientesQuery = useClientesComercial({
    page,
    pageSize,
    search: search.trim() || undefined,
    fila: filtro === 'pendente' ? 'validacao' : undefined,
    homologacao: filtro === 'homologado' || filtro === 'reprovado' ? filtro : undefined,
    comProdutos: true,
  });
  const { canShowEmpty } = useAsyncQueryState(clientesQuery);
  const clientes = clientesQuery.data?.results ?? [];
  const historicoQuery = useHomologacaoHistoricoCliente(selected?.id ?? null);
  const homologar = useHomologarClienteComercial();
  const totalCount = clientesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const analise = selected?.homologacaoResumo;
  const jaHomologado = selected?.compatibilidade === 'homologado';
  const jaReprovado = selected?.compatibilidade === 'reprovado';
  const podeHomologar = Boolean(canValidate && selected && analise?.aptoHomologar && !jaHomologado);

  const abrir = (cliente: ClienteComercial) => {
    setSelected(cliente);
    setJustificativa('');
    setHistoricoAberto(false);
  };

  const fechar = () => {
    setSelected(null);
    setJustificativa('');
    setHistoricoAberto(false);
    if (searchParams.get('cliente')) {
      searchParams.delete('cliente');
      setSearchParams(searchParams, { replace: true });
    }
  };

  useEffect(() => {
    if (!clienteLinkQuery.data) return;
    setSelected(clienteLinkQuery.data);
    setJustificativa('');
    setHistoricoAberto(false);
  }, [clienteLinkQuery.data]);

  const decidir = (decisao: 'homologado' | 'reprovado') => {
    if (!selected) return;
    if (decisao === 'reprovado' && justificativa.trim().length < 15) {
      alert('Informe o motivo da reprovação com pelo menos 15 caracteres.');
      return;
    }
    homologar.mutate(
      { id: selected.id, decisao, justificativa: justificativa.trim() },
      {
        onSuccess: (cliente) => {
          setSelected(cliente);
          setJustificativa('');
        },
        onError: (err: unknown) => alert(getComercialErrorMessage(err)),
      },
    );
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Validação clientes</h1>
        </div>
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-search-wrapper" style={{ minWidth: '240px', flex: 1 }}>
          <input
            type="text"
            placeholder="Cliente, CNPJ, município ou e-mail..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: '220px' }}
          value={filtro}
          onChange={(e) => { setFiltro(e.target.value as FiltroValidacao); setPage(1); }}
        >
          <option value="todos">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="homologado">Aprovados</option>
          <option value="reprovado">Reprovados</option>
        </select>
        <span className="reports-records-count"><strong>{totalCount}</strong> registro{totalCount === 1 ? '' : 's'}</span>
      </div>

      <QueryDataPanel
        query={clientesQuery}
        loadingMessage="Carregando validação de clientes..."
        refreshingMessage="Atualizando..."
        errorMessage="Não foi possível carregar a validação de clientes."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table comercial-browse-table comercial-validacao-table">
              <colgroup>
                <col className="col-nome" />
                <col className="col-cnpj" />
                <col className="col-produtos" />
                <col className="col-pendencia" />
                <col className="col-status" />
                <col className="col-acoes" />
              </colgroup>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CNPJ</th>
                  <th>Produtos</th>
                  <th>Pendência</th>
                  <th>Homologação</th>
                  <th aria-label="Analisar" />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : clientes.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="comercial-validacao-row"
                      onClick={() => abrir(cliente)}
                    >
                      <td className="col-nome"><strong>{cliente.razaoSocial}</strong></td>
                      <td>{cliente.cnpj || '—'}</td>
                      <td>{resumoProdutos(cliente)}</td>
                      <td className="col-pendencia" title={resumoPendencia(cliente)}>{resumoPendencia(cliente)}</td>
                      <td><ComercialHomologacaoBadge status={cliente.compatibilidade} /></td>
                      <td className="col-acoes">
                        <button type="button" className="btn-icon" title="Analisar" onClick={(e) => { e.stopPropagation(); abrir(cliente); }}>
                          <i className="bi bi-clipboard-check" />
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="comercial-validacao-page-size">Itens por página</label>
            <select
              id="comercial-validacao-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
            <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({totalCount} registros)</span>
          </span>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => setPage(1)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage <= 1 ? 0.5 : 1 }}>«</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage <= 1 ? 0.5 : 1 }}>Anterior</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage >= totalPages ? 0.5 : 1 }}>Próximo</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => setPage(totalPages)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage >= totalPages ? 0.5 : 1 }}>»</button>
        </div>
      </QueryDataPanel>

      {selected && (
        <div className="search-backdrop" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}>
          <div className="modal-card cliente-cadastro-modal comercial-homologacao-modal" style={{ width: 'min(980px, 96vw)' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="comercial-homologacao-titulo">
                <h2>Homologação de produtos</h2>
                <p>{selected.razaoSocial}</p>
              </div>
              <div className="comercial-homologacao-header-side">
                <ComercialHomologacaoBadge status={selected.compatibilidade} />
                <button type="button" className="btn-icon" onClick={fechar} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
              </div>
            </div>
            <div className="modal-body">
              {analise?.temImpeditivo ? (
                <div className="comercial-dossie-alerta is-bloqueado">
                  <strong>Impeditivos para aprovar</strong>
                  <ul>{(analise.pendencias || []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ) : null}

              <h5 className="admin-form-section-title">Produtos vinculados</h5>
              {selected.produtos.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Nenhum produto vinculado.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table comercial-browse-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Classe</th>
                        <th>ONU</th>
                        <th>Grupo</th>
                        <th>FISPQ/FDS</th>
                        <th>Conformidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.produtos.map((produto) => (
                        <tr key={produto.id || produto.nome}>
                          <td><strong>{produto.nome}</strong></td>
                          <td>{labelClasse(produto.classeRisco)}</td>
                          <td>{produto.numeroOnu || '—'}</td>
                          <td>{labelGrupo(produto.grupoEmbalagem)}</td>
                          <td>
                            {produto.fispq ? (
                              <a
                                href={hrefFispq(produto.fispq)}
                                target="_blank"
                                rel="noreferrer"
                                className="comercial-fispq-link"
                                title="Abrir FISPQ/FDS"
                                aria-label="Abrir FISPQ/FDS"
                              >
                                <i className="bi bi-link-45deg" aria-hidden="true" />
                              </a>
                            ) : '—'}
                          </td>
                          <td>
                            <span className={`comercial-pendencia-chip ${produto.conformidade?.status === 'bloqueado' ? 'is-bloqueado' : produto.conformidade?.cargaPerigosa ? 'is-alerta' : 'is-ok'}`}>
                              {conformidadeLabel(produto.conformidade?.status)}
                            </span>
                            {produto.conformidade?.alertas?.length ? (
                              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{produto.conformidade.alertas.join(' · ')}</div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {historicoQuery.data && historicoQuery.data.length > 0 ? (
                <div className="cliente-cadastro-fold" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="cliente-cadastro-fold-trigger"
                    aria-expanded={historicoAberto}
                    onClick={() => setHistoricoAberto((aberto) => !aberto)}
                  >
                    <i className={`bi ${historicoAberto ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                    <span className="admin-form-section-title" style={{ margin: 0 }}>Histórico</span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                      {historicoQuery.data.length} evento{historicoQuery.data.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {historicoAberto ? (
                    <div className="comercial-homologacao-timeline">
                      {historicoQuery.data.map((evento, indice) => {
                        const alteracoes = alteracoesDoEvento(historicoQuery.data, indice);
                        return (
                          <article key={evento.id} className="comercial-hist-item">
                            <div className="comercial-hist-top">
                              <ComercialHomologacaoBadge status={statusHistorico(evento.status)} />
                              <span className="comercial-hist-data">{formatDateTime(evento.dataCriacao)}</span>
                              <span className="comercial-hist-user">{evento.usuarioNome || 'Sistema'}</span>
                            </div>
                            {evento.justificativa ? (
                              <p className="comercial-hist-just">{evento.justificativa}</p>
                            ) : null}
                            {alteracoes.length > 0 ? (
                              <div className="comercial-hist-changes">
                                {alteracoes.map((item) => (
                                  <div key={`${evento.id}-${item.tipo}-${item.nome}`} className="comercial-hist-change">
                                    <span className={`comercial-hist-tag is-${item.tipo}`}>
                                      {HOMOLOGACAO_ALTERACAO_LABEL[item.tipo]}
                                    </span>
                                    <span className="comercial-hist-change-nome">{item.nome}</span>
                                    {item.tipo === 'alterado' && item.detalhe ? (
                                      <span className="comercial-hist-change-detalhe">{item.detalhe}</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="comercial-homologacao-form">
              {canValidate ? (
                <label className="comercial-homologacao-justificativa">
                  Justificativa
                  <textarea
                    className="form-input"
                    rows={2}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder={jaHomologado
                      ? 'Obrigatória para reprovar (mín. 15 caracteres).'
                      : 'Obrigatória na reprovação (mín. 15 caracteres). Recomendada na aprovação.'}
                  />
                </label>
              ) : null}
              <div className="comercial-homologacao-acoes">
                <button type="button" className="reports-action-btn secondary" onClick={fechar}>Fechar</button>
                {canValidate && !jaReprovado ? (
                  <button type="button" className="reports-action-btn secondary" disabled={homologar.isPending} onClick={() => decidir('reprovado')}>Reprovar</button>
                ) : null}
                {canValidate && !jaHomologado ? (
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    disabled={homologar.isPending || !podeHomologar}
                    title={!podeHomologar ? 'Regularize o nº ONU da carga perigosa antes de aprovar.' : undefined}
                    onClick={() => decidir('homologado')}
                  >
                    {homologar.isPending ? 'Registrando...' : 'Aprovar'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComercialValidacaoClientes;
