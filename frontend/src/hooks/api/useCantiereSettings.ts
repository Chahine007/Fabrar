import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { cantierKeys } from './queryKeys';

export interface CantiereSettings {
  nome?: string | null;
  indirizzo?: string | null;
  lat?: number | null;
  lng?: number | null;
  raggio_tolleranza?: number | null;
  bot_checkin_gps?: boolean | null;
  bot_anomaly_action?: 'LOG' | 'BLOCK' | string | null;
  bot_wbs_prompt_thr?: number | null;
  budget_contingency?: number | null;
  kpi_warning_thr?: number | null;
  kpi_critical_thr?: number | null;
  client_name?: string | null;
  client_ref_email?: string | null;
  pm_id?: number | null;
  site_manager_id?: number | null;
  budget?: number | null;
}

export interface ProjectManagerOption {
  id: number;
  username: string;
  employee?: {
    nome?: string | null;
    cognome?: string | null;
  } | null;
}

export interface CantiereSettingsResponse {
  settings: CantiereSettings;
  pms: ProjectManagerOption[];
}

export type CantiereSettingsPatch = Omit<CantiereSettings, 'budget'>;

export function useCantiereSettings(cantiereId: number | null) {
  return useQuery<CantiereSettingsResponse>({
    queryKey: cantierKeys.settings(cantiereId!),
    queryFn: async () => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/settings`);
      if (!res.ok) {
        throw new Error('Errore nel recupero impostazioni cantiere');
      }
      return res.json();
    },
    enabled: cantiereId !== null,
  });
}

export function useUpdateCantiereSettings(cantiereId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CantiereSettingsPatch) => {
      const res = await apiFetch(`/api/cantieri/${cantiereId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Errore salvataggio impostazioni');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cantierKeys.settings(cantiereId) });
      qc.invalidateQueries({ queryKey: cantierKeys.detail(cantiereId) });
      qc.invalidateQueries({ queryKey: cantierKeys.list() });
    },
  });
}
