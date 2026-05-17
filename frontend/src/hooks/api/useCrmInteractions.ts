import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { crmKeys } from './queryKeys';

export type CrmInteractionType = 'call' | 'email' | 'meeting' | 'note';

export interface CrmInteraction {
  id: number;
  account_id: number;
  type: CrmInteractionType;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export interface CrmInteractionPayload {
  type: CrmInteractionType;
  subject?: string | null;
  body?: string | null;
  occurred_at: string;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useCrmAccountInteractions(accountId: number | null) {
  return useQuery({
    queryKey: crmKeys.accountInteractions(accountId ?? 0),
    queryFn: () => fetchJson<CrmInteraction[]>(`/api/crm/accounts/${accountId}/interactions`),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
}

export function useCreateCrmInteraction(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrmInteractionPayload) =>
      fetchJson<CrmInteraction>(`/api/crm/accounts/${accountId}/interactions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.accountInteractions(accountId) });
    },
  });
}

export function useDeleteCrmInteraction(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interactionId: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/crm/interactions/${interactionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.accountInteractions(accountId) });
    },
  });
}

