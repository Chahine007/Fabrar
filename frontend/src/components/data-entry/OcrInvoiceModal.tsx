import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileSearch, Loader2, PackageCheck, Upload, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAnalyzeGenericInvoiceOcr,
  useAnalyzeSpesaOcr,
  useConfirmGenericInvoiceOcr,
  useConfirmSpesaOcr,
} from '../../hooks/api/useHr';
import { useCantieri } from '../../hooks/api/useCantieri';
import type {
  AuditEntry,
  CostAllocationScope,
  CostCategory,
  GenericInvoiceOcrResponse,
  SpesaOcrResponse,
} from '../../hooks/api/useHr';
import { Button, useToast } from '../ui';
import {
  ALLOCATION_SCOPE_OPTIONS,
  COST_CATEGORY_OPTIONS,
  OcrAccountingSummary,
  OcrConfirmationSummary,
  OcrInvoiceLinesTable,
  OcrSubjectPanel,
  categoryLabel,
  formatMoney,
  isLoadableLine,
  normalizeOcrLines,
  scopeLabel,
  supplierActionLabel,
} from './OcrInvoiceModal.parts';

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
  const loadableLines = lines.filter(isLoadableLine);
  const requiresWarehouse = payload?.logistica_required === true || payload?.cost_category === 'INVENTORY_MATERIAL';
  const canConfirm = Boolean(payload) && entry.logistica_status !== 'LOADED_TO_WAREHOUSE' && !confirmation;
  const fornitore = payload?.fornitore ?? null;
  const cliente = payload?.cliente ?? null;
  const pagamento = payload?.pagamento ?? null;
  const purchaseInvoice = confirmation?.fatturaAcquisto ?? analysis?.fattura_acquisto_draft ?? null;

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
      const result = await confirm.mutateAsync({
        spesaId: entry.id,
        documentId,
        lines,
        costCategory: payload?.cost_category ?? null,
        allocationScope: payload?.allocation_scope ?? null,
      });
      setConfirmation(result);
      toast.success(
        requiresWarehouse ? 'Carico registrato' : 'Fattura registrata',
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
            <div className="mb-5">
              <OcrConfirmationSummary confirmation={confirmation} title="Carico magazzino completato" />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <OcrSubjectPanel title="Fornitore" subject={fornitore} />
            <OcrSubjectPanel title="Cliente" subject={cliente} />
          </div>

          <div className="mt-4">
            <OcrAccountingSummary payload={payload} pagamento={pagamento} purchaseInvoice={purchaseInvoice} />
          </div>

          <div className="mt-5">
            <OcrInvoiceLinesTable
              lines={lines}
              loadableLines={loadableLines}
              emptyDescription="Carica una fattura accompagnatoria o un DDT con tabella articoli leggibile."
            />
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
            {requiresWarehouse ? 'Conferma carico magazzino' : 'Conferma registrazione'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function GeneralInvoiceOcrModal({ onClose }: { onClose: () => void }) {
  const analyze = useAnalyzeGenericInvoiceOcr();
  const confirm = useConfirmGenericInvoiceOcr();
  const toast = useToast();
  const { data: cantieri = [] } = useCantieri();
  const [file, setFile] = useState<File | null>(null);
  const [selectedCantiereId, setSelectedCantiereId] = useState('');
  const [analysis, setAnalysis] = useState<GenericInvoiceOcrResponse | null>(null);
  const [selectedSpesaId, setSelectedSpesaId] = useState<number | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [costCategory, setCostCategory] = useState<CostCategory>('UNKNOWN');
  const [allocationScope, setAllocationScope] = useState<CostAllocationScope>('REVIEW');
  const [confirmation, setConfirmation] = useState<SpesaOcrResponse | null>(null);

  const payload = analysis?.ocrPayload ?? null;
  const lines = normalizeOcrLines(analysis?.suggestedLines ?? payload?.righe_materiali);
  const costLines = payload?.righe_costo ?? [];
  const loadableLines = lines.filter(isLoadableLine);
  const candidates = analysis?.candidates ?? [];
  const fornitore = payload?.fornitore ?? null;
  const pagamento = payload?.pagamento ?? null;
  const purchaseInvoice = confirmation?.fatturaAcquisto ?? analysis?.fattura_acquisto_draft ?? null;
  const requiresWarehouse = costCategory === 'INVENTORY_MATERIAL' && loadableLines.length > 0;
  const reviewRequired = costCategory === 'INVENTORY_MATERIAL' && loadableLines.length === 0;
  const nonLogistic = allocationScope === 'OVERHEAD' || (!requiresWarehouse && !reviewRequired);
  const canConfirmExisting = mode === 'existing' && Boolean(selectedSpesaId);
  const canConfirmNew = mode === 'new' && (allocationScope !== 'PROJECT' || Boolean(selectedCantiereId));
  const canConfirm = Boolean(analysis?.upload) && !confirmation && (canConfirmExisting || canConfirmNew);

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('File mancante', 'Seleziona una fattura o un DDT.');
      return;
    }

    try {
      const result = await analyze.mutateAsync({
        file,
        cantiereId: selectedCantiereId ? Number(selectedCantiereId) : null,
      });
      setAnalysis(result);
      setConfirmation(null);
      setCostCategory((result.ocrPayload.cost_category as CostCategory) ?? 'UNKNOWN');
      setAllocationScope((result.ocrPayload.allocation_scope as CostAllocationScope) ?? 'REVIEW');
      const best = result.candidates[0];
      if (best?.spesa?.id) {
        setMode('existing');
        setSelectedSpesaId(best.spesa.id);
      } else {
        setMode('new');
        setSelectedSpesaId(null);
      }
      toast.success('Fattura analizzata', best ? 'Ho trovato una possibile spesa Genya da agganciare.' : 'Nessun match certo: puoi creare una nuova spesa.');
    } catch (err) {
      toast.error('Analisi non riuscita', err instanceof Error ? err.message : 'Errore OCR fattura.');
    }
  };

  const handleConfirm = async () => {
    if (!analysis || !canConfirm) return;
    try {
      const result = await confirm.mutateAsync({
        upload: analysis.upload,
        ocrPayload: analysis.ocrPayload,
        lines,
        spesaId: mode === 'existing' ? selectedSpesaId : null,
        cantiereId: mode === 'new' && allocationScope === 'PROJECT' ? Number(selectedCantiereId) : null,
        costCategory,
        allocationScope,
      });
      setConfirmation(result);
      toast.success(
        'Fattura registrata',
        `${result.movimentiCaricoCreati ?? 0} carichi creati. ${supplierActionLabel(result.fornitoreAction)}.`
      );
    } catch (err) {
      toast.error('Conferma non riuscita', err instanceof Error ? err.message : 'Errore conferma fattura.');
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
        className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
              <FileSearch size={18} className="text-accent" />
              Analizza fattura
            </h2>
            <p className="text-xs text-text-secondary">
              OCR generale: aggancia a una spesa Genya esistente oppure crea una nuova spesa.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-text-secondary hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleAnalyze} className="rounded-2xl border border-border bg-background p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-end">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Fattura/DDT
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Cantiere
                </label>
                <select
                  value={selectedCantiereId}
                  onChange={(event) => setSelectedCantiereId(event.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary"
                >
                  <option value="">Da scegliere se crea nuova spesa</option>
                  {cantieri.map((cantiere) => (
                    <option key={cantiere.id} value={cantiere.id}>{cantiere.nome}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="primary" disabled={analyze.isPending}>
                {analyze.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Analizza
              </Button>
            </div>
          </form>

          {confirmation && (
            <div className="mt-5">
              <OcrConfirmationSummary confirmation={confirmation} />
            </div>
          )}

          {analysis && (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
              <div className="space-y-4">
                <OcrSubjectPanel title="Fornitore" subject={fornitore} />
                <OcrAccountingSummary payload={payload} pagamento={pagamento} purchaseInvoice={purchaseInvoice} compact />

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-bold text-text-primary">Classificazione contabile</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    OCR: {categoryLabel(payload?.cost_category)} · {scopeLabel(payload?.allocation_scope)}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                        Categoria costo
                      </label>
                      <select
                        value={costCategory}
                        onChange={(event) => setCostCategory(event.target.value as CostCategory)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary"
                      >
                        {COST_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">
                        Destinazione
                      </label>
                      <select
                        value={allocationScope}
                        onChange={(event) => setAllocationScope(event.target.value as CostAllocationScope)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary"
                      >
                        {ALLOCATION_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={cn(
                    'mt-3 rounded-xl border px-3 py-2 text-xs font-semibold',
                    nonLogistic
                      ? 'border-info-border bg-info-bg text-info-text'
                      : 'border-success-border bg-success-bg text-success-text'
                  )}>
                    {reviewRequired
                      ? 'Materiale senza SKU caricabili: nessun carico automatico, serve riconciliazione.'
                      : nonLogistic
                        ? 'Costo overhead/non logistico: nessun articolo e nessun carico magazzino verranno creati.'
                        : 'Materiale di magazzino: verranno creati articoli e carichi solo per righe con SKU valido.'}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-bold text-text-primary">Destinazione contabile</p>
                  <div className="mt-3 space-y-2">
                    {candidates.map((candidate) => {
                      const spesaAmount = candidate.spesa.value ?? candidate.spesa.importo;
                      return (
                        <label key={candidate.spesa.id} className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                          <input
                            type="radio"
                            checked={mode === 'existing' && selectedSpesaId === candidate.spesa.id}
                            onChange={() => {
                              setMode('existing');
                              setSelectedSpesaId(candidate.spesa.id);
                            }}
                            className="mt-1 accent-accent"
                          />
                          <span>
                            <span className="block font-bold text-text-primary">
                              Aggancia a spesa #{candidate.spesa.id} · {formatMoney(spesaAmount)}
                            </span>
                            <span className="block text-xs text-text-secondary">
                              {candidate.spesa.fornitore || 'Fornitore non indicato'} · score {candidate.score} · {candidate.reasons.join(', ') || 'match generico'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                      <input
                        type="radio"
                        checked={mode === 'new'}
                        onChange={() => {
                          setMode('new');
                          setSelectedSpesaId(null);
                        }}
                        className="mt-1 accent-accent"
                      />
                      <span>
                        <span className="block font-bold text-text-primary">Crea nuova spesa OCR</span>
                        <span className="block text-xs text-text-secondary">
                          {allocationScope === 'PROJECT'
                            ? 'Richiede un cantiere selezionato. Usa questa opzione solo se la fattura non è già in Genya.'
                            : 'Per costi overhead non serve selezionare un cantiere.'}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <OcrInvoiceLinesTable
                lines={lines}
                loadableLines={loadableLines}
                emptyDescription="Il documento può essere registrato come spesa, ma non genera carichi senza codici articolo."
                compact
                costLines={costLines}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-background px-6 py-4 md:flex-row md:justify-end">
          <button onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-text-secondary hover:bg-background">
            Chiudi
          </button>
          <Button onClick={handleConfirm} disabled={!canConfirm || confirm.isPending} variant="success">
            {confirm.isPending ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
            Conferma registrazione
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
