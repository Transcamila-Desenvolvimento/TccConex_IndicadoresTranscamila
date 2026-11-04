import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionOnlineIds } from '../../contexts/SessionPresence';
import type { User } from '../../types/domain';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
  useForcePasswordChange,
  useIndicadorFiliaisOpcoes,
} from '../../hooks/useUsers';
import { useRoles } from '../../hooks/useRoles';
import {
  ADMIN_ENVIRONMENT,
  environmentRequiresFilial,
  normalizeEnvironment,
} from '../../constants/environments';
import { INDICADOR_ITEMS, INDICADORES_COM_FILIAL, type IndicadorKey } from '../../constants/indicadores';
import { funcoesDaAba, funcoesDoModulo, isFuncaoOptIn, type FuncaoKey } from '../../constants/funcoes';
import { abasDoModulo, blocosDeRotina, detalheDaRotina, HOME_ABA_KEY, rotinasConfiguraveisDoModulo } from '../../constants/abas';
import { branchesForModule } from '../../constants/filiais';
import QueryDataPanel from '../../components/QueryDataPanel';
import UserAvatar from '../../components/UserAvatar';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function chavesDoModulo(module: string): string[] {
  return abasDoModulo(module).map((item) => item.key as string);
}

function rotinaNovaBloqueada(key: string, auditoriasOptIn: boolean, sipocOptIn: boolean) {
  if (auditoriasOptIn && key.startsWith('auditorias')) return true;
  return sipocOptIn && key === 'sipoc';
}

/** No Azure, lista vazia continua significando as rotinas antigas. Auditorias e SIPOC ficam de fora até serem gravados. */
function rotinasMarcadas(module: string, saved: string[], auditoriasOptIn: boolean, sipocOptIn: boolean): string[] {
  const catalog = chavesDoModulo(module);
  if (saved.length === 0) {
    return catalog.filter((key) => !rotinaNovaBloqueada(key, auditoriasOptIn, sipocOptIn));
  }
  return catalog.filter((key) => saved.includes(key));
}

function gravacaoDasRotinas(module: string, marcadas: string[], auditoriasOptIn: boolean, sipocOptIn: boolean): string[] {
  const catalog = chavesDoModulo(module);
  const unique = catalog.filter((key) => marcadas.includes(key));
  const classicas = catalog.filter((key) => !rotinaNovaBloqueada(key, auditoriasOptIn, sipocOptIn));
  const soClassicas = unique.length === classicas.length && classicas.every((key) => unique.includes(key));
  if (soClassicas) return [];
  const temNovidade = catalog.some((key) => rotinaNovaBloqueada(key, auditoriasOptIn, sipocOptIn));
  if (unique.length === catalog.length && !temNovidade) return [];
  return unique;
}

function mascaraCpf(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

const MODULE_ACCESS_GROUPS = [
  { module: 'Financeiro', label: 'Financeiro' },
  { module: 'Faturamento', label: 'Faturamento' },
  { module: 'Indicadores', label: 'Indicadores' },
  { module: 'Compras', label: 'Compras' },
  { module: 'RH', label: 'RH' },
  { module: 'SGQ', label: 'SGQ' },
  { module: 'Marketing', label: 'Marketing' },
  { module: 'Logística', label: 'Logística' },
  { module: 'Frota', label: 'Frota' },
  { module: 'Comercial', label: 'Comercial' },
  { module: 'CamiloIA', label: 'CamiloIA' },
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
  const [pageSize, setPageSize] = useState(10);

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: searchQuery.trim() || undefined,
    roleId: roleFilter !== 'todos' ? roleFilter : undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
  }), [currentPage, pageSize, searchQuery, roleFilter, statusFilter]);

  const usersQuery = useUsers(queryParams);
  const onlineIds = useSessionOnlineIds();
  const usersPage = usersQuery.data;
  const usersList = useMemo(() => usersPage?.results ?? [], [usersPage]);
  const usersQueryState = useAsyncQueryState(usersQuery);

  const totalItems = usersPage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
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
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfObrigatorio, setCpfObrigatorio] = useState(true);
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('2');
  const [status, setStatus] = useState('ativo');
  const [moduleAccess, setModuleAccess] = useState<Record<string, string[]>>({});
  const [selectedIndicadores, setSelectedIndicadores] = useState<IndicadorKey[]>([]);
  const [indicadorFiliais, setIndicadorFiliais] = useState<Record<string, string[]>>({});
  const [funcoes, setFuncoes] = useState<Record<string, string[]>>({});
  const [funcaoFiliais, setFuncaoFiliais] = useState<Record<string, Record<string, string[]>>>({});
  const [selectedAbas, setSelectedAbas] = useState<Record<string, string[]>>({});
  const [abaFiliais, setAbaFiliais] = useState<Record<string, Record<string, string[]>>>({});
  const [selectedModule, setSelectedModule] = useState<string>(MODULE_ACCESS_GROUPS[0].module);
  const [filialVista, setFilialVista] = useState<string | null>(null);

  const isSelectedAdmin = roleId === '1';
  const auditoriasOptIn = currentUser?.sgqAuditoriasLiberadas !== true;
  const sipocOptIn = currentUser?.sgqSipocLiberado !== true;
  const { data: indicadorFiliaisOpcoes = {} } = useIndicadorFiliaisOpcoes(isModalOpen);
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
    setCargo('');
    setTelefone('');
    setCpf('');
    setCpfObrigatorio(true);
    setPassword('');
    setRoleId(defaultRoleId);
    setStatus('ativo');
    setModuleAccess({});
    setSelectedIndicadores([]);
    setIndicadorFiliais({});
    setFuncoes({});
    setFuncaoFiliais({});
    setSelectedAbas({});
    setAbaFiliais({});
    setSelectedModule(MODULE_ACCESS_GROUPS[0].module);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setName(user.name);
    setCargo(user.cargo || '');
    setTelefone(user.telefone || '');
    setCpf(user.cpf || '');
    setCpfObrigatorio(Boolean((user.cpf || '').replace(/\D/g, '')));
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
    setIndicadorFiliais(user.indicadorFiliais ?? {});
    setFuncoes(user.funcoes ?? {});
    setFuncaoFiliais(user.funcaoFiliais ?? {});
    const nextAbas: Record<string, string[]> = {};
    MODULE_ACCESS_GROUPS.forEach((group) => {
      if (group.module === 'Indicadores') return;
      const catalog = abasDoModulo(group.module).map((item) => item.key as string);
      nextAbas[group.module] = (user.abas?.[group.module] ?? []).filter((key) => catalog.includes(key));
    });
    setSelectedAbas(nextAbas);
    setAbaFiliais(user.abaFiliais ?? {});
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

    // Recorte de filiais só vale para indicadores visíveis ao usuário.
    const indicadorFiliaisFiltradas = Object.fromEntries(
      Object.entries(indicadorFiliais).filter(([key, lista]) => (
        hasIndicadoresModule
        && lista.length > 0
        && (indicadores.length === 0 || indicadores.includes(key as IndicadorKey))
      )),
    );

    const abas: Record<string, string[]> = {};
    for (const group of MODULE_ACCESS_GROUPS) {
      if (group.module === 'Indicadores' || !environments.includes(group.module)) continue;
      const catalog = chavesDoModulo(group.module);
      const keys = gravacaoDasRotinas(
        group.module,
        rotinasMarcadas(group.module, selectedAbas[group.module] ?? [], auditoriasOptIn, sipocOptIn),
        auditoriasOptIn,
        sipocOptIn,
      );
      if (keys.length > 0) {
        abas[group.module] = catalog.includes(HOME_ABA_KEY) && !keys.includes(HOME_ABA_KEY)
          ? [HOME_ABA_KEY, ...keys]
          : keys;
      }
    }

    const abaFiliaisFiltradas = Object.fromEntries(
      Object.entries(abaFiliais).flatMap(([module, porAba]) => {
        if (!environments.includes(module)) return [];
        const permitidas = new Set(filiais[module] ?? []);
        const visiveis = new Set(abas[module] ?? chavesDoModulo(module));
        const limpas = Object.fromEntries(
          Object.entries(porAba).flatMap(([aba, lista]) => {
            const validas = lista.filter((filial) => permitidas.has(filial));
            if (!visiveis.has(aba) || validas.length === 0 || validas.length >= permitidas.size) return [];
            return [[aba, validas]];
          }),
        );
        return Object.keys(limpas).length ? [[module, limpas]] : [];
      }),
    );

    // Só envia funções de módulos que o usuário realmente tem acesso.
    const funcoesFiltradas = Object.fromEntries(
      Object.entries(funcoes).filter(([module, keys]) => environments.includes(module) && keys.length > 0),
    );

    const funcaoFiliaisFiltradas = Object.fromEntries(
      Object.entries(funcaoFiliais).flatMap(([module, porFuncao]) => {
        if (!environments.includes(module)) return [];
        const permitidas = new Set(filiais[module] ?? []);
        const liberadas = new Set(funcoesFiltradas[module] ?? []);
        const limpas = Object.fromEntries(
          Object.entries(porFuncao).flatMap(([funcao, lista]) => {
            const validas = lista.filter((filial) => permitidas.has(filial));
            if (!liberadas.has(funcao) || validas.length === 0 || validas.length >= permitidas.size) return [];
            return [[funcao, validas]];
          }),
        );
        return Object.keys(limpas).length ? [[module, limpas]] : [];
      }),
    );

    const userData: any = {
      username,
      name,
      cargo: cargo.trim(),
      telefone: telefone.trim(),
      cpf: cpf.trim(),
      roleId,
      status,
      environments,
      filiais,
      indicadores,
      indicadorFiliais: indicadorFiliaisFiltradas,
      funcoes: funcoesFiltradas,
      funcaoFiliais: funcaoFiliaisFiltradas,
      abas,
      abaFiliais: abaFiliaisFiltradas,
    };
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
      const data = err?.response?.data;
      const detail = data?.detail || data?.cpf?.[0] || data?.username?.[0] || err.message || 'Erro ao salvar usuário.';
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
    setAbaFiliais((prev) => {
      const porAba = prev[module];
      if (!porAba) return prev;
      const limpo = Object.fromEntries(
        Object.entries(porAba).map(([aba, lista]) => [aba, lista.filter((filial) => filial !== branch)]),
      );
      return { ...prev, [module]: limpo };
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

  const handleToggleIndicadorFilial = (indicador: IndicadorKey, filial: string) => {
    setIndicadorFiliais((prev) => {
      const atual = prev[indicador] ?? [];
      const proximo = atual.includes(filial) ? atual.filter((f) => f !== filial) : [...atual, filial];
      return { ...prev, [indicador]: proximo };
    });
  };

  const handleToggleAba = (module: string, key: string) => {
    if (key === HOME_ABA_KEY) return;
    const catalog = chavesDoModulo(module);
    const current = rotinasMarcadas(module, selectedAbas[module] ?? [], auditoriasOptIn, sipocOptIn);
    const turningOff = current.includes(key);
    if (turningOff && current.length <= 1) return;
    const next = turningOff ? current.filter((k) => k !== key) : [...current, key];
    if (!next.includes(HOME_ABA_KEY) && catalog.includes(HOME_ABA_KEY)) {
      next.unshift(HOME_ABA_KEY);
    }
    setSelectedAbas((prev) => ({ ...prev, [module]: gravacaoDasRotinas(module, next, auditoriasOptIn, sipocOptIn) }));
    if (turningOff) {
      const keysDaAba = funcoesDaAba(module, key).map((item) => item.key);
      setFuncoes((prev) => ({
        ...prev,
        [module]: (prev[module] ?? []).filter((fn) => !keysDaAba.includes(fn as FuncaoKey)),
      }));
      setAbaFiliais((prev) => {
        const porAba = { ...(prev[module] ?? {}) };
        delete porAba[key];
        return { ...prev, [module]: porAba };
      });
    }
  };

  const definirRotinaNaFilial = (module: string, key: string, filial: string, sessionBranches: string[]) => {
    if (key === HOME_ABA_KEY) return;
    const marcadas = rotinasMarcadas(module, selectedAbas[module] ?? [], auditoriasOptIn, sipocOptIn);
    const noMenu = marcadas.includes(key);
    const salvas = (abaFiliais[module]?.[key] ?? []).filter((item) => sessionBranches.includes(item));
    const efetivas = !noMenu ? [] : (salvas.length === 0 ? [...sessionBranches] : salvas);
    const proximo = efetivas.includes(filial)
      ? efetivas.filter((item) => item !== filial)
      : [...efetivas, filial];
    if (proximo.length === 0) {
      if (noMenu && marcadas.length <= 1) return;
      handleToggleAba(module, key);
      return;
    }
    if (!noMenu) handleToggleAba(module, key);
    setAbaFiliais((prev) => {
      const porAba = { ...(prev[module] ?? {}) };
      if (proximo.length >= sessionBranches.length) delete porAba[key];
      else porAba[key] = proximo;
      return { ...prev, [module]: porAba };
    });
  };

  const definirFuncaoNaFilial = (module: string, funcao: string, filial: string, sessionBranches: string[]) => {
    const tem = (funcoes[module] ?? []).includes(funcao);
    const salvas = (funcaoFiliais[module]?.[funcao] ?? []).filter((item) => sessionBranches.includes(item));
    const efetivas = !tem ? [] : (salvas.length === 0 ? [...sessionBranches] : salvas);
    const proximo = efetivas.includes(filial)
      ? efetivas.filter((item) => item !== filial)
      : [...efetivas, filial];
    setFuncoes((prev) => {
      const atual = prev[module] ?? [];
      const next = proximo.length === 0
        ? atual.filter((item) => item !== funcao)
        : (atual.includes(funcao) ? atual : [...atual, funcao]);
      return { ...prev, [module]: next };
    });
    setFuncaoFiliais((prev) => {
      const porFuncao = { ...(prev[module] ?? {}) };
      if (proximo.length === 0 || proximo.length >= sessionBranches.length) delete porFuncao[funcao];
      else porFuncao[funcao] = proximo;
      return { ...prev, [module]: porFuncao };
    });
  };

  const aplicarFuncoesNaFilial = (module: string, ligar: boolean, filial: string, sessionBranches: string[]) => {
    const atuais = new Set(funcoes[module] ?? []);
    const por = { ...(funcaoFiliais[module] ?? {}) };
    funcoesDoModulo(module).filter((item) => !isFuncaoOptIn(item)).forEach((item) => {
      const salvas = (por[item.key] ?? []).filter((nome) => sessionBranches.includes(nome));
      const efetivas = !atuais.has(item.key) ? [] : (salvas.length === 0 ? [...sessionBranches] : salvas);
      if (efetivas.includes(filial) === ligar) return;
      const proximo = ligar ? [...efetivas, filial] : efetivas.filter((nome) => nome !== filial);
      if (proximo.length === 0) {
        atuais.delete(item.key);
        delete por[item.key];
      } else {
        atuais.add(item.key);
        if (proximo.length >= sessionBranches.length) delete por[item.key];
        else por[item.key] = proximo;
      }
    });
    setFuncoes((prev) => ({ ...prev, [module]: [...atuais] }));
    setFuncaoFiliais((prev) => ({ ...prev, [module]: por }));
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
      setSelectedAbas((prev) => ({
        ...prev,
        [module]: auditoriasOptIn && module === 'SGQ'
          ? chavesDoModulo(module).filter((key) => !(sipocOptIn && key === 'sipoc'))
          : [],
      }));
      return;
    }
    if (preset === 'so-consulta') {
      setFuncoes((prev) => ({
        ...prev,
        [module]: (prev[module] ?? []).filter((key) =>
          funcoesDoModulo(module).some((item) => item.key === key && isFuncaoOptIn(item)),
        ),
      }));
      return;
    }
    setFuncoes((prev) => ({
      ...prev,
      [module]: funcoesDoModulo(module).filter((item) => !isFuncaoOptIn(item)).map((item) => item.key),
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
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Conta Google</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Senha</th>
                  <th>Último Acesso</th>
                </tr>
              </thead>
              <tbody>
                {usersQueryState.canShowEmpty && usersList.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum usuário operacional cadastrado com os filtros ativos.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => {
                    const roleName = roles.find(r => r.id === u.roleId)?.name || 'Operador';

                    const lastLoginStr = u.lastLogin
                      ? new Date(u.lastLogin).toLocaleDateString('pt-BR') + ' ' + new Date(u.lastLogin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'Nunca logou';
                    const googleEmail = (u.googleEmail || '').trim();

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
                            <UserAvatar
                              name={u.name || u.username}
                              photo={u.googlePicture}
                              size="md"
                              online={onlineIds.has(u.id)}
                              title={
                                onlineIds.has(u.id)
                                  ? `${u.name || u.username} · Online agora`
                                  : (googleEmail ? `${u.name} · ${googleEmail}` : u.name)
                              }
                              className="admin-users-avatar"
                            />
                            <strong>{u.username}</strong>
                          </div>
                        </td>
                        <td>{u.name}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {(u.cpf || '').trim() ? u.cpf : <small style={{ color: 'var(--text-muted)' }}>—</small>}
                        </td>
                        <td>
                          {(u.cargo || '').trim() ? (
                            u.cargo
                          ) : (
                            <small style={{ color: 'var(--text-muted)' }}>—</small>
                          )}
                        </td>
                        <td>
                          {googleEmail ? (
                            <span title={googleEmail}>{googleEmail}</span>
                          ) : (
                            <small style={{ color: 'var(--text-muted)' }}>Não vinculado</small>
                          )}
                        </td>
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
          <div className="erp-pagination-page-size">
            <label htmlFor="admin-users-page-size">Itens por página</label>
            <select
              id="admin-users-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          </div>
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
        <div className="search-backdrop admin-user-modal-backdrop" id="user-admin-modal" onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div
            className="search-modal-card admin-user-modal-card admin-user-modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-title"
          >
            <div className="admin-user-drawer-header">
              <h3 id="admin-modal-title">
                {editingUserId ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </h3>
              <span className="search-close-key" onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>

            <form id="admin-user-form" className="admin-user-form" onSubmit={handleSubmit}>
              <div className="admin-user-form-body">
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
                <div className="admin-form-row" style={{ marginTop: '10px' }}>
                  <div className="login-group">
                    <label htmlFor="admin-user-cpf">
                      CPF
                      {!cpfObrigatorio && (
                        <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (opcional neste cadastro antigo)</small>
                      )}
                    </label>
                    <input
                      type="text"
                      id="admin-user-cpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      required={cpfObrigatorio}
                      maxLength={14}
                      value={cpf}
                      onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="admin-form-row" style={{ marginTop: '10px' }}>
                  <div className="login-group">
                    <label htmlFor="admin-user-cargo">Cargo <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                    <input
                      type="text"
                      id="admin-user-cargo"
                      placeholder="Ex: Analista Comercial"
                      maxLength={120}
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      autoComplete="organization-title"
                    />
                  </div>
                  <div className="login-group">
                    <label htmlFor="admin-user-telefone">Telefone <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                    <input
                      type="tel"
                      id="admin-user-telefone"
                      placeholder="Ex: (43) 99999-9999"
                      maxLength={80}
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      autoComplete="tel"
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
                    Escolha o ambiente à esquerda. Se houver mais de uma filial, abra a unidade e ligue só as rotinas dela.
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
                  const hasAcoes = funcaoItems.length > 0 && !isSelectedAdmin;
                  const porFilial = requiresFilial && branches.length > 1 && !isSelectedAdmin;
                  const filialAtiva = porFilial
                    ? (filialVista && branches.includes(filialVista) ? filialVista : branches[0])
                    : null;

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
                              const marcadas = rotinasMarcadas(item.module, selectedAbas[item.module] ?? [], auditoriasOptIn, sipocOptIn);
                              return configuraveis.filter((aba) => marcadas.includes(aba.key)).length;
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

                            {porFilial && filialAtiva && (
                              <div className="perm-filial-vista" role="tablist" aria-label="Filial em edição">
                                {branches.map((branch) => (
                                  <button
                                    key={branch}
                                    type="button"
                                    role="tab"
                                    aria-selected={filialAtiva === branch}
                                    className={`perm-filial-vista-btn${filialAtiva === branch ? ' is-on' : ''}`}
                                    onClick={() => setFilialVista(branch)}
                                  >
                                    {branch}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="perm-matrix-toolbar">
                              <span>{filialAtiva ? `Em ${filialAtiva}` : 'Neste ambiente'}</span>
                              <span className="module-access-quick-action" onClick={() => handleApplyModulePreset(group.module, 'todas-rotinas')}>
                                Todas as rotinas
                              </span>
                              {hasAcoes && (
                                <>
                                  <span
                                    className="module-access-quick-action"
                                    onClick={() => {
                                      if (filialAtiva) aplicarFuncoesNaFilial(group.module, false, filialAtiva, branches);
                                      else handleApplyModulePreset(group.module, 'so-consulta');
                                    }}
                                  >
                                    Só consulta
                                  </span>
                                  <span
                                    className="module-access-quick-action"
                                    onClick={() => {
                                      if (filialAtiva) aplicarFuncoesNaFilial(group.module, true, filialAtiva, branches);
                                      else handleApplyModulePreset(group.module, 'todas-acoes');
                                    }}
                                  >
                                    Todas as ações
                                  </span>
                                </>
                              )}
                            </div>

                            {group.module === 'Indicadores' && (
                            <table className="perm-matrix">
                              <thead>
                                <tr>
                                  <th>Rotina</th>
                                  <th className="perm-matrix-col-menu">Menu</th>
                                  <th>Ações desta rotina</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(INDICADOR_GROUPS).map(([groupName, items]) => (
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
                                          {visible && INDICADORES_COM_FILIAL.includes(item.key) ? (
                                            <td>
                                              {isSelectedAdmin ? (
                                                <span className="perm-matrix-muted">Administrador vê todas as filiais</span>
                                              ) : (
                                                <div className="perm-check-row" title="Nenhuma marcada = todas as filiais">
                                                  <span className="perm-matrix-muted">
                                                    {(indicadorFiliais[item.key]?.length ?? 0) === 0 ? 'Todas as filiais ·' : 'Só as filiais:'}
                                                  </span>
                                                  {(indicadorFiliaisOpcoes[item.key] ?? []).map((filial) => (
                                                    <label key={filial} className="perm-check">
                                                      <input
                                                        type="checkbox"
                                                        checked={(indicadorFiliais[item.key] ?? []).includes(filial)}
                                                        onChange={() => handleToggleIndicadorFilial(item.key, filial)}
                                                      />
                                                      {filial}
                                                    </label>
                                                  ))}
                                                </div>
                                              )}
                                            </td>
                                          ) : (
                                            <td className="perm-matrix-muted">Consulta do indicador</td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                            )}

                            {group.module !== 'Indicadores' && (
                              <div className="perm-blocos">
                                {blocosDeRotina(group.module).flatMap((bloco) => {
                                  const cartoes = bloco.titulo
                                    ? [bloco]
                                    : bloco.items.map((item) => ({ titulo: '', items: [item] }));
                                  return cartoes.map((cartao) => {
                                    const unico = cartao.items.length === 1 ? cartao.items[0] : null;
                                    const visivel = (key: string) => rotinasMarcadas(
                                      group.module,
                                      selectedAbas[group.module] ?? [],
                                      auditoriasOptIn,
                                      sipocOptIn,
                                    ).includes(key);
                                    const porFilial = requiresFilial && branches.length > 1 && !isSelectedAdmin;
                                    const filialAtiva = porFilial
                                      ? (filialVista && branches.includes(filialVista) ? filialVista : branches[0])
                                      : null;
                                    const ligadaAqui = (key: string) => {
                                      if (!visivel(key)) return false;
                                      if (!filialAtiva) return true;
                                      const lista = (abaFiliais[group.module]?.[key] ?? [])
                                        .filter((item) => branches.includes(item));
                                      return lista.length === 0 || lista.includes(filialAtiva);
                                    };
                                    const alternar = (key: string) => {
                                      if (filialAtiva) definirRotinaNaFilial(group.module, key, filialAtiva, branches);
                                      else handleToggleAba(group.module, key);
                                    };
                                    const funcaoMarcada = (funcao: string) => {
                                      if (!selectedFuncoes.includes(funcao)) return false;
                                      if (!filialAtiva) return true;
                                      const lista = (funcaoFiliais[group.module]?.[funcao] ?? [])
                                        .filter((item) => branches.includes(item));
                                      return lista.length === 0 || lista.includes(filialAtiva);
                                    };
                                    const acoesDaLinha = (key: string, ligado: boolean) => {
                                      if (!ligado) {
                                        return <span className="perm-matrix-muted">{filialAtiva ? 'Oculta nesta filial' : 'Oculta no menu'}</span>;
                                      }
                                      const rotinaFuncoes = funcoesDaAba(group.module, key);
                                      const acoesVisiveis = (isSelectedAdmin
                                        ? rotinaFuncoes.filter((fn) => isFuncaoOptIn(fn))
                                        : rotinaFuncoes);
                                      if (acoesVisiveis.length === 0) return <span className="perm-matrix-muted">Só consulta</span>;
                                      return (
                                        <div className="perm-bloco-acoes">
                                          {acoesVisiveis.map((fn) => (
                                            <label key={fn.key} className="perm-check" title={fn.description}>
                                              <input
                                                type="checkbox"
                                                checked={funcaoMarcada(fn.key)}
                                                onChange={() => {
                                                  if (filialAtiva) definirFuncaoNaFilial(group.module, fn.key, filialAtiva, branches);
                                                  else handleToggleFuncao(group.module, fn.key);
                                                }}
                                              />
                                              {fn.label}
                                            </label>
                                          ))}
                                        </div>
                                      );
                                    };
                                    if (unico) {
                                      const ligado = ligadaAqui(unico.key);
                                      return (
                                        <div key={unico.key} className={`perm-bloco${ligado ? '' : ' is-off'}`}>
                                          <div className="perm-bloco-head is-rotina">
                                            <label className="perm-switch" title={ligado ? (filialAtiva ? 'Ocultar nesta filial' : 'Ocultar no menu') : (filialAtiva ? 'Mostrar nesta filial' : 'Mostrar no menu')}>
                                              <input
                                                type="checkbox"
                                                checked={ligado}
                                                onChange={() => alternar(unico.key)}
                                              />
                                              <span className="perm-switch-slider" />
                                            </label>
                                            <div className="perm-bloco-titulo">
                                              <strong>{unico.label}</strong>
                                              {detalheDaRotina(group.module, unico.key) && (
                                                <span className="perm-matrix-sub">{detalheDaRotina(group.module, unico.key)}</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="perm-bloco-foot">{acoesDaLinha(unico.key, ligado)}</div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={cartao.titulo} className="perm-bloco">
                                        <div className="perm-bloco-head">
                                          <strong>{cartao.titulo}</strong>
                                        </div>
                                        {cartao.items.map((item) => {
                                          const ligado = ligadaAqui(item.key);
                                          return (
                                            <div key={item.key} className={`perm-bloco-item ${ligado ? '' : 'is-off'}`}>
                                              <label className="perm-switch" title={ligado ? (filialAtiva ? 'Ocultar nesta filial' : 'Ocultar no menu') : (filialAtiva ? 'Mostrar nesta filial' : 'Mostrar no menu')}>
                                                <input
                                                  type="checkbox"
                                                  checked={ligado}
                                                  onChange={() => alternar(item.key)}
                                                />
                                                <span className="perm-switch-slider" />
                                              </label>
                                              <span className="perm-matrix-name">{item.label}</span>
                                              {acoesDaLinha(item.key, ligado)}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  });
                                })}
                              </div>
                            )}
                            {hasAcoes && !isSelectedAdmin && (
                              <p className="admin-form-hint" style={{ margin: '8px 0 0' }}>
                                Sem ação marcada, a rotina fica só para consulta nesta filial.
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
              </div>

              <div className="admin-user-form-footer">
                <button type="submit" className="btn-login" id="btn-admin-submit-user">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPanel;
