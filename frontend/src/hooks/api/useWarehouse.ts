import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
// Dobbiamo assicurarci di avere una chiave adeguata, aggiungiamola o usiamola inline
import { cantierKeys } from './queryKeys';

export const pricebookKeys = {
  all: () => ['pricebook'] as const,
};

export const warehouseKeys = {
  all: () => ['warehouse'] as const,
  cantiere: (id: number) => [...warehouseKeys.all(), id] as const,
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function usePricebook() {
  return useQuery({
    queryKey: pricebookKeys.all(),
    queryFn: () => fetchJson<any[]>('/api/pricebook'),
    staleTime: 60000 * 5, // Cache for 5 mins
  });
}

export function useCantiereMaterials(cantiereId: number | null) {
  return useQuery({
    queryKey: warehouseKeys.cantiere(cantiereId!),
    queryFn: () => fetchJson<any[]>(`/api/cantieri/${cantiereId}/materials`),
    enabled: cantiereId !== null,
  });
}

export function useAddMaterialToCantiere(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { pricebook_id: number; quantita: number; importo: number; wbs_node_id?: number | null }) => {
      const body = {
        cantiere_id: cantiereId,
        pricebook_id: payload.pricebook_id,
        quantita: payload.quantita,
        importo: payload.importo,
        wbs_node_id: payload.wbs_node_id,
        descrizione: "Prelievo da Magazzino", // Automatic description
        fonte: "MANUAL_OFFICE"
      };
      
      const res = await apiFetch(`/api/admin/spese/manual`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Errore inserimento materiale');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both warehouse materials and general cantiere timeline / wbs
      qc.invalidateQueries({ queryKey: warehouseKeys.cantiere(cantiereId) });
      qc.invalidateQueries({ queryKey: cantierKeys.detail(cantiereId) });
      // To invalidate wbs we should theoretically import wbsKeys, 
      // but let's just invalidate all cantieri related queries for safety.
      qc.invalidateQueries({ queryKey: ['wbs', 'tree', cantiereId] });
      qc.invalidateQueries({ queryKey: ['cantieri'] });
    }
  });
}
