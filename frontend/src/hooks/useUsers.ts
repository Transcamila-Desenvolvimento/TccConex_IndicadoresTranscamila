import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { UserQueryParams } from '../types/domain';
import { AUTH_PROFILE_QUERY_KEY } from './useAuthProfile';

export const USERS_QUERY_KEY = ['users'] as const;

export function useUsers(params: UserQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, params],
    queryFn: () => apiService.getUsers(params),
    enabled,
  });
}

/** Filiais disponíveis para recorte por indicador (Admin > Usuários). */
export function useIndicadorFiliaisOpcoes(enabled = true) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, 'indicador-filiais-opcoes'],
    queryFn: () => apiService.getIndicadorFiliaisOpcoes(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiService.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiService.updateUser>[1] }) =>
      apiService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      // Se o admin editar o próprio usuário, o perfil da sessão reflete na hora.
      queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.toggleUserStatus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useForcePasswordChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.forcePasswordChange(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}
