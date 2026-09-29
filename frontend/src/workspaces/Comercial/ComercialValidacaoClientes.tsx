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
import type { ClienteComercial, ClienteComercialCompatibilidade, ClienteComercialProduto, HomologacaoProdutoAlteracao } from '../../types/domain';
import {
  CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS,
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

const formatDesde = (value?: string | null) => {
  if (!value) return { data: '—', tempo: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { data: value, tempo: '' };
  const inicio = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const hoje = new Date();
  const dias = Math.max(0, Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - inicio.getTime()) / 86_400_000));
  return {
    data: date.toLocaleDateString('pt-BR'),
    tempo: dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`,
  };
};

const statusHistorico = (status: string): ClienteComercialCompatibilidade => {
  if (status === 'homologado' || status === 'reprovado') return status;
  return 'pendente_validacao';
};

const MARCO_HISTORICO: Record<ClienteComercialCompatibilidade, { titulo: string; icone: string }> = {
  homologado: { titulo: 'Homologado', icone: 'bi-check-lg' },
  reprovado: { titulo: 'Reprovado', icone: 'bi-x-lg' },
  pendente_validacao: { titulo: 'Composição alterada', icone: 'bi-arrow-repeat' },
  nao_analisado: { titulo: 'Aguardando análise', icone: 'bi-hourglass-split' },
};

const labelClasse = (value: string) =>
  CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS.find((item) => item.value === value)?.label || value || '—';

const labelClasseCurto = (value: string) => {
  if (!value || value === 'nao_classificado') return '—';
  return value;
};

const hrefFispq = (value: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const conformidadeLabel = (status?: string) => {
  if (status === 'bloqueado') return 'Bloqueado';
  if (status === 'carga_perigosa') return 'Carga perigosa';
  return 'Não perigoso';
};

const produtoDaAlteracao = (
  produtos: ClienteComercialProduto[],
  item: { tipo: string; id?: string; nome: string },
): ClienteComercialProduto => {
  const chave = (item.id || '').toLowerCase();
  const nome = item.nome.toLowerCase();
  return produtos.find((produto) => {
    const id = (produto.produtoId || produto.id || '').toLowerCase();
    return (chave && id === chave) || produto.nome.toLowerCase() === nome;
  }) || {
    id: item.id || item.nome,
    nome: item.nome,
    fispq: '',
    numeroOnu: '',
    classeRisco: 'nao_classificado',
    grupoEmbalagem: 'nao_aplicavel',
  };
};

const ProdutosHomologacaoTable: React.FC<{
  produtos: ClienteComercialProduto[];
  alteracoes?: HomologacaoProdutoAlteracao[];
}> = ({ produtos, alteracoes }) => {
  const linhas = alteracoes?.length
    ? alteracoes.map((item) => ({ produto: produtoDaAlteracao(produtos, item), alteracao: item }))
    : produtos.map((produto) => ({ produto, alteracao: undefined }));
  const comAlteracao = Boolean(alteracoes?.length);

  return (
  <div className="table-container comercial-homologacao-produtos">
    <table className={`erp-table reports-table comercial-homologacao-produtos-table${comAlteracao ? ' has-alteracao' : ''}`}>
      <colgroup>
        {comAlteracao ? <col className="col-alteracao" /> : null}
        <col className="col-produto" />
        <col className="col-classe" />
        <col className="col-onu" />
        <col className="col-grupo" />
        <col className="col-fispq" />
        <col className="col-conf" />
      </colgroup>
      <thead>
        <tr>
          {comAlteracao ? <th>Alteração</th> : null}
          <th>Produto</th>
          <th>Classe</th>
          <th>ONU</th>
          <th>Grupo</th>
          <th>FISPQ</th>
          <th>Conformidade</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(({ produto, alteracao }) => (
          <tr key={`${alteracao?.tipo || 'item'}-${produto.id || produto.nome}`} className={alteracao?.tipo === 'removido' ? 'is-removido' : undefined}>
            {comAlteracao ? (
              <td className="col-alteracao">
                {alteracao ? (
                  <span className={`comercial-hist-tag is-${alteracao.tipo}`}>
                    {HOMOLOGACAO_ALTERACAO_LABEL[alteracao.tipo]}
                  </span>
                ) : null}
              </td>
            ) : null}
            <td className="col-produto" title={alteracao?.tipo === 'alterado' ? alteracao.detalhe : produto.nome}>
              <strong>{produto.nome}</strong>
              {alteracao?.tipo === 'alterado' && alteracao.detalhe ? (
                <div className="muted comercial-homologacao-alerta">{alteracao.detalhe}</div>
              ) : null}
            </td>
            <td className="col-classe" title={labelClasse(produto.classeRisco)}>{labelClasseCurto(produto.classeRisco)}</td>
            <td className="col-onu">{produto.numeroOnu || '—'}</td>
            <td className="col-grupo">{produto.grupoEmbalagem === 'nao_aplicavel' ? '—' : (produto.grupoEmbalagem || '—')}</td>
            <td className="col-fispq">
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
            <td className="col-conf">
              {alteracao?.tipo === 'removido' ? (
                <span className="muted">—</span>
              ) : (
                <>
                  <span className={`comercial-pendencia-chip ${produto.conformidade?.status === 'bloqueado' ? 'is-bloqueado' : produto.conformidade?.cargaPerigosa ? 'is-alerta' : 'is-ok'}`}>
                    {conformidadeLabel(produto.conformidade?.status)}
                  </span>
                  {produto.conformidade?.alertas?.length ? (
                    <div className="muted comercial-homologacao-alerta">{produto.conformidade.alertas.join(' · ')}</div>
                  ) : null}
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
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

const semProdutos = (cliente: ClienteComercial) =>
  (cliente.homologacaoResumo?.produtosVinculados ?? cliente.produtosCount ?? cliente.produtos.length) === 0;

const ComercialValidacaoClientes: React.FC = () => {
  const { user } = useAuth();
  const canValidate = userHasFuncao(user, 'Comercial', 'validar-clientes');
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filtro, setFiltro] = useState<FiltroValidacao>('todos');
  const [filterClienteId, setFilterClienteId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fila, setFila] = useState<ClienteComercial[]>([]);
  const [filaPos, setFilaPos] = useState(0);
  const [selected, setSelected] = useState<ClienteComercial | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [historicoCliente, setHistoricoCliente] = useState<ClienteComercial | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const clienteLinkId = (searchParams.get('cliente') || '').trim() || null;
  const clienteLinkQuery = useClienteComercial(clienteLinkId);

  const clientesQuery = useClientesComercial({
    page,
    pageSize,
    search: search.trim() || undefined,
    fila: filtro === 'pendente' ? 'validacao' : undefined,
    homologacao: filtro === 'homologado' || filtro === 'reprovado' ? filtro : undefined,
    clienteId: filterClienteId || undefined,
  });
  const clientesFiltroQuery = useClientesComercial({ page: 1, pageSize: 100 });
  const clientesFiltro = clientesFiltroQuery.data?.results ?? [];
  const { canShowEmpty } = useAsyncQueryState(clientesQuery);
  const clientes = clientesQuery.data?.results ?? [];
  const historicoQuery = useHomologacaoHistoricoCliente(historicoCliente?.id ?? null);
  const homologar = useHomologarClienteComercial();
  const totalCount = clientesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const analise = selected?.homologacaoResumo;
  const jaHomologado = selected?.compatibilidade === 'homologado';
  const jaReprovado = selected?.compatibilidade === 'reprovado';
  const podeHomologar = Boolean(canValidate && selected && analise?.aptoHomologar && !jaHomologado);
  const alteracoes = analise?.alteracoes ?? [];
  const revalidacao = Boolean(analise?.revalidacao && alteracoes.length);

  const abrir = (cliente: ClienteComercial) => {
    setSelected(cliente);
    setJustificativa('');
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const isAllSelected = clientes.length > 0 && clientes.every((cliente) => selectedIds.includes(cliente.id));
  const temProximo = filaPos + 1 < fila.length;

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? clientes.map((cliente) => cliente.id) : []);
  };

  const homologarSelecionados = () => {
    const lista = clientes.filter((cliente) => selectedIds.includes(cliente.id));
    setIsActionsMenuOpen(false);
    if (!lista.length) return;
    setFila(lista);
    setFilaPos(0);
    abrir(lista[0]);
  };

  const abrirHistorico = () => {
    const cliente = clientes.find((item) => selectedIds.includes(item.id));
    setIsActionsMenuOpen(false);
    if (cliente) setHistoricoCliente(cliente);
  };

  const encerrar = () => {
    setSelected(null);
    setJustificativa('');
    setFila([]);
    setFilaPos(0);
    setSelectedIds([]);
    if (searchParams.get('cliente')) {
      searchParams.delete('cliente');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const fechar = () => {
    if (temProximo) {
      setFilaPos(filaPos + 1);
      abrir(fila[filaPos + 1]);
      return;
    }
    encerrar();
  };

  useEffect(() => {
    if (!clienteLinkQuery.data) return;
    setSelected(clienteLinkQuery.data);
    setJustificativa('');
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
        <div className="reports-dropdown-wrapper">
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={selectedIds.length === 0}
            onClick={() => setIsActionsMenuOpen((open) => !open)}
          >
            <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`reports-dropdown-menu ${isActionsMenuOpen ? 'show' : ''}`}>
            <span className="reports-dropdown-item" onClick={homologarSelecionados}>
              <span className="reports-dropdown-item-left">
                <i className="bi bi-clipboard-check" />
                {canValidate ? 'Homologar' : 'Visualizar homologação'}
              </span>
            </span>
            {selectedIds.length === 1 && (
              <span className="reports-dropdown-item" onClick={abrirHistorico}>
                <span className="reports-dropdown-item-left">
                  <i className="bi bi-clock-history" />
                  Histórico
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Cliente, CNPJ, município ou e-mail..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '220px' }}>
            <select
              value={filterClienteId}
              onChange={(e) => { setFilterClienteId(e.target.value); setPage(1); }}
              aria-label="Filtrar por cliente"
              style={{ width: '100%' }}
            >
              <option value="">Cliente: Todos</option>
              {clientesFiltro.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nomeFantasia || cliente.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '160px' }}>
            <select
              value={filtro}
              onChange={(e) => { setFiltro(e.target.value as FiltroValidacao); setPage(1); }}
              aria-label="Filtrar por homologação"
            >
              <option value="todos">Homologação: Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="homologado">Aprovados</option>
              <option value="reprovado">Reprovados</option>
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalCount}</strong> Cliente{totalCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={clientesQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando validação de clientes..."
        refreshingMessage="Atualizando..."
        errorMessage="Não foi possível carregar a validação de clientes."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table comercial-browse-table comercial-validacao-table">
              <colgroup>
                <col className="col-check" />
                <col className="col-nome" />
                <col className="col-cnpj" />
                <col className="col-produtos" />
                <col className="col-pendencia" />
                <col className="col-status" />
                <col className="col-desde" />
              </colgroup>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  <th>Cliente</th>
                  <th>CNPJ</th>
                  <th>Produtos</th>
                  <th>Pendência</th>
                  <th>Homologação</th>
                  <th>Desde</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && clientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cliente.id)}
                          onChange={(e) => handleSelectRow(cliente.id, e.target.checked)}
                          style={{ borderRadius: '4px' }}
                        />
                      </td>
                      <td className="col-nome"><strong>{cliente.razaoSocial}</strong></td>
                      <td>{cliente.cnpj || '—'}</td>
                      <td>
                        {semProdutos(cliente) ? <span className="muted">Nenhum</span> : resumoProdutos(cliente)}
                      </td>
                      <td className="col-pendencia" title={resumoPendencia(cliente)}>
                        {semProdutos(cliente) ? (
                          <span className="comercial-pendencia-chip is-alerta">
                            <i className="bi bi-exclamation-triangle" aria-hidden="true" style={{ marginRight: 5 }} />
                            {resumoPendencia(cliente)}
                          </span>
                        ) : resumoPendencia(cliente)}
                      </td>
                      <td><ComercialHomologacaoBadge status={cliente.compatibilidade} /></td>
                      <td className="col-desde" title={formatDateTime(cliente.homologacaoDesde)}>
                        {(() => {
                          const desde = formatDesde(cliente.homologacaoDesde);
                          return (
                            <>
                              {desde.data}
                              {desde.tempo ? <span className="comercial-desde-tempo"> · {desde.tempo}</span> : null}
                            </>
                          );
                        })()}
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
        <div className="search-backdrop" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) encerrar(); }}>
          <div className="modal-card cliente-cadastro-modal comercial-homologacao-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="comercial-homologacao-titulo">
                <h2>{revalidacao ? 'Revalidação da composição' : 'Homologação de produtos'}</h2>
                <p>
                  {selected.razaoSocial}
                  {fila.length > 1 ? <span className="muted"> · {filaPos + 1} de {fila.length}</span> : null}
                </p>
              </div>
              <div className="comercial-homologacao-header-side">
                <ComercialHomologacaoBadge status={selected.compatibilidade} />
                <button type="button" className="btn-icon" onClick={encerrar} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
              </div>
            </div>
            <div className="modal-body">
              {analise?.temImpeditivo ? (
                <div className="comercial-dossie-alerta is-bloqueado">
                  <strong>Impeditivos para aprovar</strong>
                  <ul>{(analise.pendencias || []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ) : null}

              {revalidacao ? (
                <>
                  <h5 className="admin-form-section-title">
                    Alterações
                    <span className="muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                      {alteracoes.length}
                    </span>
                  </h5>
                  <ProdutosHomologacaoTable produtos={selected.produtos} alteracoes={alteracoes} />
                </>
              ) : (
                <>
                  <h5 className="admin-form-section-title">Composição de produtos</h5>
                  {selected.produtos.length === 0 ? (
                    <div className="comercial-dossie-alerta is-bloqueado">
                      <strong>Composição de produtos pendente</strong>
                      <p style={{ margin: '4px 0 0' }}>
                        Inclua os produtos deste cliente em Cadastros › Composição de produtos para liberar a homologação.
                      </p>
                    </div>
                  ) : (
                    <ProdutosHomologacaoTable produtos={selected.produtos} />
                  )}
                </>
              )}

            </div>

            <div className="comercial-homologacao-form">
              {jaHomologado ? (
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                  Cliente homologado. Uma nova análise só é aberta quando a composição de produtos for alterada.
                </p>
              ) : canValidate ? (
                <label className="comercial-homologacao-justificativa">
                  Justificativa
                  <textarea
                    className="form-input"
                    rows={2}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Obrigatória na reprovação (mín. 15 caracteres). Recomendada na aprovação."
                  />
                </label>
              ) : null}
              <div className="comercial-homologacao-acoes">
                <button type="button" className="reports-action-btn secondary" onClick={fechar}>{temProximo ? 'Próximo' : 'Fechar'}</button>
                {canValidate && !jaReprovado && !jaHomologado ? (
                  <button type="button" className="reports-action-btn secondary" disabled={homologar.isPending} onClick={() => decidir('reprovado')}>Reprovar</button>
                ) : null}
                {canValidate && !jaHomologado ? (
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    disabled={homologar.isPending || !podeHomologar}
                    title={!podeHomologar ? (analise?.pendencias?.[0] || 'Regularize as pendências antes de aprovar.') : undefined}
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

      {historicoCliente && (
        <div className="search-backdrop" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) setHistoricoCliente(null); }}>
          <div className="modal-card cliente-cadastro-modal comercial-homologacao-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="comercial-homologacao-titulo">
                <h2>Histórico de homologação</h2>
                <p>{historicoCliente.razaoSocial}</p>
              </div>
              <div className="comercial-homologacao-header-side">
                <ComercialHomologacaoBadge status={historicoCliente.compatibilidade} />
                <button type="button" className="btn-icon" onClick={() => setHistoricoCliente(null)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
              </div>
            </div>
            <div className="modal-body">
              <QueryDataPanel
                query={historicoQuery}
                loadingMessage="Carregando histórico..."
                errorMessage="Não foi possível carregar o histórico."
              >
                {historicoQuery.data && historicoQuery.data.length > 0 ? (
                  <div className="comercial-homologacao-timeline">
                    {historicoQuery.data.map((evento, indice) => {
                      const alteracoesEvento = alteracoesDoEvento(historicoQuery.data, indice);
                      const status = statusHistorico(evento.status);
                      const marco = MARCO_HISTORICO[status];
                      return (
                        <article key={evento.id} className={`comercial-hist-item is-${status}`}>
                          <span className="comercial-hist-dot" aria-hidden="true">
                            <i className={`bi ${marco.icone}`} />
                          </span>
                          <div className="comercial-hist-body">
                          <div className="comercial-hist-top">
                            <span className="comercial-hist-titulo">{marco.titulo}</span>
                            <span className="comercial-hist-meta">
                              <span>{formatDateTime(evento.dataCriacao)}</span>
                              <span>·</span>
                              <span>{evento.usuarioNome || 'Sistema'}</span>
                            </span>
                          </div>
                          {evento.justificativa ? (
                            <p className="comercial-hist-just">{evento.justificativa}</p>
                          ) : null}
                          {alteracoesEvento.length > 0 ? (
                            <div className="comercial-hist-changes">
                              {alteracoesEvento.map((item) => (
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
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>Nenhum evento de homologação registrado.</p>
                )}
              </QueryDataPanel>
            </div>
            <div className="comercial-homologacao-form">
              <div className="comercial-homologacao-acoes">
                <button type="button" className="reports-action-btn secondary" onClick={() => setHistoricoCliente(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComercialValidacaoClientes;
