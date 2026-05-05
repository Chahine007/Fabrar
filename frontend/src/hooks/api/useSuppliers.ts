import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { supplierKeys, magazzinoKeys } from './queryKeys';

export interface Supplier {
  id: number;
  ragione_sociale: string;
  partita_iva: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayload {
  ragione_sociale: string;
  partita_iva?: string | null;
  email?: string | null;
  telefono?: string | null;
  indirizzo?: string | null;
  note?: string | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function useSuppliers(filters: { q?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  const qs = params.toString();

  return useQuery({
    queryKey: supplierKeys.list(filters),
    queryFn: () => fetchJson<Supplier[]>(`/api/suppliers${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}

export function useSupplier(id: number | null) {
  return useQuery({
    queryKey: supplierKeys.detail(id ?? 0),
    queryFn: () => fetchJson<Supplier>(`/api/suppliers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SupplierPayload) =>
      fetchJson<Supplier>('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all() });
      qc.invalidateQueries({ queryKey: magazzinoKeys.articoli() });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SupplierPayload> }) =>
      fetchJson<Supplier>(`/api/suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: supplierKeys.all() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: magazzinoKeys.articoli() });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/suppliers/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all() });
      qc.invalidateQueries({ queryKey: magazzinoKeys.articoli() });
    },
  });
}
