import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { CalendarPersonalEvent } from '../types/domain';

export const CALENDAR_SYSTEM_KEY = ['financeiro', 'calendario', 'sistema'] as const;
export const CALENDAR_PERSONAL_KEY = ['financeiro', 'calendario', 'pessoais'] as const;

export function useCalendarSystemEvents(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: [...CALENDAR_SYSTEM_KEY, start, end],
    queryFn: () => apiService.getCalendarSystemEvents(start, end),
    enabled,
  });
}

export function useCalendarPersonalEvents(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: [...CALENDAR_PERSONAL_KEY, start, end],
    queryFn: () => apiService.getCalendarPersonalEvents(start, end),
    enabled,
  });
}

export function useCreateCalendarPersonalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CalendarPersonalEvent, 'id'>) =>
      apiService.createCalendarPersonalEvent(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_PERSONAL_KEY }),
  });
}

export function useUpdateCalendarPersonalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<CalendarPersonalEvent, 'id'>> }) =>
      apiService.updateCalendarPersonalEvent(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_PERSONAL_KEY }),
  });
}

export function useDeleteCalendarPersonalEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteCalendarPersonalEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_PERSONAL_KEY }),
  });
}
