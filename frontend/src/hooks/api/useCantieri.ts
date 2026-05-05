/**
 * useCantieri.ts — React Query hooks per la gestione dei Cantieri.
 * Copre: lista, dettaglio, KPI finanziario, tasks, documenti, CRUD.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, api } from '../../lib/api';
import { cantierKeys } from './queryKeys';
import type { ProjectDocument } from '../../types/project-detail';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Cantiere {
  id: number;
  nome: string;
  status: string;
  budget: number | null;
  valore_contratto?: number | null;
  budget_spese?: number | null;
  costo_reale: number | null;
  indirizzo?: string | null;
  attivo?: number;
  lat?: number | null;
  lng?: number | null;
}

export interface CantiereDetail {
  cantiere: Cantiere;
  kpi: {
    budget: number;
    costoTotale: number;
    costoManodopera: number;
    costoMateriali: number;
    costoSpese?: number;
    margine: number;
    totaleFatturato?: number;
    totaleIncassato?: number;
    daFatturare?: number;
    ricaviFatturati?: number;
    ricaviReali?: number;
    margineFatturato?: number;
    margineIncassato?: number;
    burnRate: number;
    nMesi: number;
  };
  perDipendente: {
    nome: string | null;
    cognome: string | null;
    ore_tot: number;
    costo_calcolato: number;
    ultimo_accesso: string | null;
  }[];
}

export interface FinancialTimeline {
  nome: string;
  budget: number;
  months: string[];
  costoReale: number[];
  costoPerMese: number[];
}

export interface Task {
  id: number;
  title: string;
  assignee: string;
  status: string;
  priority: string;
  due: string;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

function getErrorMessage(body: unknown, fallback: string) {
  return typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
    ? body.error
    : fallback;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

// ─── Cantieri List ───────────────────────────────────────────────────────────

export function useCantieri() {
  return useQuery({
    queryKey: cantierKeys.list(),
    queryFn: () => fetchJson<Cantiere[]>('/api/cantieri'),
    staleTime: 120_000,
  });
}

// ─── Cantiere Detail (KPI) ───────────────────────────────────────────────────

export function useCantiereDetail(id: number | null) {
  return useQuery({
    queryKey: cantierKeys.detail(id!),
    queryFn: () => fetchJson<CantiereDetail>(`/api/cantieri/${id}/details`),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

// ─── Financial Timeline ──────────────────────────────────────────────────────

export function useFinancialTimeline(id: number | null) {
  return useQuery({
    queryKey: cantierKeys.timeline(id!),
    queryFn: () => fetchJson<FinancialTimeline>(`/api/cantieri/${id}/financial-timeline`),
    enabled: id !== null,
    staleTime: 120_000,
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useTasks(cantiereId: number | null) {
  return useQuery({
    queryKey: cantierKeys.tasks(cantiereId!),
    queryFn: () => fetchJson<Task[]>(`/api/cantieri/${cantiereId}/tasks`),
    enabled: cantiereId !== null,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateTask(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post(`/api/cantieri/${cantiereId}/tasks`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.tasks(cantiereId) });
    },
  });
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function useDocuments(cantiereId: number | null, tag?: string) {
  return useQuery({
    queryKey: [...cantierKeys.docs(cantiereId!), tag].filter(Boolean),
    queryFn: () => fetchJson<ProjectDocument[]>(`/api/cantieri/${cantiereId}/documents${tag ? `?tag=${tag}` : ''}`),
    enabled: cantiereId !== null,
  });
}

export function useUploadDocument(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { file: File; tag?: string; numero_fattura?: string }) => {
      const fd = new FormData();
      fd.append('file', payload.file);
      if (payload.tag)            fd.append('tag',            payload.tag);
      if (payload.numero_fattura) fd.append('numero_fattura', payload.numero_fattura);
      const res = await apiFetch(`/api/cantieri/${cantiereId}/documents/upload`, {
        method:  'POST',
        headers: {},   // lascia che FormData imposti il Content-Type con il boundary
        body:    fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, 'Errore durante il caricamento del file'));
      }
      return res.json() as Promise<ProjectDocument>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.docs(cantiereId) });
    },
  });
}

export function useUpdateGps(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/gps`, {
        method: 'PATCH',
        body:   JSON.stringify({ lat, lng }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, 'Errore aggiornamento GPS'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.detail(cantiereId) });
    },
  });
}

// ─── Genya bulk import ───────────────────────────────────────────────────────

export function useCreateCantiere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      nome: string;
      indirizzo?: string;
      budget?: number | null;
      valore_contratto?: number | null;
      budget_spese?: number | null;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const res = await apiFetch('/api/admin/cantieri', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, 'Errore creazione cantiere'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.list() });
    },
  });
}

// ─── Genya bulk import ───────────────────────────────────────────────────────

export function useGenyaImport(cantiereId?: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (cantiereId) formData.append('cantiere_id', String(cantiereId));
      // Non impostare Content-Type manualmente — fetch gestisce il boundary
      const res = await apiFetch('/api/admin/spese/bulk', {
        method: 'POST',
        headers: {},  // override il default application/json di apiFetch
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, `Errore ${res.status}`));
      }
      return res.json() as Promise<{ inserted: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.list() });
    },
  });
}
