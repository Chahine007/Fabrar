/**
 * HRPage.tsx — Gestione Risorse Umane
 * Migrata a React Query (TanStack Query).
 * Mostra: lista dipendenti, alert presenze, audit trail, approvazioni bulk e singole.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, AlertTriangle, CheckCircle2, XCircle,
  Clock, TrendingUp, Search, RefreshCw, ChevronDown, ChevronUp,
  Bot
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import {
  useEmployees, useHrAlerts, useAudit,
  usePendingSummary, useBulkAudit, useSingleAuditAction,
} from '../hooks/api/useHr';
import type { AuditEntry } from '../hooks/api/useHr';

// ─── Types (aligned with backend schema) ─────────────────────
interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  cantiere_id: number | null;
  hourly_cost: number | null;
}

interface HrAlert {
  employee_id: number;
  employee_name: string;
  days_zero_hours: number;
  last_report_date: string | null;
  // Il backend restituisce anche { pending, warnings } in alcuni endpoint
  warnings?: { type: string; name: string; text: string }[];
}

interface PendingSummary {
  reports: number;
  spese: number;
}

type AuditTypeFilter = 'tutti' | 'ore' | 'spese';

// ─── Status badge ─────────────────────────────────────────────
const StatusBadge = ({ status }: { status: AuditEntry['status'] }) => {
  const map = {
    pending:  { label: 'In Attesa',  cls: 'bg-warning-bg text-warning-text border border-warning-border' },
    verified: { label: 'Approvato',  cls: 'bg-success-bg text-success-text border border-success-border' },
    rejected: { label: 'Rifiutato',  cls: 'bg-danger-bg  text-danger-text  border border-danger-border'  },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', s.cls)}>
      {s.label}
    </span>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) => (
  <motion.div
    whileHover={{ y: -3 }}
    className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 transition-colors duration-300"
  >
    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon size={22} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────
export default function HRPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<'date' | 'value'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<AuditTypeFilter>('tutti');

  // React Query hooks
  const { data: employees, isLoading: loadingEmp } = useEmployees();
  const { data: alertsData, isLoading: loadingAlerts } = useHrAlerts();
  const { data: audit, isLoading: loadingAudit, refetch: refetchAudit } =
    useAudit(typeFilter === 'tutti' ? {} : { type: typeFilter as 'ore' | 'spese' });
  const { data: pending } = usePendingSummary();

  const bulkMut   = useBulkAudit();
  const singleMut = useSingleAuditAction();

  // Normalizza i dati degli alert (il backend restituisce { pending, warnings } o array)
  const alerts = Array.isArray(alertsData)
    ? alertsData
    : (alertsData as any)?.warnings ?? [];

  // Sort audit
  const sortedAudit = React.useMemo(() => {
    if (!audit) return [];
    return [...audit].sort((a, b) => {
      const av = sortField === 'date' ? new Date((a as any).date ?? (a as any).report_date).getTime() : ((a as any).value ?? (a as any).ore_lavorate ?? 0);
      const bv = sortField === 'date' ? new Date((b as any).date ?? (b as any).report_date).getTime() : ((b as any).value ?? (b as any).ore_lavorate ?? 0);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [audit, sortField, sortDir]);

  // Filter audit by search  
  const filteredAudit = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedAudit;
    const q = searchQuery.toLowerCase();
    return sortedAudit.filter((e: any) =>
      ((e.employee_name ?? `${e.nome ?? ''} ${e.cognome ?? ''}`).toLowerCase()).includes(q) ||
       ((e.note ?? e.attivita_svolte ?? '')).toLowerCase().includes(q) ||
       ((e.cantiere_nome ?? e.luogo_cantiere ?? '')).toLowerCase().includes(q)
    );
  }, [sortedAudit, searchQuery]);

  // Pending only
  const pendingAudit = filteredAudit.filter((e: any) => e.status === 'pending');

  // Bulk approve
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkMut.mutateAsync({ ids: Array.from(selectedIds), action: 'verify' });
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSort = (field: 'date' | 'value') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: 'date' | 'value' }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-8 h-20 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Risorse Umane</h1>
          <p className="text-sm text-text-secondary">
            {employees?.length ?? '—'} dipendenti&nbsp;·&nbsp;
            <span className="text-warning-text font-semibold">{pending?.reports ?? 0} in attesa</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/hr/audit"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all text-sm font-medium"
          >
            <Bot size={14} /> Audit Telegram
          </Link>
          <button
            onClick={() => refetchAudit()}
            className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={Users} label="Dipendenti" color="bg-accent"
            value={loadingEmp ? '…' : (employees?.length ?? 0)}
          />
          <KpiCard
            icon={AlertTriangle} label="Alert Presenze" color="bg-amber-500"
            value={loadingAlerts ? '…' : (alerts?.length ?? 0)}
            sub="giorni senza ore"
          />
          <KpiCard
            icon={Clock} label="In Attesa Approv." color="bg-indigo-500"
            value={pending?.reports ?? 0}
          />
          <KpiCard
            icon={CheckCircle2} label="Approvati oggi" color="bg-emerald-500"
            value={audit ? audit.filter(e => e.status === 'verified').length : '…'}
          />
        </div>

        {/* Alert Banner */}
        {alerts && alerts.length > 0 && (
          <div className="rounded-2xl border border-warning-border bg-warning-bg p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-warning-text" />
              <h3 className="font-bold text-warning-text text-sm">
                {alerts.length} segnalazione{alerts.length > 1 ? 'i' : ''} recente{alerts.length > 1 ? 'i' : ''}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map((a: any, i: number) => (
                <span
                  key={a.employee_id ?? i}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/60 text-warning-text"
                >
                  {a.employee_name ?? a.name} — {a.days_zero_hours != null ? `${a.days_zero_hours}gg` : a.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Audit Trail / Approvazioni */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="font-bold text-text-primary">Audit Trail & Approvazioni</h2>
          <div className="flex items-center gap-3 flex-wrap">
              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                {(['tutti', 'ore', 'spese'] as AuditTypeFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize',
                      typeFilter === f ? 'bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-text-primary outline-none focus:ring-2 focus:ring-accent/20 w-48 transition-all"
                />
              </div>
              {/* Bulk approve */}
              {selectedIds.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleBulkApprove}
                  disabled={bulkMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Approva {selectedIds.size}
                  {bulkMut.isPending && ' …'}
                </motion.button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={selectedIds.size === pendingAudit.length && pendingAudit.length > 0}
                      onChange={() => {
                        if (selectedIds.size === pendingAudit.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(pendingAudit.map(e => e.id)));
                      }}
                    />
                  </th>
                  <th className="px-5 py-3 text-left">Dipendente</th>
                  <th
                    className="px-5 py-3 text-left cursor-pointer hover:text-text-primary select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <span className="flex items-center gap-1">Data <SortIcon field="date" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-left cursor-pointer hover:text-text-primary select-none"
                    onClick={() => toggleSort('value')}
                  >
                    <span className="flex items-center gap-1">Valore <SortIcon field="value" /></span>
                  </th>
                  <th className="px-5 py-3 text-left">Attività / Note</th>
                  <th className="px-5 py-3 text-left">Cantiere</th>
                  <th className="px-5 py-3 text-left">Metodo</th>
                  <th className="px-5 py-3 text-left">Stato</th>
                  <th className="px-5 py-3 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-text-secondary">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
                        <span className="text-sm">Caricamento...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-text-secondary text-sm">
                      Nessun record trovato.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map(entry => (
                    <tr
                      key={entry.id}
                      className={cn(
                        'border-b border-border/50 hover:bg-background/60 transition-colors',
                        selectedIds.has(entry.id) && 'bg-accent/5'
                      )}
                    >
                      <td className="px-5 py-3.5">
                        {(entry as any).status === 'pending' && (
                          <input
                            type="checkbox"
                            className="accent-accent"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                          />
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-text-primary">
                        {(entry as any).nome != null
                          ? `${(entry as any).nome} ${(entry as any).cognome ?? ''}`.trim()
                          : (entry as any).employee_name ?? '—'
                        }
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {(entry as any).date
                          ? new Date((entry as any).date).toLocaleDateString('it-IT')
                          : (entry as any).report_date ?? '—'
                        }
                      </td>
                      <td className="px-5 py-3.5 font-bold text-text-primary">
                        {(entry as any).type === 'spese'
                          ? `€${Number((entry as any).value).toLocaleString('it-IT')}`
                          : `${(entry as any).value ?? (entry as any).ore_lavorate ?? 0}h`
                        }
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary max-w-[200px] truncate">
                        {(entry as any).note ?? (entry as any).attivita_svolte ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {(entry as any).cantiere_nome ?? (entry as any).luogo_cantiere ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary text-xs">
                        {(entry as any).input_method ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={(entry as any).status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {(entry as any).status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => singleMut.approve(entry.id)}
                              disabled={singleMut.isPending}
                              className="p-1.5 rounded-lg bg-success-bg text-success-text hover:opacity-80 transition-all disabled:opacity-40"
                              title="Approva"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              onClick={() => singleMut.reject(entry.id)}
                              disabled={singleMut.isPending}
                              className="p-1.5 rounded-lg bg-danger-bg text-danger-text hover:opacity-80 transition-all disabled:opacity-40"
                              title="Rifiuta"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
