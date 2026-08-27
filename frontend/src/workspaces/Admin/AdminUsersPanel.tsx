import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { User } from '../../types/domain';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
  useForcePasswordChange,
} from '../../hooks/useUsers';
import { useRoles } from '../../hooks/useRoles';
import {
  ADMIN_ENVIRONMENT,
  environmentRequiresFilial,
  normalizeEnvironment,
} from '../../constants/environments';
import { INDICADOR_ITEMS, type IndicadorKey } from '../../constants/indicadores';
import { funcoesDaAba, funcoesDoModulo, type FuncaoKey } from '../../constants/funcoes';
import { abasDoModulo, HOME_ABA_KEY, rotinasConfiguraveisDoModulo } from '../../constants/abas';
import { branchesForModule } from '../../constants/filiais';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const PAGE_SIZE = 10;

const MODULE_ACCESS_GROUPS = [
  { module: 'Financeiro', label: 'Financeiro' },
  { module: 'Faturamento', label: 'Faturamento' },
  { module: 'Indicadores', label: 'Indicadores' },
  { module: 'Compras', label: 'Compras' },
  { module: 'RH', label: 'RH' },
  { module: 'SGQ', label: 'SGQ' },
  { module: 'Marketing', label: 'Marketing' },
  { module: 'Logística', label: 'Logística' },
] as const;

const INDICADOR_GROUPS = INDICADOR_ITEMS.reduce<Record<string, typeof INDICADOR_ITEMS[number][]>>((acc, item) => {
  (acc[item.group] ??= []).push(item);
  return acc;
}, {});

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
  const forcePasswordChange = useForcePasswordChange();

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
  const [selectedIndicadores, setSelectedIndicadores] = useState<IndicadorKey[]>([]);
  const [funcoes, setFuncoes] = useState<Record<string, string[]>>({});
  const [selectedAbas, setSelectedAbas] = useState<Record<string, string[]>>({});
  const [selectedModule, setSelectedModule] = useState<string>(MODULE_ACCESS_GROUPS[0].module);

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
    setSelectedIndicadores([]);
    setFuncoes({});
    setSelectedAbas({});
    setSelectedModule(MODULE_ACCESS_GROUPS[0].module);
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
      const allowed = branchesForModule(group.module);
      const branches = (userFiliais[group.module] || []).filter((b) => allowed.includes(b));
      if (branches.length > 0) nextAccess[group.module] = branches;
    });

    setModuleAccess(nextAccess);

    const userIndicadores = (user.indicadores ?? []).filter(
      (key): key is IndicadorKey => INDICADOR_ITEMS.some((item) => item.key === key),
    );
    setSelectedIndicadores(userIndicadores);
    setFuncoes(user.funcoes ?? {});
    const nextAbas: Record<string, string[]> = {};
    MODULE_ACCESS_GROUPS.forEach((group) => {
      if (group.module === 'Indicadores') return;
      const catalog = abasDoModulo(group.module).map((item) => item.key as string);
      nextAbas[group.module] = (user.abas?.[group.module] ?? []).filter((key) => catalog.includes(key));
    });
    setSelectedAbas(nextAbas);
    const firstOpen = MODULE_ACCESS_GROUPS.find((group) => (nextAccess[group.module]?.length ?? 0) > 0);
    setSelectedModule(firstOpen?.module ?? MODULE_ACCESS_GROUPS[0].module);

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

    const hasIndicadoresModule = environments.includes('Indicadores');
    const indicadorCatalog = INDICADOR_ITEMS.map((item) => item.key);
    const indicadores = hasIndicadoresModule
      && selectedIndicadores.length > 0
      && selectedIndicadores.length < indicadorCatalog.length
      ? selectedIndicadores
      : [];

    const abas: Record<string, string[]> = {};
    for (const group of MODULE_ACCESS_GROUPS) {
      if (group.module === 'Indicadores' || !environments.includes(group.module)) continue;
      const catalog = abasDoModulo(group.module).map((item) => item.key as string);
      const keys = (selectedAbas[group.module] ?? []).filter((key) => catalog.includes(key));
      if (keys.length > 0 && keys.length < catalog.length) {
        abas[group.module] = catalog.includes(HOME_ABA_KEY) && !keys.includes(HOME_ABA_KEY)
          ? [HOME_ABA_KEY, ...keys]
          : keys;
      }
    }

    // Só envia funções de módulos que o usuário realmente tem acesso.
    const funcoesFiltradas = Object.fromEntries(
      Object.entries(funcoes).filter(([module, keys]) => environments.includes(module) && keys.length > 0),
    );

    const userData: any = { username, name, roleId, status, environments, filiais, indicadores, funcoes: funcoesFiltradas, abas };
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

  const handleForcePasswordChange = async () => {
    setIsActionsMenuOpen(false);
    const targets = selectedUsers.filter((u) => u.id !== currentUser?.id && u.status === 'ativo');
    if (targets.length === 0) {
      alert('Selecione usuários ativos (exceto você) para solicitar a redefinição de senha.');
      return;
    }
    const confirmMessage = targets.length > 1
      ? `Solicitar redefinição de senha para os ${targets.length} usuários selecionados? Eles deverão alterar a senha no próximo acesso.`
      : `Solicitar redefinição de senha para ${targets[0].name || targets[0].username}? O usuário deverá alterar a senha no próximo acesso.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await Promise.all(targets.map((u) => forcePasswordChange.mutateAsync(u.id)));
      setSelectedIds([]);
      alert(
        targets.length > 1
          ? 'Redefinição solicitada. Os usuários deverão alterar a senha no próximo acesso.'
          : 'Redefinição solicitada. O usuário deverá alterar a senha no próximo acesso.',
      );
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erro ao solicitar redefinição de senha.');
    }
  };

  const isBranchSelected = (module: string, branch: string) => (moduleAccess[module] ?? []).includes(branch);

  const handleToggleBranch = (module: string, branch: string) => {
    setModuleAccess((prev) => {
      const current = prev[module] ?? [];
      const next = current.includes(branch) ? current.filter((b) => b !== branch) : [...current, branch];
      return { ...prev, [module]: next };
    });
  };

  // Interruptor do módulo: com qualquer acesso → remove tudo; sem acesso → libera todas as filiais.
  // forceOn=true força a seleção de todas as filiais independente do estado atual.
  const handleToggleModule = (module: string, forceOn = false) => {
    setModuleAccess((prev) => {
      const hasAccess = (prev[module]?.length ?? 0) > 0;
      const nextOn = forceOn || !hasAccess;
      if (nextOn) setSelectedModule(module);
      return { ...prev, [module]: nextOn ? [...branchesForModule(module)] : [] };
    });
  };

  const handleSelectAllModules = () => {
    const full: Record<string, string[]> = {};
    MODULE_ACCESS_GROUPS.forEach((group) => { full[group.module] = [...branchesForModule(group.module)]; });
    setModuleAccess(full);
  };

  const handleClearAllModules = () => setModuleAccess({});

  const handleToggleIndicador = (key: IndicadorKey) => {
    const catalog = INDICADOR_ITEMS.map((item) => item.key);
    setSelectedIndicadores((prev) => {
      const current = prev.length > 0 ? prev : catalog;
      const turningOff = current.includes(key);
      if (turningOff && current.length <= 1) return prev;
      const next = turningOff ? current.filter((k) => k !== key) : [...current, key];
      return next.length === catalog.length ? [] : next;
    });
  };

  const handleToggleAba = (module: string, key: string) => {
    if (key === HOME_ABA_KEY) return;
    const catalog = abasDoModulo(module).map((item) => item.key as string);
    const current = (selectedAbas[module]?.length ?? 0) > 0 ? selectedAbas[module] : catalog;
    const turningOff = current.includes(key);
    if (turningOff && current.length <= 1) return;
    const next = turningOff ? current.filter((k) => k !== key) : [...current, key];
    if (!next.includes(HOME_ABA_KEY) && catalog.includes(HOME_ABA_KEY)) {
      next.unshift(HOME_ABA_KEY);
    }
    setSelectedAbas((prev) => ({ ...prev, [module]: next.length === catalog.length ? [] : next }));
    if (turningOff) {
      const keysDaAba = funcoesDaAba(module, key).map((item) => item.key);
      setFuncoes((prev) => ({
        ...prev,
        [module]: (prev[module] ?? []).filter((fn) => !keysDaAba.includes(fn as FuncaoKey)),
      }));
    }
  };

  const handleToggleFuncao = (module: string, key: FuncaoKey) => {
    setFuncoes((prev) => {
      const current = prev[module] ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [module]: next };
    });
  };

  const handleApplyModulePreset = (module: string, preset: 'todas-rotinas' | 'so-consulta' | 'todas-acoes') => {
    if (module === 'Indicadores') {
      if (preset === 'todas-rotinas') setSelectedIndicadores([]);
      return;
    }
    if (preset === 'todas-rotinas') {
      setSelectedAbas((prev) => ({ ...prev, [module]: [] }));
      return;
    }
    if (preset === 'so-consulta') {
      setFuncoes((prev) => ({ ...prev, [module]: [] }));
      return;
    }
    setFuncoes((prev) => ({
      ...prev,
      [module]: funcoesDoModulo(module).map((item) => item.key),
    }));
  };

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
                <span className="reports-dropdown-item" onClick={handleEditSelected}>
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Editar
                  </span>
                </span>
              )}
              <span className="reports-dropdown-item" onClick={handleForcePasswordChange}>
                <span className="reports-dropdown-item-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  Redefinir senha
                </span>
              </span>
              <span className="reports-dropdown-item" onClick={handleBulkToggleStatus}>
                <span className="reports-dropdown-item-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                  </svg>
                  Ativar / Inativar
                </span>
              </span>
              <span className="reports-dropdown-item is-danger" onClick={handleBulkDelete}>
                <span className="reports-dropdown-item-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Excluir
                </span>
              </span>
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
                  <th>Senha</th>
                  <th>Último Acesso</th>
                </tr>
              </thead>
              <tbody>
                {usersQueryState.canShowEmpty && usersList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
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
                          <span className={`status-dot-label ${u.status === 'ativo' ? 'is-active' : 'is-inactive'}`}>
                            {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          {u.mustChangePassword ? (
                            <span
                              className="status-dot-label is-warning"
                              title="Deverá alterar a senha no próximo acesso"
                            >
                              Pendente
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Em dia</span>
                          )}
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
          <div className="search-modal-card admin-user-modal-card admin-user-modal-card--wide">
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="admin-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                {editingUserId ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>

            <form id="admin-user-form" className="admin-user-form" onSubmit={handleSubmit}>
              <div className="admin-form-columns">
              {/* Coluna esquerda: dados do usuário */}
              <div className="admin-form-col admin-form-col--fields">
              {/* Seção 1: Identificação */}
              <div className="admin-form-section">
                <h4 className="admin-form-section-title">Identificação</h4>
                <div className="admin-form-row">
                  <div className="login-group">
                    <label htmlFor="admin-user-username">Usuário</label>
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
                  <div className="login-group">
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
              </div>

              {/* Seção 2: Acesso */}
              <div className="admin-form-section">
                <h4 className="admin-form-section-title">Acesso</h4>
                <div className="admin-form-row">
                  <div className="login-group">
                    <label htmlFor="admin-user-password">Senha</label>
                    <input
                      type="password"
                      id="admin-user-password"
                      placeholder={editingUserId ? 'Só preencha para trocar' : 'Mínimo 6 caracteres'}
                      required={!editingUserId}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="login-group">
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
                  </div>
                </div>
                {isEditingSelf && (
                  <small className="admin-form-hint">Você não pode alterar sua própria função de administrador.</small>
                )}
                {editingUserId && (
                  <div className="admin-form-row" style={{ marginTop: '10px' }}>
                    <div className="login-group">
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
                )}
              </div>
              </div>

              {/* Coluna direita: permissões */}
              <div className="admin-form-col">
              <div className="admin-form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h4 className="admin-form-section-title">Permissões</h4>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <span className="module-access-quick-action" onClick={handleSelectAllModules}>Liberar ambientes</span>
                    <span className="module-access-quick-action" onClick={handleClearAllModules}>Bloquear todos</span>
                  </div>
                </div>
                <p className="admin-form-hint" style={{ margin: '0 0 8px 0' }}>
                  Escolha o ambiente à esquerda. À direita, cada rotina tem o menu e as ações próprias.
                </p>

                {isSelectedAdmin && (
                  <div style={{ fontSize: '11px', color: '#0076ce', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '8px' }}>
                    Administradores entram automaticamente em Administração/Manutenção e têm todas as ações.
                  </div>
                )}

                {(() => {
                  const group = MODULE_ACCESS_GROUPS.find((item) => item.module === selectedModule) ?? MODULE_ACCESS_GROUPS[0];
                  const branches = moduleAccess[group.module] ?? [];
                  const moduleBranches = branchesForModule(group.module);
                  const hasAccess = branches.length > 0;
                  const funcaoItems = funcoesDoModulo(group.module);
                  const selectedFuncoes = funcoes[group.module] ?? [];
                  const requiresFilial = environmentRequiresFilial(group.module);
                  const abaItems = group.module === 'Indicadores' ? [] : rotinasConfiguraveisDoModulo(group.module);
                  const hasAcoes = funcaoItems.length > 0 && !isSelectedAdmin;

                  return (
                    <div className="perm-split">
                      <div className="perm-env-list" role="list">
                        {MODULE_ACCESS_GROUPS.map((item) => {
                          const itemBranches = moduleAccess[item.module] ?? [];
                          const itemOn = itemBranches.length > 0;
                          const itemFuncoes = funcoes[item.module] ?? [];
                          const itemAbas = item.module === 'Indicadores'
                            ? (selectedIndicadores.length === 0 ? INDICADOR_ITEMS.length : selectedIndicadores.length)
                            : (() => {
                              const configuraveis = rotinasConfiguraveisDoModulo(item.module);
                              const saved = selectedAbas[item.module] ?? [];
                              if (saved.length === 0) return configuraveis.length;
                              return configuraveis.filter((aba) => saved.includes(aba.key)).length;
                            })();
                          const itemAbaTotal = item.module === 'Indicadores'
                            ? INDICADOR_ITEMS.length
                            : rotinasConfiguraveisDoModulo(item.module).length;
                          const itemHasAcoes = funcoesDoModulo(item.module).length > 0 && !isSelectedAdmin;
                          let line = 'Bloqueado';
                          if (itemOn) {
                            const parts = [
                              itemAbaTotal > 0 ? `${itemAbas}/${itemAbaTotal} rotinas` : 'Liberado',
                            ];
                            if (environmentRequiresFilial(item.module)) {
                              parts.push(`${itemBranches.length} filial`);
                            }
                            if (itemHasAcoes) {
                              parts.push(itemFuncoes.length === 0 ? 'consulta' : `${itemFuncoes.length} ação(ões)`);
                            }
                            line = parts.join(' · ');
                          }
                          return (
                            <div
                              role="listitem"
                              key={item.module}
                              className={`perm-env-item ${itemOn ? 'is-on' : ''} ${selectedModule === item.module ? 'is-selected' : ''}`}
                              onClick={() => setSelectedModule(item.module)}
                            >
                              <label
                                className="perm-switch"
                                onClick={(e) => e.stopPropagation()}
                                title={itemOn ? 'Bloquear ambiente' : 'Liberar ambiente'}
                              >
                                <input
                                  type="checkbox"
                                  checked={itemOn}
                                  onChange={() => handleToggleModule(item.module)}
                                />
                                <span className="perm-switch-slider" />
                              </label>
                              <span className="perm-env-item-text">
                                <span className="perm-env-item-name">{item.label}</span>
                                <span className="perm-env-item-meta">{line}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="perm-detail">
                        {!hasAccess ? (
                          <div className="perm-detail-empty">
                            <p><strong>{group.label}</strong> está bloqueado para este usuário.</p>
                            <button type="button" className="perm-detail-unlock" onClick={() => handleToggleModule(group.module)}>
                              Liberar {group.label}
                            </button>
                          </div>
                        ) : (
                          <>
                            {requiresFilial && (
                              <div className="perm-filial-bar">
                                <div className="perm-filial-bar-head">
                                  <span>Filiais da sessão</span>
                                  {branches.length < moduleBranches.length && (
                                    <span
                                      className="module-access-quick-action"
                                      onClick={() => handleToggleModule(group.module, true)}
                                    >
                                      Todas
                                    </span>
                                  )}
                                </div>
                                <div className="perm-check-row">
                                  {moduleBranches.map((branch) => (
                                    <label key={branch} className="perm-check">
                                      <input
                                        type="checkbox"
                                        checked={isBranchSelected(group.module, branch)}
                                        onChange={() => handleToggleBranch(group.module, branch)}
                                      />
                                      {branch}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="perm-matrix-toolbar">
                              <span>Neste ambiente</span>
                              <span className="module-access-quick-action" onClick={() => handleApplyModulePreset(group.module, 'todas-rotinas')}>
                                Todas as rotinas
                              </span>
                              {hasAcoes && (
                                <>
                                  <span className="module-access-quick-action" onClick={() => handleApplyModulePreset(group.module, 'so-consulta')}>
                                    Só consulta
                                  </span>
                                  <span className="module-access-quick-action" onClick={() => handleApplyModulePreset(group.module, 'todas-acoes')}>
                                    Todas as ações
                                  </span>
                                </>
                              )}
                            </div>

                            <table className="perm-matrix">
                              <thead>
                                <tr>
                                  <th>Rotina</th>
                                  <th className="perm-matrix-col-menu">Menu</th>
                                  <th>Ações desta rotina</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.module === 'Indicadores' && Object.entries(INDICADOR_GROUPS).map(([groupName, items]) => (
                                  <React.Fragment key={groupName}>
                                    <tr className="perm-matrix-group">
                                      <td colSpan={3}>{groupName}</td>
                                    </tr>
                                    {items.map((item) => {
                                      const visible = selectedIndicadores.length === 0 || selectedIndicadores.includes(item.key);
                                      return (
                                        <tr key={item.key} className={visible ? '' : 'is-off'}>
                                          <td>
                                            <span className="perm-matrix-name">{item.label}</span>
                                          </td>
                                          <td className="perm-matrix-col-menu">
                                            <label className="perm-switch" title={visible ? 'Ocultar no menu' : 'Mostrar no menu'}>
                                              <input
                                                type="checkbox"
                                                checked={visible}
                                                onChange={() => handleToggleIndicador(item.key)}
                                              />
                                              <span className="perm-switch-slider" />
                                            </label>
                                          </td>
                                          <td className="perm-matrix-muted">Consulta do indicador</td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                ))}

                                {group.module !== 'Indicadores' && abaItems.map((item) => {
                                  const saved = selectedAbas[group.module] ?? [];
                                  const visible = saved.length === 0 || saved.includes(item.key);
                                  const rotinaFuncoes = funcoesDaAba(group.module, item.key);
                                  return (
                                    <tr key={item.key} className={visible ? '' : 'is-off'}>
                                      <td>
                                        <span className="perm-matrix-name">{item.label}</span>
                                      </td>
                                      <td className="perm-matrix-col-menu">
                                        <label className="perm-switch" title={visible ? 'Ocultar no menu' : 'Mostrar no menu'}>
                                          <input
                                            type="checkbox"
                                            checked={visible}
                                            onChange={() => handleToggleAba(group.module, item.key)}
                                          />
                                          <span className="perm-switch-slider" />
                                        </label>
                                      </td>
                                      <td>
                                        {!visible ? (
                                          <span className="perm-matrix-muted">Oculta no menu</span>
                                        ) : rotinaFuncoes.length === 0 || isSelectedAdmin ? (
                                          <span className="perm-matrix-muted">Só consulta</span>
                                        ) : (
                                          <div className="perm-check-row">
                                            {rotinaFuncoes.map((fn) => (
                                              <label key={fn.key} className="perm-check" title={fn.description}>
                                                <input
                                                  type="checkbox"
                                                  checked={selectedFuncoes.includes(fn.key)}
                                                  onChange={() => handleToggleFuncao(group.module, fn.key)}
                                                />
                                                {fn.label}
                                              </label>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {hasAcoes && (
                              <p className="admin-form-hint" style={{ margin: '8px 0 0' }}>
                                Sem ação marcada na rotina, a pessoa só consulta. Consulta não precisa de caixa.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
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
