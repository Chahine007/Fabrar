import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { taskKeys } from './queryKeys';

export type TaskStatusCode = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriorityCode = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskStatusOption {
  value: TaskStatusCode;
  label: string;
}

export interface TaskPriorityOption {
  value: TaskPriorityCode;
  label: string;
}

export const TASK_STATUS_OPTIONS: TaskStatusOption[] = [
  { value: 'TODO', label: 'Da Fare' },
  { value: 'IN_PROGRESS', label: 'In Corso' },
  { value: 'DONE', label: 'Completato' },
];

export const TASK_PRIORITY_OPTIONS: TaskPriorityOption[] = [
  { value: 'LOW', label: 'Bassa' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Critica' },
];

export const TASK_STATUS_LABELS: Record<TaskStatusCode, string> = {
  TODO: 'Da Fare',
  IN_PROGRESS: 'In Corso',
  DONE: 'Completato',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriorityCode, string> = {
  LOW: 'Bassa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export interface TaskAssigneeEmployee {
  id: number;
  nome: string | null;
  cognome: string | null;
  ruolo: string | null;
}

export interface TaskProjectRef {
  id: number;
  nome: string;
}

export interface Task {
  id: number;
  cantiere_id: number;
  title: string;
  description: string | null;
  status: string;
  status_code: TaskStatusCode;
  priority: string;
  priority_code: TaskPriorityCode;
  assignee_id: number | null;
  assignee: string;
  assignee_employee: TaskAssigneeEmployee | null;
  due: string;
  due_date: string | null;
  budget_stimato?: number | null;
  costo_previsto?: number | null;
  costoManodopera?: number;
  costoMateriali?: number;
  costoSpese?: number;
  costoTotale?: number;
  deltaBudget?: number | null;
  created_at: string;
  updated_at: string;
  cantiere: TaskProjectRef;
}

export type TaskWithCantiere = Task;

export interface TaskFilters {
  cantiere_id?: number | null;
  status?: TaskStatusCode | null;
  priority?: TaskPriorityCode | null;
  assignee_id?: number | null;
}

export interface CreateTaskPayload {
  cantiere_id: number;
  title: string;
  description?: string | null;
  status?: TaskStatusCode;
  priority?: TaskPriorityCode;
  assignee_id?: number | null;
  due_date?: string | null;
  budget_stimato?: number | null;
  costo_previsto?: number | null;
}

export interface UpdateTaskPayload {
  cantiere_id?: number;
  title?: string;
  description?: string | null;
  status?: TaskStatusCode;
  priority?: TaskPriorityCode;
  assignee_id?: number | null;
  due_date?: string | null;
  budget_stimato?: number | null;
  costo_previsto?: number | null;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? null : value;
}

function normalizeTaskPayload<T extends Record<string, unknown>>(payload: T) {
  const nextPayload = { ...payload } as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'title')) {
    nextPayload.title = normalizeOptionalString(nextPayload.title as string | null | undefined);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'description')) {
    nextPayload.description = normalizeOptionalString(nextPayload.description as string | null | undefined);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'due_date')) {
    nextPayload.due_date = normalizeOptionalString(nextPayload.due_date as string | null | undefined);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'assignee_id')) {
    nextPayload.assignee_id = normalizeOptionalNumber(nextPayload.assignee_id as number | null | undefined);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'budget_stimato')) {
    nextPayload.budget_stimato = normalizeOptionalNumber(nextPayload.budget_stimato as number | null | undefined);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'costo_previsto')) {
    nextPayload.costo_previsto = normalizeOptionalNumber(nextPayload.costo_previsto as number | null | undefined);
  }

  return nextPayload;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();

  if (filters.cantiere_id != null) params.set('cantiere_id', String(filters.cantiere_id));
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assignee_id != null) params.set('assignee_id', String(filters.assignee_id));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export function getTaskAssigneeName(task: Pick<Task, 'assignee' | 'assignee_employee'>) {
  const firstName = task.assignee_employee?.nome?.trim() ?? '';
  const lastName = task.assignee_employee?.cognome?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || task.assignee || 'Non assegnato';
}

export function useAllTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchJson<TaskWithCantiere[]>(`/api/tasks${buildQuery(filters)}`),
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(normalizeTaskPayload(payload)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: UpdateTaskPayload }) => {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeTaskPayload(data)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<{ ok: boolean; taskId: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
    },
  });
}
