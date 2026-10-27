import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { getSgqAuditoriaErrorMessage } from '../../hooks/useSgqAuditorias';
import {
  useDeleteSgqTiposResposta,
  useSaveSgqTipoResposta,
  useSgqTiposResposta,
  useSgqTiposRespostaResumo,
} from '../../hooks/useSgqTiposResposta';
import type {
  SgqTipoResposta,
  SgqTipoRespostaOrdering,
  SgqTipoRespostaPayload,
  SgqTipoRespostaOpcao,
  SgqTipoRespostaQueryParams,
} from '../../types/domain';
import { descreverOpcoes, novaOpcao } from './sgqRespostas';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type FiltroPublica = NonNullable<SgqTipoRespostaQueryParams['publica']>;
type CampoOrdenavel = 'codigo' | 'nome' | 'emissor' | 'atualizado_em' | 'publica';

const FILTROS: Array<{ value: FiltroPublica; label: string; resumo: 'total' | 'sim' | 'nao' }> = [
  { value: '', label: 'Resposta pública: Todas', resumo: 'total' },
  { value: 'sim', label: 'Públicas', resumo: 'sim' },
  { value: 'nao', label: 'Não públicas', resumo: 'nao' },
];

const emptyForm: SgqTipoRespostaPayload = {
  nome: '',
  opcoes: [novaOpcao(100), novaOpcao(0)],
  publica: false,
};

function formatarDataHora(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const SGQAuditoriasTiposResposta: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canManage = userHasFuncao(user, 'SGQ', 'gerenciar-tipos-resposta');

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroPublica, setFiltroPublica] = useState<FiltroPublica>('');
  const [ordering, setOrdering] = useState<SgqTipoRespostaOrdering>('-codigo');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SgqTipoResposta | null>(null);
  const [form, setForm] = useState<SgqTipoRespostaPayload>(emptyForm);

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

  const params: SgqTipoRespostaQueryParams = { page, pageSize, search: buscaAplicada, publica: filtroPublica, ordering };
  const listaQuery = useSgqTiposResposta(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const resumo = useSgqTiposRespostaResumo(selectedFilial).data;
  const salvar = useSaveSgqTipoResposta();
  const excluir = useDeleteSgqTiposResposta();

  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const todasDaPaginaMarcadas = linhas.length > 0 && linhas.every((linha) => selecionados.has(linha.id));
  const algumaDaPaginaMarcada = linhas.some((linha) => selecionados.has(linha.id));
  const filtrando = Boolean(buscaAplicada || filtroPublica);
  const paginaAtual = Math.min(page, totalPaginas);
  const tipoSelecionado = selecionados.size === 1 ? linhas.find((linha) => selecionados.has(linha.id)) : undefined;

  const mudarFiltro = (valor: FiltroPublica) => {
    setFiltroPublica(valor);
    setPage(1);
    setSelecionados(new Set());
  };

  const limparFiltros = () => {
    setBusca('');
    setBuscaAplicada('');
    mudarFiltro('');
  };

  const alternarOrdenacao = (campo: CampoOrdenavel) => {
    setOrdering((atual) => (atual === campo ? `-${campo}` : campo) as SgqTipoRespostaOrdering);
    setPage(1);
  };

  const iconeOrdenacao = (campo: CampoOrdenavel) => {
    if (ordering === campo) return 'bi-arrow-up';
    if (ordering === `-${campo}`) return 'bi-arrow-down';
    return 'bi-arrow-down-up is-idle';
  };

  const alternarSelecao = (id: string) => {
    setSelecionados((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const alternarPagina = () => {
    setSelecionados((atual) => {
      const proxima = new Set(atual);
      linhas.forEach((linha) => (todasDaPaginaMarcadas ? proxima.delete(linha.id) : proxima.add(linha.id)));
      return proxima;
    });
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(emptyForm);
    setModalAberto(true);
  };

  const abrirEdicao = (tipo: SgqTipoResposta) => {
    setAcoesAbertas(false);
    setEditando(tipo);
    setForm({ nome: tipo.nome, opcoes: tipo.opcoes.map((opcao) => ({ ...opcao })), publica: tipo.publica });
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvar.isPending) return;
    setModalAberto(false);
    setEditando(null);
  };

  const alterarOpcao = (indice: number, alteracao: Partial<SgqTipoRespostaOpcao>) => {
    setForm({ ...form, opcoes: form.opcoes.map((opcao, i) => (i === indice ? { ...opcao, ...alteracao } : opcao)) });
  };

  const removerOpcao = (indice: number) => {
    setForm({ ...form, opcoes: form.opcoes.filter((_, i) => i !== indice) });
  };

  const moverOpcao = (indice: number, destino: number) => {
    const opcoes = [...form.opcoes];
    [opcoes[indice], opcoes[destino]] = [opcoes[destino], opcoes[indice]];
    setForm({ ...form, opcoes });
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    salvar.mutate(
      { id: editando?.id, payload: { ...form, nome: form.nome.trim() } },
      {
        onSuccess: () => { setModalAberto(false); setEditando(null); },
        onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar o tipo de resposta. Tente novamente.')),
      },
    );
  };

  const excluirIds = (ids: string[], descricao: string) => {
    setAcoesAbertas(false);
    if (!window.confirm(`Excluir ${descricao}? Essa ação não pode ser desfeita.`)) return;
    excluir.mutate(ids, {
      onSuccess: () => setSelecionados((atual) => {
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
          <h1 className="view-page-title">Tipos de respostas</h1>
        </div>
        <div className="sgq-lista-acoes">
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selecionados.size === 0}
              onClick={() => setAcoesAbertas((aberto) => !aberto)}
            >
              <span>Ações{selecionados.size > 0 ? ` (${selecionados.size})` : ''}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
            <div className={`reports-dropdown-menu ${acoesAbertas ? 'show' : ''}`}>
              {tipoSelecionado && (
                <span className="reports-dropdown-item" onClick={() => abrirEdicao(tipoSelecionado)}>
                  <span className="reports-dropdown-item-left">
                    <i className={`bi ${canManage ? 'bi-pencil' : 'bi-eye'}`} aria-hidden="true" />
                    {canManage ? 'Editar' : 'Visualizar'}
                  </span>
                </span>
              )}
              {canManage && (
                <span
                  className={`reports-dropdown-item is-danger${excluir.isPending ? ' is-disabled' : ''}`}
                  onClick={() => excluirIds(
                    [...selecionados],
                    tipoSelecionado ? `o tipo de resposta ${tipoSelecionado.nome}` : `${selecionados.size} tipos de resposta`,
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
            <button type="button" className="reports-action-btn primary" onClick={abrirNovo}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>Novo tipo de resposta</span>
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
              placeholder="Buscar tipo de resposta..."
              title="Busca por nome, opção de resposta ou emissor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar tipos de resposta"
            />
          </div>
          <div className="reports-select-wrapper">
            <select
              value={filtroPublica}
              onChange={(e) => mudarFiltro(e.target.value as FiltroPublica)}
              aria-label="Filtrar por resposta pública"
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
          <span className="reports-records-count">
            <strong>{total}</strong> {total === 1 ? 'Tipo de resposta' : 'Tipos de resposta'}
          </span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando tipos de resposta..."
        refreshingMessage="Atualizando tipos de resposta..."
        errorMessage="Não foi possível carregar os tipos de resposta. Tente novamente."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos da página"
                      checked={todasDaPaginaMarcadas}
                      ref={(el) => { if (el) el.indeterminate = algumaDaPaginaMarcada && !todasDaPaginaMarcadas; }}
                      onChange={alternarPagina}
                    />
                  </th>
                  <th>{cabecalhoOrdenavel('codigo', 'Código')}</th>
                  <th>{cabecalhoOrdenavel('nome', 'Nome')}</th>
                  <th>Opções de resposta</th>
                  <th>{cabecalhoOrdenavel('emissor', 'Emissor')}</th>
                  <th>{cabecalhoOrdenavel('atualizado_em', 'Última atualização')}</th>
                  <th>{cabecalhoOrdenavel('publica', 'Resposta pública?')}</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      {filtrando ? 'Nenhum tipo de resposta encontrado para os filtros aplicados.' : 'Não há registros a serem exibidos.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((tipo) => {
                    const marcado = selecionados.has(tipo.id);
                    const opcoes = descreverOpcoes(tipo.opcoes);
                    return (
                      <tr key={tipo.id} className={marcado ? 'row-selected' : undefined}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar tipo de resposta ${tipo.nome}`}
                            checked={marcado}
                            onChange={() => alternarSelecao(tipo.id)}
                          />
                        </td>
                        <td>{tipo.codigo}</td>
                        <td>
                          <button type="button" className="sgq-lista-nome" onClick={() => abrirEdicao(tipo)}>
                            {tipo.nome}
                          </button>
                        </td>
                        <td className="sgq-lista-texto-longo" title={opcoes}>{opcoes}</td>
                        <td>{tipo.emissor || '—'}</td>
                        <td>{formatarDataHora(tipo.atualizadoEm)}</td>
                        <td>
                          <span className={`sgq-aud-status ${tipo.publica ? 'is-sim' : 'is-nao'}`}>
                            {tipo.publica ? 'Sim' : 'Não'}
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
            <label htmlFor="sgq-tipos-resposta-page-size">Itens por página</label>
            <select
              id="sgq-tipos-resposta-page-size"
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
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sgq-tipo-resposta-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-tipo-resposta-modal-title">
                  {editando
                    ? `${canManage ? 'Editar Tipo de Resposta' : 'Tipo de Resposta'} ${editando.codigo}`
                    : 'Novo Tipo de Resposta'}
                </h3>
                <p className="sgq-aud-modal-sub">
                  {editando
                    ? `Emitido por ${editando.emissor || '—'} · última atualização em ${formatarDataHora(editando.atualizadoEm)}`
                    : `Código e emissor (${user?.name || user?.username || 'você'}) são preenchidos automaticamente.`}
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
                    maxLength={120}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex.: Padrão"
                    autoFocus
                  />
                </label>
                <div className="is-wide sgq-aud-campo">
                  <span>Opções de resposta <em>*</em></span>
                  <ol className="sgq-tr-opcoes">
                    {form.opcoes.map((opcao, indice) => (
                      <li key={indice} className="sgq-tr-opcao">
                        <span className="sgq-tr-opcao-num">{indice + 1}</span>
                        <input
                          className="form-input sgq-tr-codigo"
                          maxLength={10}
                          value={opcao.codigo}
                          onChange={(e) => alterarOpcao(indice, { codigo: e.target.value })}
                          placeholder="Cód."
                          title="Código digitado/importado como resposta (ex.: 1, 0, X). Vazio usa o texto."
                          aria-label={`Código da opção ${indice + 1}`}
                        />
                        <input
                          className="form-input"
                          maxLength={100}
                          value={opcao.texto}
                          onChange={(e) => alterarOpcao(indice, { texto: e.target.value })}
                          placeholder={indice === 0 ? 'Ex.: Conforme' : indice === 1 ? 'Ex.: Não conforme' : 'Opção de resposta'}
                          aria-label={`Opção ${indice + 1}`}
                        />
                        <label className="sgq-tr-valor" title="Quanto a opção vale no cálculo da aderência">
                          <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            required={opcao.valor !== null}
                            disabled={opcao.valor === null}
                            value={opcao.valor ?? ''}
                            onChange={(e) => alterarOpcao(indice, { valor: e.target.value === '' ? 0 : Number(e.target.value) })}
                            aria-label={`Valor da opção ${indice + 1} (%)`}
                          />
                          <span>%</span>
                        </label>
                        <label className="sgq-tr-na" title="A pergunta respondida com essa opção fica fora do cálculo">
                          <input
                            type="checkbox"
                            checked={opcao.valor === null}
                            onChange={(e) => alterarOpcao(indice, { valor: e.target.checked ? null : 0 })}
                          />
                          <span>N/A</span>
                        </label>
                        <label className="sgq-tr-na" title="A resposta só é aceita com justificativa do auditor">
                          <input
                            type="checkbox"
                            checked={opcao.exigeJustificativa}
                            onChange={(e) => alterarOpcao(indice, { exigeJustificativa: e.target.checked })}
                          />
                          <span>Justificar</span>
                        </label>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => moverOpcao(indice, indice - 1)}
                          disabled={indice === 0}
                          aria-label="Mover para cima"
                        >
                          <i className="bi bi-arrow-up" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => moverOpcao(indice, indice + 1)}
                          disabled={indice === form.opcoes.length - 1}
                          aria-label="Mover para baixo"
                        >
                          <i className="bi bi-arrow-down" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removerOpcao(indice)}
                          disabled={form.opcoes.length <= 2}
                          aria-label="Remover opção"
                        >
                          <i className="bi bi-trash3" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ol>
                  {canManage && (
                    <button
                      type="button"
                      className="reports-action-btn secondary sgq-tr-adicionar"
                      onClick={() => setForm({ ...form, opcoes: [...form.opcoes, novaOpcao(0)] })}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Adicionar opção</span>
                    </button>
                  )}
                  <small className="sgq-cat-ajuda">
                    Informe ao menos 2 opções, na ordem em que devem aparecer na auditoria. O código é o que se digita ou
                    importa (ex.: SASSMAQ 1, 0, X). O % é quanto a resposta conta na aderência (ex.: Conforme 100%, Parcial
                    50%, Não conforme 0%); N/A tira a pergunta do cálculo; Justificar exige justificativa do auditor.
                  </small>
                </div>
                <div className="sgq-aud-status-picker" role="radiogroup" aria-label="Resposta pública?">
                  <span>Resposta pública?</span>
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
              </fieldset>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={fecharModal} disabled={salvar.isPending}>
                  {canManage ? 'Cancelar' : 'Fechar'}
                </button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={salvar.isPending}>
                    {salvar.isPending ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Registrar Tipo de Resposta'}
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

export default SGQAuditoriasTiposResposta;
