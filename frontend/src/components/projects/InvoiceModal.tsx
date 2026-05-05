import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Loader2, ReceiptText, X } from 'lucide-react';
import {
  type BillingInstallment,
  useCreateInvoice,
} from '../../hooks/api/useBilling';

interface InvoiceModalProps {
  cantiereId: number;
  pendingInstallments: BillingInstallment[];
  onClose: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'Senza scadenza';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data non valida';
  return parsed.toLocaleDateString('it-IT');
}

export default function InvoiceModal({
  cantiereId,
  pendingInstallments,
  onClose,
}: InvoiceModalProps) {
  const createInvoice = useCreateInvoice(cantiereId);
  const [numeroFattura, setNumeroFattura] = useState('');
  const [dataEmissione, setDataEmissione] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = useMemo(() => {
    return pendingInstallments
      .filter((installment) => selectedIds.includes(installment.id))
      .reduce((sum, installment) => sum + installment.importo_previsto, 0);
  }, [pendingInstallments, selectedIds]);

  const toggleInstallment = (installmentId: number) => {
    setSelectedIds((current) =>
      current.includes(installmentId)
        ? current.filter((id) => id !== installmentId)
        : [...current, installmentId]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError('Seleziona almeno una rata da fatturare.');
      return;
    }

    try {
      await createInvoice.mutateAsync({
        numero_fattura: numeroFattura,
        data_emissione: dataEmissione || null,
        installment_ids: selectedIds,
        importo_totale: totalAmount,
        stato: 'ISSUED',
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione della fattura.');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi modale fattura"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!createInvoice.isPending) onClose();
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-accent/10 p-2.5 text-accent">
              <ReceiptText size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">Emetti Fattura</h2>
              <p className="text-sm text-text-secondary">
                Seleziona le rate pendenti e genera una fattura in stato `ISSUED`.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={createInvoice.isPending}
            className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-background hover:text-text-primary disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-5 overflow-y-auto px-6 py-6">
            {error && (
              <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">Numero Fattura</span>
                <input
                  value={numeroFattura}
                  onChange={(event) => setNumeroFattura(event.target.value)}
                  disabled={createInvoice.isPending}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
                  placeholder="Es. 2026/017"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">Data Emissione</span>
                <input
                  type="date"
                  value={dataEmissione}
                  onChange={(event) => setDataEmissione(event.target.value)}
                  disabled={createInvoice.isPending}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-border bg-background/40">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    Rate da Fatturare
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {pendingInstallments.length} rate in stato `PENDING`
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Totale selezionato
                  </p>
                  <p className="text-xl font-bold text-text-primary">{formatCurrency(totalAmount)}</p>
                </div>
              </div>

              {pendingInstallments.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-text-secondary">
                  <FileText size={34} className="opacity-30" />
                  <div>
                    <p className="font-medium text-text-primary">Nessuna rata pendente.</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Crea nuove rate o riporta una rata allo stato `PENDING`.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingInstallments.map((installment) => {
                    const checked = selectedIds.includes(installment.id);
                    return (
                      <label
                        key={installment.id}
                        className="flex cursor-pointer items-start gap-4 px-5 py-4 transition hover:bg-card"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInstallment(installment.id)}
                          disabled={createInvoice.isPending}
                          className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-text-primary">{installment.nome}</p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {installment.wbs_node ? installment.wbs_node.nome : 'Rata libera'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-text-primary">
                                {formatCurrency(installment.importo_previsto)}
                              </p>
                              <p className="mt-1 text-xs text-text-secondary">
                                {formatDate(installment.data_scadenza_prevista)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              disabled={createInvoice.isPending}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-background disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createInvoice.isPending || pendingInstallments.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-70"
            >
              {createInvoice.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {createInvoice.isPending ? 'Emissione...' : 'Emetti Fattura'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
