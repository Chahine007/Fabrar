/**
 * ProjectListPage.tsx — Lista di tutti i Cantieri con KPI Overview.
 * Rotta: /projects
 * Funge da hub tra la Dashboard globale e il dettaglio singolo cantiere.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Plus, Search, TrendingUp, TrendingDown,
  Clock, AlertCircle, CheckCircle2, BarChart3, Filter,
  X, Euro, MapPin, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useCantieri, useCreateCantiere } from '../hooks/api/useCantieri';
import type { Cantiere } from '../hooks/api/useCantieri';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

// ─── Types & helpers ─────────────────────────────────────────────────────────

type StatusFilter = 'tutti' | 'attivo' | 'completato';

function getStatusColor(status: string): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('attiv') || s.includes('corso')) return 'bg-info-bg text-info-text border-info-border';
  if (s.includes('complet') || s.includes('chiuso')) return 'bg-success-bg text-success-text border-success-border';
  if (s.includes('sospes') || s.includes('pausa')) return 'bg-warning-bg text-warning-text border-warning-border';
  return 'bg-background text-text-secondary border-border';
}

function calcAvanzamento(c: Cantiere): number {
  if (!c.budget || c.budget === 0) return 0;
  return Math.min(100, Math.round(((c.costo_reale ?? 0) / c.budget) * 100));
}

// ─── KPI Summary Bar ─────────────────────────────────────────────────────────

const SummaryBar = ({ cantieri }: { cantieri: Cantiere[] }) => {
  const totBudget = cantieri.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totCosto  = cantieri.reduce((s, c) => s + (c.costo_reale ?? 0), 0);
  const attivi    = cantieri.filter(c => (c.status ?? '').toLowerCase().includes('attiv') || (c.status ?? '').toLowerCase().includes('corso')).length;
  const overBudget = cantieri.filter(c => (c.costo_reale ?? 0) > (c.budget ?? Infinity)).length;

  const items = [
    { icon: Building2,    label: 'Cantieri Totali',   value: cantieri.length, color: 'bg-accent' },
    { icon: CheckCircle2, label: 'Attivi',             value: attivi,          color: 'bg-emerald-500' },
    { icon: AlertCircle,  label: 'Over Budget',        value: overBudget,      color: 'bg-red-500' },
    { icon: BarChart3,    label: 'Budget Totale',      value: `€${totBudget.toLocaleString('it-IT')}`, color: 'bg-indigo-500' },
    { icon: TrendingUp,   label: 'Costo Reale Tot.',   value: `€${totCosto.toLocaleString('it-IT')}`,  color: totCosto > totBudget ? 'bg-red-500' : 'bg-emerald-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
      {items.map(({ icon: Icon, label, value, color }) => (
        <motion.div
          key={label}
          whileHover={{ y: -3 }}
          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 transition-colors duration-300"
        >
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
            <Icon size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-secondary font-medium uppercase tracking-wide truncate">{label}</p>
            <p className="text-lg font-bold text-text-primary">{value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Cantiere Card ────────────────────────────────────────────────────────────

const CantiereCard = ({ cantiere, onClick }: { cantiere: Cantiere; onClick: () => void }) => {
  const avanzamento = calcAvanzamento(cantiere);
  const budget = cantiere.budget ?? 0;
  const costo  = cantiere.costo_reale ?? 0;
  const isOverBudget = costo > budget && budget > 0;
  const remaining = Math.max(0, budget - costo);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      className="bg-card border border-border rounded-3xl p-6 cursor-pointer group shadow-sm hover:shadow-lg hover:border-accent/30 transition-all duration-300 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-text-primary text-base leading-tight truncate group-hover:text-accent transition-colors">
              {cantiere.nome}
            </h3>
            {cantiere.indirizzo && (
              <p className="text-xs text-text-secondary truncate mt-0.5">{cantiere.indirizzo}</p>
            )}
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap shrink-0', getStatusColor(cantiere.status))}>
          {cantiere.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-secondary">Avanzamento Budget</span>
          <span className={cn('text-xs font-bold', isOverBudget ? 'text-danger-text' : 'text-success-text')}>
            {avanzamento}%
          </span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${avanzamento}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className={cn('h-full rounded-full', isOverBudget ? 'bg-danger-text' : avanzamento > 80 ? 'bg-warning-text' : 'bg-accent')}
          />
        </div>
      </div>

      {/* KPI Footer */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wide mb-0.5">Budget</p>
          <p className="text-sm font-bold text-text-primary">€{budget.toLocaleString('it-IT')}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wide mb-0.5">Residuo</p>
          <p className={cn('text-sm font-bold', isOverBudget ? 'text-danger-text' : 'text-success-text')}>
            {isOverBudget ? '-' : ''}€{Math.abs(remaining).toLocaleString('it-IT')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wide mb-0.5">Costo Reale</p>
          <p className="text-sm font-bold text-text-primary">€{costo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex items-end">
          {isOverBudget ? (
            <div className="flex items-center gap-1 text-danger-text bg-danger-bg border border-danger-border px-2 py-1 rounded-lg w-full justify-center">
              <TrendingDown size={12} />
              <span className="text-[10px] font-bold">Over Budget</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-success-text bg-success-bg border border-success-border px-2 py-1 rounded-lg w-full justify-center">
              <TrendingUp size={12} />
              <span className="text-[10px] font-bold">In Linea</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Modale Nuovo Cantiere ────────────────────────────────────────────────

interface NuovoCantiereModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NuovoCantiereModal = ({ isOpen, onClose }: NuovoCantiereModalProps) => {
  const createMut = useCreateCantiere();

  const [nome, setNome]         = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [budget, setBudget]     = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => { setNome(''); setIndirizzo(''); setBudget(''); setFormError(null); };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (nome.trim().length < 3) {
      setFormError('Il nome del cantiere deve essere di almeno 3 caratteri.');
      return;
    }
    const budgetNum = budget.trim() !== '' ? parseFloat(budget.replace(',', '.')) : null;
    if (budget.trim() !== '' && (isNaN(budgetNum!) || budgetNum! <= 0)) {
      setFormError('Il budget deve essere un numero positivo.');
      return;
    }
    try {
      await createMut.mutateAsync({
        nome:     nome.trim(),
        indirizzo: indirizzo.trim() || undefined,
        budget:   budgetNum,
      });
      handleClose();
    } catch (err) {
      setFormError((err as Error).message ?? 'Errore durante la creazione.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <form
              onSubmit={handleSubmit}
              className="pointer-events-auto w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Building2 size={18} className="text-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Nuovo Cantiere</h2>
                    <p className="text-xs text-text-secondary">Compila i dati per creare il cantiere</p>
                  </div>
                </div>
                <button type="button" onClick={handleClose} className="p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-xl transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* Fields */}
              <div className="space-y-5">
                {/* Nome */}
                <div>
                  <label htmlFor="cantiere-nome" className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Nome Cantiere <span className="text-danger-text">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      id="cantiere-nome"
                      name="nome"
                      type="text"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="es. Via Roma 12 — Ristrutturazione"
                      required
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  </div>
                </div>

                {/* Indirizzo */}
                <div>
                  <label htmlFor="cantiere-indirizzo" className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Indirizzo
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      id="cantiere-indirizzo"
                      name="indirizzo"
                      type="text"
                      value={indirizzo}
                      onChange={e => setIndirizzo(e.target.value)}
                      placeholder="Via, Comune, CAP"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label htmlFor="cantiere-budget" className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Budget (€)
                  </label>
                  <div className="relative">
                    <Euro size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      id="cantiere-budget"
                      name="budget"
                      type="text"
                      inputMode="decimal"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      placeholder="es. 150000"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                  </div>
                </div>

                {/* Error */}
                {formError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded-xl px-3 py-2"
                  >
                    ❌ {formError}
                  </motion.p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-xl border border-border text-text-secondary hover:bg-background text-sm font-bold transition-all"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || nome.trim().length < 3}
                  className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMut.isPending ? (
                    <><Loader2 size={15} className="animate-spin" /> Creazione...</>
                  ) : (
                    <><Plus size={15} /> Crea Cantiere</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: cantieri, isLoading, error, refetch } = useCantieri();

  // Leggi la query iniziale dall'URL (?q=...) — permette redirect dal topbar globale
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tutti');
  const [modalOpen, setModalOpen] = useState(false);

  // Sincronizza URL quando la ricerca cambia (debounced implicitamente da React)
  useEffect(() => {
    if (search.trim()) {
      setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('q', search); return p; }, { replace: true });
    } else {
      setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('q'); return p; }, { replace: true });
    }
  }, [search]);

  const filtered = (cantieri ?? []).filter(c => {
    const matchSearch = search.trim() === '' ||
      c.nome.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'tutti' ||
      (statusFilter === 'attivo' && ((c.status ?? '').toLowerCase().includes('attiv') || (c.status ?? '').toLowerCase().includes('corso'))) ||
      (statusFilter === 'completato' && ((c.status ?? '').toLowerCase().includes('complet') || (c.status ?? '').toLowerCase().includes('chiuso')));
    return matchSearch && matchStatus;
  });

  if (isLoading) return <Spinner fullScreen label="Caricamento progetti..." />;
  if (error)     return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  return (
    <div className="flex-1 overflow-y-auto bg-background transition-colors duration-300">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-8 h-20 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Progetti</h1>
          <p className="text-sm text-text-secondary">
            {cantieri?.length ?? 0} cantieri totali &nbsp;·&nbsp;
            <span className="text-accent font-semibold">
              {filtered.length} visibili
            </span>
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={16} /> Nuovo Cantiere
        </button>
      </div>

      <NuovoCantiereModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="p-8">
        {/* Summary KPIs */}
        {cantieri && <SummaryBar cantieri={cantieri} />}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Cerca cantiere..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
            {(['tutti', 'attivo', 'completato'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize',
                  statusFilter === f
                    ? 'bg-card text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-text-secondary ml-auto">
            <Filter size={14} />
            <span className="text-xs">{filtered.length} risultati</span>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-4 border border-border">
              <Building2 size={28} className="text-text-secondary opacity-40" />
            </div>
            <p className="text-text-secondary font-medium">Nessun cantiere trovato</p>
            <p className="text-text-secondary text-sm mt-1 opacity-60">Prova a modificare i filtri di ricerca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(c => (
              <CantiereCard
                key={c.id}
                cantiere={c}
                onClick={() => navigate(`/projects/${c.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
