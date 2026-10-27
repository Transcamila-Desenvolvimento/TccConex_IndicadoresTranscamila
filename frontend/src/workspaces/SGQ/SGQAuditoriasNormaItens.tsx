import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { getSgqAuditoriaErrorMessage } from '../../hooks/useSgqAuditorias';
import {
  useDeleteSgqNormaItem,
  useMoverSgqNormaItem,
  useSaveSgqNormaItem,
  useSgqNorma,
  useSgqNormaItens,
} from '../../hooks/useSgqNormas';
import { useSgqNormaTiposResposta } from '../../hooks/useSgqTiposResposta';
import type { SgqNormaItem, SgqNormaItemPayload } from '../../types/domain';
import { SGQ_NORMA_ITEM_TIPO_OPTIONS } from '../../types/domain';
import SGQNormaImportarModal from './SGQNormaImportarModal';
import { descreverOpcoes } from './sgqRespostas';

type NoArvore = { item: SgqNormaItem; numero: string; nivel: number; filhos: NoArvore[] };

const LIMITE_BUSCA = 300;

/** Seções agrupam itens no sumário; perguntas sem subitens ficam só no conteúdo. */
const ehSecao = (no: NoArvore) => no.item.tipo === 'orientativo' || no.filhos.length > 0;

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function montarArvore(itens: SgqNormaItem[]): NoArvore[] {
  const porPai = new Map<string | null, SgqNormaItem[]>();
  itens.forEach((item) => {
    const lista = porPai.get(item.parentId) ?? [];
    lista.push(item);
    porPai.set(item.parentId, lista);
  });
  const montar = (parentId: string | null, prefixo: string, nivel: number): NoArvore[] => (
    (porPai.get(parentId) ?? []).map((item, i) => {
      const numero = item.codigo || (prefixo ? `${prefixo}.${i + 1}` : String(i + 1));
      return { item, numero, nivel, filhos: montar(item.id, numero, nivel + 1) };
    })
  );
  return montar(null, '', 0);
}

function achatar(nos: NoArvore[]): NoArvore[] {
  return nos.flatMap((no) => [no, ...achatar(no.filhos)]);
}

const SGQAuditoriasNormaItens: React.FC = () => {
  const { normaId = '' } = useParams();
  const { user, selectedFilial } = useAuth();
  const canManage = userHasFuncao(user, 'SGQ', 'gerenciar-normas');

  const normaQuery = useSgqNorma(selectedFilial, normaId);
  const itensQuery = useSgqNormaItens(selectedFilial, normaId);
  const { canShowEmpty } = useAsyncQueryState(itensQuery);
  const salvar = useSaveSgqNormaItem(selectedFilial, normaId);
  const excluir = useDeleteSgqNormaItem(selectedFilial, normaId);
  const mover = useMoverSgqNormaItem(selectedFilial, normaId);
  const tiposResposta = useSgqNormaTiposResposta(selectedFilial, normaId).data;
  const classificacoes = normaQuery.data?.classificacoes ?? [];

  const [selecionadoId, setSelecionadoId] = useState<string | null | undefined>(undefined);
  const [navAbertos, setNavAbertos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const listaRef = useRef<HTMLDivElement>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [editando, setEditando] = useState<SgqNormaItem | null>(null);
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  const [form, setForm] = useState<SgqNormaItemPayload>({
    normaId, parentId: null, codigo: '', titulo: '', descricao: '', tipo: 'orientativo',
    tipoRespostaId: null, classificacao: '', areas: [], peso: 1, obrigatorio: true,
  });

  const itens = useMemo(() => itensQuery.data ?? [], [itensQuery.data]);
  const nomeTipoResposta = useMemo(
    () => new Map((tiposResposta ?? []).map((tipo) => [tipo.id, tipo.nome])),
    [tiposResposta],
  );
  const areasNorma = normaQuery.data?.areas ?? [];
  const classificacaoCritica = classificacoes.some((c) => c.sigla === form.classificacao && c.critica);
  const arvore = useMemo(() => montarArvore(itens), [itens]);
  const todos = useMemo(() => achatar(arvore), [arvore]);
  const totalPerguntas = itens.filter((item) => item.tipo === 'pergunta').length;

  const indices = useMemo(() => {
    const porId = new Map<string, NoArvore>();
    const pai = new Map<string, string | null>();
    const posicoes = new Map<string, { posicao: number; total: number }>();
    const perguntas = new Map<string, number>();
    const visitar = (nos: NoArvore[], paiId: string | null): number => nos.reduce((soma, no, posicao) => {
      porId.set(no.item.id, no);
      pai.set(no.item.id, paiId);
      posicoes.set(no.item.id, { posicao, total: nos.length });
      const internas = visitar(no.filhos, no.item.id);
      perguntas.set(no.item.id, internas);
      return soma + internas + (no.item.tipo === 'pergunta' ? 1 : 0);
    }, 0);
    visitar(arvore, null);
    return { porId, pai, posicoes, perguntas };
  }, [arvore]);

  const primeiraSecao = arvore.find(ehSecao)?.item.id ?? null;
  const selecionado = selecionadoId === undefined || (selecionadoId !== null && !indices.porId.has(selecionadoId))
    ? primeiraSecao
    : selecionadoId;
  const secao = selecionado ? indices.porId.get(selecionado) ?? null : null;

  const ancestrais = (id: string): NoArvore[] => {
    const cadeia: NoArvore[] = [];
    let atual = indices.pai.get(id) ?? null;
    while (atual) {
      const no = indices.porId.get(atual);
      if (!no) break;
      cadeia.unshift(no);
      atual = indices.pai.get(atual) ?? null;
    }
    return cadeia;
  };

  const selecionar = (id: string | null) => {
    setSelecionadoId(id);
    setBusca('');
    if (id) setNavAbertos((atual) => new Set([...atual, ...ancestrais(id).map((no) => no.item.id)]));
    listaRef.current?.scrollTo({ top: 0 });
  };

  const alternarNav = (id: string) => setNavAbertos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });

  const expandirNav = (aberto: boolean) => {
    setNavAbertos(aberto ? new Set(todos.filter(ehSecao).map((no) => no.item.id)) : new Set());
  };

  const termo = normalizar(busca.trim());
  const resultados = useMemo(() => (
    termo ? todos.filter((no) => normalizar(`${no.numero} ${no.item.titulo} ${no.item.descricao}`).includes(termo)) : []
  ), [todos, termo]);

  const conteudo = termo ? resultados.slice(0, LIMITE_BUSCA) : secao ? achatar(secao.filhos) : todos;
  const nivelBase = secao && !termo ? secao.nivel + 1 : 0;

  const opcoesPai = useMemo(() => {
    if (!editando) return todos;
    const bloqueados = new Set<string>();
    const marcar = (no: NoArvore) => { bloqueados.add(no.item.id); no.filhos.forEach(marcar); };
    const proprio = todos.find((no) => no.item.id === editando.id);
    if (proprio) marcar(proprio);
    return todos.filter((no) => !bloqueados.has(no.item.id));
  }, [todos, editando]);

  const novoForm = (parentId: string | null, base?: Partial<SgqNormaItemPayload>): SgqNormaItemPayload => ({
    normaId, parentId, codigo: '', titulo: '', descricao: '', tipo: 'orientativo',
    tipoRespostaId: null, classificacao: '', areas: [], peso: 1, obrigatorio: true, ...base,
  });

  const abrirNovo = (parentId: string | null) => {
    setEditando(null);
    setUltimoSalvo(null);
    setForm(novoForm(parentId, parentId ? { tipo: 'pergunta' } : undefined));
    setModalAberto(true);
  };

  const abrirEdicao = (item: SgqNormaItem) => {
    setEditando(item);
    setUltimoSalvo(null);
    setForm({
      normaId, parentId: item.parentId, codigo: item.codigo, titulo: item.titulo, descricao: item.descricao, tipo: item.tipo,
      tipoRespostaId: item.tipoRespostaId, classificacao: item.classificacao, areas: [...item.areas],
      peso: item.peso, obrigatorio: item.obrigatorio,
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvar.isPending) return;
    setModalAberto(false);
    setEditando(null);
  };

  const enviar = (continuar: boolean) => {
    salvar.mutate(
      { id: editando?.id, payload: { ...form, titulo: form.titulo.trim() } },
      {
        onSuccess: (salvo) => {
          if (continuar) {
            setUltimoSalvo(salvo.titulo);
            setForm(novoForm(form.parentId, {
              tipo: form.tipo,
              tipoRespostaId: form.tipoRespostaId,
              classificacao: form.classificacao,
              areas: form.areas,
              peso: form.peso,
              obrigatorio: form.obrigatorio,
            }));
          } else {
            setModalAberto(false);
            setEditando(null);
          }
        },
        onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar o item. Tente novamente.')),
      },
    );
  };

  const excluirItem = (no: NoArvore) => {
    const aviso = no.filhos.length ? ` e seus ${achatar(no.filhos).length} subitem(ns)` : '';
    if (!window.confirm(`Excluir o item ${no.numero} "${no.item.titulo}"${aviso}? Essa ação não pode ser desfeita.`)) return;
    excluir.mutate(no.item.id, {
      onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível excluir o item. Tente novamente.')),
    });
  };

  const somenteLeitura = !canManage;

  const renderAcoes = (no: NoArvore) => {
    if (!canManage) return null;
    const { item } = no;
    const { posicao, total } = indices.posicoes.get(item.id) ?? { posicao: 0, total: 1 };
    return (
      <div className="sgq-req-acoes">
        {ehSecao(no) && (
          <button type="button" className="btn-icon" title="Adicionar item nesta seção" aria-label="Adicionar item" onClick={() => abrirNovo(item.id)}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="btn-icon"
          title="Mover para cima"
          aria-label="Mover para cima"
          disabled={posicao <= 0 || mover.isPending}
          onClick={() => mover.mutate({ id: item.id, direcao: 'cima' })}
        >
          <i className="bi bi-arrow-up" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon"
          title="Mover para baixo"
          aria-label="Mover para baixo"
          disabled={posicao >= total - 1 || mover.isPending}
          onClick={() => mover.mutate({ id: item.id, direcao: 'baixo' })}
        >
          <i className="bi bi-arrow-down" aria-hidden="true" />
        </button>
        <button type="button" className="btn-icon" title="Editar" aria-label="Editar" onClick={() => abrirEdicao(item)}>
          <i className="bi bi-pencil" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon-danger"
          title="Excluir"
          aria-label="Excluir"
          disabled={excluir.isPending}
          onClick={() => excluirItem(no)}
        >
          <i className="bi bi-trash3" aria-hidden="true" />
        </button>
      </div>
    );
  };

  const renderNav = (nos: NoArvore[]): React.ReactNode => nos.filter(ehSecao).map((no) => {
    const id = no.item.id;
    const subsecoes = no.filhos.filter(ehSecao);
    const aberto = navAbertos.has(id);
    return (
      <li key={id}>
        <div
          className={`sgq-req-nav-item${!termo && selecionado === id ? ' is-active' : ''}`}
          style={{ paddingLeft: 6 + no.nivel * 14 }}
        >
          <button
            type="button"
            className={`sgq-req-nav-toggle${subsecoes.length ? '' : ' is-vazio'}`}
            onClick={() => alternarNav(id)}
            disabled={!subsecoes.length}
            aria-label={aberto ? 'Recolher' : 'Expandir'}
          >
            <i className={`bi ${aberto ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
          </button>
          <button type="button" className="sgq-req-nav-label" onClick={() => selecionar(id)} title={`${no.numero} ${no.item.titulo}`}>
            <span className="sgq-req-nav-codigo">{no.numero}</span>
            <span className="sgq-req-nav-titulo">{no.item.titulo}</span>
            <span className="sgq-req-nav-count">{indices.perguntas.get(id) ?? 0}</span>
          </button>
        </div>
        {aberto && subsecoes.length > 0 && <ul>{renderNav(no.filhos)}</ul>}
      </li>
    );
  });

  const renderLinha = (no: NoArvore) => {
    const { item } = no;
    const recuo = 16 + (termo ? 0 : Math.max(0, no.nivel - nivelBase) * 22);
    if (ehSecao(no)) {
      return (
        <div key={item.id} className={`sgq-req-grupo${no.nivel === nivelBase && !termo ? ' is-topo' : ''}`} style={{ paddingLeft: recuo }}>
          <button type="button" className="sgq-req-grupo-titulo" onClick={() => selecionar(item.id)} title="Abrir seção">
            <span className="sgq-req-codigo">{no.numero}</span>
            <span>{item.titulo}</span>
          </button>
          <span className="sgq-req-contagem">{indices.perguntas.get(item.id) ?? 0} perguntas</span>
          {renderAcoes(no)}
        </div>
      );
    }
    return (
      <div key={item.id} className="sgq-req-pergunta" style={{ paddingLeft: recuo }}>
        <span className="sgq-req-codigo">{no.numero}</span>
        <div className="sgq-req-pergunta-corpo">
          {termo && <span className="sgq-req-caminho">{ancestrais(item.id).map((a) => a.numero).join(' › ') || 'Requisito principal'}</span>}
          <button type="button" className="sgq-req-pergunta-titulo" onClick={() => abrirEdicao(item)}>
            {item.titulo}
          </button>
          {item.descricao && <p className="sgq-req-pergunta-desc" title={item.descricao}>{item.descricao}</p>}
          <span className="sgq-req-meta">
            {item.classificacao && (<><span className="sgq-req-classe">{item.classificacao}</span><span aria-hidden="true">·</span></>)}
            {item.areas.length > 0 && (<>{item.areas.join(' · ')}<span aria-hidden="true">·</span></>)}
            {(item.tipoRespostaId && nomeTipoResposta.get(item.tipoRespostaId)) || 'Sem tipo de resposta'}
            <span aria-hidden="true">·</span>
            Peso {item.peso.toLocaleString('pt-BR')}
            {!item.obrigatorio && (<><span aria-hidden="true">·</span>Opcional</>)}
          </span>
        </div>
        {renderAcoes(no)}
      </div>
    );
  };

  const botaoImportar = canManage && (
    <button type="button" className="reports-action-btn secondary" onClick={() => setImportarAberto(true)}>
      <i className="bi bi-file-earmark-arrow-up" aria-hidden="true" />
      <span>Importar planilha</span>
    </button>
  );

  return (
    <div className="sgq-aud-page">
      <header className="sgq-aud-header">
        <div>
          <Link to="/sgq/auditorias/normas" className="sgq-norma-voltar">
            <i className="bi bi-arrow-left" aria-hidden="true" /> Normas
          </Link>
          <h1 className="view-page-title">{normaQuery.data?.nome ?? 'Norma'}</h1>
          <p className="sgq-aud-subtitle">
            {normaQuery.data?.descricao || 'Requisitos e subitens da norma.'}
            {itens.length > 0 && ` · ${itens.length} item(ns), ${totalPerguntas} pergunta(s)`}
          </p>
        </div>
        {canManage && (
          <div className="sgq-norma-header-acoes">
            {botaoImportar}
            <button type="button" className="reports-action-btn primary" onClick={() => abrirNovo(null)}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>Novo requisito</span>
            </button>
          </div>
        )}
      </header>

      <QueryDataPanel
        query={itensQuery}
        loadingMessage="Carregando requisitos..."
        refreshingMessage="Atualizando requisitos..."
        errorMessage="Não foi possível carregar os requisitos. Tente novamente."
      >
        {canShowEmpty && itens.length === 0 ? (
          <div className="sgq-aud-table-card">
              <div className="sgq-aud-empty">
                <i className="bi bi-list-nested" aria-hidden="true" />
                <strong>Nenhum requisito cadastrado</strong>
                <span>Cadastre os requisitos da norma e, dentro deles, os subitens e perguntas, ou importe uma lista de verificação em Excel.</span>
                {canManage && (
                  <div className="sgq-norma-header-acoes">
                    {botaoImportar}
                    <button type="button" className="reports-action-btn primary" onClick={() => abrirNovo(null)}>
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Novo requisito</span>
                    </button>
                  </div>
                )}
              </div>
          </div>
        ) : (
          <div className="sgq-req-layout">
            <aside className="sgq-req-nav" aria-label="Sumário da norma">
              <div className="sgq-req-nav-header">
                <label className="sgq-req-busca">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar código ou texto..."
                    aria-label="Buscar itens da norma"
                  />
                </label>
                <div className="sgq-req-nav-tools">
                  <span>Sumário</span>
                  <button type="button" className="btn-icon" title="Expandir tudo" aria-label="Expandir tudo" onClick={() => expandirNav(true)}>
                    <i className="bi bi-arrows-expand" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-icon" title="Recolher tudo" aria-label="Recolher tudo" onClick={() => expandirNav(false)}>
                    <i className="bi bi-arrows-collapse" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <ul className="sgq-req-nav-lista">
                <li>
                  <div className={`sgq-req-nav-item${!termo && selecionado === null ? ' is-active' : ''}`} style={{ paddingLeft: 6 }}>
                    <span className="sgq-req-nav-toggle is-vazio" />
                    <button type="button" className="sgq-req-nav-label" onClick={() => selecionar(null)}>
                      <span className="sgq-req-nav-titulo">Todos os itens</span>
                      <span className="sgq-req-nav-count">{totalPerguntas}</span>
                    </button>
                  </div>
                </li>
                {renderNav(arvore)}
              </ul>
            </aside>

            <section className="sgq-req-conteudo">
              <div className="sgq-req-conteudo-header">
                {termo ? (
                  <div className="sgq-req-secao-info">
                    <h2 className="sgq-req-secao-titulo">
                      {resultados.length} resultado(s) para “{busca.trim()}”
                    </h2>
                    {resultados.length > LIMITE_BUSCA && (
                      <p className="sgq-req-secao-desc">Mostrando os primeiros {LIMITE_BUSCA}. Refine a busca para ver os demais.</p>
                    )}
                  </div>
                ) : secao ? (
                  <div className="sgq-req-secao-info">
                    <nav className="sgq-req-breadcrumb" aria-label="Caminho da seção">
                      <button type="button" onClick={() => selecionar(null)}>Todos</button>
                      {ancestrais(secao.item.id).map((no) => (
                        <React.Fragment key={no.item.id}>
                          <i className="bi bi-chevron-right" aria-hidden="true" />
                          <button type="button" onClick={() => selecionar(no.item.id)} title={no.item.titulo}>
                            {no.numero} {no.item.titulo}
                          </button>
                        </React.Fragment>
                      ))}
                    </nav>
                    <h2 className="sgq-req-secao-titulo">
                      <span className="sgq-aud-codigo">{secao.numero}</span>
                      {secao.item.titulo}
                    </h2>
                    {secao.item.descricao && secao.item.descricao !== secao.item.titulo && (
                      <p className="sgq-req-secao-desc">{secao.item.descricao}</p>
                    )}
                    <span className="sgq-req-secao-meta">{indices.perguntas.get(secao.item.id) ?? 0} pergunta(s) nesta seção</span>
                  </div>
                ) : (
                  <div className="sgq-req-secao-info">
                    <h2 className="sgq-req-secao-titulo">Todos os itens</h2>
                    <span className="sgq-req-secao-meta">{itens.length} itens · {totalPerguntas} perguntas</span>
                  </div>
                )}
                {!termo && secao && canManage && (
                  <div className="sgq-req-secao-acoes">
                    <button type="button" className="reports-action-btn secondary" onClick={() => abrirEdicao(secao.item)}>
                      <i className="bi bi-pencil" aria-hidden="true" />
                      <span>Editar seção</span>
                    </button>
                    <button type="button" className="reports-action-btn primary" onClick={() => abrirNovo(secao.item.id)}>
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Adicionar item</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="sgq-req-lista" ref={listaRef}>
                {conteudo.length === 0 ? (
                  <div className="sgq-req-vazio">
                    <i className={`bi ${termo ? 'bi-search' : 'bi-inbox'}`} aria-hidden="true" />
                    <span>{termo ? 'Nenhum item encontrado.' : 'Esta seção ainda não tem itens.'}</span>
                  </div>
                ) : conteudo.map(renderLinha)}
              </div>
            </section>
          </div>
        )}
      </QueryDataPanel>

      {modalAberto && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) fecharModal(); }}>
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sgq-item-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-item-modal-title">
                  {editando ? (canManage ? 'Editar item da norma' : 'Item da norma') : 'Novo item da norma'}
                </h3>
                {ultimoSalvo && <p className="sgq-aud-modal-sub">Salvo: {ultimoSalvo}</p>}
              </div>
              <button type="button" className="btn-icon" onClick={fecharModal} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form className="modal-body sgq-aud-form" onSubmit={(e) => { e.preventDefault(); enviar(false); }}>
              <fieldset disabled={somenteLeitura || salvar.isPending}>
                <label className="is-wide">
                  <span>Título <em>*</em></span>
                  <textarea
                    className="form-input"
                    required
                    rows={2}
                    maxLength={500}
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex.: REQUISITO 1"
                    autoFocus
                  />
                  <small className="sgq-norma-contador">{form.titulo.length} / 500</small>
                </label>
                <label className="is-wide">
                  <span>Descrição</span>
                  <textarea
                    className="form-input"
                    rows={3}
                    maxLength={4000}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                  <small className="sgq-norma-contador">{form.descricao.length} / 4000</small>
                </label>
                <label>
                  <span>Código</span>
                  <input
                    className="form-input"
                    maxLength={30}
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="Automático (ex.: 1.2.1a)"
                  />
                </label>
                <label>
                  <span>Pertence à</span>
                  <select
                    className="form-input"
                    value={form.parentId ?? ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                  >
                    <option value="">— Nenhum (requisito principal)</option>
                    {opcoesPai.map((no) => (
                      <option key={no.item.id} value={no.item.id}>
                        {`${'\u00A0\u00A0'.repeat(no.nivel)}${no.numero} ${no.item.titulo}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    className="form-input"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as SgqNormaItemPayload['tipo'] })}
                  >
                    {SGQ_NORMA_ITEM_TIPO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                {form.tipo === 'pergunta' && (
                  <>
                    <label>
                      <span>Tipo de resposta <em>*</em></span>
                      <select
                        className="form-input"
                        required
                        value={form.tipoRespostaId ?? ''}
                        onChange={(e) => setForm({ ...form, tipoRespostaId: e.target.value || null })}
                      >
                        <option value="">Selecione...</option>
                        {(tiposResposta ?? []).map((tipo) => (
                          <option key={tipo.id} value={tipo.id} title={descreverOpcoes(tipo.opcoes)}>
                            {tipo.codigo} - {tipo.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    {classificacoes.length > 0 && (
                      <label>
                        <span>Classificação</span>
                        <select
                          className="form-input"
                          value={form.classificacao}
                          onChange={(e) => setForm({ ...form, classificacao: e.target.value })}
                        >
                          <option value="">— Sem classificação</option>
                          {classificacoes.map((c) => (
                            <option key={c.sigla} value={c.sigla}>{c.sigla} - {c.nome}{c.critica ? ' (crítica)' : ''}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {areasNorma.length > 0 && (
                      <div className="is-wide sgq-aud-campo">
                        <span>Áreas</span>
                        <div className="sgq-norma-areas-picker">
                          {areasNorma.map((area) => (
                            <label key={area.sigla} className="sgq-tr-na" title={area.nome}>
                              <input
                                type="checkbox"
                                checked={form.areas.includes(area.sigla)}
                                onChange={(e) => setForm({
                                  ...form,
                                  areas: e.target.checked
                                    ? [...form.areas, area.sigla]
                                    : form.areas.filter((sigla) => sigla !== area.sigla),
                                })}
                              />
                              <span>{area.sigla} - {area.nome}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <label>
                      <span>Peso</span>
                      <input
                        className="form-input"
                        type="number"
                        min={0.01}
                        step={0.01}
                        required
                        value={form.peso}
                        onChange={(e) => setForm({ ...form, peso: Number(e.target.value) })}
                      />
                    </label>
                    <p className="is-wide sgq-norma-aviso">
                      <i className="bi bi-info-circle" aria-hidden="true" /> O peso do item é usado no cálculo de aderência,
                      multiplicado pela pontuação da resposta.
                    </p>
                    <label className="is-wide sgq-norma-switch">
                      <input
                        type="checkbox"
                        checked={form.obrigatorio || classificacaoCritica}
                        disabled={classificacaoCritica}
                        onChange={(e) => setForm({ ...form, obrigatorio: e.target.checked })}
                      />
                      <span>Item obrigatório{classificacaoCritica ? ' (classificação crítica)' : ''}</span>
                    </label>
                  </>
                )}
              </fieldset>

              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={fecharModal} disabled={salvar.isPending}>
                  {canManage ? 'Cancelar' : 'Fechar'}
                </button>
                {canManage && !editando && (
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    disabled={salvar.isPending}
                    onClick={(e) => { if (e.currentTarget.form?.reportValidity()) enviar(true); }}
                  >
                    Salvar e adicionar outro
                  </button>
                )}
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={salvar.isPending}>
                    {salvar.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {importarAberto && (
        <SGQNormaImportarModal
          filial={selectedFilial}
          normaId={normaId}
          tiposResposta={tiposResposta ?? []}
          itensExistentes={itens.length}
          onClose={() => setImportarAberto(false)}
          onImportado={() => { setSelecionadoId(undefined); setNavAbertos(new Set()); setBusca(''); }}
        />
      )}
    </div>
  );
};

export default SGQAuditoriasNormaItens;
