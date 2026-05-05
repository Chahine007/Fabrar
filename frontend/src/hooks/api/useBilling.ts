import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { billingKeys, cantierKeys, dashboardKeys } from './queryKeys';

export type InstallmentStatus = 'PENDING' | 'INVOICED' | 'PAID';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID';

export interface BillingWbsNode {
  id: number;
  nome: string;
  parent_id: number | null;
}

export interface BillingDocument {
  id: number;
  name: string;
  file_path: string | null;
  type: string;
  numero_fattura: string | null;
  data_emissione: string | null;
}

export interface BillingInstallment {
  id: number;
  cantiere_id: number;
  wbs_node_id: number | null;
  nome: string;
  percentuale: number | null;
  importo_previsto: number;
  data_scadenza_prevista: string | null;
  stato: InstallmentStatus;
  fattura_id: number | null;
  created_at: string;
  updated_at: string;
  wbs_node: BillingWbsNode | null;
  fattura: {
    id: number;
    numero_fattura: string | null;
    importo_totale: number;
    stato: InvoiceStatus;
    documento: BillingDocument | null;
  } | null;
}

export interface BillingInvoice {
  id: number;
  cantiere_id: number;
  numero_fattura: string | null;
  data_emissione: string | null;
  importo_totale: number;
  stato: InvoiceStatus;
  documento_id: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  documento: BillingDocument | null;
  rate?: Array<{
    id: number;
    nome: string;
    importo_previsto: number;
    percentuale: number | null;
    stato: InstallmentStatus;
    wbs_node: BillingWbsNode | null;
  }>;
}

export interface ProjectBillingSummary {
  totale_contratto: number;
  totale_fatturato: number;
  totale_incassato: number;
  da_fatturare: number;
}

export interface ProjectBilling {
  cantiere: {
    id: number;
    nome: string;
    totale_contratto: number;
  };
  summary: ProjectBillingSummary;
  rate: BillingInstallment[];
  fatture: BillingInvoice[];
}

export interface CreateInstallmentPayload {
  nome: string;
  importo_previsto: number;
  data_scadenza_prevista?: string | null;
  wbs_node_id?: number | null;
  percentuale?: number | null;
  stato?: InstallmentStatus;
}

export interface UpdateInstallmentPayload {
  nome?: string;
  importo_previsto?: number;
  data_scadenza_prevista?: string | null;
  wbs_node_id?: number | null;
  percentuale?: number | null;
  stato?: InstallmentStatus;
  fattura_id?: number | null;
}

export interface CreateInvoicePayload {
  numero_fattura?: string | null;
  data_emissione?: string | null;
  installment_ids: number[];
  importo_totale: number;
  stato?: InvoiceStatus;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeNullableString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function invalidateBillingContext(queryClient: ReturnType<typeof useQueryClient>, cantiereId: number) {
  queryClient.invalidateQueries({ queryKey: billingKeys.project(cantiereId) });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
  queryClient.invalidateQueries({ queryKey: cantierKeys.detail(cantiereId) });
  queryClient.invalidateQueries({ queryKey: ['project', cantiereId] });
}

export function useProjectBilling(cantiereId: number | null) {
  return useQuery({
    queryKey: billingKeys.project(cantiereId ?? 0),
    queryFn: () => fetchJson<ProjectBilling>(`/api/billing/projects/${cantiereId}`),
    enabled: cantiereId != null,
    staleTime: 30_000,
  });
}

export function useCreateInstallment(cantiereId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInstallmentPayload) =>
      fetchJson<BillingInstallment>(`/api/billing/projects/${cantiereId}/installments`, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          nome: payload.nome.trim(),
          data_scadenza_prevista: normalizeNullableString(payload.data_scadenza_prevista),
        }),
      }),
    onSuccess: () => invalidateBillingContext(queryClient, cantiereId),
  });
}

export function useUpdateInstallment(cantiereId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, data }: { installmentId: number; data: UpdateInstallmentPayload }) =>
      fetchJson<BillingInstallment>(`/api/billing/installments/${installmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...data,
          nome: data.nome != null ? data.nome.trim() : data.nome,
          data_scadenza_prevista:
            data.data_scadenza_prevista !== undefined
              ? normalizeNullableString(data.data_scadenza_prevista)
              : data.data_scadenza_prevista,
        }),
      }),
    onSuccess: () => invalidateBillingContext(queryClient, cantiereId),
  });
}

export function useCreateInvoice(cantiereId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) =>
      fetchJson<BillingInvoice>(`/api/billing/projects/${cantiereId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          numero_fattura: normalizeNullableString(payload.numero_fattura),
          data_emissione: normalizeNullableString(payload.data_emissione),
        }),
      }),
    onSuccess: () => invalidateBillingContext(queryClient, cantiereId),
  });
}
