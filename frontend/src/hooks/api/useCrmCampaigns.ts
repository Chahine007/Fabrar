import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { crmKeys } from './queryKeys';

export interface CrmCampaign {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  channel: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmCampaignPayload {
  name: string;
  status?: CrmCampaign['status'];
  channel?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useCrmCampaigns(filters: { q?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  const qs = params.toString();

  return useQuery({
    queryKey: crmKeys.campaignList(filters),
    queryFn: () => fetchJson<CrmCampaign[]>(`/api/crm/campaigns${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}

export function useCreateCrmCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CrmCampaignPayload) =>
      fetchJson<CrmCampaign>('/api/crm/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.campaigns() });
    },
  });
}

