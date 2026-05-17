import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { crmKeys } from './queryKeys';

export interface CrmDeal {
  id: number;
  account_id: number;
  title: string;
  amount: number | null;
  currency: string | null;
  stage: string;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDealPayload {
  account_id: number;
  title: string;
  amount?: number | null;
  currency?: string | null;
  stage?: string;
  expected_close_date?: string | null;
}

export interface CrmPipelineStage {
  id: string;
  label: string;
  order: number;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useCrmDeals(filters: { q?: string; stage?: string; accountId?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.stage?.trim()) params.set('stage', filters.stage.trim());
  if (typeof filters.accountId === 'number') params.set('accountId', String(filters.accountId));
  const qs = params.toString();

  return useQuery({
    queryKey: crmKeys.dealList(filters),
    queryFn: () => fetchJson<CrmDeal[]>(`/api/crm/deals${qs ? `?${qs}` : ''}`),
    staleTime: 30_000,
  });
}

export function useCrmAccountDeals(accountId: number | null) {
  return useQuery({
    queryKey: crmKeys.accountDeals(accountId ?? 0),
    queryFn: () => fetchJson<CrmDeal[]>(`/api/crm/accounts/${accountId}/deals`),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
}

export function useCrmPipeline() {
  return useQuery({
    queryKey: crmKeys.pipeline(),
    queryFn: () => fetchJson<CrmPipelineStage[]>(`/api/crm/pipeline`),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCrmDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrmDealPayload) =>
      fetchJson<CrmDeal>('/api/crm/deals', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() });
      qc.invalidateQueries({ queryKey: crmKeys.accounts() });
      qc.invalidateQueries({ queryKey: crmKeys.accountDeals(deal.account_id) });
    },
  });
}

export function useUpdateCrmDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CrmDealPayload> }) =>
      fetchJson<CrmDeal>(`/api/crm/deals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() });
      qc.invalidateQueries({ queryKey: crmKeys.dealDetail(deal.id) });
      qc.invalidateQueries({ queryKey: crmKeys.accountDeals(deal.account_id) });
    },
  });
}

export function useDeleteCrmDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/crm/deals/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() });
      qc.invalidateQueries({ queryKey: crmKeys.accounts() });
    },
  });
}

