/**
 * TelegramAuditPage.tsx — Feed globale del Bot Telegram per l'Amministratore.
 * Rotta: /hr/audit
 *
 * Mostra in un'unica vista:
 *   - KPI rapidi (messaggi oggi, ore totali, spese totali, GPS check-in)
 *   - Tabella Audit unificata (ore + spese da bot) con filtri e azioni inline
 *   - Tab "Log Grezzi" per vedere i raw text ricevuti dal bot
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Bot, Clock, Banknote, MapPin, RefreshCw, Download,
  CheckCircle2, XCircle, Search, Filter, Mic, Camera, MessageCircle,
  ChevronDown, ChevronUp, Eye, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTelegramFeed, useApproveTelegramEntry } from '../hooks/api/useTelegramAudit';
import { useExportCsv } from '../hooks/api/useHr';
import type { AuditEntry, AuditStatus } from '../hooks/api/useHr';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

// ─── Types & helpers ──────────────────────────────────────────────────────────

type TypeFilter = 'tutti' | 'ore' | 'spese';
type StatusFilter = 'tutti' | 'pending' | 'verified' | 'rejected';

function getMethodBadge(method: string): { label: string; icon: React.ElementType; cls: string } {
  const m = (method ?? '').toLowerCase();
  if (m.includes('audio') || m.includes('voice'))
    return { label: 'Vocale',  icon: Mic,     cls: 'bg-warning-bg text-warning-text border-warning-border' };
  if (m.includes('ocr') || m.includes('foto') || m.includes('photo'))
    return { label: 'Foto OCR', icon: Camera,  cls: 'bg-indigo-900/30 text-indigo-400 border-indigo-700/40' };
  if (m.includes('gps'))
    return { label: 'GPS',     icon: MapPin,   cls: 'bg-info-bg text-info-text border-info-border' };
  if (m.includes('testo') || m.includes('text'))
    return { label: 'Testo',   icon: MessageCircle, cls: 'bg-success-bg text-success-text border-success-border' };
  return { label: method || 'N/D', icon: Bot, cls: 'bg-background text-text-secondary border-border' };
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

const KpiStrip = ({ feed, isLoading }: { feed: AuditEntry[]; isLoading: boolean }) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayFeed   = feed.filter(e => e.date?.startsWith(today));
  const oreTotal    = feed.filter(e => e.type === 'ore').reduce((s, e) => s + e.value, 0);
  const speseTotal  = feed.filter(e => e.type === 'spese').reduce((s, e) => s + e.value, 0);
  const gpsCount    = feed.filter(e => (e.input_method ?? '').toLowerCase().includes('gps')).length;

  const items = [
    { icon: MessageCircle, label: 'Messaggi Oggi', value: isLoading ? '…' : todayFeed.length, color: 'bg-accent' },
    { icon: Clock,         label: 'Ore Totali',    value: isLoading ? '…' : `${oreTotal.toFixed(1)}h`, color: 'bg-emerald-500' },
    { icon: Banknote,      label: 'Spese Totali',  value: isLoading ? '…' : `€${speseTotal.toLocaleString('it-IT')}`, color: 'bg-indigo-500' },
    { icon: MapPin,        label: 'Check-in GPS',  value: isLoading ? '…' : gpsCount, color: 'bg-amber-500' },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {items.map(({ icon: Icon, label, value, color }) => (
        <motion.div
          key={label}
          whileHover={{ y: -3 }}
          className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 transition-colors duration-300"
        >
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', color)}>
            <Icon size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: AuditStatus }) => {
  const map: Record<AuditStatus, { label: string; cls: string }> = {
    pending:  { label: '⏳ In Attesa', cls: 'bg-warning-bg text-warning-text border border-warning-border' },
    verified: { label: '✅ Approvato', cls: 'bg-success-bg text-success-text border border-success-border' },
    rejected: { label: '❌ Rifiutato', cls: 'bg-danger-bg text-danger-text border border-danger-border' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-background text-text-secondary' };
  return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap', s.cls)}>{s.label}</span>;
};

// ─── Table Section ────────────────────────────────────────────────────────────

const AuditTable = ({
  feed, isLoading, error, refetch,
}: {
  feed: AuditEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}) => {
  const [search, setSearch]          = useState('');
  const [typeFilter, setTypeFilter]  = useState<TypeFilter>('tutti');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tutti');
  const [sortField, setSortField]    = useState<'date' | 'value'>('date');
  const [sortDir, setSortDir]        = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected]      = useState<Set<number>>(new Set());

  const approveMut = useApproveTelegramEntry();

  const filtered = useMemo(() => {
    let data = feed;
    if (typeFilter !== 'tutti') data = data.filter(e => e.type === typeFilter);
    if (statusFilter !== 'tutti') data = data.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(e =>
        (`${e.nome ?? ''} ${e.cognome ?? ''}`).toLowerCase().includes(q) ||
        (e.cantiere_nome ?? '').toLowerCase().includes(q) ||
        (e.note ?? '').toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => {
      const av = sortField === 'date' ? new Date(a.date).getTime() : a.value;
      const bv = sortField === 'date' ? new Date(b.date).getTime() : b.value;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [feed, typeFilter, statusFilter, search, sortField, sortDir]);

  const pendingFiltered = filtered.filter(e => e.status === 'pending');

  const toggleSort = (field: 'date' | 'value') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: 'date' | 'value' }) => {
    if (sortField !== field) return <ChevronDown size={13} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  const handleBulkAction = async (action: 'verify' | 'reject') => {
    if (selected.size === 0) return;
    await approveMut.mutateAsync({ ids: Array.from(selected), action });
    setSelected(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Cerca dipendente, cantiere..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-text-primary outline-none focus:ring-2 focus:ring-accent/20 w-52 transition-all"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
            {(['tutti', 'ore', 'spese'] as TypeFilter[]).map(f => (
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

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
            {(['tutti', 'pending', 'verified', 'rejected'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize',
                  statusFilter === f ? 'bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {f === 'pending' ? 'In Attesa' : f === 'verified' ? 'Approvati' : f === 'rejected' ? 'Rifiutati' : 'Tutti'}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => handleBulkAction('verify')}
                disabled={approveMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Approva {selected.size}{approveMut.isPending && ' …'}
              </motion.button>
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => handleBulkAction('reject')}
                disabled={approveMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger-bg text-danger-text border border-danger-border text-sm font-bold hover:opacity-80 transition-all disabled:opacity-50"
              >
                <XCircle size={14} /> Rifiuta {selected.size}
              </motion.button>
            </>
          )}
          <span className="text-xs text-text-secondary ml-1">
            {filtered.length} record
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Spinner label="Caricamento feed..." />
          </div>
        ) : error ? (
          <div className="py-16"><ErrorMessage error={error} onRetry={refetch} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={selected.size === pendingFiltered.length && pendingFiltered.length > 0}
                    onChange={() => {
                      if (selected.size === pendingFiltered.length) setSelected(new Set());
                      else setSelected(new Set(pendingFiltered.map(e => e.id)));
                    }}
                  />
                </th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Dipendente</th>
                <th className="px-5 py-3 text-left">Cantiere</th>
                <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Data <SortIcon field="date" /></span>
                </th>
                <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-text-primary" onClick={() => toggleSort('value')}>
                  <span className="flex items-center gap-1">Valore <SortIcon field="value" /></span>
                </th>
                <th className="px-5 py-3 text-left">Metodo</th>
                <th className="px-5 py-3 text-left">Stato</th>
                <th className="px-5 py-3 text-left">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-text-secondary text-sm">
                    Nessun record trovato con i filtri attuali.
                  </td>
                </tr>
              ) : filtered.map(entry => {
                const methodBadge = getMethodBadge(entry.input_method);
                const MethodIcon = methodBadge.icon;
                return (
                  <tr
                    key={`${entry.type}-${entry.id}`}
                    className={cn(
                      'border-b border-border/50 hover:bg-background/60 transition-colors',
                      selected.has(entry.id) && 'bg-accent/5'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      {entry.status === 'pending' && (
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={selected.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border',
                        entry.type === 'ore' ? 'bg-success-bg text-success-text border-success-border' : 'bg-danger-bg text-danger-text border-danger-border'
                      )}>
                        {entry.type === 'ore' ? '🕐 Ore' : '💶 Spesa'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-text-primary">
                      {`${entry.nome ?? ''} ${entry.cognome ?? ''}`.trim() || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">{entry.cantiere_nome ?? '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {new Date(entry.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-text-primary">
                      {entry.type === 'ore' ? `${entry.value}h` : `€${Number(entry.value).toLocaleString('it-IT')}`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border w-fit', methodBadge.cls)}>
                        <MethodIcon size={11} /> {methodBadge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      {entry.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => approveMut.mutate({ ids: [entry.id], action: 'verify' })}
                            disabled={approveMut.isPending}
                            className="p-1.5 rounded-lg bg-success-bg text-success-text hover:opacity-80 transition-all disabled:opacity-40"
                            title="Approva"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => approveMut.mutate({ ids: [entry.id], action: 'reject' })}
                            disabled={approveMut.isPending}
                            className="p-1.5 rounded-lg bg-danger-bg text-danger-text hover:opacity-80 transition-all disabled:opacity-40"
                            title="Rifiuta"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TelegramAuditPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const { feed, logs, isLoading, error, refetch } = useTelegramFeed({
    from: dateFrom || undefined,
    to:   dateTo   || undefined,
  });
  const [activeSection, setActiveSection] = useState<'audit' | 'logs'>('audit');
  const { downloadCsv } = useExportCsv();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadCsv({ start: dateFrom || undefined, end: dateTo || undefined });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background transition-colors duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-8 h-20 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Bot size={22} className="text-accent" /> Audit Telegram
          </h1>
          <p className="text-sm text-text-secondary">
            Feed in tempo reale dal Bot — ore, spese e check-in GPS dal cantiere
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range filter */}
          <div className="hidden md:flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              title="Data inizio"
            />
            <span className="text-text-secondary text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              title="Data fine"
            />
          </div>
          <button
            onClick={refetch}
            className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-background transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Esportazione...' : 'Esporta CSV'}
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* KPI Strip */}
        <KpiStrip feed={feed} isLoading={isLoading} />

        {/* Section Toggle */}
        <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 mb-6 w-fit">
          {([
            { id: 'audit', label: 'Tabella Audit' },
            { id: 'logs',  label: `Log Grezzi (${logs.length})` },
          ] as { id: 'audit' | 'logs'; label: string }[]).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn('px-4 py-2 rounded-lg text-sm font-bold transition-all',
                activeSection === s.id ? 'bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'audit' ? (
          <AuditTable feed={feed} isLoading={isLoading} error={error} refetch={refetch} />
        ) : (
          /* Log Grezzi */
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex justify-center"><Spinner label="Caricamento log..." /></div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-text-secondary text-sm">Nessun log disponibile.</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map(log => (
                  <div key={log.id} className="p-5 hover:bg-background/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-accent">{log.employee_name ?? `Employee #${log.employee_id}`}</span>
                          <span className="text-xs text-text-secondary">
                            {new Date(log.timestamp_utc).toLocaleString('it-IT')}
                          </span>
                          {log.message_type && (
                            <span className="px-2 py-0.5 bg-background text-text-secondary border border-border rounded text-[10px] font-bold uppercase">
                              {log.message_type}
                            </span>
                          )}
                        </div>
                        {log.raw_text && (
                          <p className="text-sm text-text-primary bg-background border border-border rounded-xl p-3 font-mono leading-relaxed">
                            {log.raw_text}
                          </p>
                        )}
                        {log.extracted_json && (
                          <details className="mt-2">
                            <summary className="text-xs text-accent cursor-pointer hover:underline flex items-center gap-1">
                              <Eye size={11} /> JSON Estratto
                            </summary>
                            <pre className="text-[11px] text-text-secondary bg-background border border-border rounded-xl p-3 mt-1 overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.extracted_json), null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
