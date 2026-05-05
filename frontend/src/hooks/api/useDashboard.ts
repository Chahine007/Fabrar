/**
 * useDashboard.ts — React Query hooks per Dashboard principale e BI.
 * Endpoint: GET /api/dashboard/radar + /api/dashboard/bi/*
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { dashboardKeys } from './queryKeys';

// ─── Types (radar) ───────────────────────────────────────────────────────────

export interface DashboardCantiere {
  id:     number;
  nome:   string;
  budget: number | null;
  costo:  number;
  pct:    number | null;
  status: string;
}

export interface DashboardRadar {
  cantieri:      DashboardCantiere[];
  pending:       { reports: number; spese: number };
  oreSettimana:  { corrente: number; scorsa: number };
  operaiAttivi:  number;
}

// ─── Types (BI) ──────────────────────────────────────────────────────────────

export interface FinanceKPIs {
  budgetTotale: number;
  speseTotali:  number;
  costiTotali?: number;
  valoreContrattoTotale?: number;
  costoManodoperaTotale?: number;
  costoMaterialiTotale?: number;
  costoSpeseTotale?: number;
  margine:      number;
  marginePct:   number | null;
  cpiMedio:     number | null;
  top3BurnRate: { id: number; nome: string; budget: number; costo: number; burnRate: number; cpi: number | null }[];
}

export interface WarehouseKPIs {
  capitaleImmobilizzato: number;
  totalArticoli:  number;
  totalMovimenti: number;
  deadStock: {
    articolo_id: number;
    codice_sku:  string;
    descrizione: string;
    quantita:    number;
    valore:      number;
    ultimo_movimento: string | null;
  }[];
}

export interface HrKPIs {
  costoOrarioMedio:     number;
  oreTotaliMese:        number;
  oreConWbs:            number;
  pctFatturabili:       number;
  costoHrMese:          number;
  dipendentiConTariffa: number;
}

export interface OpsKPIs {
  avgApprovalHours: number | null;
  totalVerified:    number;
  totalRejected:    number;
  totalEntries:     number;
  tassoRifiuto:     number;
  totalPending:     number;
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

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useDashboardRadar() {
  return useQuery({
    queryKey: dashboardKeys.kpi(),
    queryFn:  () => fetchJson<DashboardRadar>('/api/dashboard/radar'),
    staleTime: 60_000,
  });
}

export function useFinanceKPIs() {
  return useQuery({
    queryKey: [...dashboardKeys.all(), 'bi', 'finance'],
    queryFn:  () => fetchJson<FinanceKPIs>('/api/dashboard/bi/finance'),
    staleTime: 120_000,
  });
}

export function useWarehouseKPIs() {
  return useQuery({
    queryKey: [...dashboardKeys.all(), 'bi', 'warehouse'],
    queryFn:  () => fetchJson<WarehouseKPIs>('/api/dashboard/bi/warehouse'),
    staleTime: 120_000,
  });
}

export function useHrKPIs() {
  return useQuery({
    queryKey: [...dashboardKeys.all(), 'bi', 'hr'],
    queryFn:  () => fetchJson<HrKPIs>('/api/dashboard/bi/hr'),
    staleTime: 120_000,
  });
}

export function useOpsKPIs() {
  return useQuery({
    queryKey: [...dashboardKeys.all(), 'bi', 'operations'],
    queryFn:  () => fetchJson<OpsKPIs>('/api/dashboard/bi/operations'),
    staleTime: 120_000,
  });
}
