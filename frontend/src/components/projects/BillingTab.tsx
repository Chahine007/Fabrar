import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarRange,
  ChevronRight,
  FileText,
  Plus,
  ReceiptText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  type BillingInstallment,
  type BillingInvoice,
  type InstallmentStatus,
  type InvoiceStatus,
  useProjectBilling,
} from '../../hooks/api/useBilling';
import InstallmentModal from './InstallmentModal';
import InvoiceModal from './InvoiceModal';
import Spinner from '../Spinner';
import ErrorMessage from '../ErrorMessage';

const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: 'Da Fatturare',
  INVOICED: 'Fatturata',
  PAID: 'Incassata',
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Bozza',
  ISSUED: 'Emessa',
  PAID: 'Incassata',
};

const INSTALLMENT_STATUS_CLASSES: Record<InstallmentStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-text border-warning-border',
  INVOICED: 'bg-info-bg text-info-text border-info-border',
  PAID: 'bg-success-bg text-success-text border-success-border',
};

const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-background text-text-secondary border-border',
  ISSUED: 'bg-info-bg text-info-text border-info-border',
  PAID: 'bg-success-bg text-success-text border-success-border',
};

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('it-IT');
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{title}</p>
      <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-sm text-text-secondary">{hint}</p>
    </div>
  );
}

function InstallmentRow({
  installment,
  onEdit,
}: {
  installment: BillingInstallment;
  onEdit: (installment: BillingInstallment) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onEdit(installment)}
      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-background/50"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-text-primary">{installment.nome}</p>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-bold',
              INSTALLMENT_STATUS_CLASSES[installment.stato]
            )}
          >
            {INSTALLMENT_STATUS_LABELS[installment.stato]}
          </span>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          {installment.wbs_node ? installment.wbs_node.nome : 'Rata libera / accordo informale'}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Scadenza: {formatDate(installment.data_scadenza_prevista)}
          {installment.fattura?.numero_fattura ? ` · Fattura ${installment.fattura.numero_fattura}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="font-semibold text-text-primary">{formatCurrency(installment.importo_previsto)}</p>
          {installment.percentuale != null && (
            <p className="mt-1 text-xs text-text-secondary">{installment.percentuale}% contratto</p>
          )}
        </div>
        <ChevronRight size={18} className="text-text-secondary" />
      </div>
    </button>
  );
}

function InvoiceRow({ invoice }: { invoice: BillingInvoice }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-text-primary">
            {invoice.numero_fattura ? `Fattura ${invoice.numero_fattura}` : `Fattura #${invoice.id}`}
          </p>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-bold',
              INVOICE_STATUS_CLASSES[invoice.stato]
            )}
          >
            {INVOICE_STATUS_LABELS[invoice.stato]}
          </span>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Emissione: {formatDate(invoice.data_emissione)}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {invoice.rate?.length ? `${invoice.rate.length} rate collegate` : 'Nessuna rata collegata'}
        </p>
      </div>

      <div className="text-right">
        <p className="font-semibold text-text-primary">{formatCurrency(invoice.importo_totale)}</p>
      </div>
    </div>
  );
}

export default function BillingTab({ cantiereId }: { cantiereId: number }) {
  const { data, isLoading, error, refetch } = useProjectBilling(cantiereId);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<BillingInstallment | null>(null);

  const pendingInstallments = useMemo(
    () => data?.rate.filter((installment) => installment.stato === 'PENDING') ?? [],
    [data?.rate]
  );

  const openCreateInstallment = () => {
    setSelectedInstallment(null);
    setIsInstallmentModalOpen(true);
  };

  const openEditInstallment = (installment: BillingInstallment) => {
    setSelectedInstallment(installment);
    setIsInstallmentModalOpen(true);
  };

  if (isLoading) return <Spinner label="Caricamento dati di fatturazione..." />;
  if (error || !data) {
    return (
      <ErrorMessage
        error={(error as Error)?.message ?? 'Errore caricamento fatturazione'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Totale Contratto"
          value={formatCurrency(data.summary.totale_contratto)}
          hint="Valore pianificato del cantiere"
        />
        <SummaryCard
          title="Totale Fatturato"
          value={formatCurrency(data.summary.totale_fatturato)}
          hint="Fatture emesse e registrate"
        />
        <SummaryCard
          title="Totale Incassato"
          value={formatCurrency(data.summary.totale_incassato)}
          hint="Ricavo realmente incassato"
        />
        <SummaryCard
          title="Da Fatturare"
          value={formatCurrency(data.summary.da_fatturare)}
          hint="Residuo ancora da emettere"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Piano Rate</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Milestone di incasso libere o collegate alla WBS.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateInstallment}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <Plus size={16} />
              Nuova Rata
            </button>
          </div>

          {data.rate.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center text-text-secondary">
              <CalendarRange size={34} className="opacity-30" />
              <div>
                <p className="font-medium text-text-primary">Nessuna rata pianificata.</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Inserisci rate SAL o accordi informali per iniziare il piano di incasso.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.rate.map((installment) => (
                <InstallmentRow
                  key={installment.id}
                  installment={installment}
                  onEdit={openEditInstallment}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Fatture Emesse</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Emissioni collegate alle rate del progetto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-card"
            >
              <ReceiptText size={16} />
              Emetti Fattura
            </button>
          </div>

          {data.fatture.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center text-text-secondary">
              <FileText size={34} className="opacity-30" />
              <div>
                <p className="font-medium text-text-primary">Nessuna fattura emessa.</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Seleziona una o più rate pendenti per creare la prima fattura.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.fatture.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {isInstallmentModalOpen && (
          <InstallmentModal
            cantiereId={cantiereId}
            installment={selectedInstallment}
            onClose={() => {
              setSelectedInstallment(null);
              setIsInstallmentModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInvoiceModalOpen && (
          <InvoiceModal
            cantiereId={cantiereId}
            pendingInstallments={pendingInstallments}
            onClose={() => setIsInvoiceModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
