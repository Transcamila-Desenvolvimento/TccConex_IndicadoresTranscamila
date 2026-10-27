import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { getSgqAuditoriaErrorMessage } from '../../hooks/useSgqAuditorias';
import {
  useDeleteSgqCategorias,
  useSaveSgqCategoria,
  useSgqCategorias,
  useSgqCategoriasResumo,
  useSgqCategoriasSugestoes,
} from '../../hooks/useSgqCategorias';
import type { SgqCategoria, SgqCategoriaOrdering, SgqCategoriaPayload, SgqCategoriaQueryParams } from '../../types/domain';
import SGQNormasPicker from './SGQNormasPicker';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type FiltroSituacao = NonNullable<SgqCategoriaQueryParams['situacao']>;
type CampoOrdenavel = 'nome' | 'ativa' | 'emissor' | 'atualizado_por';

const FILTROS: Array<{ value: FiltroSituacao; label: string; resumo: 'total' | 'ativa' | 'inativa' }> = [
  { value: '', label: 'Situação: Todas', resumo: 'total' },
  { value: 'ativa', label: 'Ativas', resumo: 'ativa' },
  { value: 'inativa', label: 'Inativas', resumo: 'inativa' },
];

const emptyForm: SgqCategoriaPayload = {
  nome: '',
  normaIds: [],
  ativa: true,
};

const SGQAuditoriasCategorias: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canManage = userHasFuncao(user, 'SGQ', 'gerenciar-categorias');

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('');
  const [ordering, setOrdering] = useState<SgqCategoriaOrdering>('nome');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SgqCategoria | null>(null);
  const [form, setForm] = useState<SgqCategoriaPayload>(emptyForm);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (!acoesAbertas) return;
    const fechar = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) setAcoesAbertas(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [acoesAbertas]);

  const params: SgqCategoriaQueryParams = { page, pageSize, search: buscaAplicada, situacao: filtroSituacao, ordering };
  const listaQuery = useSgqCategorias(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const resumo = useSgqCategoriasResumo(selectedFilial).data;
  const sugestoesQuery = useSgqCategoriasSugestoes(selectedFilial, modalAberto);
  const salvar = useSaveSgqCategoria();
  const excluir = useDeleteSgqCategorias();

  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const todasDaPaginaMarcadas = linhas.length > 0 && linhas.every((linha) => selecionadas.has(linha.id));
  const algumaDaPaginaMarcada = linhas.some((linha) => selecionadas.has(linha.id));
  const filtrando = Boolean(buscaAplicada || filtroSituacao);
  const paginaAtual = Math.min(page, totalPaginas);
  const categoriaSelecionada = selecionadas.size === 1 ? linhas.find((linha) => selecionadas.has(linha.id)) : undefined;

  const mudarFiltro = (valor: FiltroSituacao) => {
    setFiltroSituacao(valor);
    setPage(1);
    setSelecionadas(new Set());
  };

  const limparFiltros = () => {
    setBusca('');
    setBuscaAplicada('');
    mudarFiltro('');
  };

  const alternarOrdenacao = (campo: CampoOrdenavel) => {
    setOrdering((atual) => (atual === campo ? `-${campo}` : campo) as SgqCategoriaOrdering);
    setPage(1);
  };

  const iconeOrdenacao = (campo: CampoOrdenavel) => {
    if (ordering === campo) return 'bi-arrow-up';
    if (ordering === `-${campo}`) return 'bi-arrow-down';
    return 'bi-arrow-down-up is-idle';
  };

  const alternarSelecao = (id: string) => {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const alternarPagina = () => {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      linhas.forEach((linha) => (todasDaPaginaMarcadas ? proxima.delete(linha.id) : proxima.add(linha.id)));
      return proxima;
    });
  };

  const abrirNova = () => {
    setEditando(null);
    setForm(emptyForm);
    setModalAberto(true);
  };

  const abrirEdicao = (categoria: SgqCategoria) => {
    setAcoesAbertas(false);
    setEditando(categoria);
    setForm({ nome: categoria.nome, normaIds: categoria.normas.map((norma) => norma.id), ativa: categoria.ativa });
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvar.isPending) return;
    setModalAberto(false);
    setEditando(null);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    salvar.mutate(
      { id: editando?.id, payload: { ...form, nome: form.nome.trim() } },
      {
        onSuccess: () => { setModalAberto(false); setEditando(null); },
        onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar a categoria. Tente novamente.')),
      },
    );
  };

  const alternarSituacao = (categoria: SgqCategoria) => {
    setAcoesAbertas(false);
    salvar.mutate(
      { id: categoria.id, payload: { nome: categoria.nome, normaIds: categoria.normas.map((norma) => norma.id), ativa: !categoria.ativa } },
      { onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível alterar a situação. Tente novamente.')) },
    );
  };

  const excluirIds = (ids: string[], descricao: string) => {
    setAcoesAbertas(false);
    if (!window.confirm(`Excluir ${descricao}? Essa ação não pode ser desfeita.`)) return;
    excluir.mutate(ids, {
      onSuccess: () => setSelecionadas((atual) => {
        const proxima = new Set(atual);
        ids.forEach((id) => proxima.delete(id));
        return proxima;
      }),
      onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível excluir. Tente novamente.')),
    });
  };

  const cabecalhoOrdenavel = (campo: CampoOrdenavel, rotulo: string) => (
    <button type="button" className="sgq-aud-sort" onClick={() => alternarOrdenacao(campo)}>
      {rotulo} <i className={`bi ${iconeOrdenacao(campo)}`} aria-hidden="true" />
    </button>
  );

  return (
    <div className="fat-list-compact sgq-lista">
      <header className="view-header sgq-lista-header">
        <div className="sgq-lista-titulo">
          <span className="sgq-lista-marcador" aria-hidden="true" />
          <h1 className="view-page-title">Categorias</h1>
        </div>
        <div className="sgq-lista-acoes">
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selecionadas.size === 0}
              onClick={() => setAcoesAbertas((aberto) => !aberto)}
            >
              <span>Ações{selecionadas.size > 0 ? ` (${selecionadas.size})` : ''}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
            <div className={`reports-dropdown-menu ${acoesAbertas ? 'show' : ''}`}>
              {categoriaSelecionada && (
                <span className="reports-dropdown-item" onClick={() => abrirEdicao(categoriaSelecionada)}>
                  <span className="reports-dropdown-item-left">
                    <i className={`bi ${canManage ? 'bi-pencil' : 'bi-eye'}`} aria-hidden="true" />
                    {canManage ? 'Editar' : 'Visualizar'}
                  </span>
                </span>
              )}
              {canManage && categoriaSelecionada && (
                <span
                  className={`reports-dropdown-item${salvar.isPending ? ' is-disabled' : ''}`}
                  onClick={() => alternarSituacao(categoriaSelecionada)}
                >
                  <span className="reports-dropdown-item-left">
                    <i className={`bi ${categoriaSelecionada.ativa ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
                    {categoriaSelecionada.ativa ? 'Inativar' : 'Ativar'}
                  </span>
                </span>
              )}
              {canManage && (
                <span
                  className={`reports-dropdown-item is-danger${excluir.isPending ? ' is-disabled' : ''}`}
                  onClick={() => excluirIds(
                    [...selecionadas],
                    categoriaSelecionada ? `a categoria ${categoriaSelecionada.nome}` : `${selecionadas.size} categorias`,
                  )}
                >
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-trash3" aria-hidden="true" />
                    {excluir.isPending ? 'Excluindo...' : 'Excluir'}
                  </span>
                </span>
              )}
            </div>
          </div>
          {canManage && (
            <button type="button" className="reports-action-btn primary" onClick={abrirNova}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>Nova categoria</span>
            </button>
          )}
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <i className="bi bi-funnel" aria-hidden="true" />
            <span>Filtrar</span>
          </div>
          <div className="reports-search-wrapper">
            <i className="bi bi-search search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar categoria..."
              title="Busca por título, norma, emissor ou quem atualizou"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar categorias"
            />
          </div>
          <div className="reports-select-wrapper">
            <select
              value={filtroSituacao}
              onChange={(e) => mudarFiltro(e.target.value as FiltroSituacao)}
              aria-label="Filtrar por situação"
            >
              {FILTROS.map((filtro) => (
                <option key={filtro.value || 'todas'} value={filtro.value}>
                  {filtro.label}{resumo ? ` (${resumo[filtro.resumo]})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="reports-action-btn secondary" onClick={limparFiltros} disabled={!filtrando && !busca}>
            Limpar Filtros
          </button>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{total}</strong> {total === 1 ? 'Categoria' : 'Categorias'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando categorias..."
        refreshingMessage="Atualizando categorias..."
        errorMessage="Não foi possível carregar as categorias. Tente novamente."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas da página"
                      checked={todasDaPaginaMarcadas}
                      ref={(el) => { if (el) el.indeterminate = algumaDaPaginaMarcada && !todasDaPaginaMarcadas; }}
                      onChange={alternarPagina}
                    />
                  </th>
                  <th>{cabecalhoOrdenavel('nome', 'Título')}</th>
                  <th>Normas</th>
                  <th>{cabecalhoOrdenavel('ativa', 'Situação')}</th>
                  <th>{cabecalhoOrdenavel('emissor', 'Emissor')}</th>
                  <th>{cabecalhoOrdenavel('atualizado_por', 'Atualizado por')}</th>
                  <th>Auditorias</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      {filtrando ? 'Nenhuma categoria encontrada para os filtros aplicados.' : 'Não há registros a serem exibidos.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((categoria) => {
                    const marcada = selecionadas.has(categoria.id);
                    return (
                      <tr key={categoria.id} className={marcada ? 'row-selected' : undefined}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar categoria ${categoria.nome}`}
                            checked={marcada}
                            onChange={() => alternarSelecao(categoria.id)}
                          />
                        </td>
                        <td>
                          <button type="button" className="sgq-lista-nome" onClick={() => abrirEdicao(categoria)}>
                            {categoria.nome}
                          </button>
                        </td>
                        <td>
                          {categoria.normas.length ? (
                            <div className="sgq-aud-normas">
                              {categoria.normas.slice(0, 2).map((norma) => <span key={norma.id} className="sgq-aud-chip">{norma.nome}</span>)}
                              {categoria.normas.length > 2 && (
                                <span className="sgq-aud-chip is-more" title={categoria.normas.slice(2).map((norma) => norma.nome).join(', ')}>
                                  +{categoria.normas.length - 2}
                                </span>
                              )}
                            </div>
                          ) : <span className="sgq-aud-muted">—</span>}
                        </td>
                        <td>
                          <span className={`sgq-aud-status ${categoria.ativa ? 'is-ativa' : 'is-inativa'}`}>
                            {categoria.ativa ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td>{categoria.emissor || '—'}</td>
                        <td>{categoria.atualizadoPor || '—'}</td>
                        <td>{categoria.totalAuditorias}</td>
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
            <label htmlFor="sgq-categorias-page-size">Itens por página</label>
            <select
              id="sgq-categorias-page-size"
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

      {modalAberto && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) fecharModal(); }}>
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sgq-categoria-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-categoria-modal-title">
                  {editando ? (canManage ? 'Editar Categoria' : 'Categoria') : 'Nova Categoria'}
                </h3>
                <p className="sgq-aud-modal-sub">
                  {editando
                    ? `Emitida por ${editando.emissor || '—'} · atualizada por ${editando.atualizadoPor || '—'}`
                    : `Emissor (${user?.name || user?.username || 'você'}) é preenchido automaticamente.`}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={fecharModal} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form className="modal-body sgq-aud-form" onSubmit={enviar}>
              <fieldset disabled={!canManage || salvar.isPending}>
                <label className="is-wide">
                  <span>Título <em>*</em></span>
                  <input
                    className="form-input"
                    required
                    maxLength={120}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex.: Auditoria interna"
                    autoFocus
                  />
                  {editando && editando.totalAuditorias > 0 && editando.nome !== form.nome.trim() && (
                    <small className="sgq-cat-aviso">
                      O novo título será aplicado às {editando.totalAuditorias} auditorias desta categoria.
                    </small>
                  )}
                </label>
                <div className="is-wide sgq-aud-campo">
                  <span>Normas</span>
                  <SGQNormasPicker
                    opcoes={sugestoesQuery.data?.normas ?? []}
                    vinculadas={editando?.normas}
                    value={form.normaIds}
                    onChange={(normaIds) => setForm({ ...form, normaIds })}
                    disabled={!canManage || salvar.isPending}
                    carregando={sugestoesQuery.isLoading}
                    podeCadastrar={userHasFuncao(user, 'SGQ', 'gerenciar-normas')}
                  />
                  <small className="sgq-cat-ajuda">Ao criar uma auditoria desta categoria, essas normas já vêm vinculadas.</small>
                </div>
                <div className="sgq-aud-status-picker" role="radiogroup" aria-label="Situação">
                  <span>Situação</span>
                  <div>
                    {[true, false].map((valor) => (
                      <button
                        key={String(valor)}
                        type="button"
                        role="radio"
                        aria-checked={form.ativa === valor}
                        className={`sgq-aud-status ${valor ? 'is-ativa' : 'is-inativa'}${form.ativa === valor ? ' is-picked' : ''}`}
                        onClick={() => setForm({ ...form, ativa: valor })}
                      >
                        <i className={`bi ${valor ? 'bi-check-circle-fill' : 'bi-slash-circle'}`} aria-hidden="true" />
                        {valor ? 'Ativa' : 'Inativa'}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={fecharModal} disabled={salvar.isPending}>
                  {canManage ? 'Cancelar' : 'Fechar'}
                </button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={salvar.isPending}>
                    {salvar.isPending ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Registrar Categoria'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SGQAuditoriasCategorias;
