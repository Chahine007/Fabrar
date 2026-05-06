import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileSearch, Loader2, PackageCheck, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAnalyzeSpesaOcr, useConfirmSpesaOcr } from '../../hooks/api/useHr';
import type { AuditEntry, InvoiceOcrLine, InvoiceOcrPayload, SpesaOcrResponse } from '../../hooks/api/useHr';
import { EmptyState, useToast } from '../ui';

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  const amount = safeNumber(value);
  return `€${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOptionalMoney(value: unknown) {
  if (value == null || value === '') return '—';
  return formatMoney(value);
}

function normalizeOcrLines(lines: InvoiceOcrLine[] | undefined | null) {
  return Array.isArray(lines) ? lines : [];
}

function formatOcrAddress(subject?: InvoiceOcrPayload['fornitore'] | InvoiceOcrPayload['cliente'] | null) {
  if (!subject) return '—';
  const locality = [subject.cap, subject.comune].filter(Boolean).join(' ');
  const province = subject.provincia ? `(${subject.provincia})` : '';
  return [subject.indirizzo, [locality, province].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';
}

function lineStatusMeta(line: InvoiceOcrLine) {
  if (!line.codice_sku) {
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

function supplierActionLabel(action?: SpesaOcrResponse['fornitoreAction']) {
  if (action === 'created') return 'Fornitore creato';
  if (action === 'updated') return 'Fornitore aggiornato';
  if (action === 'found') return 'Fornitore già presente';
  return 'Fornitore non variato';
}

export default function OcrInvoiceModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const analyze = useAnalyzeSpesaOcr();
  const confirm = useConfirmSpesaOcr();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<SpesaOcrResponse | null>(null);
  const [confirmation, setConfirmation] = useState<SpesaOcrResponse | null>(null);

  const payload = analysis?.ocrPayload ?? entry.ocr_payload ?? null;
  const lines = normalizeOcrLines(analysis?.suggestedLines ?? payload?.righe_materiali);
  const documentId = analysis?.document?.id ?? entry.documento_id ?? null;
  const loadableLines = lines.filter((line) => line.codice_sku);
  const canConfirm = loadableLines.length > 0 && entry.logistica_status !== 'LOADED_TO_WAREHOUSE' && !confirmation;
  const fornitore = payload?.fornitore ?? null;
  const cliente = payload?.cliente ?? null;
  const pagamento = payload?.pagamento ?? null;

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('File mancante', 'Seleziona una foto della fattura o del DDT.');
      return;
    }

    try {
      const result = await analyze.mutateAsync({ spesaId: entry.id, file });
      setAnalysis(result);
      setConfirmation(null);
      toast.success('OCR completato', 'Controlla le righe prima di confermare il carico.');
    } catch (err) {
      toast.error('OCR non riuscito', err instanceof Error ? err.message : 'Errore analisi fattura.');
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      const result = await confirm.mutateAsync({ spesaId: entry.id, documentId, lines });
      setConfirmation(result);
      toast.success(
        'Carico registrato',
        `${result.movimentiCaricoCreati ?? 0} righe caricate. ${supplierActionLabel(result.fornitoreAction)}.`
      );
    } catch (err) {
      toast.error('Conferma non riuscita', err instanceof Error ? err.message : 'Errore conferma carico.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
              <FileSearch size={18} className="text-accent" />
              Analizza fattura Genya
            </h2>
            <p className="text-xs text-text-secondary">
              Spesa #{entry.id} · {entry.fornitore || 'Fornitore non indicato'} · {formatMoney(entry.value)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-text-secondary hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleAnalyze} className="mb-5 rounded-2xl border border-border bg-background p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">
              Fattura/DDT dettagliato
            </label>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary"
              />
              <button
                type="submit"
                disabled={analyze.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {analyze.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Analizza fattura
              </button>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              Accetta immagini e PDF fattura/DDT. Il carico viene creato solo dopo conferma.
            </p>
          </form>

          {confirmation && (
            <div className="mb-5 rounded-2xl border border-success-border bg-success-bg p-4 text-sm text-success-text">
              <p className="font-bold">Carico magazzino completato</p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <span>{supplierActionLabel(confirmation.fornitoreAction)}</span>
                <span>{confirmation.articoliCreati ?? 0} articoli creati</span>
                <span>{confirmation.movimentiCaricoCreati ?? 0} movimenti di carico</span>
                <span>{confirmation.righeDaRiconciliare ?? 0} righe da riconciliare</span>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Fornitore</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{fornitore?.ragione_sociale || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">P.IVA: {fornitore?.partita_iva || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">{formatOcrAddress(fornitore)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Cliente</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{cliente?.ragione_sociale || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">P.IVA: {cliente?.partita_iva || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">{formatOcrAddress(cliente)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Tipo documento</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{payload?.tipo_documento || payload?.document_type || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Documento</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{payload?.numero_documento || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Data</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{payload?.data_documento || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Totale OCR</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{formatOptionalMoney(payload?.totale_documento)}</p>
            </div>
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
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Pagamento</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{pagamento?.modalita_pagamento || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">{pagamento?.iban || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Scadenza</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{pagamento?.scadenza || '—'}</p>
              <p className="mt-1 text-xs text-text-secondary">{formatOptionalMoney(pagamento?.importo_scadenza)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold text-text-primary">Righe materiali estratte</h3>
              <span className="text-xs text-text-secondary">
                {loadableLines.length} caricabili · {lines.length - loadableLines.length} da riconciliare
              </span>
            </div>
            {lines.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileSearch}
                  title="Nessuna riga materiale"
                  description="Carica una fattura accompagnatoria o un DDT con tabella articoli leggibile."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background text-xs uppercase tracking-wider text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left">Codice</th>
                      <th className="px-4 py-3 text-left">Descrizione</th>
                      <th className="px-4 py-3 text-left">Esito</th>
                      <th className="px-4 py-3 text-right">Q.ta</th>
                      <th className="px-4 py-3 text-left">UM</th>
                      <th className="px-4 py-3 text-right">Prezzo unit.</th>
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
                            {line.codice_articolo && line.codice_sku && line.codice_articolo !== line.codice_sku && (
                              <p className="text-[10px] text-text-secondary">Orig.: {line.codice_articolo}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{line.descrizione || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-bold', status.cls)}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-text-primary">{safeNumber(line.quantita).toLocaleString('it-IT')}</td>
                          <td className="px-4 py-3 text-text-secondary">{line.unita_misura || '—'}</td>
                          <td className="px-4 py-3 text-right text-text-primary">{formatOptionalMoney(line.prezzo_unitario ?? line.costo_unitario)}</td>
                          <td className="px-4 py-3 text-right font-bold text-text-primary">{formatOptionalMoney(line.prezzo_totale ?? line.importo_riga)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-background px-6 py-4 md:flex-row md:justify-end">
          <button onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-secondary hover:bg-background">
            Chiudi
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || confirm.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-success-bg px-4 py-2 text-sm font-bold text-success-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirm.isPending ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
            Conferma carico magazzino
          </button>
        </div>
      </motion.div>
    </div>
  );
}
