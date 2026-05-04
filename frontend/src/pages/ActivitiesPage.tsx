/**
 * ActivitiesPage.tsx — Pagina attività globale cross-project.
 * Rotta: /activities
 * Mostra tutti i task di tutti i cantieri con filtri e possibilità di aggiornare lo stato.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckSquare, Clock, AlertCircle, CheckCircle2,
  ChevronRight, Plus, Search, Filter, X, Loader2, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAllTasks, useUpdateTask } from '../hooks/api/useTasks';
import { useCantieri } from '../hooks/api/useCantieri';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import type { TaskFilters, TaskWithCantiere } from '../hooks/api/useTasks';

// ─── Costanti ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Da Fare', 'In Corso', 'In Revisione', 'Completato'];
const PRIORITY_OPTIONS = ['Bassa', 'Media', 'Alta', 'Critica'];

const STATUS_STYLE: Record<string, string> = {
  'Completato':   'bg-success-bg text-success-text border border-success-border',
  'In Corso':     'bg-info-bg    text-info-text    border border-info-border',
  'In Revisione': 'bg-warning-bg text-warning-text border border-warning-border',
  'Da Fare':      'bg-background text-text-secondary border border-border',
};

const PRIORITY_STYLE: Record<string, string> = {
  'Critica': 'bg-danger-bg  text-danger-text  border border-danger-border',
  'Alta':    'bg-warning-bg text-warning-text border border-warning-border',
  'Media':   'bg-info-bg    text-info-text    border border-info-border',
  'Bassa':   'bg-background text-text-secondary border border-border',
};

// ─── Sub-component: Badge ────────────────────────────────────────────────────

const Badge = ({ text, styleMap }: { text: string; styleMap: Record<string, string> }) => (
  <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold', styleMap[text] ?? 'bg-background text-text-secondary')}>
    {text}
  </span>
);

// ─── Sub-component: StatusDropdown ───────────────────────────────────────────

const StatusDropdown = ({ task }: { task: TaskWithCantiere }) => {
  const update = useUpdateTask(task.cantiere_id);
  const [open, setOpen]  = useState(false);

  const handleSelect = async (newStatus: string) => {
    setOpen(false);
    if (newStatus === task.status) return;
    try {
      await update.mutateAsync({ taskId: task.id, data: { status: newStatus } });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={update.isPending}
        className="flex items-center gap-1"
        title="Cambia stato"
      >
        {update.isPending
          ? <Loader2 size={14} className="animate-spin text-accent" />
          : <Badge text={task.status} styleMap={STATUS_STYLE} />
        }
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-8 z-50 bg-card border border-border rounded-2xl shadow-xl p-2 w-40 space-y-1"
          >
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors',
                  s === task.status ? 'bg-accent/10 text-accent' : 'hover:bg-background text-text-primary'
                )}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const navigate    = useNavigate();
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState('');
  const [priorityF, setPriorityF] = useState('');
  const [cantiereF, setCantiereF] = useState<number | null>(null);

  const filters: TaskFilters = {
    status:      statusF   || undefined,
    priority:    priorityF || undefined,
    cantiere_id: cantiereF ?? undefined,
  };

  const { data: tasks, isLoading, error, refetch } = useAllTasks(filters);
  const { data: cantieri } = useCantieri();

  // Filtro testo lato client (non vale la pena un round-trip API per il search)
  const displayed = useMemo(() => {
    if (!tasks) return [];
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.cantiere.nome.toLowerCase().includes(q) ||
      (t.assignee ?? '').toLowerCase().includes(q)
    );
  }, [tasks, search]);

  // KPI strip
  const kpi = useMemo(() => ({
    total:      tasks?.length ?? 0,
    daFare:     tasks?.filter(t => t.status === 'Da Fare').length    ?? 0,
    inCorso:    tasks?.filter(t => t.status === 'In Corso').length   ?? 0,
    completati: tasks?.filter(t => t.status === 'Completato').length ?? 0,
  }), [tasks]);

  const resetFilters = () => {
    setSearch(''); setStatusF(''); setPriorityF(''); setCantiereF(null);
  };
  const hasFilters = search || statusF || priorityF || cantiereF;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-8 py-6 border-b border-border bg-card flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tutte le Attività</h1>
          <p className="text-sm text-text-secondary mt-1">Vista globale cross-project</p>
        </div>
        <button
          onClick={refetch}
          className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all"
          title="Aggiorna"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8 py-6 border-b border-border">
        {[
          { label: 'Totali',      value: kpi.total,      icon: CheckSquare, color: 'text-accent' },
          { label: 'Da Fare',     value: kpi.daFare,     icon: Clock,        color: 'text-text-secondary' },
          { label: 'In Corso',    value: kpi.inCorso,    icon: AlertCircle,  color: 'text-info-text' },
          { label: 'Completati',  value: kpi.completati, icon: CheckCircle2, color: 'text-success-text' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            whileHover={{ y: -2 }}
            className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          >
            <div className={cn('p-2 rounded-xl bg-background', color)}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{value}</p>
              <p className="text-xs text-text-secondary font-medium">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Toolbar filtri ── */}
      <div className="px-8 py-4 border-b border-border bg-card/50 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Cerca task, cantiere, assegnatario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>

        <select
          value={cantiereF ?? ''}
          onChange={e => setCantiereF(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        >
          <option value="">Tutti i cantieri</option>
          {(cantieri ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <select
          value={statusF}
          onChange={e => setStatusF(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        >
          <option value="">Tutti gli stati</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={priorityF}
          onChange={e => setPriorityF(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        >
          <option value="">Tutte le priorità</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-danger-bg text-danger-text border border-danger-border text-xs font-bold hover:opacity-80 transition-all"
          >
            <X size={14} /> Reset
          </button>
        )}
      </div>

      {/* ── Tabella ── */}
      <div className="flex-1 px-8 py-6">
        {isLoading ? (
          <Spinner fullScreen label="Caricamento attività..." />
        ) : error ? (
          <ErrorMessage error={(error as Error)?.message ?? 'Errore caricamento'} onRetry={refetch} />
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
            <CheckSquare size={48} className="mb-4 opacity-30" />
            <p className="font-medium">
              {hasFilters ? 'Nessun task trovato con i filtri selezionati.' : 'Nessun task nel sistema.'}
            </p>
            {hasFilters && (
              <button onClick={resetFilters} className="mt-3 text-accent text-sm hover:underline">
                Rimuovi filtri
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-background border-b border-border text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                  <th className="p-4 pl-6">Task</th>
                  <th className="p-4">Cantiere</th>
                  <th className="p-4 hidden md:table-cell">Assegnato a</th>
                  <th className="p-4 hidden lg:table-cell">Priorità</th>
                  <th className="p-4 hidden lg:table-cell">Scadenza</th>
                  <th className="p-4">Stato</th>
                  <th className="p-4 pr-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayed.map(task => (
                  <motion.tr
                    key={task.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-background/60 transition-colors"
                  >
                    <td className="p-4 pl-6">
                      <p className="font-semibold text-text-primary text-sm line-clamp-1">{task.title}</p>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => navigate(`/projects/${task.cantiere.id}`)}
                        className="text-accent text-xs font-bold hover:underline"
                      >
                        {task.cantiere.nome}
                      </button>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-text-secondary">{task.assignee ?? '—'}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <Badge text={task.priority} styleMap={PRIORITY_STYLE} />
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-xs text-text-secondary">
                        {task.due && task.due !== '-' ? task.due : '—'}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusDropdown task={task} />
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => navigate(`/projects/${task.cantiere.id}`)}
                        className="p-1.5 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all inline-block"
                        title="Vai al progetto"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-border text-xs text-text-secondary">
              {displayed.length} task {hasFilters ? '(filtrati)' : 'totali'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
