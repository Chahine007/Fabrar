import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { cantierKeys } from './queryKeys';

export function useCantiereSettings(cantiereId: number | null) {
  return useQuery({
    queryKey: cantierKeys.settings(cantiereId!),
    queryFn: async () => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/settings`);
      if (!res.ok) {
        throw new Error('Errore nel recupero impostazioni cantiere');
      }
      return res.json();
    },
    enabled: cantiereId !== null,
  });
}

export function useUpdateCantiereSettings(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Errore salvataggio impostazioni');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.settings(cantiereId) });
      qc.invalidateQueries({ queryKey: cantierKeys.detail(cantiereId) });
      qc.invalidateQueries({ queryKey: cantierKeys.list() });
    },
  });
}
