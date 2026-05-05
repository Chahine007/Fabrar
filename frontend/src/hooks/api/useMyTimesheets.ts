import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { employeeKeys, hrKeys, timesheetKeys } from './queryKeys';

export interface MyTimeEntryPayload {
  report_date: string;
  cantiere_id: number;
  task_id?: number | null;
  ore_lavorate: number;
  descrizione?: string | null;
  attivita_svolte?: string | null;
  ingresso?: string | null;
  pausa_inizio?: string | null;
  pausa_fine?: string | null;
  uscita?: string | null;
}

export interface UpdateMyTimeEntryPayload {
  cantiere_id?: number;
  task_id?: number | null;
  ore_lavorate?: number;
  descrizione?: string | null;
  attivita_svolte?: string | null;
  ingresso?: string | null;
  pausa_inizio?: string | null;
  pausa_fine?: string | null;
  uscita?: string | null;
}

async function parseMutationResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function normalizeTimeEntryPayload<T extends Record<string, unknown>>(payload: T) {
  const data = { ...payload };

  if (Object.prototype.hasOwnProperty.call(data, 'descrizione')) {
    data.descrizione = String(data.descrizione ?? '').trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'attivita_svolte')) {
    data.attivita_svolte = String(data.attivita_svolte ?? '').trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'task_id')) {
    data.task_id = data.task_id == null || data.task_id === '' ? null : Number(data.task_id);
  }

  return data;
}

function invalidateTimesheetData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: timesheetKeys.all() });
  queryClient.invalidateQueries({ queryKey: hrKeys.all() });
  queryClient.invalidateQueries({ queryKey: employeeKeys.all() });
  queryClient.invalidateQueries({ queryKey: ['audit'] });
}

export function useCreateMyTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MyTimeEntryPayload) => {
      const res = await apiFetch('/api/my-timesheets', {
        method: 'POST',
        body: JSON.stringify(normalizeTimeEntryPayload(payload)),
      });
      return parseMutationResponse(res);
    },
    onSuccess: () => invalidateTimesheetData(queryClient),
  });
}

export function useUpdateMyTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMyTimeEntryPayload }) => {
      const res = await apiFetch(`/api/my-timesheets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(normalizeTimeEntryPayload(data)),
      });
      return parseMutationResponse(res);
    },
    onSuccess: () => invalidateTimesheetData(queryClient),
  });
}

export function useDeleteMyTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/my-timesheets/${id}`, {
        method: 'DELETE',
      });
      return parseMutationResponse<{ ok: boolean; entryId: number }>(res);
    },
    onSuccess: () => invalidateTimesheetData(queryClient),
  });
}
