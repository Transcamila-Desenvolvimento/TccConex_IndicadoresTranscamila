import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { User } from '../../types/domain';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
} from '../../hooks/useUsers';
import { useRoles } from '../../hooks/useRoles';
import {
  ADMIN_ENVIRONMENT,
  normalizeEnvironment,
} from '../../constants/environments';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const PAGE_SIZE = 10;

const BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá'] as const;

const MODULE_ACCESS_GROUPS = [
  { module: 'Financeiro', label: 'Financeiro', colorKey: 'financeiro' },
  { module: 'Indicadores', label: 'Indicadores', colorKey: 'indicadores' },
  { module: 'Compras', label: 'Compras', colorKey: 'compras' },
  { module: 'RH', label: 'RH', colorKey: 'rh' },
] as const;

const AdminUsersPanel: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: searchQuery.trim() || undefined,
    roleId: roleFilter !== 'todos' ? roleFilter : undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
  }), [currentPage, searchQuery, roleFilter, statusFilter]);

  const usersQuery = useUsers(queryParams);
  const usersPage = usersQuery.data;
  const usersList = useMemo(() => usersPage?.results ?? [], [usersPage]);
  const usersQueryState = useAsyncQueryState(usersQuery);

  const totalItems = usersPage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;

  const { data: roles = [], isError: rolesError, isLoading: rolesLoading } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const toggleUserStatus = useToggleUserStatus();

  const defaultRoleId = useMemo(
    () => roles.find((r) => !r.permissions.some((perm) => normalizeEnvironment(perm) === ADMIN_ENVIRONMENT))?.id ?? roles[0]?.id ?? '2',
    [roles],
  );

  // Selection (bulk actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const selectedUsers = useMemo(
    () => usersList.filter((u) => selectedIds.includes(u.id)),
    [usersList, selectedIds],
  );

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('2');
  const [status, setStatus] = useState('ativo');
  const [moduleAccess, setModuleAccess] = useState<Record<string, string[]>>({});

  const isSelectedAdmin = roleId === '1';
  const isEditingSelf = !!editingUserId && editingUserId === currentUser?.id;

  useEffect(() => {
    if (defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId]);

  // Fecha o menu de ações ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) setIsActionsMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('todos');
    setStatusFilter('todos');
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds([]);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? usersList.map((u) => u.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const isAllSelected = usersList.length > 0 && usersList.every((u) => selectedIds.includes(u.id));

  const handleOpenCreate = () => {
    setEditingUserId(null);
    setUsername('');
    setName('');
    setPassword('');
    setRoleId(defaultRoleId);
    setStatus('ativo');
    setModuleAccess({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setName(user.name);
    setPassword('');
    setRoleId(user.roleId);
    setStatus(user.status);

    const userFiliais = user.filiais || {};
    const nextAccess: Record<string, string[]> = {};
    MODULE_ACCESS_GROUPS.forEach((group) => {
      const branches = (userFiliais[group.module] || []).filter((b) => (BRANCHES as readonly string[]).includes(b));
      if (branches.length > 0) nextAccess[group.module] = branches;
    });

    setModuleAccess(nextAccess);
    setIsModalOpen(true);
  };

  const handleEditSelected = () => {
    setIsActionsMenuOpen(false);
    if (selectedUsers.length !== 1) return;
    handleOpenEdit(selectedUsers[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const environments: string[] = [];
    const filiais: Record<string, string[]> = {};

    MODULE_ACCESS_GROUPS.forEach((group) => {
      const branches = moduleAccess[group.module] ?? [];
      if (branches.length > 0) {
        environments.push(group.module);
        filiais[group.module] = branches;
      }
    });

    // Administradores sempre mantêm acesso ao ambiente de Administração/Manutenção,
    // além dos módulos operacionais que escolherem individualmente.
    if (isSelectedAdmin) {
      environments.push(ADMIN_ENVIRONMENT);
    }

    const userData: any = { username, name, roleId, status, environments, filiais };
    if (password) userData.password = password;

    try {
      if (editingUserId) {
        await updateUser.mutateAsync({ id: editingUserId, data: userData });
        alert('Usuário atualizado com sucesso.');
      } else {
        await createUser.mutateAsync(userData);
        alert('Novo usuário operacional criado!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.username?.[0] || err.message || 'Erro ao salvar usuário.';
      alert(detail);
    }
  };

  const handleBulkToggleStatus = async () => {
    setIsActionsMenuOpen(false);
    const targets = selectedUsers.filter((u) => u.id !== currentUser?.id);
    if (targets.length === 0) {
      alert('Não é permitido alterar o status do seu próprio usuário.');
      return;
    }
    try {
      await Promise.all(targets.map((u) => toggleUserStatus.mutateAsync(u.id)));
      setSelectedIds([]);
      alert(targets.length > 1 ? 'Status atualizado para os usuários selecionados.' : 'Status do usuário atualizado com sucesso.');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao alterar o status de um ou mais usuários.');
    }
  };

  const handleBulkDelete = async () => {
    setIsActionsMenuOpen(false);
    const targets = selectedUsers.filter((u) => u.id !== currentUser?.id);
    if (targets.length === 0) {
      alert('Não é permitido remover seu próprio usuário conectado.');
      return;
    }
    const confirmMessage = targets.length > 1
      ? `Deseja realmente excluir permanentemente os ${targets.length} usuários selecionados?`
      : 'Deseja realmente excluir permanentemente este usuário do sistema?';
    if (!window.confirm(confirmMessage)) return;
    try {
      await Promise.all(targets.map((u) => deleteUser.mutateAsync(u.id)));
      setSelectedIds([]);
      alert(targets.length > 1 ? 'Usuários removidos com sucesso.' : 'Usuário removido com sucesso.');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao excluir um ou mais usuários.');
    }
  };

  const isBranchSelected = (module: string, branch: string) => (moduleAccess[module] ?? []).includes(branch);

  const isModuleFullySelected = (module: string) => (moduleAccess[module]?.length ?? 0) === BRANCHES.length;

  const handleToggleBranch = (module: string, branch: string) => {
    setModuleAccess((prev) => {
      const current = prev[module] ?? [];
      const next = current.includes(branch) ? current.filter((b) => b !== branch) : [...current, branch];
      return { ...prev, [module]: next };
    });
  };

  // Clique no nome do módulo: alterna rapidamente entre "todas as filiais" e "nenhuma".
  const handleToggleModule = (module: string) => {
    setModuleAccess((prev) => {
      const fullySelected = (prev[module]?.length ?? 0) === BRANCHES.length;
      return { ...prev, [module]: fullySelected ? [] : [...BRANCHES] };
    });
  };

  const handleSelectAllModules = () => {
    const full: Record<string, string[]> = {};
    MODULE_ACCESS_GROUPS.forEach((group) => { full[group.module] = [...BRANCHES]; });
    setModuleAccess(full);
  };

  const handleClearAllModules = () => setModuleAccess({});

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filters */}
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
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={roleFilter} onChange={(e) => handleFilterChange(setRoleFilter, e.target.value)}>
              <option value="todos">Função: Todas</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}>
              <option value="todos">Status: Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <button type="button" className="reports-action-btn secondary" onClick={handleClearFilters}>
            Limpar Filtros
          </button>
        </div>

        <div className="reports-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="reports-records-count"><strong>{totalItems}</strong> Usuários</span>

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
              {selectedUsers.length === 1 && (
                <span className="reports-dropdown-item" onClick={handleEditSelected}>Editar</span>
              )}
              <span className="reports-dropdown-item" onClick={handleBulkToggleStatus}>Ativar / Inativar</span>
              <span className="reports-dropdown-item" onClick={handleBulkDelete}>Excluir</span>
            </div>
          </div>

          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={handleOpenCreate}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Criar Usuário</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <QueryDataPanel
        query={usersQuery}
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
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  <th>Usuário</th>
                  <th>Nome Completo</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Último Acesso</th>
                </tr>
              </thead>
              <tbody>
                {usersQueryState.canShowEmpty && usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum usuário operacional cadastrado com os filtros ativos.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => {
                    const roleName = roles.find(r => r.id === u.roleId)?.name || 'Operador';
                    const initials = u.name.split(' ').length > 1 ? u.name.split(' ')[0][0] + u.name.split(' ')[u.name.split(' ').length - 1][0] : u.name.slice(0, 2);
                    const formattedInitials = initials.toUpperCase();

                    const lastLoginStr = u.lastLogin
                      ? new Date(u.lastLogin).toLocaleDateString('pt-BR') + ' ' + new Date(u.lastLogin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'Nunca logou';

                    return (
                      <tr key={u.id}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={(e) => handleSelectRow(u.id, e.target.checked)}
                            style={{ borderRadius: '4px' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0076ce', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '12px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                              {formattedInitials}
                            </div>
                            <strong>{u.username}</strong>
                          </div>
                        </td>
                        <td>{u.name}</td>
                        <td><span style={{ fontWeight: 600 }}>{roleName}</span></td>
                        <td>
                          <span className={`status-badge ${u.status === 'ativo' ? 'success' : 'inativo'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td><small style={{ color: 'var(--text-muted)' }}>{lastLoginStr}</small></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="erp-pagination-bar">
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({totalItems} registros)</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage <= 1}
            onClick={() => handlePageChange(clampedPage - 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage >= totalPages}
            onClick={() => handlePageChange(clampedPage + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {/* MODAL: CRIAR / EDITAR USUÁRIO */}
      {isModalOpen && (
        <div className="search-backdrop admin-user-modal-backdrop" id="user-admin-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div className="search-modal-card admin-user-modal-card" style={{ width: '520px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="admin-modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
                {editingUserId ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>

            <form id="admin-user-form" style={{ padding: '16px 24px 20px 24px' }} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="admin-user-username">Usuário (Username)</label>
                  <input
                    type="text"
                    id="admin-user-username"
                    placeholder="Ex: joao.santos"
                    required
                    readOnly={!!editingUserId}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="admin-user-name">Nome Completo</label>
                  <input
                    type="text"
                    id="admin-user-name"
                    placeholder="Ex: João dos Santos"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="login-group" style={{ marginBottom: '10px' }}>
                <label htmlFor="admin-user-password">Senha</label>
                <input
                  type="password"
                  id="admin-user-password"
                  placeholder={editingUserId ? 'Preencha apenas para definir nova senha' : 'Defina a senha do novo usuário'}
                  required={!editingUserId}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {!editingUserId && (
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontSize: '11px' }}>
                    Mínimo de 6 caracteres. Informe a senha ao usuário por um canal seguro.
                  </small>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="admin-user-role">Função</label>
                  <select
                    id="admin-user-role"
                    className="selection-select"
                    style={{ height: '40px' }}
                    required
                    value={roles.length > 0 ? roleId : ''}
                    disabled={rolesLoading || roles.length === 0 || isEditingSelf}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    {rolesLoading || roles.length === 0 ? (
                      <option value="">
                        {rolesError ? 'Erro ao carregar funções' : 'Carregando funções...'}
                      </option>
                    ) : (
                      roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))
                    )}
                  </select>
                  {isEditingSelf && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                      Você não pode alterar sua própria função de administrador.
                    </small>
                  )}
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="admin-user-status">Status</label>
                  <select
                    id="admin-user-status"
                    className="selection-select"
                    style={{ height: '40px' }}
                    required
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Módulo e Filial: acesso granular por módulo */}
              <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Acesso por Módulo e Filial</h4>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <span className="module-access-quick-action" onClick={handleSelectAllModules}>Selecionar tudo</span>
                    <span className="module-access-quick-action" onClick={handleClearAllModules}>Limpar</span>
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px 0' }}>
                  Clique no nome do módulo para marcar/desmarcar todas as filiais.
                </p>

                {isSelectedAdmin && (
                  <div style={{ fontSize: '11px', color: '#0076ce', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '8px' }}>
                    Administradores também têm acesso automático ao ambiente de Administração/Manutenção.
                  </div>
                )}

                <div className="module-access-list">
                  {MODULE_ACCESS_GROUPS.map((group) => {
                    const fullySelected = isModuleFullySelected(group.module);
                    const hasSome = (moduleAccess[group.module]?.length ?? 0) > 0;

                    return (
                      <div className="module-access-row" key={group.module}>
                        <button
                          type="button"
                          className={`module-access-name ${hasSome ? `active-${group.colorKey}` : ''}`}
                          onClick={() => handleToggleModule(group.module)}
                          title={fullySelected ? 'Remover todas as filiais deste módulo' : 'Liberar todas as filiais deste módulo'}
                        >
                          <span className="module-access-check">{fullySelected ? '✓' : hasSome ? '–' : ''}</span>
                          {group.label}
                        </button>
                        <div className="module-access-branches">
                          {BRANCHES.map((branch) => {
                            const active = isBranchSelected(group.module, branch);
                            return (
                              <span
                                key={branch}
                                className={`module-access-branch-chip ${active ? `active-${group.colorKey}` : ''}`}
                                onClick={() => handleToggleBranch(group.module, branch)}
                              >
                                {branch}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="btn-login" id="btn-admin-submit-user">Salvar Usuário</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPanel;
