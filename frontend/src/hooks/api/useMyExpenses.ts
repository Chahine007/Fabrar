import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { cantierKeys, dashboardKeys, expenseKeys, hrKeys } from './queryKeys';

export interface MyExpensePayload {
  date?: string | null;
  timestamp_utc?: string | null;
  cantiere_id: number;
  task_id?: number | null;
  importo: number;
  fornitore?: string | null;
  descrizione?: string | null;
}

export interface UpdateMyExpensePayload {
  date?: string | null;
  timestamp_utc?: string | null;
  cantiere_id?: number;
  task_id?: number | null;
  importo?: number;
  fornitore?: string | null;
  descrizione?: string | null;
}

async function parseMutationResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function normalizeExpensePayload<T extends Record<string, unknown>>(payload: T) {
  const data = { ...payload };

  if (Object.prototype.hasOwnProperty.call(data, 'fornitore')) {
    data.fornitore = String(data.fornitore ?? '').trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'descrizione')) {
    data.descrizione = String(data.descrizione ?? '').trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'task_id')) {
    data.task_id = data.task_id == null || data.task_id === '' ? null : Number(data.task_id);
  }

  return data;
}

function invalidateExpenseData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: expenseKeys.all() });
  queryClient.invalidateQueries({ queryKey: hrKeys.all() });
  queryClient.invalidateQueries({ queryKey: hrKeys.audit() });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
  queryClient.invalidateQueries({ queryKey: cantierKeys.all() });
}

export function useCreateMyExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MyExpensePayload) => {
      const res = await apiFetch('/api/my-expenses', {
        method: 'POST',
        body: JSON.stringify(normalizeExpensePayload(payload)),
      });
      return parseMutationResponse(res);
    },
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useUpdateMyExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMyExpensePayload }) => {
      const res = await apiFetch(`/api/my-expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeExpensePayload(data)),
      });
      return parseMutationResponse(res);
    },
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useDeleteMyExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/my-expenses/${id}`, {
        method: 'DELETE',
      });
      return parseMutationResponse<{ ok: boolean; expenseId: number }>(res);
    },
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}
