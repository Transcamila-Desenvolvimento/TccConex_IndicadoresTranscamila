import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import UserAvatar from '../../components/UserAvatar';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFrotaErrorMessage,
  useCadastrarUsuarioMotorista,
  useDefinirSenhaUsuarioMotorista,
  useExcluirUsuarioMotorista,
  useMotoristasElegiveis,
  useUsuariosMotorista,
} from '../../hooks/useFrotaMotoristas';
import type { MotoristaElegivel, UsuarioMotorista } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatCpf(value?: string) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

function SeletorMotorista({
  motoristas,
  value,
  carregando,
  onChange,
}: {
  motoristas: MotoristaElegivel[];
  value: string;
  carregando: boolean;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const selecionado = motoristas.find((item) => item.id === value) ?? null;
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const filtrados = termo
    ? motoristas.filter((item) => `${item.nomeCompleto} ${item.cargo}`.toLocaleLowerCase('pt-BR').includes(termo))
    : motoristas;

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (event: MouseEvent) => {
      if (!raiz.current?.contains(event.target as Node)) setAberto(false);
    };
    const fecharEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
    };
  }, [aberto]);

  const escolher = (id: string) => {
    onChange(id);
    setAberto(false);
  };

  const navegar = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      setDestaque((atual) => Math.min(Math.max(atual + passo, 0), Math.max(filtrados.length - 1, 0)));
    } else if (event.key === 'Enter' && filtrados[destaque]) {
      event.preventDefault();
      escolher(filtrados[destaque].id);
    }
  };

  return (
    <div className="sgq-pessoa" ref={raiz}>
      <button
        type="button"
        className={`sgq-pessoa-campo${aberto ? ' is-aberto' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={carregando || motoristas.length === 0}
        onClick={() => {
          setBusca('');
          setDestaque(Math.max(motoristas.findIndex((item) => item.id === value), 0));
          setAberto((atual) => !atual);
        }}
      >
        {selecionado ? (
          <>
            <span className="sgq-pessoa-avatar" aria-hidden="true">{iniciais(selecionado.nomeCompleto)}</span>
            <span className="sgq-pessoa-texto">
              <span className="sgq-pessoa-nome">{selecionado.nomeCompleto}</span>
              {selecionado.cargo ? <small>{selecionado.cargo}</small> : null}
            </span>
          </>
        ) : (
          <span className="sgq-pessoa-placeholder">{carregando ? 'Carregando...' : 'Escolher motorista'}</span>
        )}
        <i className={`bi bi-chevron-${aberto ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="sgq-pessoa-menu">
          <div className="sgq-pessoa-busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              autoFocus
              placeholder="Buscar por nome ou cargo..."
              aria-label="Buscar motorista"
              onChange={(event) => { setBusca(event.target.value); setDestaque(0); }}
              onKeyDown={navegar}
            />
          </div>
          <ul role="listbox">
            {filtrados.map((item, indice) => {
              const marcado = item.id === value;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    className={`sgq-pessoa-opcao${marcado ? ' is-selecionada' : ''}${indice === destaque ? ' is-destaque' : ''}`}
                    onMouseEnter={() => setDestaque(indice)}
                    onClick={() => escolher(item.id)}
                  >
                    <span className="sgq-pessoa-avatar" aria-hidden="true">{iniciais(item.nomeCompleto)}</span>
                    <span className="sgq-pessoa-texto">
                      <span className="sgq-pessoa-nome">{item.nomeCompleto}</span>
                      {item.cargo ? <small>{item.cargo}</small> : null}
                    </span>
                    {marcado && <i className="bi bi-check2" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {!filtrados.length && (
              <li className="sgq-pessoa-vazio">
                <i className="bi bi-person-x" aria-hidden="true" />
                Nenhum motorista encontrado.
              </li>
            )}
          </ul>
          <div className="sgq-pessoa-rodape">
            <i className="bi bi-people" aria-hidden="true" />
            {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'}
          </div>
        </div>
      )}
    </div>
  );
}

function SenhaModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioMotorista | null;
  onClose: () => void;
}) {
  const cadastrar = useCadastrarUsuarioMotorista();
  const definirSenha = useDefinirSenhaUsuarioMotorista();
  const elegiveisQuery = useMotoristasElegiveis(usuario === null);
  const elegiveis = elegiveisQuery.data ?? [];
  const salvando = cadastrar.isPending || definirSenha.isPending;
  const [funcionarioId, setFuncionarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const escolhido = elegiveis.find((item) => item.id === funcionarioId) ?? null;

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro('');
    if (!usuario && !funcionarioId) {
      setErro('Selecione um motorista.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    try {
      if (usuario) {
        await definirSenha.mutateAsync({ id: usuario.id, password: senha });
      } else {
        await cadastrar.mutateAsync({ funcionarioId, password: senha });
      }
      onClose();
    } catch (falha) {
      setErro(getFrotaErrorMessage(falha));
    }
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !salvando) onClose(); }}
    >
      <form
        className="search-modal-card search-modal-card--allow-overflow motorista-usuario-form"
        style={{ width: '520px', padding: '24px' }}
        onSubmit={enviar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="motorista-usuario-titulo"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 id="motorista-usuario-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            {usuario ? 'Redefinir senha' : 'Criar usuário'}
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar" disabled={salvando}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {usuario ? (
            <div className="login-group" style={{ marginBottom: 0 }}>
              <label htmlFor="motorista-usuario">Usuário</label>
              <input id="motorista-usuario" value={`${usuario.nomeCompleto} · ${usuario.username}`} readOnly />
            </div>
          ) : (
            <>
              <div className="login-group" style={{ marginBottom: 0 }}>
                <label id="motorista-colaborador">Motorista</label>
                <SeletorMotorista
                  motoristas={elegiveis}
                  value={funcionarioId}
                  carregando={elegiveisQuery.isLoading}
                  onChange={setFuncionarioId}
                />
              </div>
              <div className="login-group" style={{ marginBottom: 0 }}>
                <label htmlFor="motorista-username">Usuário</label>
                <input id="motorista-username" value={escolhido?.username ?? ''} placeholder="nome.sobrenome" readOnly />
              </div>
              {!elegiveisQuery.isLoading && elegiveis.length === 0 && (
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  Nenhum motorista ativo desta filial está disponível para cadastro.
                </p>
              )}
            </>
          )}
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="motorista-senha">Senha</label>
            <input id="motorista-senha" type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={(event) => setSenha(event.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="motorista-senha-confirmacao">Confirmar senha</label>
            <input id="motorista-senha-confirmacao" type="password" placeholder="Repita a senha" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
        </div>
        {erro && <p style={{ color: '#e11d48', fontSize: '13px', margin: '12px 0 0' }}>{erro}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={salvando || (!usuario && elegiveis.length === 0)}>
            {salvando ? 'Salvando...' : usuario ? 'Redefinir senha' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  );
}

const FrotaMotoristasUsuarios: React.FC = () => {
  const { user } = useAuth();
  const podeExcluir = userHasFuncao(user, 'Frota', 'excluir-usuarios-motorista');
  const podeCriar = userHasFuncao(user, 'Frota', 'criar-usuarios-motorista');
  const excluir = useExcluirUsuarioMotorista();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [formulario, setFormulario] = useState<UsuarioMotorista | 'novo' | null>(null);

  const status = statusFilter === 'ativo' || statusFilter === 'inativo' ? statusFilter : undefined;
  const usuariosQuery = useUsuariosMotorista({
    search: searchQuery.trim() || undefined,
    page,
    pageSize,
    status,
  });
  const { canShowEmpty } = useAsyncQueryState(usuariosQuery);
  const linhas = useMemo(() => usuariosQuery.data?.results ?? [], [usuariosQuery.data]);
  const total = usuariosQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginaAtual = Math.min(page, totalPages);
  const selecionados = useMemo(
    () => linhas.filter((usuario) => selectedIds.includes(usuario.id)),
    [linhas, selectedIds],
  );
  const todosMarcados = linhas.length > 0 && linhas.every((usuario) => selectedIds.includes(usuario.id));

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) setMenuAberto(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, []);

  const mudarFiltro = (aplicar: (valor: string) => void, valor: string) => {
    aplicar(valor);
    setPage(1);
    setSelectedIds([]);
  };

  const limparFiltros = () => {
    setSearchQuery('');
    setStatusFilter('todos');
    setPage(1);
    setSelectedIds([]);
  };

  const mudarPagina = (proxima: number) => {
    setPage(proxima);
    setSelectedIds([]);
  };

  const abrirSenha = () => {
    if (selecionados.length !== 1) return;
    setMenuAberto(false);
    setFormulario(selecionados[0]);
  };

  const excluirSelecionados = async () => {
    setMenuAberto(false);
    if (!podeExcluir || selecionados.length === 0 || excluir.isPending) return;
    const mensagem = selecionados.length > 1
      ? `Excluir o acesso de ${selecionados.length} motoristas ao aplicativo? Eles continuam no quadro de funcionários.`
      : `Excluir o acesso de ${selecionados[0].nomeCompleto} ao aplicativo? O colaborador continua no quadro de funcionários.`;
    if (!window.confirm(mensagem)) return;
    try {
      await Promise.all(selecionados.map((usuario) => excluir.mutateAsync(usuario.id)));
      setSelectedIds([]);
    } catch (falha) {
      window.alert(getFrotaErrorMessage(falha));
    }
  };

  const temAcao = (podeCriar && selecionados.length === 1) || (podeExcluir && selecionados.length > 0);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
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
              placeholder="Buscar por nome ou usuário..."
              value={searchQuery}
              onChange={(event) => mudarFiltro(setSearchQuery, event.target.value)}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={statusFilter} onChange={(event) => mudarFiltro(setStatusFilter, event.target.value)}>
              <option value="todos">Status: Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <button type="button" className="reports-action-btn secondary" onClick={limparFiltros}>
            Limpar Filtros
          </button>
        </div>

        <div className="reports-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="reports-records-count"><strong>{total}</strong> Usuários</span>

          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={!temAcao || excluir.isPending}
              onClick={() => setMenuAberto((aberto) => !aberto)}
            >
              <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${menuAberto ? 'show' : ''}`}>
              {podeCriar && selecionados.length === 1 && (
                <span className="reports-dropdown-item" onClick={abrirSenha}>
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                    Redefinir senha
                  </span>
                </span>
              )}
              {podeExcluir && selecionados.length > 0 && (
                <span className="reports-dropdown-item is-danger" onClick={() => { void excluirSelecionados(); }}>
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Excluir
                  </span>
                </span>
              )}
            </div>
          </div>

          {podeCriar && (
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={() => setFormulario('novo')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Criar Usuário</span>
          </button>
          )}
        </div>
      </div>

      <QueryDataPanel
        query={usuariosQuery}
        loadingMessage="Carregando usuários..."
        refreshingMessage="Atualizando usuários..."
        errorMessage="Não foi possível carregar os usuários. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={(event) => setSelectedIds(event.target.checked ? linhas.map((usuario) => usuario.id) : [])}
                      style={{ borderRadius: '4px' }}
                    />
                  </th>
                  <th>Usuário</th>
                  <th>Nome Completo</th>
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum usuário cadastrado com os filtros ativos.
                    </td>
                  </tr>
                ) : (
                  linhas.map((usuario) => (
                    <tr key={usuario.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(usuario.id)}
                          onChange={(event) => {
                            setSelectedIds((atual) => (
                              event.target.checked
                                ? [...atual, usuario.id]
                                : atual.filter((id) => id !== usuario.id)
                            ));
                          }}
                          style={{ borderRadius: '4px' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <UserAvatar name={usuario.nomeCompleto || usuario.username} size="md" className="admin-users-avatar" />
                          <strong>{usuario.username}</strong>
                        </div>
                      </td>
                      <td>{usuario.nomeCompleto}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatCpf(usuario.cpf) || <small style={{ color: 'var(--text-muted)' }}>—</small>}
                      </td>
                      <td>
                        {(usuario.cargo || '').trim()
                          ? usuario.cargo
                          : <small style={{ color: 'var(--text-muted)' }}>—</small>}
                      </td>
                      <td>
                        <span className={`status-dot-label ${usuario.ativo ? 'is-active' : 'is-inactive'}`}>
                          {usuario.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="motoristas-page-size">Itens por página</label>
            <select
              id="motoristas-page-size"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); setSelectedIds([]); }}
            >
              {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          </div>
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{paginaAtual}</span> de <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={paginaAtual <= 1}
            onClick={() => mudarPagina(paginaAtual - 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: paginaAtual <= 1 ? 0.5 : 1, cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={paginaAtual >= totalPages}
            onClick={() => mudarPagina(paginaAtual + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: paginaAtual >= totalPages ? 0.5 : 1, cursor: paginaAtual >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {formulario !== null && (
        <SenhaModal
          usuario={formulario === 'novo' ? null : formulario}
          onClose={() => setFormulario(null)}
        />
      )}
    </div>
  );
};

export default FrotaMotoristasUsuarios;
