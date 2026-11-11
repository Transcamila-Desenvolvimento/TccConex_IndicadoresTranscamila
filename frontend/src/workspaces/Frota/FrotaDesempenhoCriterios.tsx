import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFrotaErrorMessage,
  useCriteriosDesempenho,
  useCriarCriterioDesempenho,
  useCriarGrupoDesempenho,
  useExcluirCriterioDesempenho,
  useExcluirGrupoDesempenho,
  useSalvarCriterioDesempenho,
  useSalvarGrupoDesempenho,
} from '../../hooks/useFrotaDesempenho';
import type { CriterioDesempenho, GrupoCriterioDesempenho } from '../../types/domain';
import { numeroBonito } from './desempenhoFormat';

type Editor =
  | { tipo: 'grupo'; grupo?: GrupoCriterioDesempenho }
  | { tipo: 'criterio'; grupo?: GrupoCriterioDesempenho; criterio?: CriterioDesempenho };

type LinhaCriterio = {
  grupo: GrupoCriterioDesempenho;
  criterio: CriterioDesempenho | null;
};

const FrotaDesempenhoCriterios: React.FC = () => {
  const { user } = useAuth();
  const podeGerenciar = userHasFuncao(user, 'Frota', 'gerenciar-criterios-desempenho');
  const consulta = useCriteriosDesempenho();
  const excluirGrupo = useExcluirGrupoDesempenho();
  const excluirCriterio = useExcluirCriterioDesempenho();
  const { canShowEmpty } = useAsyncQueryState(consulta);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busca, setBusca] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const grupos = consulta.data?.grupos ?? [];
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const grupoSelecionado = grupos.find((grupo) => grupo.id === grupoId) ?? null;
  const linhas = grupos.flatMap((grupo): LinhaCriterio[] => {
    if (grupoId && grupo.id !== grupoId) return [];
    const criterios = grupo.criterios.filter((criterio) => (
      !termo || `${grupo.nome} ${criterio.nome} ${criterio.descricao}`.toLocaleLowerCase('pt-BR').includes(termo)
    ));
    if (criterios.length > 0) return criterios.map((criterio) => ({ grupo, criterio }));
    const grupoVisivel = !termo || grupo.nome.toLocaleLowerCase('pt-BR').includes(termo);
    return grupoVisivel ? [{ grupo, criterio: null }] : [];
  });

  const criteriosVisiveis = linhas.flatMap((linha) => (linha.criterio ? [linha.criterio] : []));
  const marcados = criteriosVisiveis.filter((criterio) => selecionados.includes(criterio.id));
  const todosMarcados = criteriosVisiveis.length > 0 && criteriosVisiveis.every((criterio) => selecionados.includes(criterio.id));
  const temAcao = marcados.length > 0 || Boolean(grupoSelecionado);

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) setMenuAberto(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, []);

  const editarSelecionado = () => {
    if (marcados.length !== 1) return;
    const criterio = marcados[0];
    const grupo = grupos.find((item) => item.id === criterio.grupoId);
    setMenuAberto(false);
    if (grupo) setEditor({ tipo: 'criterio', grupo, criterio });
  };

  const excluirSelecionados = async () => {
    setMenuAberto(false);
    if (marcados.length === 0 || excluirCriterio.isPending) return;
    const mensagem = marcados.length > 1
      ? `Excluir ${marcados.length} critérios?`
      : `Excluir ${marcados[0].nome}?`;
    if (!window.confirm(mensagem)) return;
    try {
      await Promise.all(marcados.map((criterio) => excluirCriterio.mutateAsync(criterio.id)));
      setSelecionados([]);
    } catch (falha) {
      window.alert(getFrotaErrorMessage(falha));
    }
  };

  const excluirGrupoSelecionado = () => {
    setMenuAberto(false);
    if (!grupoSelecionado || excluirGrupo.isPending) return;
    if (!window.confirm(`Excluir o grupo ${grupoSelecionado.nome}?`)) return;
    void excluirGrupo.mutateAsync(grupoSelecionado.id)
      .then(() => setGrupoId(''))
      .catch((falha) => window.alert(getFrotaErrorMessage(falha)));
  };

  return (
    <div className="desempenho-page desempenho-page--lista desempenho-page--sistema">
      <header className="view-header desempenho-head">
        <div className="desempenho-titulo">
          <div className="desempenho-titulo-marca" />
          <h1 className="view-page-title">Critérios</h1>
        </div>
        {podeGerenciar && (
        <div className="desempenho-head-acoes">
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={!temAcao || excluirCriterio.isPending || excluirGrupo.isPending}
              onClick={() => setMenuAberto((aberto) => !aberto)}
            >
              <span>Ações{marcados.length > 0 ? ` (${marcados.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${menuAberto ? 'show' : ''}`}>
              {marcados.length === 1 && (
                <span className="reports-dropdown-item" onClick={editarSelecionado}>
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Editar
                  </span>
                </span>
              )}
              {marcados.length > 0 && (
                <span className="reports-dropdown-item is-danger" onClick={() => { void excluirSelecionados(); }}>
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Excluir
                  </span>
                </span>
              )}
              {grupoSelecionado && (
                <span className="reports-dropdown-item" onClick={() => { setMenuAberto(false); setEditor({ tipo: 'grupo', grupo: grupoSelecionado }); }}>
                  <span className="reports-dropdown-item-left">Editar grupo</span>
                </span>
              )}
              {grupoSelecionado && (
                <span className="reports-dropdown-item is-danger" onClick={excluirGrupoSelecionado}>
                  <span className="reports-dropdown-item-left">Excluir grupo</span>
                </span>
              )}
            </div>
          </div>
          <button type="button" className="reports-action-btn secondary" onClick={() => setEditor({ tipo: 'criterio', grupo: grupoSelecionado ?? undefined })} disabled={grupos.length === 0}>
            Novo critério
          </button>
          <button type="button" className="reports-action-btn primary desempenho-btn-primario" onClick={() => setEditor({ tipo: 'grupo' })}>
            Novo grupo
          </button>
        </div>
        )}
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>Filtrar</span>
          </div>
          <div className="reports-search-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar critério ou grupo..."
              value={busca}
              onChange={(event) => { setBusca(event.target.value); setSelecionados([]); }}
            />
          </div>
          <div className="reports-select-wrapper">
            <select value={grupoId} aria-label="Grupo" onChange={(event) => { setGrupoId(event.target.value); setSelecionados([]); }}>
              <option value="">Grupo: Todos</option>
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count">
            <strong>{criteriosVisiveis.length}</strong> Critérios
          </span>
        </div>
      </div>

      <QueryDataPanel query={consulta} loadingMessage="Carregando critérios..." errorMessage="Não foi possível carregar os critérios.">
        <div className="erp-card reports-table-card desempenho-tabela">
          <div className="table-container">
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      disabled={criteriosVisiveis.length === 0}
                      onChange={(event) => setSelecionados(event.target.checked ? criteriosVisiveis.map((criterio) => criterio.id) : [])}
                      style={{ borderRadius: '4px' }}
                    />
                  </th>
                  <th>Grupo</th>
                  <th>Critério</th>
                  <th className="num">Pontos</th>
                  <th>Zera o bônus</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum critério encontrado.
                    </td>
                  </tr>
                ) : linhas.map((linha) => (
                  <tr key={linha.criterio?.id ?? `grupo-${linha.grupo.id}`}>
                    <td className="checkbox-cell">
                      {linha.criterio && (
                        <input
                          type="checkbox"
                          checked={selecionados.includes(linha.criterio.id)}
                          onChange={(event) => {
                            const id = linha.criterio?.id;
                            if (!id) return;
                            setSelecionados((atual) => (
                              event.target.checked ? [...atual, id] : atual.filter((item) => item !== id)
                            ));
                          }}
                          style={{ borderRadius: '4px' }}
                        />
                      )}
                    </td>
                    <td>{linha.grupo.nome}</td>
                    <td className="desempenho-criterio-celula">
                      {linha.criterio ? (
                        <>
                          <strong>{linha.criterio.nome}</strong>
                          {linha.criterio.descricao ? <span>{linha.criterio.descricao}</span> : null}
                        </>
                      ) : (
                        <strong>Nenhum critério neste grupo.</strong>
                      )}
                    </td>
                    <td className="num">{linha.criterio ? `${Number(linha.criterio.pontos) > 0 ? '-' : ''}${numeroBonito(linha.criterio.pontos)}` : '—'}</td>
                    <td>{linha.criterio ? (linha.criterio.zeraBonus ? 'Sim' : 'Não') : '—'}</td>
                    <td>
                      <span className={`status-dot-label ${(linha.criterio ?? linha.grupo).ativo ? 'is-active' : 'is-inactive'}`}>
                        {(linha.criterio ?? linha.grupo).ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryDataPanel>

      {editor?.tipo === 'grupo' && <EditorGrupo grupo={editor.grupo} onClose={() => setEditor(null)} />}
      {editor?.tipo === 'criterio' && (
        <EditorCriterio grupos={grupos} grupo={editor.grupo} criterio={editor.criterio} onClose={() => setEditor(null)} />
      )}
    </div>
  );
};

function EditorGrupo({ grupo, onClose }: { grupo?: GrupoCriterioDesempenho; onClose: () => void }) {
  const criar = useCriarGrupoDesempenho();
  const salvar = useSalvarGrupoDesempenho();
  const [nome, setNome] = useState(grupo?.nome ?? '');
  const [ativo, setAtivo] = useState(grupo?.ativo ?? true);
  const pendente = criar.isPending || salvar.isPending;

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) return;
    try {
      if (grupo) await salvar.mutateAsync({ id: grupo.id, nome: nome.trim(), ativo });
      else await criar.mutateAsync({ nome: nome.trim() });
      onClose();
    } catch (falha) {
      window.alert(getFrotaErrorMessage(falha));
    }
  };

  return (
    <div className="search-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !pendente) onClose(); }}>
      <form className="search-modal-card desempenho-modal" onSubmit={enviar}>
        <h2>{grupo ? 'Editar grupo' : 'Novo grupo'}</h2>
        <label className="desempenho-field">
          <span>Nome</span>
          <input type="text" value={nome} onChange={(event) => setNome(event.target.value)} autoFocus />
        </label>
        {grupo && (
          <label className="desempenho-check">
            <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            <span>
              <strong>Grupo ativo</strong>
              <small>Grupos inativos saem do cálculo das próximas apurações.</small>
            </span>
          </label>
        )}
        <div className="desempenho-acoes">
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pendente}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={pendente}>Salvar</button>
        </div>
      </form>
    </div>
  );
}

function EditorCriterio({
  grupos,
  grupo,
  criterio,
  onClose,
}: {
  grupos: GrupoCriterioDesempenho[];
  grupo?: GrupoCriterioDesempenho;
  criterio?: CriterioDesempenho;
  onClose: () => void;
}) {
  const criar = useCriarCriterioDesempenho();
  const salvar = useSalvarCriterioDesempenho();
  const [grupoId, setGrupoId] = useState(grupo?.id ?? criterio?.grupoId ?? grupos[0]?.id ?? '');
  const [nome, setNome] = useState(criterio?.nome ?? '');
  const [descricao, setDescricao] = useState(criterio?.descricao ?? '');
  const [pontos, setPontos] = useState(criterio?.pontos ?? '0');
  const [zera, setZera] = useState(criterio?.zeraBonus ?? false);
  const [ativo, setAtivo] = useState(criterio?.ativo ?? true);
  const pendente = criar.isPending || salvar.isPending;
  const grupoAtual = grupos.find((item) => item.id === grupoId) ?? grupo;

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim() || !grupoId) return;
    try {
      if (criterio) {
        await salvar.mutateAsync({
          id: criterio.id,
          dados: { nome: nome.trim(), pontos, zeraBonus: zera, ativo, descricao: descricao.trim() },
        });
      } else {
        await criar.mutateAsync({ grupoId, nome: nome.trim(), descricao: descricao.trim(), pontos, zeraBonus: zera });
      }
      onClose();
    } catch (falha) {
      window.alert(getFrotaErrorMessage(falha));
    }
  };

  return (
    <div className="search-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !pendente) onClose(); }}>
      <form className="search-modal-card desempenho-modal" onSubmit={enviar}>
        <div className="desempenho-modal-head">
          <h2>{criterio ? 'Editar critério' : 'Novo critério'}</h2>
          <p>{grupoAtual?.nome || 'Escolha o grupo'}</p>
        </div>
        {!criterio && (
          <label className="desempenho-field">
            <span>Grupo</span>
            <select value={grupoId} onChange={(event) => setGrupoId(event.target.value)}>
              {grupos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
        )}
        <label className="desempenho-field">
          <span>Nome</span>
          <input type="text" value={nome} onChange={(event) => setNome(event.target.value)} autoFocus />
        </label>
        <label className="desempenho-field">
          <span>Descrição</span>
          <textarea value={descricao} rows={3} maxLength={400} onChange={(event) => setDescricao(event.target.value)} />
        </label>
        <label className="desempenho-field desempenho-field--curto">
          <span>Pontos por ocorrência</span>
          <input type="text" value={pontos} onChange={(event) => setPontos(event.target.value)} />
        </label>
        <label className="desempenho-check">
          <input type="checkbox" checked={zera} onChange={(event) => setZera(event.target.checked)} />
          <span>
            <strong>Zera o bônus</strong>
            <small>Uma ocorrência neste critério anula a bonificação do mês.</small>
          </span>
        </label>
        {criterio && (
          <label className="desempenho-check">
            <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            <span>
              <strong>Critério ativo</strong>
              <small>Critérios inativos não aparecem no registro de novas ocorrências.</small>
            </span>
          </label>
        )}
        <div className="desempenho-acoes">
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pendente}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={pendente}>Salvar</button>
        </div>
      </form>
    </div>
  );
}

export default FrotaDesempenhoCriterios;
