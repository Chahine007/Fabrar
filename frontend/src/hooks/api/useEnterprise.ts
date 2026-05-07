import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { accountingKeys, dashboardKeys, enterpriseKeys, hrKeys, magazzinoKeys, materialRequestKeys } from './queryKeys';

type JsonRecord = Record<string, unknown>;

export interface WorkflowTransitionPayload {
  entityType: string;
  id: number | string;
  action: string;
  payload?: JsonRecord;
  reason?: string;
}

export interface LedgerBackfillPayload {
  dryRun?: boolean;
  limit?: number;
}

export interface OutboxFilters {
  status?: string;
  event_type?: string;
  aggregate_type?: string;
  limit?: number;
}

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string | number;
  action?: string;
  actor_user_id?: string | number;
  actor_employee_id?: string | number;
  correlation_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface BiJobCostingFilters {
  cantiere_id?: number | string;
}

function buildQuery(filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useBiOverview() {
  return useQuery({
    queryKey: enterpriseKeys.biOverview(),
    queryFn: () => fetchJson('/api/bi/overview'),
    staleTime: 60_000,
  });
}

export function useBiJobCosting(filters: BiJobCostingFilters = {}) {
  return useQuery({
    queryKey: enterpriseKeys.biJobCosting(filters),
    queryFn: () => fetchJson(`/api/bi/job-costing${buildQuery(filters)}`),
    staleTime: 60_000,
  });
}

export function useDataQuality() {
  return useQuery({
    queryKey: enterpriseKeys.dataQuality(),
    queryFn: () => fetchJson('/api/bi/data-quality'),
    staleTime: 60_000,
  });
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: enterpriseKeys.auditLogs(filters),
    queryFn: () => fetchJson(`/api/audit/logs${buildQuery(filters)}`),
    staleTime: 30_000,
  });
}

export function useOutboxEvents(filters: OutboxFilters = {}) {
  return useQuery({
    queryKey: enterpriseKeys.outbox(filters),
    queryFn: () => fetchJson(`/api/outbox${buildQuery(filters)}`),
    staleTime: 15_000,
  });
}

export function useRetryOutboxEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchJson(`/api/outbox/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enterpriseKeys.all() });
    },
  });
}

export function useFlushOutbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) =>
      fetchJson('/api/outbox/flush', {
        method: 'POST',
        body: JSON.stringify(limit ? { limit } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enterpriseKeys.all() });
    },
  });
}

export function useLedgerBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LedgerBackfillPayload = { dryRun: true }) =>
      fetchJson(`/api/ledger/backfill${buildQuery({ dryRun: payload.dryRun ?? true, limit: payload.limit })}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enterpriseKeys.all() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
    },
  });
}

export function useWorkflowTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, id, action, payload, reason }: WorkflowTransitionPayload) =>
      fetchJson(`/api/workflows/${entityType}/${id}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ action, payload, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enterpriseKeys.all() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.all() });
      queryClient.invalidateQueries({ queryKey: hrKeys.all() });
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.all() });
      queryClient.invalidateQueries({ queryKey: materialRequestKeys.all() });
    },
  });
}
