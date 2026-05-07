import { PackageCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AuditEntry, AuditStatus, AuditType } from '../../hooks/api/useHr';

export type AuditMutationStatus = 'APPROVED' | 'REJECTED';

export function isApprovedAuditStatus(status: AuditStatus | string | null | undefined) {
  const raw = String(status ?? '').toUpperCase();
  return raw === 'APPROVED' || raw === 'VERIFIED';
}

export function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeTime(value: unknown) {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAuditDate(value: unknown) {
  const time = safeTime(value);
  return time ? new Date(time).toLocaleDateString('it-IT') : '—';
}

export function formatAuditValue(entry: AuditEntry) {
  const value = safeNumber(entry.value);
  return entry.type === 'ore'
    ? `${value}h`
    : `€${value.toLocaleString('it-IT')}`;
}

export function auditKey(entry: Pick<AuditEntry, 'type' | 'id'>) {
  return `${entry.type}:${entry.id}`;
}

export function toAuditMutationItem(entry: Pick<AuditEntry, 'id' | 'type'>, newStatus: AuditMutationStatus) {
  return { id: entry.id, type: entry.type as AuditType, newStatus };
}

export function formatDayLabel(dayKey: string) {
  const time = safeTime(`${dayKey}T00:00:00`);
  return time
    ? new Date(time).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : dayKey;
}

export function formatLogTime(value: string) {
  const time = safeTime(value);
  return time
    ? new Date(time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : '—';
}

export function safeParseLogJson(rawJson: string | null) {
  if (!rawJson || !rawJson.trim()) {
    return { parsedJson: null, hasInvalidJson: false };
  }

  try {
    return { parsedJson: JSON.parse(rawJson), hasInvalidJson: false };
  } catch {
    return { parsedJson: rawJson, hasInvalidJson: true };
  }
}

export function getLogAnomalyCount(log: {
  isUnknownEmployee: boolean;
  hasInvalidJson: boolean;
  previewTruncated: boolean;
}) {
  let count = 0;
  if (log.isUnknownEmployee) count += 1;
  if (log.hasInvalidJson) count += 1;
  if (log.previewTruncated) count += 1;
  return count;
}

export function StatusBadge({ status }: { status: AuditStatus }) {
  const map: Record<AuditStatus, { label: string; cls: string }> = {
    pending: { label: '⏳ In Attesa', cls: 'bg-warning-bg text-warning-text border border-warning-border' },
    approved: { label: '✅ Approvato', cls: 'bg-success-bg text-success-text border border-success-border' },
    verified: { label: '✅ Approvato', cls: 'bg-success-bg text-success-text border border-success-border' },
    rejected: { label: '❌ Rifiutato', cls: 'bg-danger-bg text-danger-text border border-danger-border' },
  };
  const item = map[status] ?? { label: status, cls: 'bg-background text-text-secondary' };
  return (
    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', item.cls)}>
      {item.label}
    </span>
  );
}

export function LogisticaBadge({ status }: { status?: AuditEntry['logistica_status'] }) {
  if (!status || status === 'NOT_REQUIRED') return null;
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_OCR: { label: 'Da analizzare OCR', cls: 'bg-warning-bg text-warning-text border-warning-border' },
    OCR_REVIEW: { label: 'OCR in revisione', cls: 'bg-info-bg text-info-text border-info-border' },
    LOADED_TO_WAREHOUSE: { label: 'Caricato a magazzino', cls: 'bg-success-bg text-success-text border-success-border' },
    RECONCILIATION_REQUIRED: { label: 'Da riconciliare', cls: 'bg-danger-bg text-danger-text border-danger-border' },
  };
  const item = map[status] ?? { label: status, cls: 'bg-background text-text-secondary border-border' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold', item.cls)}>
      <PackageCheck size={11} />
      {item.label}
    </span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  INVENTORY_MATERIAL: 'Materiale',
  CONSUMABLE_SUPPLY: 'Fornitura',
  SERVICE: 'Servizio',
  LEASING_RENTAL: 'Leasing',
  UTILITY: 'Utenza',
  INSURANCE: 'Assicurazione',
  TAX_FEE: 'Tassa',
  PROFESSIONAL_SERVICE: 'Professionista',
  TRAVEL_VEHICLE: 'Veicolo',
  OTHER: 'Altro',
  UNKNOWN: 'Da classificare',
};

const SCOPE_LABELS: Record<string, string> = {
  PROJECT: 'Cantiere',
  OVERHEAD: 'Overhead',
  REVIEW: 'Review',
};

export function CostBadges({ entry }: { entry: AuditEntry }) {
  if (entry.type !== 'spese') return null;
  const category = entry.cost_category ?? 'OTHER';
  const scope = entry.allocation_scope ?? 'PROJECT';
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className="inline-flex rounded-full border border-border bg-background px-2 py-1 text-[10px] font-bold text-text-secondary">
        {CATEGORY_LABELS[String(category)] ?? String(category)}
      </span>
      <span className={cn(
        'inline-flex rounded-full border px-2 py-1 text-[10px] font-bold',
        scope === 'OVERHEAD'
          ? 'border-info-border bg-info-bg text-info-text'
          : scope === 'REVIEW'
            ? 'border-warning-border bg-warning-bg text-warning-text'
            : 'border-success-border bg-success-bg text-success-text'
      )}>
        {SCOPE_LABELS[String(scope)] ?? String(scope)}
      </span>
    </span>
  );
}

export function PurchaseInvoiceBadge({ entry }: { entry: AuditEntry }) {
  if (entry.type !== 'spese' || !entry.fattura_acquisto) return null;
  const invoice = entry.fattura_acquisto;
  const total = safeNumber(invoice.totale_documento);
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-full border border-info-border bg-info-bg px-2 py-1 text-[10px] font-bold text-info-text">
      Fattura #{invoice.numero_documento || invoice.id}
      {total > 0 && <span>· €{total.toLocaleString('it-IT')}</span>}
      {invoice.righe_count != null && <span>· {invoice.righe_count} righe</span>}
    </span>
  );
}
