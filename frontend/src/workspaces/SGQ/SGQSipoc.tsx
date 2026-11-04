import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { getFrotaErrorMessage } from '../../hooks/useFrotaOlhoVivo';
import {
  useCriarSgqSipocProcedimento,
  useCriarSgqSipocSetor,
  useExcluirSgqSipocProcedimento,
  useExcluirSgqSipocSetor,
  useSalvarSgqSipocProcedimento,
  useSgqSipocProcedimentos,
  useSgqSipocSetores,
} from '../../hooks/useSgqSipoc';

function dataAtualizacao(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

const Criador: React.FC<{ nome: string; foto?: string }> = ({ nome, foto }) => {
  const [falhou, setFalhou] = useState(false);
  const url = foto?.trim();
  useEffect(() => setFalhou(false), [url]);
  if (!nome) return <>—</>;
  return (
    <span className="sgq-pessoa-resumo" title={nome}>
      {url && !falhou ? (
        <span className="sgq-pessoa-avatar" aria-hidden="true">
          <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
        </span>
      ) : (
        <span className="sgq-pessoa-avatar" aria-hidden="true">{iniciais(nome)}</span>
      )}
      <span className="sgq-pessoa-nome">{nome}</span>
    </span>
  );
};

const SGQSipoc: React.FC = () => {
  const navigate = useNavigate();
  const acoesRef = useRef<HTMLDivElement>(null);
  const [setorId, setSetorId] = useState<number | ''>('');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [modal, setModal] = useState<'procedimento' | 'setores' | 'editar' | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeSetor, setNomeSetor] = useState('');
  const [nomeProcedimento, setNomeProcedimento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setorNovo, setSetorNovo] = useState<number | ''>('');
  const setores = useSgqSipocSetores();
  const procedimentos = useSgqSipocProcedimentos(setorId, busca.trim());
  const criarSetor = useCriarSgqSipocSetor();
  const excluirSetor = useExcluirSgqSipocSetor();
  const criarProcedimento = useCriarSgqSipocProcedimento();
  const salvarProcedimento = useSalvarSgqSipocProcedimento();
  const excluirProcedimento = useExcluirSgqSipocProcedimento();
  const linhas = procedimentos.data?.results ?? [];
  const listaSetores = setores.data?.results ?? [];
  const filtrando = setorId !== '' || busca.trim() !== '';

  useEffect(() => {
    if (!acoesAbertas) return undefined;
    const fechar = (event: MouseEvent) => {
      if (!acoesRef.current?.contains(event.target as Node)) setAcoesAbertas(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [acoesAbertas]);

  function falha(err: unknown) {
    alert(getFrotaErrorMessage(err));
  }

  function abrirEdicao() {
    const item = linhas.find((linha) => linha.id === [...selecionados][0]);
    if (!item) return;
    setEditandoId(item.id);
    setNomeProcedimento(item.nome);
    setDescricao(item.descricao);
    setSetorNovo(item.setorId);
    setAcoesAbertas(false);
    setModal('editar');
  }

  function abrirNovo() {
    setNomeProcedimento('');
    setDescricao('');
    setSetorNovo(setorId);
    setModal('procedimento');
  }

  function excluirSelecionados() {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    const unico = ids.length === 1 ? linhas.find((item) => item.id === ids[0]) : undefined;
    const texto = unico ? `o procedimento ${unico.nome}` : `${ids.length} procedimentos`;
    if (!window.confirm(`Excluir ${texto}?`)) return;
    setAcoesAbertas(false);
    ids.forEach((id) => {
      excluirProcedimento.mutate(id, {
        onSuccess: () => setSelecionados((atual) => {
          const proxima = new Set(atual);
          proxima.delete(id);
          return proxima;
        }),
        onError: falha,
      });
    });
  }

  const todosMarcados = linhas.length > 0 && linhas.every((item) => selecionados.has(item.id));
  const algumMarcado = linhas.some((item) => selecionados.has(item.id));

  return (
    <div className="fat-list-compact sgq-lista">
      <header className="view-header sgq-lista-header">
        <div className="sgq-lista-titulo">
          <span className="sgq-lista-marcador" aria-hidden="true" />
          <h1 className="view-page-title">SIPOC</h1>
        </div>
        <div className="sgq-lista-acoes">
          <button type="button" className="reports-action-btn secondary" onClick={() => setModal('setores')}>
            <i className="bi bi-diagram-3" aria-hidden="true" />
            <span>Setores</span>
          </button>
          <div className="reports-dropdown-wrapper" ref={acoesRef}>
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
              {selecionados.size === 1 && (
                <span className="reports-dropdown-item" onClick={abrirEdicao}>
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-pencil" aria-hidden="true" />
                    Editar
                  </span>
                </span>
              )}
              {selecionados.size === 1 && (
                <span
                  className="reports-dropdown-item"
                  onClick={() => {
                    setAcoesAbertas(false);
                    navigate(`/sgq/sipoc/${[...selecionados][0]}`);
                  }}
                >
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-easel" aria-hidden="true" />
                    Abrir lousa
                  </span>
                </span>
              )}
              <span
                className={`reports-dropdown-item is-danger${excluirProcedimento.isPending ? ' is-disabled' : ''}`}
                onClick={() => { if (!excluirProcedimento.isPending) excluirSelecionados(); }}
              >
                <span className="reports-dropdown-item-left">
                  <i className="bi bi-trash3" aria-hidden="true" />
                  {excluirProcedimento.isPending ? 'Excluindo...' : 'Excluir'}
                </span>
              </span>
            </div>
          </div>
          <button type="button" className="reports-action-btn primary" onClick={abrirNovo}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>Novo procedimento</span>
          </button>
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
              placeholder="Buscar procedimento..."
              aria-label="Buscar procedimentos"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <div className="reports-select-wrapper">
            <select
              value={setorId}
              aria-label="Filtrar por setor"
              onChange={(event) => setSetorId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Todos os setores</option>
              {listaSetores.map((setor) => (
                <option key={setor.id} value={setor.id}>{setor.nome}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={() => { setBusca(''); setSetorId(''); }}
            disabled={!filtrando}
          >
            Limpar Filtros
          </button>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count">
            <strong>{procedimentos.data?.count ?? 0}</strong> {procedimentos.data?.count === 1 ? 'Procedimento' : 'Procedimentos'}
          </span>
        </div>
      </div>

      <QueryDataPanel
        query={procedimentos}
        loadingMessage="Carregando procedimentos..."
        errorMessage="Não foi possível carregar os procedimentos."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={todosMarcados}
                      ref={(el) => { if (el) el.indeterminate = algumMarcado && !todosMarcados; }}
                      onChange={() => {
                        setSelecionados((atual) => {
                          const proxima = new Set(atual);
                          if (todosMarcados) linhas.forEach((item) => proxima.delete(item.id));
                          else linhas.forEach((item) => proxima.add(item.id));
                          return proxima;
                        });
                      }}
                    />
                  </th>
                  <th>Procedimento</th>
                  <th>Setor</th>
                  <th>Descrição</th>
                  <th>Última atualização</th>
                  <th>Criado por</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="comercial-browse-empty">
                      {filtrando ? 'Nenhum procedimento encontrado para os filtros aplicados.' : 'Não há registros a serem exibidos.'}
                    </td>
                  </tr>
                ) : linhas.map((item) => {
                  const marcado = selecionados.has(item.id);
                  return (
                    <tr key={item.id} className={marcado ? 'row-selected' : undefined}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${item.nome}`}
                          checked={marcado}
                          onChange={() => setSelecionados((atual) => {
                            const proxima = new Set(atual);
                            if (proxima.has(item.id)) proxima.delete(item.id);
                            else proxima.add(item.id);
                            return proxima;
                          })}
                        />
                      </td>
                      <td>
                        <button type="button" className="sgq-lista-nome" onClick={() => navigate(`/sgq/sipoc/${item.id}`)}>
                          {item.nome}
                        </button>
                      </td>
                      <td>{item.setorNome}</td>
                      <td>{item.descricao || '—'}</td>
                      <td>{dataAtualizacao(item.atualizadoEm)}</td>
                      <td><Criador nome={item.criadoPor} foto={item.criadoPorFoto} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </QueryDataPanel>

      {modal === 'procedimento' && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sipoc-novo-titulo">
            <div className="modal-header">
              <div>
                <h3 id="sipoc-novo-titulo">Novo procedimento</h3>
                <p className="sgq-aud-modal-sub">O procedimento abre na lousa depois do cadastro.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setModal(null)} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form
              className="modal-body sgq-aud-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (setorNovo === '') return;
                criarProcedimento.mutate({
                  nome: nomeProcedimento.trim(),
                  setorId: setorNovo,
                  descricao: descricao.trim(),
                }, {
                  onSuccess: (criado) => {
                    setModal(null);
                    navigate(`/sgq/sipoc/${criado.id}`);
                  },
                  onError: falha,
                });
              }}
            >
              <label className="is-wide">
                <span>Nome <em>*</em></span>
                <input className="form-input" required maxLength={140} value={nomeProcedimento} onChange={(event) => setNomeProcedimento(event.target.value)} />
              </label>
              <label className="is-wide">
                <span>Setor <em>*</em></span>
                <select className="form-input" required value={setorNovo} onChange={(event) => setSetorNovo(event.target.value ? Number(event.target.value) : '')}>
                  <option value="">Selecione</option>
                  {listaSetores.map((setor) => (
                    <option key={setor.id} value={setor.id}>{setor.nome}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                <span>Descrição</span>
                <input className="form-input" maxLength={300} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
              </label>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="reports-action-btn primary" disabled={criarProcedimento.isPending || setorNovo === ''}>
                  {criarProcedimento.isPending ? 'Salvando...' : 'Cadastrar e abrir lousa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'editar' && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sipoc-editar-titulo">
            <div className="modal-header">
              <div>
                <h3 id="sipoc-editar-titulo">Editar procedimento</h3>
                <p className="sgq-aud-modal-sub">Nome, setor e descrição do procedimento.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setModal(null)} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form
              className="modal-body sgq-aud-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (editandoId == null || setorNovo === '') return;
                salvarProcedimento.mutate({
                  id: editandoId,
                  nome: nomeProcedimento.trim(),
                  setorId: setorNovo,
                  descricao: descricao.trim(),
                }, {
                  onSuccess: () => setModal(null),
                  onError: falha,
                });
              }}
            >
              <label className="is-wide">
                <span>Nome <em>*</em></span>
                <input className="form-input" required maxLength={140} value={nomeProcedimento} onChange={(event) => setNomeProcedimento(event.target.value)} />
              </label>
              <label className="is-wide">
                <span>Setor <em>*</em></span>
                <select className="form-input" required value={setorNovo} onChange={(event) => setSetorNovo(event.target.value ? Number(event.target.value) : '')}>
                  <option value="">Selecione</option>
                  {listaSetores.map((setor) => (
                    <option key={setor.id} value={setor.id}>{setor.nome}</option>
                  ))}
                </select>
              </label>
              <label className="is-wide">
                <span>Descrição</span>
                <input className="form-input" maxLength={300} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
              </label>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="reports-action-btn primary" disabled={salvarProcedimento.isPending || setorNovo === ''}>
                  {salvarProcedimento.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'setores' && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-labelledby="sipoc-setores-titulo">
            <div className="modal-header">
              <div>
                <h3 id="sipoc-setores-titulo">Setores</h3>
                <p className="sgq-aud-modal-sub">Um setor só pode ser excluído quando não tem procedimentos.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setModal(null)} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form
              className="modal-body sgq-aud-form"
              onSubmit={(event) => {
                event.preventDefault();
                criarSetor.mutate(nomeSetor.trim(), {
                  onSuccess: () => setNomeSetor(''),
                  onError: falha,
                });
              }}
            >
              <label className="is-wide">
                <span>Novo setor</span>
                <input className="form-input" maxLength={80} value={nomeSetor} onChange={(event) => setNomeSetor(event.target.value)} />
              </label>
              <QueryDataPanel query={setores} loadingMessage="Carregando setores..." errorMessage="Não foi possível carregar os setores." variant="compact">
                <ul className="sipoc-setores-lista">
                  {listaSetores.length === 0 ? (
                    <li className="comercial-browse-empty">Nenhum setor cadastrado.</li>
                  ) : listaSetores.map((setor) => (
                    <li key={setor.id}>
                      <span>{setor.nome}</span>
                      <small>{setor.totalProcedimentos}</small>
                      <button
                        type="button"
                        aria-label={`Excluir setor ${setor.nome}`}
                        onClick={() => {
                          if (!window.confirm(`Excluir o setor ${setor.nome}?`)) return;
                          excluirSetor.mutate(setor.id, {
                            onSuccess: () => { if (setorId === setor.id) setSetorId(''); },
                            onError: falha,
                          });
                        }}
                      >
                        <i className="bi bi-trash3" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </QueryDataPanel>
              <div className="modal-footer">
                <button type="button" className="reports-action-btn secondary" onClick={() => setModal(null)}>Fechar</button>
                <button type="submit" className="reports-action-btn primary" disabled={!nomeSetor.trim() || criarSetor.isPending}>
                  {criarSetor.isPending ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SGQSipoc;
