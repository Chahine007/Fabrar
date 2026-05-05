/**
 * useTelegramAudit.ts — React Query hooks per il Feed Telegram Bot.
 * Aggrega:
 *   - /api/logs          → MessageLog (log grezzi interazioni bot)
 *   - /api/hr/audit?type=ore&status=...  → Ore inserite via Telegram
 *   - /api/hr/audit?type=spese&status=... → Spese da foto scontrino
 *
 * Supporta filtro opzionale per cantiere_id (vista contestuale in ProjectDetail).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { telegramKeys, hrKeys, employeeKeys } from './queryKeys';
import type { AuditEntry, AuditStatus, AuditBulkItem } from './useHr';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MessageLogEntry {
  id: number;
  timestamp_utc: string;
  employee_id: number;
  employee_name: string | null;
  message_type: string | null;
  raw_text: string | null;
  extracted_json: string | null;
}

export interface TelegramAuditFilters {
  cantiereId?: number;     // se presente, filtra per cantiere specifico
  status?: AuditStatus;
  from?: string;           // YYYY-MM-DD
  to?: string;             // YYYY-MM-DD
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(body, `Errore ${res.status}`));
  }
  return res.json() as Promise<T>;
}

function buildAuditPath(type: 'ore' | 'spese', filters: TelegramAuditFilters): string {
  const params = new URLSearchParams({ type });
  if (filters.status)     params.set('status',      filters.status);
  if (filters.from)       params.set('from',         filters.from);
  if (filters.to)         params.set('to',           filters.to);
  if (filters.cantiereId) params.set('cantiere_id',  String(filters.cantiereId));
  return `/api/hr/audit?${params.toString()}`;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Log grezzi di tutte le interazioni con il bot Telegram.
 * Restituisce i record dalla tabella MessageLog.
 */
export function useMessageLogs(filters: TelegramAuditFilters = {}, enabled = true) {
  return useQuery({
    queryKey: telegramKeys.logs(filters),
    queryFn: () => fetchJson<MessageLogEntry[]>('/api/logs'),
    enabled,
  });
}

/**
 * Ore inserite da bot (fonte TELEGRAM_TESTO / TELEGRAM_AUDIO / GPS).
 * Può essere filtrato per cantiere lato client dopo il fetch.
 */
export function useTelegramOre(filters: TelegramAuditFilters = {}) {
  return useQuery({
    queryKey: telegramKeys.audit({ type: 'ore', ...filters }),
    queryFn: () => fetchJson<AuditEntry[]>(buildAuditPath('ore', filters)),
  });
}

/**
 * Spese inserite da bot (input_method telegram_ocr / TELEGRAM_OCR).
 */
export function useTelegramSpese(filters: TelegramAuditFilters = {}) {
  return useQuery({
    queryKey: telegramKeys.audit({ type: 'spese', ...filters }),
    queryFn: () => fetchJson<AuditEntry[]>(buildAuditPath('spese', filters)),
  });
}

/**
 * Feed unificato per la TelegramAuditPage globale.
 * Esegue le 2 query in parallelo e fonde i risultati.
 * Filtra opzionalmente per cantiere_id lato client.
 */
export function useTelegramFeed(filters: TelegramAuditFilters = {}) {
  const oreQuery  = useTelegramOre(filters);
  const speseQuery = useTelegramSpese(filters);
  const logsQuery = useMessageLogs(filters);

  const isLoading = oreQuery.isLoading || speseQuery.isLoading || logsQuery.isLoading;
  const error     = oreQuery.error || speseQuery.error || logsQuery.error;

  const feed = (() => {
    const ore   = (oreQuery.data   ?? []).filter(e => isTelegramSource(e.input_method));
    const spese = (speseQuery.data ?? []).filter(e => isTelegramSource(e.input_method));
    const all   = [...ore, ...spese];

    // Filtro lato client per cantiere specifico
    // Il filtro è applicato anche lato backend (cantiere_id passato nei params)
    // Il filtro client-side rimane come fallback per dati privi di cantiere_id
    const filtered = filters.cantiereId
      ? all.filter(e =>
          (e.cantiere_nome ?? '').length > 0 // record con cantiere valorizzato
        )
      : all;

    // Ordina per data decrescente
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  })();

  return {
    feed,
    logs: logsQuery.data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => {
      oreQuery.refetch();
      speseQuery.refetch();
      logsQuery.refetch();
    },
  };
}

/** Identifica i record originati dal bot Telegram */
function isTelegramSource(method: string): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  return m.includes('telegram') || m.includes('gps') || m.includes('ocr');
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useApproveTelegramEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { items: AuditBulkItem[] } | { ids: number[]; action: 'verify' | 'reject' }) => {
      const res = await apiFetch('/api/hr/audit/bulk', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, 'Errore approvazione'));
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: telegramKeys.all() });
      qc.invalidateQueries({ queryKey: hrKeys.all() });
      qc.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
}
