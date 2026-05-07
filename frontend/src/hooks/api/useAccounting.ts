import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { accountingKeys, dashboardKeys, hrKeys } from './queryKeys';

export type PaymentDueStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PaymentDueEffectiveStatus = PaymentDueStatus | 'OVERDUE' | 'DUE_SOON';
export type PaymentDueSource = 'OCR' | 'GENYA' | 'MANUAL';

export interface PayablesFilters {
  status?: string;
  from?: string;
  to?: string;
  supplier_id?: number | string;
  cost_category?: string;
  allocation_scope?: string;
}

export interface PayableItem {
  id: number;
  data_scadenza: string;
  importo: number;
  modalita_pagamento?: string | null;
  iban?: string | null;
  status: PaymentDueStatus;
  status_effettivo: PaymentDueEffectiveStatus;
  source: PaymentDueSource;
  paid_at?: string | null;
  paid_amount?: number | null;
  note?: string | null;
  fornitore?: {
    id: number;
    ragione_sociale: string;
    partita_iva?: string | null;
    iban_default?: string | null;
  } | null;
  spesa?: {
    id: number;
    importo?: number | string | null;
    fonte?: string | null;
    input_method?: string | null;
    cost_category?: string | null;
    allocation_scope?: string | null;
  } | null;
  fattura_acquisto?: {
    id: number;
    numero_documento?: string | null;
    data_documento?: string | null;
    tipo_documento?: string | null;
    totale_imponibile?: number | null;
    totale_imposta?: number | null;
    totale_documento?: number | null;
    cost_category?: string | null;
    allocation_scope?: string | null;
    cantiere?: { id: number; nome: string } | null;
    documento?: { id: number; name: string } | null;
  } | null;
}

export interface PayablesResponse {
  summary: {
    totale_aperto: number;
    totale_scaduto: number;
    totale_in_scadenza_7: number;
    totale_in_scadenza_30: number;
    totale_pagato: number;
  };
  items: PayableItem[];
}

export interface VatRegisterFilters {
  from?: string;
  to?: string;
  supplier_id?: number | string;
  iva_percentuale?: number | string;
  cost_category?: string;
  allocation_scope?: string;
}

export interface VatRegisterRow {
  id: number;
  fattura_acquisto_id: number;
  numero_documento?: string | null;
  data_documento?: string | null;
  fornitore?: { id: number; ragione_sociale: string; partita_iva?: string | null } | null;
  cantiere?: { id: number; nome: string } | null;
  descrizione?: string | null;
  codice_sku_normalizzato?: string | null;
  imponibile: number;
  iva_percentuale?: number | null;
  imposta: number;
  totale: number;
  cost_category?: string | null;
  allocation_scope?: string | null;
  is_stockable?: boolean;
}

export interface VatRegisterResponse {
  summary: {
    imponibile: number;
    imposta: number;
    totale: number;
    fatture_count: number;
    righe_count: number;
    by_iva: Array<{
      iva_percentuale?: number | null;
      imponibile: number;
      imposta: number;
      totale: number;
      righe: number;
    }>;
  };
  items: VatRegisterRow[];
}

export interface UpdatePayablePayload {
  id: number;
  status?: PaymentDueStatus;
  data_scadenza?: string;
  importo?: number;
  modalita_pagamento?: string | null;
  iban?: string | null;
  paid_at?: string | null;
  paid_amount?: number | null;
  note?: string | null;
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

export function usePayables(filters: PayablesFilters = {}) {
  return useQuery({
    queryKey: accountingKeys.payables(filters),
    queryFn: () => fetchJson<PayablesResponse>(`/api/accounting/payables${buildQuery(filters)}`),
    staleTime: 60_000,
  });
}

export function useUpdatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdatePayablePayload) =>
      fetchJson<PayableItem>(`/api/accounting/payables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.all() });
      qc.invalidateQueries({ queryKey: dashboardKeys.all() });
      qc.invalidateQueries({ queryKey: hrKeys.all() });
    },
  });
}

export function useVatRegister(filters: VatRegisterFilters = {}) {
  return useQuery({
    queryKey: accountingKeys.vatRegister(filters),
    queryFn: () => fetchJson<VatRegisterResponse>(`/api/accounting/vat-register${buildQuery(filters)}`),
    staleTime: 120_000,
  });
}

export function buildVatCsv(data?: VatRegisterResponse | null) {
  const rows = data?.items ?? [];
  const header = [
    'Data documento',
    'Numero documento',
    'Fornitore',
    'Partita IVA',
    'Descrizione',
    'Imponibile',
    'Aliquota IVA',
    'Imposta',
    'Totale',
    'Categoria',
    'Destinazione',
  ];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    header.map(escape).join(';'),
    ...rows.map((row) => [
      row.data_documento ? String(row.data_documento).slice(0, 10) : '',
      row.numero_documento ?? '',
      row.fornitore?.ragione_sociale ?? '',
      row.fornitore?.partita_iva ?? '',
      row.descrizione ?? '',
      row.imponibile.toFixed(2),
      row.iva_percentuale == null ? '' : row.iva_percentuale.toFixed(2),
      row.imposta.toFixed(2),
      row.totale.toFixed(2),
      row.cost_category ?? '',
      row.allocation_scope ?? '',
    ].map(escape).join(';')),
  ].join('\n');
}
