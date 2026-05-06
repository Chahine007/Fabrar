/**
 * useHr.ts — React Query hooks per HR: employees (KPI), audit, alert, pending summary.
 * Supporta filtri query (type, status, employee_id) per selezione granulare.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { accountingKeys, hrKeys, employeeKeys, magazzinoKeys } from './queryKeys';

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

export interface EmployeeSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
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

export interface HrAlertsResponse {
  pending: {
    reports: number;
    spese: number;
    total: number;
  };
  anomalies: string[];
  warnings: Array<{ type: string; name: string; text: string }>;
}

export type AuditType = 'ore' | 'spese';
export type AuditStatus = 'pending' | 'verified' | 'approved' | 'rejected';
export type AuditMutationStatus = 'APPROVED' | 'REJECTED';
export type LogisticaStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_OCR'
  | 'OCR_REVIEW'
  | 'LOADED_TO_WAREHOUSE'
  | 'RECONCILIATION_REQUIRED';
export type CostCategory =
  | 'INVENTORY_MATERIAL'
  | 'CONSUMABLE_SUPPLY'
  | 'SERVICE'
  | 'LEASING_RENTAL'
  | 'UTILITY'
  | 'INSURANCE'
  | 'TAX_FEE'
  | 'PROFESSIONAL_SERVICE'
  | 'TRAVEL_VEHICLE'
  | 'OTHER'
  | 'UNKNOWN';
export type CostAllocationScope = 'PROJECT' | 'OVERHEAD' | 'REVIEW';

export interface InvoiceOcrLine {
  codice_articolo?: string | null;
  codice_articolo_raw?: string | null;
  codice_sku?: string | null;
  descrizione?: string | null;
  quantita?: number | null;
  unita_misura?: string | null;
  prezzo_unitario?: number | null;
  costo_unitario?: number | null;
  prezzo_totale?: number | null;
  importo_riga?: number | null;
  iva_percentuale?: number | null;
  imponibile_riga?: number | null;
  imposta_riga?: number | null;
  cost_category?: CostCategory | string | null;
  stockable?: boolean | null;
  magazzino_status?: 'new' | 'existing' | 'reconcile' | string;
  reconcile_reason?: string | null;
  articolo_id?: number | null;
}

export interface InvoiceOcrPayload {
  document_type?: string | null;
  cost_category?: CostCategory | string | null;
  allocation_scope?: CostAllocationScope | string | null;
  logistica_required?: boolean | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  data_documento?: string | null;
  codice_destinatario?: string | null;
  documento?: {
    tipo_documento?: string | null;
    numero_documento?: string | null;
    data_documento?: string | null;
    codice_destinatario?: string | null;
  } | null;
  fornitore?: {
    ragione_sociale?: string | null;
    partita_iva?: string | null;
    codice_fiscale?: string | null;
    indirizzo?: string | null;
    comune?: string | null;
    provincia?: string | null;
    cap?: string | null;
  } | null;
  cliente?: {
    ragione_sociale?: string | null;
    partita_iva?: string | null;
    codice_fiscale?: string | null;
    indirizzo?: string | null;
    comune?: string | null;
    provincia?: string | null;
    cap?: string | null;
  } | null;
  totale_imponibile?: number | null;
  totale_imposta?: number | null;
  totale_documento?: number | null;
  totali?: {
    totale_imponibile?: number | null;
    totale_imposta?: number | null;
    totale_documento?: number | null;
  } | null;
  pagamento?: {
    modalita_pagamento?: string | null;
    iban?: string | null;
    scadenza?: string | null;
    importo_scadenza?: number | null;
  } | null;
  righe_materiali?: InvoiceOcrLine[];
  righe_costo?: Array<{
    descrizione?: string | null;
    cost_category?: CostCategory | string | null;
    allocation_scope?: CostAllocationScope | string | null;
    importo?: number | null;
    iva_percentuale?: number | null;
    quantita?: number | null;
    unita_misura?: string | null;
    prezzo_unitario?: number | null;
  }>;
}

export interface PurchaseInvoiceLine {
  id?: number;
  codice_articolo_originale?: string | null;
  codice_sku_normalizzato?: string | null;
  descrizione?: string | null;
  quantita?: number | string | null;
  unita_misura?: string | null;
  prezzo_unitario?: number | string | null;
  iva_percentuale?: number | string | null;
  imponibile_riga?: number | string | null;
  imposta_riga?: number | string | null;
  prezzo_totale?: number | string | null;
  cost_category?: CostCategory | string | null;
  allocation_scope?: CostAllocationScope | string | null;
  is_stockable?: boolean | null;
  reconciliation_status?: string | null;
  articolo_id?: number | null;
  movimento_id?: number | null;
  articolo?: {
    id: number;
    codice_sku: string;
    descrizione?: string | null;
  } | null;
  movimento?: {
    id: number;
    tipo_movimento: string;
    quantita?: number | string | null;
    valore_totale?: number | string | null;
  } | null;
}

export interface PurchaseInvoiceDraft {
  id?: number;
  document_type?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  data_documento?: string | null;
  codice_destinatario?: string | null;
  fornitore?: InvoiceOcrPayload['fornitore'] & {
    id?: number;
    partita_iva_normalizzata?: string | null;
    paese?: string | null;
    iban_default?: string | null;
  };
  cliente?: InvoiceOcrPayload['cliente'];
  totali?: InvoiceOcrPayload['totali'];
  pagamento?: InvoiceOcrPayload['pagamento'];
  cost_category?: CostCategory | string | null;
  allocation_scope?: CostAllocationScope | string | null;
  logistica_required?: boolean | null;
  righe?: PurchaseInvoiceLine[];
  scadenze?: Array<{
    id: number;
    data_scadenza: string;
    importo: number | string;
    modalita_pagamento?: string | null;
    iban?: string | null;
    status?: string;
  }>;
}

export interface PurchaseInvoiceSummary {
  id: number;
  numero_documento?: string | null;
  data_documento?: string | null;
  tipo_documento?: string | null;
  totale_imponibile?: number | string | null;
  totale_imposta?: number | string | null;
  totale_documento?: number | string | null;
  pagamento_modalita?: string | null;
  pagamento_scadenza?: string | null;
  pagamento_iban?: string | null;
  pagamento_importo?: number | string | null;
  righe_count?: number;
}

export interface SpesaOcrResponse {
  spesa: AuditEntry & Record<string, unknown>;
  document?: {
    id: number;
    name: string;
    file_path?: string | null;
    type?: string | null;
  };
  ocrPayload?: InvoiceOcrPayload;
  fattura_acquisto_draft?: PurchaseInvoiceDraft;
  fatturaAcquisto?: PurchaseInvoiceDraft;
  suggestedLines?: InvoiceOcrLine[];
  matchStatus?: {
    score: number;
    strength: 'strong' | 'weak' | 'none';
    reasons: string[];
    canConfirm?: boolean;
  };
  movimentiCaricoCreati?: number;
  articoliCreati?: number;
  fornitore?: {
    id: number;
    ragione_sociale: string;
    partita_iva?: string | null;
    partita_iva_normalizzata?: string | null;
    codice_fiscale?: string | null;
    indirizzo?: string | null;
    comune?: string | null;
    provincia?: string | null;
    cap?: string | null;
    paese?: string | null;
    iban_default?: string | null;
  } | null;
  fornitoreAction?: 'created' | 'updated' | 'found' | string | null;
  righeDaRiconciliare?: number;
  righeDaRiconciliareDettaglio?: Array<{ reason: string; line: unknown }>;
}

export interface GenericInvoiceOcrCandidate {
  spesa: AuditEntry & Record<string, unknown>;
  score: number;
  strength: 'strong' | 'weak' | 'none';
  reasons: string[];
}

export interface GenericInvoiceOcrUpload {
  token: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface GenericInvoiceOcrResponse {
  upload: GenericInvoiceOcrUpload;
  ocrPayload: InvoiceOcrPayload;
  fattura_acquisto_draft?: PurchaseInvoiceDraft;
  suggestedLines: InvoiceOcrLine[];
  candidates: GenericInvoiceOcrCandidate[];
  matchStatus?: {
    best?: GenericInvoiceOcrCandidate | null;
    canConfirmExisting?: boolean;
    canCreateNew?: boolean;
  };
}

export interface AuditBulkItem {
  id: number;
  type: AuditType;
  newStatus: AuditMutationStatus;
}

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
  fornitore?: string | null;
  note: string | null;
  cantiere_nome: string | null;
  cantiere_id: number | null;
  task_id?: number | null;
  task_title?: string | null;
  luogo_cantiere: string | null;
  report_id?: number;
  documento_id?: number | null;
  documento_nome?: string | null;
  logistica_status?: LogisticaStatus | null;
  cost_category?: CostCategory | string | null;
  allocation_scope?: CostAllocationScope | string | null;
  fornitore_id?: number | null;
  ocr_payload?: InvoiceOcrPayload | null;
  ocr_reviewed_at?: string | null;
  movimenti_magazzino_count?: number;
  fattura_acquisto_id?: number | null;
  fattura_acquisto?: PurchaseInvoiceSummary | null;
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
  cost_category?: string;
  allocation_scope?: string;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
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
  if (filters.cost_category) params.set('cost_category', filters.cost_category);
  if (filters.allocation_scope) params.set('allocation_scope', filters.allocation_scope);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Lista dipendenti con KPI mensili (costo_orario, ore_mese, costo_mese).
 * Endpoint: GET /api/employees
 */
export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: employeeKeys.list(),
    queryFn:  () => fetchJson<EmployeeWithKPI[]>('/api/employees'),
    staleTime: 60_000,
    enabled,
  });
}

export function useSearchEmployees(query: string, enabled = true) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: employeeKeys.search(normalizedQuery),
    queryFn: () => fetchJson<EmployeeSearchResult[]>(`/api/employees/search?q=${encodeURIComponent(normalizedQuery)}`),
    enabled: enabled && normalizedQuery.length > 0,
    staleTime: 30_000,
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
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
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
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
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
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
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
    queryFn: () => fetchJson<HrAlertsResponse>('/api/hr/alerts'),
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
type BulkAuditPayload =
  | { items: AuditBulkItem[] }
  | { ids: number[]; action: BulkAction };

export function useBulkAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkAuditPayload) => {
      const res = await apiFetch('/api/hr/audit/bulk', {
        method: 'PUT',
        body: JSON.stringify(payload),
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
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
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
    approve: (id: number, type: AuditType) => bulk.mutateAsync({ items: [{ id, type, newStatus: 'APPROVED' }] }),
    reject:  (id: number, type: AuditType) => bulk.mutateAsync({ items: [{ id, type, newStatus: 'REJECTED' }] }),
  };
}

export function useAnalyzeSpesaOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ spesaId, file }: { spesaId: number; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch(`/api/admin/spese/${spesaId}/ocr`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
      }
      return res.json() as Promise<SpesaOcrResponse>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.all() });
    },
  });
}

export function useAnalyzeGenericInvoiceOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, cantiereId }: { file: File; cantiereId?: number | null }) => {
      const form = new FormData();
      form.append('file', file);
      if (cantiereId) form.append('cantiere_id', String(cantiereId));
      const res = await apiFetch('/api/admin/spese/ocr/analyze', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
      }
      return res.json() as Promise<GenericInvoiceOcrResponse>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.all() });
    },
  });
}

export function useConfirmGenericInvoiceOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      upload,
      ocrPayload,
      lines,
      spesaId,
      cantiereId,
      ubicazioneId,
      costCategory,
      allocationScope,
    }: {
      upload: GenericInvoiceOcrUpload;
      ocrPayload: InvoiceOcrPayload;
      lines: InvoiceOcrLine[];
      spesaId?: number | null;
      cantiereId?: number | null;
      ubicazioneId?: number | null;
      costCategory?: CostCategory | string | null;
      allocationScope?: CostAllocationScope | string | null;
    }) => {
      const res = await apiFetch('/api/admin/spese/ocr/confirm', {
        method: 'POST',
        body: JSON.stringify({
          upload,
          ocrPayload,
          lines,
          spesa_id: spesaId ?? null,
          cantiere_id: cantiereId ?? null,
          ubicazione_id: ubicazioneId ?? null,
          cost_category: costCategory ?? null,
          allocation_scope: allocationScope ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
      }
      return res.json() as Promise<SpesaOcrResponse>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.all() });
      qc.invalidateQueries({ queryKey: magazzinoKeys.all() });
      qc.invalidateQueries({ queryKey: accountingKeys.all() });
    },
  });
}

export function useConfirmSpesaOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      spesaId,
      documentId,
      lines,
      ubicazioneId,
      costCategory,
      allocationScope,
    }: {
      spesaId: number;
      documentId?: number | null;
      lines: InvoiceOcrLine[];
      ubicazioneId?: number | null;
      costCategory?: CostCategory | string | null;
      allocationScope?: CostAllocationScope | string | null;
    }) => {
      const res = await apiFetch(`/api/admin/spese/${spesaId}/ocr/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          document_id: documentId ?? null,
          lines,
          ubicazione_id: ubicazioneId ?? null,
          cost_category: costCategory ?? null,
          allocation_scope: allocationScope ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
      }
      return res.json() as Promise<SpesaOcrResponse>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.all() });
      qc.invalidateQueries({ queryKey: magazzinoKeys.all() });
      qc.invalidateQueries({ queryKey: accountingKeys.all() });
    },
  });
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
