import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Euro,
  Percent,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../../lib/utils';
import { useFinanceKPIs } from '../../hooks/api/useDashboard';
import {
  buildVatCsv,
  usePayables,
  useUpdatePayable,
  useVatRegister,
  type PayableItem,
  type VatRegisterRow,
} from '../../hooks/api/useAccounting';
import Spinner from '../Spinner';
import {
  Badge,
  Button,
  EmptyState,
  ResponsiveDataView,
  StatusBadge,
  TableSkeleton,
  useToast,
} from '../ui';
import { DashboardKpiGrid, type DashboardKpiDefinition, type DashboardKpiSectionProps } from './DashboardKpiGrid';

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const moneyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type FinanceView = 'pnl' | 'payables' | 'vat';

const FINANCE_VIEWS: Array<{ id: FinanceView; label: string; icon: typeof Euro }> = [
  { id: 'pnl', label: 'P&L Cantieri', icon: TrendingUp },
  { id: 'payables', label: 'Pagamenti in uscita', icon: CalendarDays },
  { id: 'vat', label: 'Registro IVA', icon: ReceiptText },
];

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatMoney(value: unknown) {
  return moneyFormatter.format(Number(value) || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${percentFormatter.format(value)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('it-IT');
}

function formatCompactProjectName(value: string) {
  if (value.length <= 20) return value;
  return `${value.slice(0, 20)}...`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function lastDayOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);
}

function categoryLabel(value?: string | null) {
  const labels: Record<string, string> = {
    INVENTORY_MATERIAL: 'Materiale',
    CONSUMABLE_SUPPLY: 'Forniture',
    SERVICE: 'Servizi',
    LEASING_RENTAL: 'Leasing',
    UTILITY: 'Utenze',
    INSURANCE: 'Assicurazioni',
    TAX_FEE: 'Tasse',
    PROFESSIONAL_SERVICE: 'Professionisti',
    TRAVEL_VEHICLE: 'Veicoli',
    OTHER: 'Altro',
    UNKNOWN: 'Da classificare',
  };
  return labels[String(value ?? '')] ?? value ?? '—';
}

function effectiveStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Aperta',
    PAID: 'Pagata',
    CANCELLED: 'Annullata',
    OVERDUE: 'Scaduta',
    DUE_SOON: 'In scadenza',
  };
  return labels[status] ?? status;
}

function PayableCard({ item, onMarkPaid }: { item: PayableItem; onMarkPaid: (item: PayableItem) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-text-primary">{item.fornitore?.ragione_sociale ?? 'Fornitore non indicato'}</p>
          <p className="mt-1 text-xs text-text-secondary">
            Fattura {item.fattura_acquisto?.numero_documento ?? `#${item.fattura_acquisto?.id ?? '-'}`} · scade {formatDate(item.data_scadenza)}
          </p>
        </div>
        <StatusBadge status={item.status_effettivo} label={effectiveStatusLabel(item.status_effettivo)} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-secondary">Importo</p>
          <p className="font-bold text-text-primary">{formatMoney(item.importo)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-text-secondary">Metodo</p>
          <p className="font-medium text-text-primary">{item.modalita_pagamento ?? '—'}</p>
        </div>
      </div>
      {item.iban && <p className="mt-3 break-all text-xs text-text-secondary">IBAN {item.iban}</p>}
      {item.status === 'OPEN' && (
        <Button className="mt-4 w-full" variant="success" size="sm" onClick={() => onMarkPaid(item)}>
          Segna pagata
        </Button>
      )}
    </div>
  );
}

function PayablesPanel() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState('');
  const filters = useMemo(() => ({ status, from, to }), [from, status, to]);
  const { data, isLoading, error } = usePayables(filters);
  const updatePayable = useUpdatePayable();
  const items = data?.items ?? [];

  const markPaid = async (item: PayableItem) => {
    try {
      await updatePayable.mutateAsync({
        id: item.id,
        status: 'PAID',
        paid_amount: item.importo,
      });
      toast.success('Scadenza pagata', 'Il pagamento e stato registrato nello scadenziario.');
    } catch (err) {
      toast.error('Pagamento non registrato', err instanceof Error ? err.message : 'Errore aggiornamento scadenza.');
    }
  };

  if (isLoading) return <TableSkeleton rows={6} columns={5} />;
  if (error) return <p className="text-sm text-danger-text">Errore caricamento scadenziario.</p>;

  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Totale aperto</p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(summary?.totale_aperto)}</p>
        </div>
        <div className="rounded-2xl border border-danger-border bg-danger-bg p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-danger-text">Scaduto</p>
          <p className="mt-2 text-2xl font-extrabold text-danger-text">{formatMoney(summary?.totale_scaduto)}</p>
        </div>
        <div className="rounded-2xl border border-warning-border bg-warning-bg p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warning-text">Prossimi 7 giorni</p>
          <p className="mt-2 text-2xl font-extrabold text-warning-text">{formatMoney(summary?.totale_in_scadenza_7)}</p>
        </div>
        <div className="rounded-2xl border border-info-border bg-info-bg p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-info-text">Prossimi 30 giorni</p>
          <p className="mt-2 text-2xl font-extrabold text-info-text">{formatMoney(summary?.totale_in_scadenza_30)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[180px_180px_180px_1fr]">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Tutte</option>
            <option value="OPEN">Aperte</option>
            <option value="OVERDUE">Scadute</option>
            <option value="DUE_7">In scadenza 7 giorni</option>
            <option value="DUE_30">In scadenza 30 giorni</option>
            <option value="PAID">Pagate</option>
            <option value="CANCELLED">Annullate</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <p className="self-center text-xs text-text-secondary">
            Lo scadenziario nasce dalle fatture acquisto OCR/Genya e supporta piu rate per fattura.
          </p>
        </div>
      </div>

      <ResponsiveDataView
        data={items}
        getKey={(item) => item.id}
        emptyIcon={CalendarDays}
        emptyTitle="Nessuna scadenza pagamento"
        emptyDescription="Le scadenze compaiono quando una fattura acquisto OCR contiene data, importo e metodo pagamento."
        renderCard={(item) => <PayableCard item={item} onMarkPaid={markPaid} />}
        renderTable={(rows) => (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">Scadenza</th>
                  <th className="px-4 py-3 text-left">Fornitore</th>
                  <th className="px-4 py-3 text-left">Fattura</th>
                  <th className="px-4 py-3 text-left">Metodo</th>
                  <th className="px-4 py-3 text-right">Importo</th>
                  <th className="px-4 py-3 text-left">Stato</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-text-primary">{formatDate(item.data_scadenza)}</td>
                    <td className="px-4 py-3 text-text-primary">{item.fornitore?.ragione_sociale ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.fattura_acquisto?.numero_documento ?? `#${item.fattura_acquisto?.id ?? '-'}`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <div>{item.modalita_pagamento ?? '—'}</div>
                      {item.iban && <div className="text-xs">{item.iban}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-text-primary">{formatMoney(item.importo)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status_effettivo} label={effectiveStatusLabel(item.status_effettivo)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'OPEN' ? (
                        <Button size="sm" variant="success" onClick={() => markPaid(item)} disabled={updatePayable.isPending}>
                          <CheckCircle2 size={14} />
                          Pagata
                        </Button>
                      ) : (
                        <span className="text-xs text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
    </div>
  );
}

function VatCard({ row }: { row: VatRegisterRow }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-text-primary">{row.fornitore?.ragione_sociale ?? 'Fornitore non indicato'}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {formatDate(row.data_documento)} · fattura {row.numero_documento ?? `#${row.fattura_acquisto_id}`}
          </p>
        </div>
        <Badge tone="info">{row.iva_percentuale == null ? 'IVA N/D' : `IVA ${row.iva_percentuale}%`}</Badge>
      </div>
      <p className="mt-3 text-sm text-text-secondary">{row.descrizione ?? 'Riga senza descrizione'}</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-secondary">Imponibile</p>
          <p className="font-bold text-text-primary">{formatMoney(row.imponibile)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-text-secondary">Imposta</p>
          <p className="font-bold text-text-primary">{formatMoney(row.imposta)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-text-secondary">Totale</p>
          <p className="font-bold text-text-primary">{formatMoney(row.totale)}</p>
        </div>
      </div>
    </div>
  );
}

function VatRegisterPanel() {
  const toast = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = useMemo(() => ({ from, to }), [from, to]);
  const { data, isLoading, error } = useVatRegister(filters);
  const items = data?.items ?? [];

  const downloadCsv = () => {
    const csv = buildVatCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registro-iva-acquisti-${from || 'inizio'}-${to || 'fine'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV generato', 'Il registro IVA acquisti e pronto per il commercialista.');
  };

  const setCurrentMonth = () => {
    setFrom(firstDayOfCurrentMonth());
    setTo(lastDayOfCurrentMonth());
  };

  const clearPeriod = () => {
    setFrom('');
    setTo('');
  };

  if (isLoading) return <TableSkeleton rows={6} columns={6} />;
  if (error) return <p className="text-sm text-danger-text">Errore caricamento registro IVA.</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Imponibile</p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(data?.summary.imponibile)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">IVA acquisti</p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(data?.summary.imposta)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Totale lordo</p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">{formatMoney(data?.summary.totale)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Fatture / righe</p>
          <p className="mt-2 text-2xl font-extrabold text-text-primary">
            {data?.summary.fatture_count ?? 0} / {data?.summary.righe_count ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Da</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">A</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2 self-center">
            {(data?.summary.by_iva ?? []).map((row) => (
              <Badge key={row.iva_percentuale ?? 'nd'} tone="neutral">
                {row.iva_percentuale == null ? 'IVA N/D' : `IVA ${row.iva_percentuale}%`} · {formatMoney(row.imposta)}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={setCurrentMonth}>
              Mese corrente
            </Button>
            <Button variant="ghost" onClick={clearPeriod}>
              Tutto
            </Button>
            <Button variant="secondary" onClick={downloadCsv} disabled={items.length === 0}>
              <Download size={14} />
              CSV
            </Button>
          </div>
        </div>
      </div>

      <ResponsiveDataView
        data={items}
        getKey={(item) => item.id}
        emptyIcon={ReceiptText}
        emptyTitle="Nessuna riga IVA"
        emptyDescription="Le righe IVA si popolano dalle fatture acquisto analizzate via OCR. Se hai impostato un periodo, prova a rimuovere il filtro date."
        renderCard={(item) => <VatCard row={item} />}
        renderTable={(rows) => (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Fattura</th>
                  <th className="px-4 py-3 text-left">Fornitore</th>
                  <th className="px-4 py-3 text-left">Descrizione</th>
                  <th className="px-4 py-3 text-right">Imponibile</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Imposta</th>
                  <th className="px-4 py-3 text-right">Totale</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(row.data_documento)}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{row.numero_documento ?? `#${row.fattura_acquisto_id}`}</td>
                    <td className="px-4 py-3 text-text-primary">{row.fornitore?.ragione_sociale ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.descrizione ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(row.imponibile)}</td>
                    <td className="px-4 py-3 text-right">{row.iva_percentuale == null ? '—' : `${row.iva_percentuale}%`}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(row.imposta)}</td>
                    <td className="px-4 py-3 text-right font-bold text-text-primary">{formatMoney(row.totale)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.allocation_scope === 'OVERHEAD' ? 'info' : 'neutral'}>
                        {categoryLabel(row.cost_category)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
    </div>
  );
}

function PnlPanel({ kpiControls }: { kpiControls: DashboardKpiSectionProps }) {
  const { data, isLoading, error } = useFinanceKPIs();

  if (isLoading) return <Spinner label="Caricamento dati finanziari..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati finanziari.</p>;

  const totalRevenue = data.valoreContrattoTotale ?? data.budgetTotale ?? 0;
  const totalCosts = data.costiTotali ?? data.speseTotali ?? 0;
  const marginPercent = data.marginePct;
  const isMarginAlert = marginPercent != null && marginPercent < 15;
  const isMarginPositive = data.margine >= 0;
  const topCantieri = data.topCantieri ?? [];
  const hasRevenue = totalRevenue > 0;
  const kpiDefinitions: DashboardKpiDefinition[] = [
    {
      id: 'finance-revenue',
      label: 'Ricavi Previsti Totali',
      value: formatCurrency(totalRevenue),
      sublabel: hasRevenue ? 'Somma valori contratto cantieri attivi' : 'Nessun contratto valorizzato',
      icon: Euro,
      tone: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      id: 'finance-costs',
      label: 'Costi Totali Reali',
      value: formatCurrency(totalCosts),
      sublabel: `Manodopera ${formatCurrency(data.costoManodoperaTotale ?? 0)} | Materiali ${formatCurrency(data.costoMaterialiTotale ?? 0)} | Spese ${formatCurrency(data.costoSpeseTotale ?? 0)}`,
      icon: TrendingDown,
      tone: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    {
      id: 'finance-margin',
      label: 'Margine Netto',
      value: formatCurrency(data.margine),
      sublabel: isMarginPositive ? 'Ricavi superiori ai costi' : 'Costi superiori ai ricavi',
      icon: isMarginPositive ? TrendingUp : AlertTriangle,
      tone: isMarginPositive ? 'text-emerald-500' : 'text-rose-500',
      bg: isMarginPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10',
    },
    {
      id: 'finance-margin-pct',
      label: 'Margine Netto %',
      value: formatPercent(marginPercent),
      sublabel: marginPercent == null ? 'Contratti mancanti' : isMarginAlert ? 'Sotto soglia di allerta 15%' : 'Margine sopra soglia di controllo',
      icon: Percent,
      tone: marginPercent == null ? 'text-text-secondary' : isMarginAlert ? 'text-rose-500' : 'text-emerald-500',
      bg: marginPercent == null ? 'bg-background' : isMarginAlert ? 'bg-rose-500/10' : 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardKpiGrid definitions={[...kpiDefinitions, ...kpiControls.customKpis]} controls={kpiControls} />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Top 5 Cantieri Attivi
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Confronto tra ricavo previsto da contratto e costo reale operativo.
            </p>
          </div>
          {marginPercent != null && (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-right',
                isMarginAlert
                  ? 'border-danger-border bg-danger-bg text-danger-text'
                  : 'border-success-border bg-success-bg text-success-text'
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">Margine Globale</p>
              <p className="text-lg font-bold">{formatPercent(marginPercent)}</p>
            </div>
          )}
        </div>

        {!hasRevenue ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background text-center">
            <AlertTriangle size={28} className="text-text-secondary/60" />
            <div>
              <p className="font-medium text-text-primary">Nessun valore contratto disponibile.</p>
              <p className="mt-1 text-sm text-text-secondary">
                Valorizza il campo contratto nei cantieri per attivare il confronto P&amp;L.
              </p>
            </div>
          </div>
        ) : topCantieri.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-sm text-text-secondary">
            Nessun cantiere attivo con contratto valorizzato disponibile per il confronto.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCantieri} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, rgba(148, 163, 184, 0.18))" />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    tickFormatter={formatCompactProjectName}
                    interval={0}
                    angle={-10}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    tickFormatter={(value: number) => `€${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(value: string) => value}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid var(--color-border, rgba(148, 163, 184, 0.18))',
                      backgroundColor: 'var(--color-card, white)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ricavoPrevisto" name="Ricavo Previsto" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="costo" name="Costo Reale" fill="#f97316" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-text-secondary">
                    <th className="px-4 py-3">Cantiere</th>
                    <th className="px-4 py-3 text-right">Ricavo Previsto</th>
                    <th className="px-4 py-3 text-right">Costo Reale</th>
                    <th className="px-4 py-3 text-right">Margine</th>
                    <th className="px-4 py-3 text-right">Margine %</th>
                  </tr>
                </thead>
                <tbody>
                  {topCantieri.map((cantiere) => {
                    const rowAlert = cantiere.marginePct != null && cantiere.marginePct < 15;
                    return (
                      <tr key={cantiere.id} className="border-b border-border/60">
                        <td className="px-4 py-3 font-medium text-text-primary">{cantiere.nome}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(cantiere.ricavoPrevisto)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(cantiere.costo)}</td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold',
                            cantiere.margine >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          )}
                        >
                          {formatCurrency(cantiere.margine)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold',
                            cantiere.marginePct == null
                              ? 'text-text-secondary'
                              : rowAlert
                                ? 'text-rose-500'
                                : 'text-emerald-500'
                          )}
                        >
                          {formatPercent(cantiere.marginePct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinanceTab({ kpiControls }: { kpiControls: DashboardKpiSectionProps }) {
  const [view, setView] = useState<FinanceView>('pnl');

  return (
    <div className="space-y-6">
      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {FINANCE_VIEWS.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all',
              view === item.id ? 'bg-background text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {view === 'pnl' && <PnlPanel kpiControls={kpiControls} />}
      {view === 'payables' && <PayablesPanel />}
      {view === 'vat' && <VatRegisterPanel />}
    </div>
  );
}
