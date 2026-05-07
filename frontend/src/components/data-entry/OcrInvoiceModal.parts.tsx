import { FileSearch } from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  CostAllocationScope,
  CostCategory,
  InvoiceOcrLine,
  InvoiceOcrPayload,
  SpesaOcrResponse,
} from '../../hooks/api/useHr';
import { EmptyState } from '../ui';

export function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: unknown) {
  const amount = safeNumber(value);
  return `€${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatOptionalMoney(value: unknown) {
  if (value == null || value === '') return '—';
  return formatMoney(value);
}

export function normalizeOcrLines(lines: InvoiceOcrLine[] | undefined | null) {
  return Array.isArray(lines) ? lines : [];
}

export function isLoadableLine(line: InvoiceOcrLine) {
  return Boolean(
    line.codice_sku
      && line.stockable !== false
      && (line.cost_category == null || line.cost_category === 'INVENTORY_MATERIAL')
  );
}

export const COST_CATEGORY_OPTIONS: Array<{ value: CostCategory; label: string }> = [
  { value: 'INVENTORY_MATERIAL', label: 'Materiale di magazzino' },
  { value: 'CONSUMABLE_SUPPLY', label: 'Fornitura / consumabile' },
  { value: 'SERVICE', label: 'Servizio' },
  { value: 'LEASING_RENTAL', label: 'Leasing / noleggio' },
  { value: 'UTILITY', label: 'Utenza' },
  { value: 'INSURANCE', label: 'Assicurazione' },
  { value: 'TAX_FEE', label: 'Tassa / diritto' },
  { value: 'PROFESSIONAL_SERVICE', label: 'Prestazione professionale' },
  { value: 'TRAVEL_VEHICLE', label: 'Viaggio / veicolo' },
  { value: 'OTHER', label: 'Altro' },
  { value: 'UNKNOWN', label: 'Da classificare' },
];

export const ALLOCATION_SCOPE_OPTIONS: Array<{ value: CostAllocationScope; label: string }> = [
  { value: 'PROJECT', label: 'Progetto / cantiere' },
  { value: 'OVERHEAD', label: 'Overhead aziendale' },
  { value: 'REVIEW', label: 'Da rivedere' },
];

export function categoryLabel(value?: string | null) {
  return COST_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value ?? 'Da classificare';
}

export function scopeLabel(value?: string | null) {
  return ALLOCATION_SCOPE_OPTIONS.find((item) => item.value === value)?.label ?? value ?? 'Da rivedere';
}

export function formatOcrAddress(subject?: InvoiceOcrPayload['fornitore'] | InvoiceOcrPayload['cliente'] | null) {
  if (!subject) return '—';
  const locality = [subject.cap, subject.comune].filter(Boolean).join(' ');
  const province = subject.provincia ? `(${subject.provincia})` : '';
  return [subject.indirizzo, [locality, province].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';
}

export function lineStatusMeta(line: InvoiceOcrLine) {
  if (!isLoadableLine(line)) {
    return { label: 'Da riconciliare', cls: 'bg-warning-bg text-warning-text border-warning-border' };
  }
  if (line.magazzino_status === 'existing') {
    return { label: 'Articolo esistente', cls: 'bg-info-bg text-info-text border-info-border' };
  }
  if (line.magazzino_status === 'reconcile') {
    return { label: 'Da riconciliare', cls: 'bg-warning-bg text-warning-text border-warning-border' };
  }
  return { label: 'Nuovo articolo', cls: 'bg-success-bg text-success-text border-success-border' };
}

export function supplierActionLabel(action?: SpesaOcrResponse['fornitoreAction']) {
  if (action === 'created') return 'Fornitore creato';
  if (action === 'updated') return 'Fornitore aggiornato';
  if (action === 'found') return 'Fornitore già presente';
  return 'Fornitore non variato';
}

export function purchaseInvoiceDueLabel(invoice?: { scadenze?: Array<{ data_scadenza?: string; importo?: number | string }> } | null) {
  const due = invoice?.scadenze?.[0];
  if (!due) return 'scadenziario non generato';
  const date = String(due.data_scadenza ?? '').slice(0, 10) || 'senza data';
  return `scadenza ${date} · ${formatOptionalMoney(due.importo)}`;
}

type PurchaseInvoicePreview = {
  id?: number;
  numero_documento?: string | null;
  righe?: unknown[] | null;
  scadenze?: Array<{ data_scadenza?: string; importo?: number | string }> | null;
} | null;

export function OcrConfirmationSummary({
  confirmation,
  title = 'Fattura registrata',
}: {
  confirmation: SpesaOcrResponse;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-success-border bg-success-bg p-4 text-sm text-success-text">
      <p className="font-bold">{title}</p>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <span>{supplierActionLabel(confirmation.fornitoreAction)}</span>
        <span>{confirmation.articoliCreati ?? 0} articoli creati</span>
        <span>{confirmation.movimentiCaricoCreati ?? 0} movimenti di carico</span>
        <span>{confirmation.righeDaRiconciliare ?? 0} righe da riconciliare</span>
      </div>
      {confirmation.fatturaAcquisto?.id && (
        <p className="mt-2 text-xs font-semibold">
          Fattura acquisto #{confirmation.fatturaAcquisto.id} salvata con dati IVA, righe OCR e {purchaseInvoiceDueLabel(confirmation.fatturaAcquisto)}.
        </p>
      )}
    </div>
  );
}

export function OcrSubjectPanel({
  title,
  subject,
}: {
  title: string;
  subject?: InvoiceOcrPayload['fornitore'] | InvoiceOcrPayload['cliente'] | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{title}</p>
      <p className="mt-1 text-sm font-bold text-text-primary">{subject?.ragione_sociale || '—'}</p>
      <p className="mt-1 text-xs text-text-secondary">P.IVA: {subject?.partita_iva || '—'}</p>
      <p className="mt-1 text-xs text-text-secondary">{formatOcrAddress(subject)}</p>
    </div>
  );
}

export function OcrAccountingSummary({
  payload,
  pagamento,
  purchaseInvoice,
  compact = false,
}: {
  payload: InvoiceOcrPayload | null;
  pagamento?: InvoiceOcrPayload['pagamento'] | null;
  purchaseInvoice?: PurchaseInvoicePreview;
  compact?: boolean;
}) {
  return (
    <>
      <div className={cn('grid gap-4', compact ? 'md:grid-cols-2' : 'md:grid-cols-4')}>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{compact ? 'Documento' : 'Tipo documento'}</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {compact ? payload?.numero_documento || '—' : payload?.tipo_documento || payload?.document_type || '—'}
          </p>
          {compact && <p className="mt-1 text-xs text-text-secondary">{payload?.data_documento || '—'}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{compact ? 'Totale' : 'Documento'}</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {compact ? formatOptionalMoney(payload?.totale_documento) : payload?.numero_documento || '—'}
          </p>
          {compact && <p className="mt-1 text-xs text-text-secondary">{pagamento?.modalita_pagamento || 'Pagamento non letto'}</p>}
        </div>
        {!compact && (
          <>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Data</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{payload?.data_documento || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Totale OCR</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{formatOptionalMoney(payload?.totale_documento)}</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Imponibile</p>
          <p className="mt-1 text-sm font-bold text-text-primary">{formatOptionalMoney(payload?.totale_imponibile)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">IVA</p>
          <p className="mt-1 text-sm font-bold text-text-primary">{formatOptionalMoney(payload?.totale_imposta)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{compact ? 'Scadenza' : 'Pagamento'}</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {compact ? pagamento?.scadenza || '—' : pagamento?.modalita_pagamento || '—'}
          </p>
          {!compact && <p className="mt-1 text-xs text-text-secondary">{pagamento?.iban || '—'}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{compact ? 'Importo rata' : 'Scadenza'}</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {compact ? formatOptionalMoney(pagamento?.importo_scadenza) : pagamento?.scadenza || '—'}
          </p>
          {!compact && <p className="mt-1 text-xs text-text-secondary">{formatOptionalMoney(pagamento?.importo_scadenza)}</p>}
        </div>
      </div>

      {purchaseInvoice && (
        <div className="mt-4 rounded-2xl border border-info-border bg-info-bg p-4 text-sm text-info-text">
          <p className="font-bold">Fattura acquisto strutturata</p>
          <p className="mt-1 text-xs">
            {purchaseInvoice.numero_documento || payload?.numero_documento || 'Documento senza numero'} ·{' '}
            {purchaseInvoice.righe?.length ?? 0} righe {compact ? '· fornitore, IVA, pagamento e scadenziario saranno salvati.' : 'salvabili · dati fornitore, IVA e scadenziario disponibili.'}
          </p>
        </div>
      )}
    </>
  );
}

export function OcrInvoiceLinesTable({
  lines,
  loadableLines,
  emptyDescription,
  compact = false,
  costLines = [],
}: {
  lines: InvoiceOcrLine[];
  loadableLines: InvoiceOcrLine[];
  emptyDescription: string;
  compact?: boolean;
  costLines?: NonNullable<InvoiceOcrPayload['righe_costo']>;
}) {
  return (
    <div className="rounded-2xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text-primary">{compact ? 'Righe materiali' : 'Righe materiali estratte'}</h3>
        <span className="text-xs text-text-secondary">
          {loadableLines.length} caricabili · {lines.length - loadableLines.length} da riconciliare
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={FileSearch}
            title="Nessuna riga materiale"
            description={emptyDescription}
          />
        </div>
      ) : (
        <div className={compact ? 'max-h-[360px] overflow-auto' : 'overflow-x-auto'}>
          <table className="w-full text-sm">
            <thead className={cn('bg-background text-xs uppercase tracking-wider text-text-secondary', compact && 'sticky top-0')}>
              <tr>
                <th className="px-4 py-3 text-left">Codice</th>
                <th className="px-4 py-3 text-left">Descrizione</th>
                <th className="px-4 py-3 text-left">Esito</th>
                {!compact && <th className="px-4 py-3 text-right">Q.ta</th>}
                {!compact && <th className="px-4 py-3 text-left">UM</th>}
                {!compact && <th className="px-4 py-3 text-right">Prezzo unit.</th>}
                <th className="px-4 py-3 text-right">Totale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, index) => {
                const status = lineStatusMeta(line);
                return (
                  <tr key={`${line.codice_articolo ?? 'row'}-${index}`}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-text-primary">{line.codice_sku || line.codice_articolo || '—'}</p>
                      {!compact && line.codice_articolo && line.codice_sku && line.codice_articolo !== line.codice_sku && (
                        <p className="text-[10px] text-text-secondary">Orig.: {line.codice_articolo}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{line.descrizione || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-bold', status.cls)}>
                        {status.label}
                      </span>
                    </td>
                    {!compact && <td className="px-4 py-3 text-right text-text-primary">{safeNumber(line.quantita).toLocaleString('it-IT')}</td>}
                    {!compact && <td className="px-4 py-3 text-text-secondary">{line.unita_misura || '—'}</td>}
                    {!compact && <td className="px-4 py-3 text-right text-text-primary">{formatOptionalMoney(line.prezzo_unitario ?? line.costo_unitario)}</td>}
                    <td className="px-4 py-3 text-right font-bold text-text-primary">{formatOptionalMoney(line.prezzo_totale ?? line.importo_riga)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {costLines.length > 0 && (
        <div className="border-t border-border p-4">
          <h4 className="text-sm font-bold text-text-primary">Righe costo non logistiche</h4>
          <div className="mt-3 space-y-2">
            {costLines.map((line, index) => (
              <div key={`${line.descrizione ?? 'cost'}-${index}`} className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary">{line.descrizione || 'Costo senza descrizione'}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {categoryLabel(line.cost_category)} · {scopeLabel(line.allocation_scope)}
                    </p>
                  </div>
                  <span className="font-bold text-text-primary">{formatOptionalMoney(line.importo)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
