import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Database,
  FileWarning,
  Loader2,
  PackageSearch,
  PlayCircle,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useBiOverview,
  useDataQuality,
  useFlushOutbox,
  useLedgerBackfill,
  useOutboxEvents,
  useRetryOutboxEvent,
} from '../../hooks/api/useEnterprise';
import { cn } from '../../lib/utils';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  StatusBadge,
  TableSkeleton,
  useToast,
} from '../ui';
import { DashboardKpiGrid, type DashboardKpiDefinition, type DashboardKpiSectionProps } from './DashboardKpiGrid';

type DataQualityReport = {
  summary?: Record<string, number>;
  roleMismatches?: Array<Record<string, unknown>>;
  duplicateSuppliers?: Array<Record<string, unknown>>;
  unclassifiedExpenses?: Array<Record<string, unknown>>;
  pendingOcrExpenses?: Array<Record<string, unknown>>;
  disconnectedDocuments?: Array<Record<string, unknown>>;
  articlesWithoutStock?: Array<Record<string, unknown>>;
  understockArticles?: Array<Record<string, unknown>>;
};

type BiOverview = {
  exceptions?: {
    pendingOcr?: number;
    outboxFailed?: number;
    materialRequestsPending?: number;
    payables?: {
      overdue?: { count?: number; amount?: number };
      next7Days?: { count?: number; amount?: number };
      openTotal?: { count?: number; amount?: number };
    };
    understockArticles?: Array<Record<string, unknown>>;
  };
};

type OutboxResponse = {
  events?: Array<{
    id: number;
    event_type?: string;
    aggregate_type?: string;
    aggregate_id?: string | number;
    status?: string;
    attempts?: number;
    last_error?: string | null;
    created_at?: string;
    occurred_at?: string;
  }>;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(toNumber(value));
}

function formatDate(value: unknown) {
  if (!value) return 'Data non disponibile';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Data non disponibile';
  return date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function issueCount(report: DataQualityReport) {
  return Object.values(report.summary ?? {}).reduce((total, value) => total + toNumber(value), 0);
}

function DetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
        <div className="mt-1 text-sm font-semibold text-text-primary">{value}</div>
      </div>
      {action}
    </div>
  );
}

function QualityCard({
  icon: Icon,
  title,
  count,
  description,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  description: string;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
}) {
  const iconClass =
    tone === 'danger'
      ? 'bg-danger-bg text-danger-text'
      : tone === 'warning'
        ? 'bg-warning-bg text-warning-text'
        : tone === 'info'
          ? 'bg-info-bg text-info-text'
          : 'bg-background text-text-secondary';

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn('rounded-xl p-2.5', iconClass)}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-sm font-bold text-text-primary">{title}</h4>
            <Badge tone={count > 0 ? (tone === 'neutral' ? 'warning' : tone) : 'success'}>
              {count}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function GovernanceTab({ kpiControls }: { kpiControls: DashboardKpiSectionProps }) {
  const toast = useToast();
  const overviewQuery = useBiOverview();
  const dataQualityQuery = useDataQuality();
  const outboxQuery = useOutboxEvents({ status: 'FAILED', limit: 20 });
  const flushOutbox = useFlushOutbox();
  const retryOutbox = useRetryOutboxEvent();
  const ledgerBackfill = useLedgerBackfill();
  const [confirmBackfillOpen, setConfirmBackfillOpen] = useState(false);
  const [lastBackfillResult, setLastBackfillResult] = useState<Record<string, unknown> | null>(null);

  const overview = (overviewQuery.data ?? {}) as BiOverview;
  const dataQuality = (dataQualityQuery.data ?? {}) as DataQualityReport;
  const outbox = (outboxQuery.data ?? {}) as OutboxResponse;
  const failedEvents = outbox.events ?? [];
  const totalDataIssues = issueCount(dataQuality);
  const pendingOcr = toNumber(overview.exceptions?.pendingOcr);
  const overduePayables = overview.exceptions?.payables?.overdue;
  const outboxFailed = toNumber(overview.exceptions?.outboxFailed || failedEvents.length);

  const kpis = useMemo<DashboardKpiDefinition[]>(() => [
    {
      id: 'governance-data-issues',
      label: 'Anomalie Data Quality',
      value: dataQualityQuery.isLoading ? '...' : totalDataIssues,
      sublabel: 'Record da normalizzare o riconciliare',
      icon: ShieldAlert,
      tone: totalDataIssues > 0 ? 'text-warning-text' : 'text-success-text',
      bg: totalDataIssues > 0 ? 'bg-warning-bg' : 'bg-success-bg',
      trendType: totalDataIssues > 0 ? 'negative' : 'positive',
    },
    {
      id: 'governance-pending-ocr',
      label: 'OCR Da Revisionare',
      value: overviewQuery.isLoading ? '...' : pendingOcr,
      sublabel: 'Fatture/spese in coda logistica',
      icon: FileWarning,
      tone: pendingOcr > 0 ? 'text-warning-text' : 'text-success-text',
      bg: pendingOcr > 0 ? 'bg-warning-bg' : 'bg-success-bg',
      trendType: pendingOcr > 0 ? 'negative' : 'positive',
    },
    {
      id: 'governance-overdue-payables',
      label: 'Pagamenti Scaduti',
      value: overviewQuery.isLoading ? '...' : (overduePayables?.count ?? 0),
      sublabel: formatCurrency(overduePayables?.amount ?? 0),
      icon: AlertTriangle,
      tone: toNumber(overduePayables?.count) > 0 ? 'text-danger-text' : 'text-success-text',
      bg: toNumber(overduePayables?.count) > 0 ? 'bg-danger-bg' : 'bg-success-bg',
      trendType: toNumber(overduePayables?.count) > 0 ? 'negative' : 'positive',
    },
    {
      id: 'governance-outbox-failed',
      label: 'Eventi Falliti',
      value: outboxQuery.isLoading ? '...' : outboxFailed,
      sublabel: 'Outbox da rigiocare manualmente',
      icon: ServerCog,
      tone: outboxFailed > 0 ? 'text-danger-text' : 'text-success-text',
      bg: outboxFailed > 0 ? 'bg-danger-bg' : 'bg-success-bg',
      trendType: outboxFailed > 0 ? 'negative' : 'positive',
    },
    ...kpiControls.customKpis,
  ], [
    dataQualityQuery.isLoading,
    kpiControls.customKpis,
    outboxFailed,
    outboxQuery.isLoading,
    overduePayables?.amount,
    overduePayables?.count,
    overviewQuery.isLoading,
    pendingOcr,
    totalDataIssues,
  ]);

  const qualityCards = [
    {
      key: 'roleMismatches',
      title: 'Ruoli divergenti',
      count: dataQuality.roleMismatches?.length ?? 0,
      description: 'User.role e ruolo dipendente non allineati. Le azioni sensibili devono restare bloccate.',
      icon: Users,
      tone: 'danger' as const,
    },
    {
      key: 'duplicateSuppliers',
      title: 'Fornitori duplicati',
      count: dataQuality.duplicateSuppliers?.length ?? 0,
      description: 'Partite IVA normalizzate presenti su piu anagrafiche fornitore.',
      icon: Database,
      tone: 'warning' as const,
    },
    {
      key: 'unclassifiedExpenses',
      title: 'Spese non classificate',
      count: dataQuality.unclassifiedExpenses?.length ?? 0,
      description: 'Costi senza categoria o con destinazione contabile in revisione.',
      icon: Bug,
      tone: 'warning' as const,
    },
    {
      key: 'pendingOcrExpenses',
      title: 'OCR pendenti',
      count: dataQuality.pendingOcrExpenses?.length ?? 0,
      description: 'Spese Genya o fatture che devono essere analizzate o confermate.',
      icon: FileWarning,
      tone: 'info' as const,
    },
    {
      key: 'disconnectedDocuments',
      title: 'Documenti scollegati',
      count: dataQuality.disconnectedDocuments?.length ?? 0,
      description: 'File caricati senza legame con spese, fatture o movimenti.',
      icon: FileWarning,
      tone: 'neutral' as const,
    },
    {
      key: 'articlesWithoutStock',
      title: 'Articoli senza giacenza',
      count: dataQuality.articlesWithoutStock?.length ?? 0,
      description: 'Anagrafiche articolo create senza stock o movimenti associati.',
      icon: PackageSearch,
      tone: 'neutral' as const,
    },
  ];

  const runDryBackfill = async () => {
    try {
      const result = await ledgerBackfill.mutateAsync({ dryRun: true, limit: 1000 });
      setLastBackfillResult(result as Record<string, unknown>);
      toast.success('Dry-run completato', 'Il ledger non e stato modificato.');
    } catch (error) {
      toast.error('Dry-run fallito', error instanceof Error ? error.message : 'Errore imprevisto');
    }
  };

  const runRealBackfill = async () => {
    try {
      const result = await ledgerBackfill.mutateAsync({ dryRun: false, limit: 1000 });
      setLastBackfillResult(result as Record<string, unknown>);
      setConfirmBackfillOpen(false);
      toast.success('Backfill completato', 'Ledger aggiornato con posting idempotente.');
    } catch (error) {
      toast.error('Backfill fallito', error instanceof Error ? error.message : 'Errore imprevisto');
    }
  };

  const flushPending = async () => {
    try {
      await flushOutbox.mutateAsync(100);
      toast.success('Flush outbox completato');
    } catch (error) {
      toast.error('Flush outbox fallito', error instanceof Error ? error.message : 'Errore imprevisto');
    }
  };

  const retryEvent = async (eventId: number) => {
    try {
      await retryOutbox.mutateAsync(eventId);
      toast.success('Evento rimesso in coda');
    } catch (error) {
      toast.error('Retry evento fallito', error instanceof Error ? error.message : 'Errore imprevisto');
    }
  };

  const isLoading = overviewQuery.isLoading || dataQualityQuery.isLoading;

  return (
    <div className="space-y-6">
      <DashboardKpiGrid definitions={kpis} controls={kpiControls} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
                <ShieldCheck size={20} className="text-accent" />
                Data Quality
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Controlli operativi su master data, documenti e classificazioni contabili.
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={() => dataQualityQuery.refetch()}>
              Aggiorna
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-5">
              <TableSkeleton rows={4} columns={3} />
            </div>
          ) : totalDataIssues === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nessuna anomalia critica"
              description="Le principali regole di qualita dati non segnalano record da correggere."
              className="py-12"
            />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {qualityCards.map((card) => (
                <QualityCard key={card.key} {...card} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
                  <ServerCog size={20} className="text-accent" />
                  Outbox eventi
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Eventi falliti rigiocabili senza retry infinito.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={flushOutbox.isPending ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
                disabled={flushOutbox.isPending}
                onClick={flushPending}
              >
                Flush
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {outboxQuery.isLoading ? (
                <TableSkeleton rows={3} columns={2} />
              ) : failedEvents.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Outbox pulita"
                  description="Non risultano eventi falliti."
                  className="py-8"
                />
              ) : (
                failedEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text-primary">
                          {event.event_type ?? `Evento #${event.id}`}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {event.aggregate_type ?? 'aggregate'} #{event.aggregate_id ?? '-'} · {formatDate(event.occurred_at ?? event.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={event.status ?? 'FAILED'} />
                    </div>
                    {event.last_error && (
                      <p className="mt-3 line-clamp-2 rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-text">
                        {event.last_error}
                      </p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={retryOutbox.isPending}
                        icon={retryOutbox.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        onClick={() => retryEvent(event.id)}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
              <Database size={20} className="text-accent" />
              Ledger backfill
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Riallinea lo storico economico con dry-run prima della scrittura reale.
            </p>

            <div className="mt-4 grid gap-3">
              <Button
                variant="secondary"
                icon={ledgerBackfill.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                disabled={ledgerBackfill.isPending}
                onClick={runDryBackfill}
              >
                Dry-run backfill
              </Button>
              <Button
                variant="warning"
                icon={<Database size={16} />}
                disabled={ledgerBackfill.isPending}
                onClick={() => setConfirmBackfillOpen(true)}
              >
                Esegui backfill reale
              </Button>
            </div>

            {lastBackfillResult && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Ultimo report</p>
                <pre className="mt-2 max-h-52 overflow-auto text-xs text-text-secondary">
                  {JSON.stringify(lastBackfillResult, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Exception dashboard</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Collegamenti rapidi alle code operative che bloccano controllo direzionale e qualita dati.
            </p>
          </div>
          <Badge tone={totalDataIssues > 0 || pendingOcr > 0 || outboxFailed > 0 ? 'warning' : 'success'}>
            {totalDataIssues + pendingOcr + outboxFailed} eccezioni
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailRow
            label="OCR fatture"
            value={`${pendingOcr} da revisionare`}
            action={<Link className="text-xs font-bold text-accent hover:underline" to="/data-entry">Raccolta dati</Link>}
          />
          <DetailRow
            label="Pagamenti"
            value={`${overduePayables?.count ?? 0} scaduti · ${formatCurrency(overduePayables?.amount ?? 0)}`}
            action={<Link className="text-xs font-bold text-accent hover:underline" to="/finance">Finanza</Link>}
          />
          <DetailRow
            label="Richieste materiali"
            value={`${overview.exceptions?.materialRequestsPending ?? 0} pending`}
            action={<Link className="text-xs font-bold text-accent hover:underline" to="/material-requests">Apri</Link>}
          />
          <DetailRow
            label="Sotto scorta"
            value={`${overview.exceptions?.understockArticles?.length ?? 0} articoli`}
            action={<Link className="text-xs font-bold text-accent hover:underline" to="/warehouse">Magazzino</Link>}
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmBackfillOpen}
        title="Eseguire backfill reale del ledger?"
        description="Questa operazione scrive righe ledger per lo storico operativo. Eseguila solo dopo aver verificato il dry-run."
        confirmLabel="Esegui backfill"
        cancelLabel="Annulla"
        tone="primary"
        isBusy={ledgerBackfill.isPending}
        onClose={() => setConfirmBackfillOpen(false)}
        onConfirm={runRealBackfill}
      />
    </div>
  );
}
