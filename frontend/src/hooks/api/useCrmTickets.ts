import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { crmKeys } from './queryKeys';

export type CrmTicketStatus = 'open' | 'pending' | 'closed';

export interface CrmTicket {
  id: number;
  account_id: number;
  subject: string;
  status: CrmTicketStatus;
  priority: 'low' | 'medium' | 'high' | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTicketPayload {
  account_id: number;
  subject: string;
  status?: CrmTicketStatus;
  priority?: 'low' | 'medium' | 'high' | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useCrmAccountTickets(accountId: number | null) {
  return useQuery({
    queryKey: crmKeys.accountTickets(accountId ?? 0),
    queryFn: () => fetchJson<CrmTicket[]>(`/api/crm/accounts/${accountId}/tickets`),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
}

export function useCreateCrmTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrmTicketPayload) =>
      fetchJson<CrmTicket>('/api/crm/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: crmKeys.accountTickets(ticket.account_id) });
    },
  });
}

export function useUpdateCrmTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CrmTicketPayload> }) =>
      fetchJson<CrmTicket>(`/api/crm/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: crmKeys.accountTickets(ticket.account_id) });
    },
  });
}

export function useDeleteCrmTicket(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/crm/tickets/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.accountTickets(accountId) });
    },
  });
}

