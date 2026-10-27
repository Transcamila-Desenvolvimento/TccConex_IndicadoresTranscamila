import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { getSgqAuditoriaErrorMessage } from '../../hooks/useSgqAuditorias';
import {
  useDeleteSgqNormas,
  useSaveSgqNorma,
  useSgqNormas,
  useSgqNormasResumo,
} from '../../hooks/useSgqNormas';
import type {
  SgqNorma,
  SgqNormaArea,
  SgqNormaClassificacao,
  SgqNormaOrdering,
  SgqNormaPayload,
  SgqNormaQueryParams,
} from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type FiltroSituacao = NonNullable<SgqNormaQueryParams['situacao']>;
type CampoOrdenavel = 'nome' | 'descricao' | 'data_atualizacao' | 'emissor';

const FILTROS: Array<{ value: FiltroSituacao; label: string; resumo: 'total' | 'ativa' | 'inativa' }> = [
  { value: '', label: 'Situação: Todas', resumo: 'total' },
  { value: 'ativa', label: 'Ativas', resumo: 'ativa' },
  { value: 'inativa', label: 'Inativas', resumo: 'inativa' },
];

const emptyForm: SgqNormaPayload = {
  nome: '',
  descricao: '',
  publica: false,
  ativa: true,
  classificacoes: [],
  areas: [],
};

const NOVA_CLASSIFICACAO: SgqNormaClassificacao = {
  sigla: '', nome: '', critica: false, metaPrimeira: 0, metaReavaliacao: 0,
};

function formatarData(iso: string) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SGQAuditoriasNormas: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canManage = userHasFuncao(user, 'SGQ', 'gerenciar-normas');
  const navigate = useNavigate();
  const abrirRequisitos = (norma: SgqNorma) => navigate(`/sgq/auditorias/normas/${norma.id}`);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('');
  const [ordering, setOrdering] = useState<SgqNormaOrdering>('nome');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SgqNorma | null>(null);
  const [form, setForm] = useState<SgqNormaPayload>(emptyForm);

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

  const params: SgqNormaQueryParams = { page, pageSize, search: buscaAplicada, situacao: filtroSituacao, ordering };
  const listaQuery = useSgqNormas(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const resumo = useSgqNormasResumo(selectedFilial).data;
  const salvar = useSaveSgqNorma();
  const excluir = useDeleteSgqNormas();

  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const todasDaPaginaMarcadas = linhas.length > 0 && linhas.every((linha) => selecionadas.has(linha.id));
  const algumaDaPaginaMarcada = linhas.some((linha) => selecionadas.has(linha.id));
  const filtrando = Boolean(buscaAplicada || filtroSituacao);
  const paginaAtual = Math.min(page, totalPaginas);
  const normaSelecionada = selecionadas.size === 1 ? linhas.find((linha) => selecionadas.has(linha.id)) : undefined;

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
    setOrdering((atual) => (atual === campo ? `-${campo}` : campo) as SgqNormaOrdering);
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

  const abrirEdicao = (norma: SgqNorma) => {
    setAcoesAbertas(false);
    setEditando(norma);
    setForm({
      nome: norma.nome,
      descricao: norma.descricao,
      publica: norma.publica,
      ativa: norma.ativa,
      classificacoes: norma.classificacoes.map((classe) => ({ ...classe })),
      areas: norma.areas.map((area) => ({ ...area })),
    });
    setModalAberto(true);
  };

  const alterarArea = (indice: number, alteracao: Partial<SgqNormaArea>) => {
    setForm({ ...form, areas: form.areas.map((area, i) => (i === indice ? { ...area, ...alteracao } : area)) });
  };

  const alterarClassificacao = (indice: number, alteracao: Partial<SgqNormaClassificacao>) => {
    setForm({
      ...form,
      classificacoes: form.classificacoes.map((classe, i) => (i === indice ? { ...classe, ...alteracao } : classe)),
    });
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
        onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar a norma. Tente novamente.')),
      },
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
          <h1 className="view-page-title">Normas</h1>
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
              {normaSelecionada && (
                <>
                  <span className="reports-dropdown-item" onClick={() => abrirRequisitos(normaSelecionada)}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-list-nested" aria-hidden="true" />
                      Requisitos
                    </span>
                  </span>
                  <span className="reports-dropdown-item" onClick={() => abrirEdicao(normaSelecionada)}>
                    <span className="reports-dropdown-item-left">
                      <i className={`bi ${canManage ? 'bi-pencil' : 'bi-eye'}`} aria-hidden="true" />
                      {canManage ? 'Editar' : 'Visualizar'}
                    </span>
                  </span>
                </>
              )}
              {canManage && (
                <span
                  className={`reports-dropdown-item is-danger${excluir.isPending ? ' is-disabled' : ''}`}
                  onClick={() => excluirIds([...selecionadas], selecionadas.size === 1 ? 'a norma selecionada' : `${selecionadas.size} normas`)}
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
              <span>Nova norma</span>
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
              placeholder="Buscar norma..."
              title="Busca por nome, descrição ou emissor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar normas"
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
          <span className="reports-records-count"><strong>{total}</strong> {total === 1 ? 'Norma' : 'Normas'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando normas..."
        refreshingMessage="Atualizando normas..."
        errorMessage="Não foi possível carregar as normas. Tente novamente."
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
                  <th>{cabecalhoOrdenavel('nome', 'Nome')}</th>
                  <th>{cabecalhoOrdenavel('descricao', 'Descrição')}</th>
                  <th>{cabecalhoOrdenavel('data_atualizacao', 'Última atualização')}</th>
                  <th>{cabecalhoOrdenavel('emissor', 'Emissor')}</th>
                  <th>Norma pública?</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      {filtrando ? 'Nenhuma norma encontrada para os filtros aplicados.' : 'Não há registros a serem exibidos.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((norma) => {
                    const marcada = selecionadas.has(norma.id);
                    return (
                      <tr key={norma.id} className={marcada ? 'row-selected' : undefined}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar norma ${norma.nome}`}
                            checked={marcada}
                            onChange={() => alternarSelecao(norma.id)}
                          />
                        </td>
                        <td>
                          <button type="button" className="sgq-lista-nome" onClick={() => abrirRequisitos(norma)} title="Abrir requisitos">
                            {norma.nome}
                          </button>
                        </td>
                        <td className="sgq-lista-texto-longo" title={norma.descricao || undefined}>
                          {norma.descricao || '—'}
                        </td>
                        <td>{formatarData(norma.dataAtualizacao)}</td>
                        <td>{norma.emissor || '—'}</td>
                        <td>
                          <span className={`sgq-aud-status ${norma.publica ? 'is-sim' : 'is-nao'}`}>
                            {norma.publica ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td>
                          <span className={`sgq-aud-status ${norma.ativa ? 'is-ativa' : 'is-inativa'}`}>
                            {norma.ativa ? 'Ativa' : 'Inativa'}
                          </span>
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
            <label htmlFor="sgq-normas-page-size">Itens por página</label>
            <select
              id="sgq-normas-page-size"
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
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sgq-norma-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-norma-modal-title">
                  {editando ? (canManage ? 'Editar Norma' : 'Norma') : 'Nova Norma'}
                </h3>
                <p className="sgq-aud-modal-sub">
                  {editando
                    ? `Última atualização em ${formatarData(editando.dataAtualizacao)} por ${editando.emissor || '—'}`
                    : `Data da última atualização e emissor (${user?.name || user?.username || 'você'}) são preenchidos automaticamente.`}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={fecharModal} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form className="modal-body sgq-aud-form" onSubmit={enviar}>
              <fieldset disabled={!canManage || salvar.isPending}>
                <label className="is-wide">
                  <span>Nome <em>*</em></span>
                  <input
                    className="form-input"
                    required
                    maxLength={150}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex.: ISO 9001:2015"
                    autoFocus
                  />
                </label>
                <label className="is-wide">
                  <span>Descrição</span>
                  <textarea
                    className="form-input"
                    rows={2}
                    maxLength={500}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex.: Sistemas de gestão da qualidade - Requisitos"
                  />
                </label>
                <div className="sgq-aud-status-picker" role="radiogroup" aria-label="Norma pública?">
                  <span>Norma pública?</span>
                  <div>
                    {[true, false].map((valor) => (
                      <button
                        key={String(valor)}
                        type="button"
                        role="radio"
                        aria-checked={form.publica === valor}
                        className={`sgq-aud-status ${valor ? 'is-sim' : 'is-nao'}${form.publica === valor ? ' is-picked' : ''}`}
                        onClick={() => setForm({ ...form, publica: valor })}
                      >
                        {valor ? 'Sim' : 'Não'}
                      </button>
                    ))}
                  </div>
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
                <div className="is-wide sgq-aud-campo">
                  <span>Classificações das perguntas</span>
                  {form.classificacoes.length > 0 && (
                    <ol className="sgq-norma-classes">
                      {form.classificacoes.map((classe, indice) => (
                        <li key={indice} className="sgq-norma-classe">
                          <label>
                            Sigla
                            <input
                              className="form-input"
                              required
                              maxLength={10}
                              value={classe.sigla}
                              onChange={(e) => alterarClassificacao(indice, { sigla: e.target.value.toUpperCase() })}
                              placeholder="M"
                            />
                          </label>
                          <label>
                            Nome
                            <input
                              className="form-input"
                              required
                              maxLength={60}
                              value={classe.nome}
                              onChange={(e) => alterarClassificacao(indice, { nome: e.target.value })}
                              placeholder="Mandatória"
                            />
                          </label>
                          <label className="sgq-tr-na" title="Pergunta obrigatória; uma não conformidade reprova a auditoria">
                            <input
                              type="checkbox"
                              checked={classe.critica}
                              onChange={(e) => alterarClassificacao(indice, { critica: e.target.checked })}
                            />
                            <span>Crítica</span>
                          </label>
                          <label title="Meta de conformidade na 1ª avaliação">
                            Meta 1ª (%)
                            <input
                              className="form-input"
                              type="number"
                              required
                              min={0}
                              max={100}
                              value={classe.metaPrimeira}
                              onChange={(e) => alterarClassificacao(indice, { metaPrimeira: Number(e.target.value) })}
                            />
                          </label>
                          <label title="Meta de conformidade nas reavaliações">
                            Reavaliação (%)
                            <input
                              className="form-input"
                              type="number"
                              required
                              min={0}
                              max={100}
                              value={classe.metaReavaliacao}
                              onChange={(e) => alterarClassificacao(indice, { metaReavaliacao: Number(e.target.value) })}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setForm({ ...form, classificacoes: form.classificacoes.filter((_, i) => i !== indice) })}
                            aria-label={`Remover classificação ${classe.sigla}`}
                          >
                            <i className="bi bi-trash3" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="reports-action-btn secondary sgq-tr-adicionar"
                      onClick={() => setForm({ ...form, classificacoes: [...form.classificacoes, { ...NOVA_CLASSIFICACAO }] })}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Adicionar classificação</span>
                    </button>
                  )}
                  <small className="sgq-cat-ajuda">
                    Opcional. Ex. SASSMAQ: M - Mandatória (crítica, 100%/100%), I - Indústria (70%/85%), D - Desejável (0%/40%).
                    As perguntas usam a sigla; classificação crítica torna a pergunta obrigatória.
                  </small>
                </div>
                <div className="is-wide sgq-aud-campo">
                  <span>Áreas das perguntas</span>
                  {form.areas.length > 0 && (
                    <ol className="sgq-norma-classes">
                      {form.areas.map((area, indice) => (
                        <li key={indice} className="sgq-norma-classe is-area">
                          <label>
                            Sigla
                            <input
                              className="form-input"
                              required
                              maxLength={10}
                              value={area.sigla}
                              onChange={(e) => alterarArea(indice, { sigla: e.target.value.toUpperCase() })}
                              placeholder="SS"
                            />
                          </label>
                          <label>
                            Nome
                            <input
                              className="form-input"
                              required
                              maxLength={60}
                              value={area.nome}
                              onChange={(e) => alterarArea(indice, { nome: e.target.value })}
                              placeholder="Saúde e Segurança"
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setForm({ ...form, areas: form.areas.filter((_, i) => i !== indice) })}
                            aria-label={`Remover área ${area.sigla}`}
                          >
                            <i className="bi bi-trash3" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="reports-action-btn secondary sgq-tr-adicionar"
                      onClick={() => setForm({ ...form, areas: [...form.areas, { sigla: '', nome: '' }] })}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Adicionar área</span>
                    </button>
                  )}
                  <small className="sgq-cat-ajuda">
                    Opcional. Pilares usados nos indicadores (ex. SASSMAQ: SS, MA, Q, ESG, PE); uma pergunta pode ter várias.
                  </small>
                </div>
              </fieldset>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={fecharModal} disabled={salvar.isPending}>
                  {canManage ? 'Cancelar' : 'Fechar'}
                </button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={salvar.isPending}>
                    {salvar.isPending ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Registrar Norma'}
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

export default SGQAuditoriasNormas;
