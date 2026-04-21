/**
 * useHr.ts — React Query hooks per HR: audit, alert, pending summary, approvazioni.
 * Supporta filtri query (type, status, employee_id) per selezione granulare.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { hrKeys, employeeKeys } from './queryKeys';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  cantiere_id: number | null;
  hourly_cost: number | null;
}

export interface HrAlert {
  employee_id: number;
  employee_name: string;
  days_zero_hours: number;
  last_report_date: string | null;
}

export type AuditType = 'ore' | 'spese';
export type AuditStatus = 'pending' | 'verified' | 'rejected';

export interface AuditEntry {
  id: number;
  type: AuditType;
  status: AuditStatus;
  input_method: string;
  date: string;
  value: number;
  employee_id: number;
  nome: string | null;
  cognome: string | null;
  note: string | null;
  cantiere_nome: string | null;
  report_id?: number;
}

export interface PendingSummary {
  reports: number;
  spese: number;
}

export interface AuditFilters {
  type?: AuditType;
  status?: AuditStatus;
  employee_id?: string;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.employee_id) params.set('employee_id', filters.employee_id);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useEmployees() {
  return useQuery({
    queryKey: employeeKeys.list(),
    queryFn: () => fetchJson<Employee[]>('/api/employees'),
  });
}

export function useHrAlerts() {
  return useQuery({
    queryKey: hrKeys.alerts(),
    queryFn: () => fetchJson<HrAlert[]>('/api/hr/alerts'),
    staleTime: 60_000, // alert non cambiano ogni secondo
  });
}

export function useAudit(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: hrKeys.audit(filters),
    queryFn: () => fetchJson<AuditEntry[]>(`/api/hr/audit${buildQuery(filters)}`),
  });
}

export function usePendingSummary() {
  return useQuery({
    queryKey: hrKeys.pending(),
    queryFn: () => fetchJson<PendingSummary>('/api/admin/pending-summary'),
    staleTime: 15_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

type BulkAction = 'verify' | 'reject';

export function useBulkAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action }: { ids: number[]; action: BulkAction }) => {
      const res = await apiFetch('/api/hr/audit/bulk', {
        method: 'PUT',
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) throw new Error('Errore approvazione bulk');
      return res.json();
    },
    onSuccess: () => {
      // Invalida tutte le query HR (audit + pending + alert)
      qc.invalidateQueries({ queryKey: hrKeys.all() });
    },
  });
}

/**
 * Hook per approvare/rifiutare un singolo record.
 * Wrapper tipizzato attorno a useBulkAudit con id singolo.
 */
export function useSingleAuditAction() {
  const bulk = useBulkAudit();
  return {
    ...bulk,
    approve: (id: number) => bulk.mutateAsync({ ids: [id], action: 'verify' }),
    reject:  (id: number) => bulk.mutateAsync({ ids: [id], action: 'reject' }),
  };
}
