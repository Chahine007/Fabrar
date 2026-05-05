/**
 * useWbs.ts — React Query hooks per il Job Costing Engine (WBS).
 * Copre: lettura albero WBS con burn rate, CRUD nodi (fase/sottofase).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { wbsKeys } from './queryKeys';
import type { WbsNode } from '../../types/wbs';

function getErrorMessage(body: unknown, fallback: string) {
  return typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
    ? body.error
    : fallback;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Legge l'albero WBS con burn rate per ogni nodo */
export function useWbsTree(cantiereId: number | null) {
  return useQuery({
    queryKey: wbsKeys.tree(cantiereId!),
    queryFn: () => fetchJson<WbsNode[]>(`/api/cantieri/${cantiereId}/wbs`),
    enabled: cantiereId !== null,
    staleTime: 30_000,
  });
}

/** Crea un nuovo nodo WBS (fase o sottofase) */
export function useCreateWbsNode(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      nome: string;
      budget_preventivato?: number | null;
      parent_id?: number | null;
    }) => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/wbs`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, 'Errore creazione fase'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wbsKeys.tree(cantiereId) });
    },
  });
}

/** Aggiorna nome e/o budget preventivato di un nodo WBS */
export function useUpdateWbsNode(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      nodeId: number;
      nome?: string;
      budget_preventivato?: number | null;
    }) => {
      const { nodeId, ...body } = payload;
      const res = await apiFetch(`/api/cantieri/${cantiereId}/wbs/${nodeId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body2 = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body2, 'Errore aggiornamento fase'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wbsKeys.tree(cantiereId) });
    },
  });
}

/** Elimina un nodo WBS (solo se senza voci o figli) */
export function useDeleteWbsNode(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nodeId: number) => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/wbs/${nodeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body, 'Errore eliminazione fase'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wbsKeys.tree(cantiereId) });
    },
  });
}
