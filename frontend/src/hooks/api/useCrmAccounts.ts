import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { crmKeys } from './queryKeys';

export interface CrmAccount {
  id: number;
  name: string;
  vat_number: string | null;
  tax_code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmAccountPayload {
  name: string;
  vat_number?: string | null;
  tax_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useCrmAccounts(filters: { q?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  const qs = params.toString();

  return useQuery({
    queryKey: crmKeys.accountList(filters),
    queryFn: () => fetchJson<CrmAccount[]>(`/api/crm/accounts${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}

export function useCrmAccount(id: number | null) {
  return useQuery({
    queryKey: crmKeys.accountDetail(id ?? 0),
    queryFn: () => fetchJson<CrmAccount>(`/api/crm/accounts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCrmAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrmAccountPayload) =>
      fetchJson<CrmAccount>('/api/crm/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.accounts() });
    },
  });
}

export function useUpdateCrmAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CrmAccountPayload> }) =>
      fetchJson<CrmAccount>(`/api/crm/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.accounts() });
      qc.invalidateQueries({ queryKey: crmKeys.accountDetail(vars.id) });
    },
  });
}

export function useDeleteCrmAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/crm/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.accounts() });
    },
  });
}

