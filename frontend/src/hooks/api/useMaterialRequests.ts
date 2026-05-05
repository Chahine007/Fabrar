import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { cantierKeys, magazzinoKeys, materialRequestKeys, taskKeys } from './queryKeys';

export type MaterialRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

export interface MaterialRequestLine {
  id: number;
  richiesta_id: number;
  articolo_id: number;
  quantita: number;
  note: string | null;
  articolo: {
    id: number;
    codice_sku: string;
    descrizione: string;
    unita_misura: string;
    costo_medio: number;
    scorta_minima?: number;
    categoria?: string | null;
  };
}

export interface MaterialRequest {
  id: number;
  cantiere_id: number;
  task_id: number | null;
  richiedente_id: number;
  data_richiesta: string;
  status: MaterialRequestStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  cantiere: {
    id: number;
    nome: string;
    indirizzo?: string | null;
  };
  task: {
    id: number;
    title: string;
    status: string;
    priority: string;
  } | null;
  richiedente: {
    id: number;
    nome: string | null;
    cognome: string | null;
    ruolo: string | null;
  };
  righe: MaterialRequestLine[];
}

export interface MaterialRequestFilters {
  status?: MaterialRequestStatus | '';
  cantiere_id?: number | null;
}

export interface CreateMaterialRequestPayload {
  cantiere_id: number;
  task_id?: number | null;
  note?: string | null;
  righe: {
    articolo_id: number;
    quantita: number;
    note?: string | null;
  }[];
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(filters: MaterialRequestFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.cantiere_id) params.set('cantiere_id', String(filters.cantiere_id));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useMaterialRequests(filters: MaterialRequestFilters = {}) {
  return useQuery({
    queryKey: materialRequestKeys.list(filters),
    queryFn: () => fetchJson<MaterialRequest[]>(`/api/material-requests${buildQuery(filters)}`),
    staleTime: 30_000,
  });
}

export function useCreateMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMaterialRequestPayload) =>
      fetchJson<MaterialRequest>('/api/material-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: materialRequestKeys.all() });
      qc.invalidateQueries({ queryKey: cantierKeys.detail(vars.cantiere_id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useUpdateMaterialRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Extract<MaterialRequestStatus, 'APPROVED' | 'REJECTED' | 'PENDING'> }) =>
      fetchJson<MaterialRequest>(`/api/material-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: materialRequestKeys.all() });
    },
  });
}

export function useFulfillMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ richiesta: MaterialRequest; movimenti: unknown[]; spese: unknown[] }>(
        `/api/material-requests/${id}/fulfill`,
        { method: 'POST' }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: materialRequestKeys.all() });
      qc.invalidateQueries({ queryKey: magazzinoKeys.all() });
      qc.invalidateQueries({ queryKey: cantierKeys.detail(data.richiesta.cantiere_id) });
      qc.invalidateQueries({ queryKey: cantierKeys.timeline(data.richiesta.cantiere_id) });
      qc.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}
