/**
 * useTasks.ts — React Query hooks per la gestione task cross-project.
 * Endpoint: GET /api/tasks (lista globale) + PATCH /api/tasks/:id (aggiornamento)
 *
 * Separato da useCantieri.ts perché ha scope globale (cross-project),
 * non legato a un singolo cantiere.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { taskKeys, cantierKeys } from './queryKeys';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  id:          number;
  cantiere_id: number;
  title:       string;
  assignee:    string;
  status:      string;
  priority:    string;
  due:         string;
  created_at:  string;
}

export interface TaskWithCantiere extends Task {
  cantiere: { id: number; nome: string };
}

export interface TaskFilters {
  cantiere_id?: number | null;
  status?:      string | null;
  priority?:    string | null;
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.cantiere_id != null) params.set('cantiere_id', String(filters.cantiere_id));
  if (filters.status)              params.set('status',      filters.status);
  if (filters.priority)            params.set('priority',    filters.priority);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Tutti i task di tutti i cantieri, con filtri opzionali.
 * Usato da ActivitiesPage per la vista globale cross-project.
 */
export function useAllTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn:  () => fetchJson<TaskWithCantiere[]>(`/api/tasks${buildQuery(filters)}`),
    staleTime: 30_000,
  });
}

/**
 * Aggiorna un singolo task (status, priority, assignee, title, due).
 * Invalida sia taskKeys.all() che i tasks del cantiere specifico.
 */
export function useUpdateTask(cantiereId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<Task> }) => {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body:   JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all() });
      if (cantiereId != null) {
        qc.invalidateQueries({ queryKey: cantierKeys.tasks(cantiereId) });
      }
    },
  });
}
