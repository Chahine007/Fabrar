/**
 * useHr.ts — React Query hooks per HR: employees (KPI), audit, alert, pending summary.
 * Supporta filtri query (type, status, employee_id) per selezione granulare.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { hrKeys, employeeKeys } from './queryKeys';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Dipendente con KPI mensili calcolati dal backend */
export interface EmployeeWithKPI {
  id:          number;
  nome:        string;
  cognome:     string;
  ruolo:       string | null;
  telegram_id: string | null;
  telefono:         string | null;
  email_personale:  string | null;
  dipartimento:     string | null;
  data_assunzione:  string | null;
  costo_orario: number;
  ore_mese:     number;
  costo_mese:   number;
}

// alias legacy
export type Employee = EmployeeWithKPI;

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  role: 'WORKER' | 'ADMIN' | 'PROJECT_MANAGER' | 'HR';
  hourly_rate?: number;
  email?: string;
}

/** Record completo del dipendente (dettaglio) */
export interface EmployeeDetail {
  id:          number;
  nome:        string | null;
  cognome:     string | null;
  ruolo:       string | null;
  telegram_id: string | null;
  chat_id:     string | null;
  attivo:      number;
  telefono:         string | null;
  email_personale:  string | null;
  dipartimento:     string | null;
  codice_fiscale:   string | null;
  data_nascita:     string | null;
  indirizzo:        string | null;
  citta:            string | null;
  cap:              string | null;
  telefono_personale: string | null;
  data_assunzione:  string | null;
  skills:           string | null;
  competenze:       string[] | null;
  note_admin:       string | null;
  costo_orario:     number;
  valido_dal:       string | null;
  ore_totali:       number;
  costo_totale:     number;
}

/** CV JSON strutturato */
export interface EmployeeCVData {
  generato_il: string;
  anagrafica: {
    nome: string | null;
    cognome: string | null;
    codice_fiscale: string | null;
    data_nascita: string | null;
    indirizzo: string | null;
    telefono: string | null;
    email: string | null;
  };
  professionale: {
    ruolo: string;
    dipartimento: string | null;
    data_assunzione: string | null;
    tariffa_oraria: number;
  };
  competenze: string[];
  esperienza: {
    ore_totali_lavorate: number;
    cantieri_lavorati: string[];
  };
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
  cantiere_id: number | null;
  luogo_cantiere: string | null;
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
  cantiere_id?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
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
  if (filters.cantiere_id) params.set('cantiere_id', String(filters.cantiere_id));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Lista dipendenti con KPI mensili (costo_orario, ore_mese, costo_mese).
 * Endpoint: GET /api/employees
 */
export function useEmployees() {
  return useQuery({
    queryKey: employeeKeys.list(),
    queryFn:  () => fetchJson<EmployeeWithKPI[]>('/api/employees'),
    staleTime: 60_000,
  });
}

/**
 * Dettaglio completo di un singolo dipendente.
 * Endpoint: GET /api/hr/employees/:id
 */
export function useEmployeeDetail(id: number) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn:  () => fetchJson<EmployeeDetail>(`/api/hr/employees/${id}`),
    enabled:  id > 0,
  });
}

/**
 * CV auto-generato per un dipendente.
 * Endpoint: GET /api/hr/employees/:id/cv
 */
export function useGenerateCV(id: number) {
  return useQuery({
    queryKey: [...employeeKeys.detail(id), 'cv'],
    queryFn:  () => fetchJson<EmployeeCVData>(`/api/hr/employees/${id}/cv`),
    enabled:  false, // Solo su richiesta esplicita (refetch)
  });
}

/**
 * Aggiorna i dati anagrafici di un dipendente.
 * Endpoint: PATCH /api/hr/employees/:id
 */
export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiFetch(`/api/hr/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Errore ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Errore ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
}

/**
 * Imposta una nuova tariffa oraria per un dipendente.
 * Endpoint: POST /api/hr/users/:id/cost
 */
export function useSetEmployeeCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, costo_orario, valido_dal }: { id: number; costo_orario: number; valido_dal: string }) => {
      const res = await apiFetch(`/api/hr/users/${id}/cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costo_orario, valido_dal }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Errore ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: employeeKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
}


export function useHrAlerts(enabled = true) {
  return useQuery({
    queryKey: hrKeys.alerts(),
    queryFn: () => fetchJson<HrAlert[]>('/api/hr/alerts'),
    staleTime: 60_000, // alert non cambiano ogni secondo
    enabled,
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
      qc.invalidateQueries({ queryKey: hrKeys.all() });
    },
  });
}

/**
 * Modifica admin di una timbratura: ore_lavorate, cantiere_id, wbs_node_id, attivita_svolte.
 * Endpoint: PATCH /api/hr/report-entries/:id/admin
 * Se la entry era VERIFIED, il backend ricalcola i costi del cantiere.
 */
export interface UpdateReportEntryPayload {
  ore_lavorate?:    number;
  cantiere_id?:     number | null;
  wbs_node_id?:     number | null;
  attivita_svolte?: string | null;
}

export function useUpdateReportEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateReportEntryPayload }) => {
      const res = await apiFetch(`/api/hr/report-entries/${id}/admin`, {
        method: 'PATCH',
        body:   JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Errore ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalida audit (tabulati) e lista employees (KPI mese)
      qc.invalidateQueries({ queryKey: hrKeys.audit() });
      qc.invalidateQueries({ queryKey: employeeKeys.list() });
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

/**
 * Utility per scaricare il CSV delle rendicontazioni.
 * Chiama GET /admin/export.csv e forza il download nel browser.
 */
export function useExportCsv() {
  const { apiFetch: fetch } = { apiFetch }; // alias per chiarezza

  const downloadCsv = async (params: { start?: string; end?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end)   qs.set('end',   params.end);
    const path = `/admin/export.csv${qs.toString() ? `?${qs.toString()}` : ''}`;

    const res = await apiFetch(path);
    if (!res.ok) throw new Error(`Export fallito: ${res.status}`);

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `fabrar-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return { downloadCsv };
}
