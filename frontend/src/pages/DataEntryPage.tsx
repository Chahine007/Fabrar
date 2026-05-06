import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Clock,
  FileSearch,
  FileSpreadsheet,
  Loader2,
  Package,
  Play,
  Square,
  Timer,
  Upload,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuthContext } from '../context/AuthContext';
import { useAudit } from '../hooks/api/useHr';
import type { AuditEntry } from '../hooks/api/useHr';
import { useCantieri, useGenyaImport } from '../hooks/api/useCantieri';
import TimeEntryModal from '../components/timesheets/TimeEntryModal';
import ExpenseModal from '../components/timesheets/ExpenseModal';
import OcrInvoiceModal from '../components/data-entry/OcrInvoiceModal';
import { Button, Card, EmptyState, PageHeader, TableSkeleton, useToast } from '../components/ui';

const OFFICE_IMPORT_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];
const WEB_ENTRY_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WORKER'];
const OCR_STATUSES = ['PENDING_OCR', 'OCR_REVIEW', 'RECONCILIATION_REQUIRED'];

function isGenyaEntry(entry: AuditEntry) {
  const method = String(entry.input_method ?? '').toLowerCase();
  return entry.type === 'spese' && (method.includes('genya') || method.includes('genia') || method.includes('import'));
}

function formatMoney(value: unknown) {
  const parsed = Number(value);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return `€${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function DataToolCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export default function DataEntryPage() {
  const { user } = useAuthContext();
  const toast = useToast();
  const role = user?.role ?? '';
  const canUseWebEntry = WEB_ENTRY_ROLES.includes(role);
  const canUseOfficeImport = OFFICE_IMPORT_ROLES.includes(role);
  const tabulatiPath = role === 'WORKER' ? '/timesheets' : '/hr/tabulati';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCantiereId, setSelectedCantiereId] = useState('');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [ocrEntry, setOcrEntry] = useState<AuditEntry | null>(null);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());

  const { data: cantieri = [] } = useCantieri();
  const genyaImport = useGenyaImport(selectedCantiereId ? Number(selectedCantiereId) : null);
  const { data: auditRows = [], isLoading: loadingAudit } = useAudit({ type: 'spese' });

  useEffect(() => {
    if (!timerStart) return undefined;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerStart]);

  const elapsedMs = timerStart ? timerNow - timerStart : 0;
  const pendingOcrEntries = useMemo(
    () =>
      auditRows
        .filter((entry) => isGenyaEntry(entry) && OCR_STATUSES.includes(String(entry.logistica_status ?? '')))
        .sort((a, b) => new Date(String(b.date ?? '')).getTime() - new Date(String(a.date ?? '')).getTime())
        .slice(0, 10),
    [auditRows]
  );

  const handleGenyaFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await genyaImport.mutateAsync(file);
      const warnings = Array.isArray((result as { warnings?: string[] }).warnings)
        ? (result as { warnings?: string[] }).warnings ?? []
        : [];
      toast.success(
        'Import Genya completato',
        `${(result as { inserted?: number }).inserted ?? 0} spese create. ${warnings[0] ?? 'Coda logistica aggiornata.'}`
      );
    } catch (err) {
      toast.error('Import Genya non riuscito', err instanceof Error ? err.message : 'Errore import.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-full bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <PageHeader
          title="Raccolta Dati"
          description="Punto unico per inserire ore, spese, import Genya e OCR fatture. Tabulati resta dedicata a controllo, approvazione e consultazione."
          actions={
            <Link to={tabulatiPath}>
              <Button variant="secondary" trailingIcon={<ArrowRight size={16} />}>
                Vai a Tabulati
              </Button>
            </Link>
          }
        />

        <div className="grid gap-5 xl:grid-cols-3">
          <DataToolCard
            icon={Clock}
            title="Ore e WBS"
            description="Registra ore lavorate da web collegandole a cantiere e task/WBS."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<Clock size={16} />}
                onClick={() => setTimeModalOpen(true)}
                disabled={!canUseWebEntry}
              >
                Registra Ore
              </Button>
              {!canUseWebEntry && (
                <span className="text-xs text-text-secondary">Il tuo ruolo non può inserire ore da web.</span>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Timer size={16} className="text-accent" />
                    Timer operativo
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Timer locale di supporto: salva poi le ore con “Registra Ore”.
                  </p>
                </div>
                <div className="font-mono text-xl font-bold text-text-primary">{formatElapsed(elapsedMs)}</div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant={timerStart ? 'secondary' : 'success'}
                  size="sm"
                  icon={timerStart ? <Square size={14} /> : <Play size={14} />}
                  onClick={() => {
                    if (timerStart) setTimerStart(null);
                    else {
                      setTimerStart(Date.now());
                      setTimerNow(Date.now());
                    }
                  }}
                >
                  {timerStart ? 'Ferma' : 'Avvia'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setTimerStart(null); setTimerNow(Date.now()); }}>
                  Azzera
                </Button>
              </div>
            </div>
          </DataToolCard>

          <DataToolCard
            icon={Banknote}
            title="Spese manuali"
            description="Inserisci una spesa operativa collegata a cantiere e task."
          >
            <Button
              variant="primary"
              icon={<Banknote size={16} />}
              onClick={() => setExpenseModalOpen(true)}
              disabled={!canUseWebEntry}
            >
              Nuova Spesa
            </Button>
            {!canUseWebEntry && (
              <p className="mt-3 text-xs text-text-secondary">Il tuo ruolo non può inserire spese manuali.</p>
            )}
          </DataToolCard>

          <DataToolCard
            icon={Package}
            title="Materiali e articoli"
            description="Gestisci anagrafica e giacenze da magazzino; i carichi OCR nascono dalle fatture Genya."
          >
            <div className="flex flex-wrap gap-2">
              <Link to="/warehouse">
                <Button variant="secondary" icon={<Package size={16} />}>
                  Apri Magazzino
                </Button>
              </Link>
              <Link to="/material-requests">
                <Button variant="ghost" trailingIcon={<ArrowRight size={16} />}>
                  Richieste Materiali
                </Button>
              </Link>
            </div>
          </DataToolCard>
        </div>

        {canUseOfficeImport && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info-bg text-info-text">
                  <FileSpreadsheet size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-text-primary">Import Genya</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Importa il CSV contabile Genya. Le righe diventano spese in coda logistica, pronte per l’OCR fattura.
                  </p>

                  <div className="mt-4 space-y-3">
                    <select
                      value={selectedCantiereId}
                      onChange={(event) => setSelectedCantiereId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="">Cantiere dal file Genya</option>
                      {cantieri.map((cantiere) => (
                        <option key={cantiere.id} value={cantiere.id}>
                          {cantiere.nome}
                        </option>
                      ))}
                    </select>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={handleGenyaFileSelected}
                    />
                    <Button
                      variant="primary"
                      icon={genyaImport.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={genyaImport.isPending}
                    >
                      {genyaImport.isPending ? 'Importazione...' : 'Importa Genya'}
                    </Button>

                    {genyaImport.data && (
                      <div className="rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-text">
                        Import completato: {(genyaImport.data as { inserted?: number }).inserted ?? 0} spese create in coda OCR.
                      </div>
                    )}
                    {genyaImport.error && (
                      <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
                        {genyaImport.error.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-border p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-bg text-warning-text">
                    <FileSearch size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text-primary">Analisi fatture OCR</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      Seleziona una spesa Genya in attesa e carica la fattura/DDT dettagliata per generare i carichi.
                    </p>
                  </div>
                </div>
              </div>

              {loadingAudit ? (
                <div className="p-5">
                  <TableSkeleton rows={4} columns={4} />
                </div>
              ) : pendingOcrEntries.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={FileSearch}
                    title="Nessuna fattura Genya in attesa"
                    description="Importa prima il CSV Genya, poi analizza la fattura dettagliata da questa lista."
                  />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingOcrEntries.map((entry) => (
                    <div key={`${entry.type}-${entry.id}`} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-text-primary">{entry.fornitore || 'Fornitore non indicato'}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {entry.cantiere_nome || 'Senza cantiere'} · {entry.date ? new Date(entry.date).toLocaleDateString('it-IT') : 'Data non disponibile'} · {formatMoney(entry.value)}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-warning-text">
                          {entry.logistica_status === 'OCR_REVIEW' ? 'OCR in revisione' : 'Da analizzare OCR'}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" icon={<FileSearch size={14} />} onClick={() => setOcrEntry(entry)}>
                        Analizza fattura
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <AnimatePresence>
        {timeModalOpen && <TimeEntryModal onClose={() => setTimeModalOpen(false)} />}
        {expenseModalOpen && <ExpenseModal onClose={() => setExpenseModalOpen(false)} />}
        {ocrEntry && <OcrInvoiceModal entry={ocrEntry} onClose={() => setOcrEntry(null)} />}
      </AnimatePresence>
    </div>
  );
}
