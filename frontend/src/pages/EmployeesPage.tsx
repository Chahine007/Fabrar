/**
 * EmployeesPage.tsx — Gestione Personale: griglia/lista dipendenti con KPI.
 * Rotta: /hr
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Users, Clock, Euro, Search, RefreshCw, ChevronRight,
  TrendingUp, AlertTriangle, LayoutGrid, List, Plus,
  Phone, Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useEmployees } from '../hooks/api/useHr';
import type { EmployeeWithKPI } from '../hooks/api/useHr';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import CreateEmployeeModal from '../components/hr/CreateEmployeeModal';
import { RoleGuard } from '../components/auth/RoleGuard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(nome: string, cognome: string): string {
  return `${(nome?.[0] ?? '').toUpperCase()}${(cognome?.[0] ?? '').toUpperCase()}`;
}

const COLORS = [
  'from-violet-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-700',
];
const avatarColor = (id: number) => COLORS[id % COLORS.length];

type ViewMode = 'grid' | 'list';

// ─── Card (Grid mode) ─────────────────────────────────────────────────────────
const EmployeeCard = ({ emp }: { emp: EmployeeWithKPI }) => {
  const name = `${emp.nome ?? ''} ${emp.cognome ?? ''}`.trim();
  const initials = getInitials(emp.nome ?? '', emp.cognome ?? '');

  return (
    <Link to={`/hr/employees/${emp.id}`} className="block">
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-4 transition-colors duration-300 cursor-pointer group"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg',
            avatarColor(emp.id)
          )}>
            {initials || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-text-primary text-base truncate group-hover:text-accent transition-colors">{name || 'N/D'}</p>
            <p className="text-xs text-text-secondary font-medium mt-0.5 uppercase tracking-wider truncate">
              {emp.ruolo ?? 'Dipendente'}
            </p>
          </div>
          <ChevronRight size={16} className="text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>

        {/* Contatti */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          {emp.telefono && (
            <span className="flex items-center gap-1 truncate"><Phone size={11} /> {emp.telefono}</span>
          )}
          {emp.email_personale && (
            <span className="flex items-center gap-1 truncate"><Mail size={11} /> {emp.email_personale}</span>
          )}
          {!emp.telefono && !emp.email_personale && (
            <span className="italic opacity-50">Nessun contatto</span>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background border border-border rounded-2xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Clock size={13} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ore Mese</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{emp.ore_mese}h</p>
          </div>
          <div className="bg-background border border-border rounded-2xl p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Euro size={13} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Costo Mese</span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              €{emp.costo_mese.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-text-secondary border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} />
            <span>€{emp.costo_orario.toFixed(2)}/h</span>
          </div>
          {emp.telegram_id && (
            <span className="px-2 py-0.5 bg-info-bg text-info-text border border-info-border rounded-full text-[10px] font-bold">Bot</span>
          )}
        </div>
      </motion.div>
    </Link>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!employees) return [];
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      (e.nome ?? '').toLowerCase().includes(q) ||
      (e.cognome ?? '').toLowerCase().includes(q) ||
      (e.ruolo ?? '').toLowerCase().includes(q) ||
      (e.dipartimento ?? '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const tot = useMemo(() => ({
    dipendenti: employees?.length ?? 0,
    ore:   (employees ?? []).reduce((s, e) => s + e.ore_mese, 0),
    costo: (employees ?? []).reduce((s, e) => s + e.costo_mese, 0),
    noTar: (employees ?? []).filter(e => e.costo_orario === 0).length,
  }), [employees]);

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-card flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Users size={24} className="text-accent" />
            Gestione Personale
          </h1>
          <p className="text-sm text-text-secondary mt-1">Anagrafica dipendenti e KPI mensili</p>
        </div>
        <div className="flex items-center gap-3">
          <RoleGuard allowedRoles={['ADMIN', 'HR']}>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-95"
            >
              <Plus size={16} />
              + Nuovo Dipendente
            </button>
          </RoleGuard>
          <button onClick={refetch} className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all" title="Aggiorna">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8 py-6 border-b border-border">
        {[
          { label: 'Dipendenti totali', value: tot.dipendenti, icon: Users,         color: 'text-accent',      bg: 'bg-accent/10' },
          { label: 'Ore mese (tot.)',   value: `${tot.ore.toFixed(1)}h`,       icon: Clock,         color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Costo mese (tot.)', value: `€${tot.costo.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, icon: Euro, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Senza tariffa',     value: tot.noTar,            icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className={cn('p-2.5 rounded-xl', bg, color)}><Icon size={20} /></div>
            <div><p className="text-2xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary font-medium mt-0.5">{label}</p></div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar: search + view toggle */}
      <div className="px-8 py-4 border-b border-border bg-card/50 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input id="employee-search" type="text" placeholder="Cerca per nome, ruolo, dipartimento..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
        </div>
        <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
          <button onClick={() => setViewMode('grid')} title="Griglia"
            className={cn('p-2 rounded-lg transition-all', viewMode === 'grid' ? 'bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} title="Lista"
            className={cn('p-2 rounded-lg transition-all', viewMode === 'list' ? 'bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6">
        {isLoading ? (
          <Spinner label="Caricamento dipendenti..." />
        ) : error ? (
          <ErrorMessage error={(error as Error)?.message ?? 'Errore caricamento'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
            <Users size={48} className="mb-4 opacity-30" />
            <p className="font-medium">{search ? 'Nessun dipendente trovato.' : 'Nessun dipendente nel sistema.'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        ) : (
          /* Lista tabella */
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Dipendente</th>
                    <th className="px-5 py-3 text-left">Ruolo</th>
                    <th className="px-5 py-3 text-left">Telefono</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-right">Ore Mese</th>
                    <th className="px-5 py-3 text-right">Costo Mese</th>
                    <th className="px-5 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => {
                    const name = `${emp.nome ?? ''} ${emp.cognome ?? ''}`.trim();
                    return (
                      <Link key={emp.id} to={`/hr/employees/${emp.id}`} className="contents">
                        <tr className="border-b border-border/50 hover:bg-background/60 transition-colors cursor-pointer group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(emp.id))}>
                                {getInitials(emp.nome ?? '', emp.cognome ?? '')}
                              </div>
                              <span className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">{name || 'N/D'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-text-secondary">{emp.ruolo ?? '—'}</td>
                          <td className="px-5 py-3.5 text-text-secondary">{emp.telefono ?? '—'}</td>
                          <td className="px-5 py-3.5 text-text-secondary truncate max-w-[180px]">{emp.email_personale ?? '—'}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-text-primary">{emp.ore_mese}h</td>
                          <td className="px-5 py-3.5 text-right font-bold text-text-primary">€{emp.costo_mese.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</td>
                          <td className="px-5 py-3.5">
                            <ChevronRight size={14} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                        </tr>
                      </Link>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && <CreateEmployeeModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
