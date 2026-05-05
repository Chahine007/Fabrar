import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { userKeys } from './queryKeys';

export interface UserNotificationSettings {
  email: boolean;
  push: boolean;
  telegram: boolean;
  dailySummary: boolean;
  criticalAlerts: boolean;
}

export interface UserPreferenceSettings {
  theme: 'light' | 'dark';
  language: 'it' | 'en' | 'es' | 'fr';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
}

export interface UserSettings {
  notifications: UserNotificationSettings;
  preferences: UserPreferenceSettings;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface MaterialRequest {
  id: number;
  tipo_movimento: 'CARICO' | 'SCARICO_CANTIERE' | 'TRASFERIMENTO' | 'RESO';
  quantita: string | number;
  costo_unitario: string | number;
  valore_totale: string | number;
  data_movimento: string;
  articolo: {
    codice_sku: string;
    descrizione: string;
    unita_misura: string;
  };
  cantiere?: { id: number; nome: string } | null;
  wbs_node?: { id: number; nome: string } | null;
  ubicazione_da?: { codice: string; descrizione: string | null } | null;
  ubicazione_a?: { codice: string; descrizione: string | null } | null;
}

export interface SupportContact {
  employee: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useUserSettings() {
  return useQuery({
    queryKey: userKeys.settings(),
    queryFn: () => fetchJson<{ settings: UserSettings }>('/api/user/settings'),
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UserSettings>) =>
      fetchJson<{ settings: UserSettings }>('/api/user/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.settings() });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      fetchJson<{ message: string }>('/api/user/password', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  });
}

export function useMyMaterialRequests() {
  return useQuery({
    queryKey: userKeys.materialMovements(),
    queryFn: () => fetchJson<MaterialRequest[]>('/api/user/material-movements'),
    staleTime: 30_000,
  });
}

export function useSupportContact() {
  return useQuery({
    queryKey: userKeys.supportContact(),
    queryFn: () => fetchJson<SupportContact>('/api/user/support-contact'),
    staleTime: 300_000,
  });
}
