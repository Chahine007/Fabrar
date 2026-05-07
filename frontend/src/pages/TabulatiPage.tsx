import React, { useDeferredValue, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Braces,
  ClipboardList, Clock, Banknote, MapPin, RefreshCw, Download,
  CheckCircle2, XCircle, Search, MessageCircle,
  ChevronDown, ChevronUp, Eye, Loader2, Pencil,
  Filter, Users,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAudit, useExportCsv } from '../hooks/api/useHr';
import {
  useMessageLogs,
  useApproveTelegramEntry,
  type MessageLogEntry,
} from '../hooks/api/useTelegramAudit';
import { useCantieri } from '../hooks/api/useCantieri';
import type { AuditEntry, AuditFilters } from '../hooks/api/useHr';
import ErrorMessage from '../components/ErrorMessage';
import { useAuthContext } from '../context/AuthContext';
import { RoleGuard } from '../components/auth/RoleGuard';
import { CardListSkeleton, EmptyState, TableSkeleton, useToast } from '../components/ui';
import MethodBadge from '../components/ui/MethodBadge';
import { EditAuditModal } from '../components/tabulati/EditAuditModal';
import {
  CostBadges,
  LogisticaBadge,
  PurchaseInvoiceBadge,
  StatusBadge,
  auditKey,
  formatAuditDate,
  formatAuditValue,
  formatDayLabel,
  formatLogTime,
  getLogAnomalyCount,
  isApprovedAuditStatus,
  safeNumber,
  safeParseLogJson,
  safeTime,
  toAuditMutationItem,
  type AuditMutationStatus,
} from '../components/tabulati/tabulatiUtils';

type TypeFilter   = 'tutti' | 'ore' | 'spese';
type StatusFilter = 'tutti' | 'pending' | 'approved' | 'rejected';
type CategoryFilter = 'tutte' | 'INVENTORY_MATERIAL' | 'CONSUMABLE_SUPPLY' | 'SERVICE' | 'LEASING_RENTAL' | 'UTILITY' | 'INSURANCE' | 'TAX_FEE' | 'PROFESSIONAL_SERVICE' | 'TRAVEL_VEHICLE' | 'OTHER' | 'UNKNOWN';
type ScopeFilter = 'tutte' | 'PROJECT' | 'OVERHEAD' | 'REVIEW';
type EnrichedLogEntry = MessageLogEntry & {
  parsedJson: unknown | null;
  hasInvalidJson: boolean;
  previewTruncated: boolean;
  isUnknownEmployee: boolean;
};
type EmployeeLogGroup = {
  key: string;
  employeeId: number;
  employeeLabel: string;
  employeeName: string | null;
  latestTime: number;
  logs: EnrichedLogEntry[];
  anomalyCount: number;
};
type DayLogGroup = {
  dayKey: string;
  dayLabel: string;
  latestTime: number;
  totalLogs: number;
  groups: EmployeeLogGroup[];
};

function RawLogsPanel({
  logs,
  isLoading,
  error,
  refetch,
  search,
  onSearchChange,
  selectedEmployeeId,
  onEmployeeChange,
  selectedMessageType,
  onMessageTypeChange,
  onlyWithJson,
  onOnlyWithJsonChange,
}: {
  logs: MessageLogEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedEmployeeId: string;
  onEmployeeChange: (value: string) => void;
  selectedMessageType: string;
  onMessageTypeChange: (value: string) => void;
  onlyWithJson: boolean;
  onOnlyWithJsonChange: (value: boolean) => void;
}) {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [collapsedEmployees, setCollapsedEmployees] = useState<Set<string>>(new Set());
  const [expandedTextIds, setExpandedTextIds] = useState<Set<number>>(new Set());
  const [expandedJsonIds, setExpandedJsonIds] = useState<Set<number>>(new Set());

  const enrichedLogs = useMemo<EnrichedLogEntry[]>(() => {
    return logs.map((log) => {
      const { parsedJson, hasInvalidJson } = safeParseLogJson(log.extracted_json);
      const rawText = String(log.raw_text ?? '').trim();
      const rawPreview = String(log.raw_preview ?? '').trim();
      const previewTruncated = Boolean(rawText && rawPreview && rawText !== rawPreview && rawPreview.endsWith('…'));
      return {
        ...log,
        parsedJson,
        hasInvalidJson,
        previewTruncated,
        isUnknownEmployee: !log.employee_name,
      };
    });
  }, [logs]);

  const employeeOptions = useMemo(() => {
    return [...new Map(
      enrichedLogs.map(log => [
        log.employee_id,
        { id: String(log.employee_id), label: log.employee_label },
      ])
    ).values()].sort((a, b) => a.label.localeCompare(b.label, 'it-IT'));
  }, [enrichedLogs]);

  const messageTypeOptions = useMemo(() => {
    return [...new Set(
      enrichedLogs
        .map(log => log.message_type?.trim())
        .filter((value): value is string => Boolean(value))
    )].sort((a, b) => a.localeCompare(b, 'it-IT'));
  }, [enrichedLogs]);

  const groupedLogs = useMemo<DayLogGroup[]>(() => {
    const dayMap = new Map<string, {
      dayKey: string;
      dayLabel: string;
      latestTime: number;
      groups: Map<string, EmployeeLogGroup>;
    }>();

    for (const log of enrichedLogs) {
      const dayKey = log.day_key || String(log.timestamp_utc).slice(0, 10);
      const groupKey = `${dayKey}:${log.employee_id}`;
      const logTime = safeTime(log.timestamp_utc);

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          dayKey,
          dayLabel: formatDayLabel(dayKey),
          latestTime: logTime,
          groups: new Map(),
        });
      }

      const dayGroup = dayMap.get(dayKey)!;
      dayGroup.latestTime = Math.max(dayGroup.latestTime, logTime);

      if (!dayGroup.groups.has(groupKey)) {
        dayGroup.groups.set(groupKey, {
          key: groupKey,
          employeeId: log.employee_id,
          employeeLabel: log.employee_label,
          employeeName: log.employee_name,
          latestTime: logTime,
          logs: [],
          anomalyCount: 0,
        });
      }

      const employeeGroup = dayGroup.groups.get(groupKey)!;
      employeeGroup.latestTime = Math.max(employeeGroup.latestTime, logTime);
      employeeGroup.logs.push(log);
      employeeGroup.anomalyCount += getLogAnomalyCount(log);
    }

    return [...dayMap.values()]
      .sort((a, b) => b.latestTime - a.latestTime)
      .map(dayGroup => ({
        dayKey: dayGroup.dayKey,
        dayLabel: dayGroup.dayLabel,
        latestTime: dayGroup.latestTime,
        totalLogs: [...dayGroup.groups.values()].reduce((sum, group) => sum + group.logs.length, 0),
        groups: [...dayGroup.groups.values()].sort((a, b) => b.latestTime - a.latestTime),
      }));
  }, [enrichedLogs]);

  const toggleCollapsed = (key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpandedItem = (id: number, setter: React.Dispatch<React.SetStateAction<Set<number>>>) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    onSearchChange('');
    onEmployeeChange('all');
    onMessageTypeChange('all');
    onOnlyWithJsonChange(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="border-b border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Cerca nel raw_text..."
                className="pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-text-primary outline-none focus:ring-2 focus:ring-accent/20 w-60 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-secondary">
              <Users size={14} />
              <select
                value={selectedEmployeeId}
                onChange={e => onEmployeeChange(e.target.value)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="all">Tutti i dipendenti</option>
                {employeeOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-secondary">
              <Filter size={14} />
              <select
                value={selectedMessageType}
                onChange={e => onMessageTypeChange(e.target.value)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="all">Tutti i tipi</option>
                {messageTypeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onOnlyWithJsonChange(!onlyWithJson)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                onlyWithJson
                  ? 'border-info-border bg-info-bg text-info-text'
                  : 'border-border bg-background text-text-secondary hover:text-text-primary'
              )}
            >
              <Braces size={14} />
              Solo con JSON estratto
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-secondary">
              {logs.length} log filtrati
            </span>
            <button
              onClick={resetFilters}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-secondary hover:bg-background transition-all"
            >
              Reset filtri
            </button>
            <button
              onClick={refetch}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-secondary hover:bg-background transition-all"
            >
              Aggiorna
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><CardListSkeleton rows={6} /></div>
      ) : error ? (
        <div className="py-16"><ErrorMessage error={error} onRetry={refetch} /></div>
      ) : groupedLogs.length === 0 ? (
        <div className="py-16 text-center text-text-secondary text-sm">Nessun log trovato con i filtri attuali.</div>
      ) : (
        <div className="divide-y divide-border">
          {groupedLogs.map(day => {
            const dayCollapsed = collapsedDays.has(day.dayKey);

            return (
              <section key={day.dayKey} className="p-4 md:p-5">
                <button
                  onClick={() => toggleCollapsed(day.dayKey, setCollapsedDays)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-all hover:border-accent/30"
                >
                  <div>
                    <p className="text-sm font-bold capitalize text-text-primary">{day.dayLabel}</p>
                    <p className="mt-1 text-xs text-text-secondary">{day.totalLogs} eventi · {day.groups.length} gruppi dipendente</p>
                  </div>
                  {dayCollapsed ? <ChevronDown size={16} className="text-text-secondary" /> : <ChevronUp size={16} className="text-text-secondary" />}
                </button>

                {!dayCollapsed && (
                  <div className="mt-4 space-y-3">
                    {day.groups.map(group => {
                      const employeeCollapsed = collapsedEmployees.has(group.key);

                      return (
                        <div key={group.key} className="rounded-2xl border border-border overflow-hidden">
                          <button
                            onClick={() => toggleCollapsed(group.key, setCollapsedEmployees)}
                            className="flex w-full items-center justify-between gap-4 bg-card px-4 py-3 text-left transition-all hover:bg-background/50"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-text-primary">{group.employeeLabel}</span>
                                {group.employeeName == null && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[10px] font-bold text-warning-text">
                                    <AlertTriangle size={10} /> Identità incompleta
                                  </span>
                                )}
                                {group.anomalyCount > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-bg px-2 py-0.5 text-[10px] font-bold text-danger-text">
                                    <AlertTriangle size={10} /> {group.anomalyCount} anomalie
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-text-secondary">{group.logs.length} eventi nel giorno selezionato</p>
                            </div>
                            {employeeCollapsed ? <ChevronDown size={16} className="text-text-secondary" /> : <ChevronUp size={16} className="text-text-secondary" />}
                          </button>

                          {!employeeCollapsed && (
                            <div className="space-y-3 border-t border-border bg-background/40 p-4">
                              {group.logs.map(log => {
                                const showFullText = expandedTextIds.has(log.id);
                                const showJson = expandedJsonIds.has(log.id);

                                return (
                                  <article key={log.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs font-bold text-accent">{formatLogTime(log.timestamp_utc)}</span>
                                          {log.message_type ? (
                                            <MethodBadge method={log.message_type} className="min-w-0" />
                                          ) : (
                                            <span className="inline-flex h-7 items-center justify-center rounded-lg border border-border px-2.5 text-[11px] font-semibold text-text-secondary">
                                              Altro
                                            </span>
                                          )}
                                          {log.has_extracted_json && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-info-border bg-info-bg px-2 py-0.5 text-[10px] font-bold text-info-text">
                                              <Braces size={10} /> JSON estratto
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-3 rounded-xl border border-border bg-background p-3">
                                          <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words font-mono">
                                            {log.raw_preview}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 lg:max-w-[240px] lg:justify-end">
                                        {log.previewTruncated && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[10px] font-bold text-warning-text">
                                            <Eye size={10} /> Testo lungo troncato
                                          </span>
                                        )}
                                        {log.hasInvalidJson && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-bg px-2 py-1 text-[10px] font-bold text-danger-text">
                                            <AlertTriangle size={10} /> JSON non valido
                                          </span>
                                        )}
                                        {log.isUnknownEmployee && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[10px] font-bold text-warning-text">
                                            <Users size={10} /> Dipendente sconosciuto
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        onClick={() => toggleExpandedItem(log.id, setExpandedTextIds)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-secondary hover:bg-background transition-all"
                                      >
                                        <Eye size={12} />
                                        {showFullText ? 'Nascondi testo completo' : 'Apri testo completo'}
                                      </button>

                                      {log.has_extracted_json && (
                                        <button
                                          onClick={() => toggleExpandedItem(log.id, setExpandedJsonIds)}
                                          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text-secondary hover:bg-background transition-all"
                                        >
                                          <Braces size={12} />
                                          {showJson ? 'Nascondi JSON' : 'Apri JSON'}
                                        </button>
                                      )}
                                    </div>

                                    {showFullText && (
                                      <div className="mt-3 rounded-xl border border-border bg-background p-3">
                                        <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words font-mono">
                                          {log.raw_text?.trim() || 'Nessun contenuto testuale'}
                                        </p>
                                      </div>
                                    )}

                                    {showJson && log.has_extracted_json && (
                                      <div className="mt-3 rounded-xl border border-border bg-background p-3">
                                        {log.hasInvalidJson && (
                                          <div className="mb-3 rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-text">
                                            Il payload esiste ma non è un JSON valido. Mostro il contenuto raw senza parsing.
                                          </div>
                                        )}
                                        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-secondary">
                                          {log.hasInvalidJson
                                            ? String(log.extracted_json ?? '')
                                            : JSON.stringify(log.parsedJson, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </article>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TabulatiPage() {
  const { user } = useAuthContext();
  const userRole = user?.role ?? '';
  const canManageAudit = userRole === 'ADMIN' || userRole === 'HR';
  const canViewLogs = canManageAudit;
  const [searchParams] = useSearchParams();
  const initEmp = searchParams.get('employee_id') ?? '';
  const initCantiere = searchParams.get('cantiere_id') ?? '';

  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [search, setSearch]       = useState('');
  const [typeF, setTypeF]         = useState<TypeFilter>('tutti');
  const [statusF, setStatusF]     = useState<StatusFilter>('tutti');
  const [categoryF, setCategoryF] = useState<CategoryFilter>('tutte');
  const [scopeF, setScopeF]       = useState<ScopeFilter>('tutte');
  const [cantiereF, setCantiereF] = useState(initCantiere);
  const [sortField, setSortField] = useState<'date'|'value'>('date');
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('desc');
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [editEntry, setEditEntry] = useState<AuditEntry | null>(null);
  const [section, setSection]     = useState<'audit'|'logs'>('audit');
  const [exporting, setExporting] = useState(false);
  const [logSearchInput, setLogSearchInput] = useState('');
  const [selectedLogEmployeeId, setSelectedLogEmployeeId] = useState('all');
  const [selectedLogMessageType, setSelectedLogMessageType] = useState('all');
  const [onlyLogsWithJson, setOnlyLogsWithJson] = useState(false);
  const toast = useToast();
  const { data: cantieri = [] } = useCantieri();
  const deferredLogSearch = useDeferredValue(logSearchInput.trim());

  const filters: AuditFilters = {
    type:        typeF !== 'tutti' ? typeF : undefined,
    status:      statusF !== 'tutti' ? statusF : undefined,
    employee_id: initEmp || undefined,
    cantiere_id: cantiereF ? Number(cantiereF) : undefined,
    from:        dateFrom || undefined,
    to:          dateTo   || undefined,
    cost_category: categoryF !== 'tutte' ? categoryF : undefined,
    allocation_scope: scopeF !== 'tutte' ? scopeF : undefined,
  };

  const { data: rawFeed = [], isLoading, error, refetch } = useAudit(filters);
  const {
    data: logs = [],
    isLoading: isLogsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useMessageLogs({
    from: dateFrom || undefined,
    to:   dateTo   || undefined,
    employeeId: selectedLogEmployeeId !== 'all' ? Number(selectedLogEmployeeId) : undefined,
    messageType: selectedLogMessageType !== 'all' ? selectedLogMessageType : undefined,
    hasExtractedJson: onlyLogsWithJson ? true : undefined,
    search: deferredLogSearch || undefined,
  }, canViewLogs);
  const approveMut       = useApproveTelegramEntry();
  const { downloadCsv }  = useExportCsv();

  const feed = useMemo(() => {
    let data = rawFeed;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(e =>
        (`${e.nome??''} ${e.cognome??''}`).toLowerCase().includes(q) ||
        (e.cantiere_nome ?? '').toLowerCase().includes(q) ||
        (e.note ?? '').toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => {
      const av = sortField === 'date' ? safeTime(a.date) : safeNumber(a.value);
      const bv = sortField === 'date' ? safeTime(b.date) : safeNumber(b.value);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rawFeed, search, sortField, sortDir]);

  const pendingFeed = feed.filter(e => e.status === 'pending');
  const pendingKeys = useMemo(() => pendingFeed.map(auditKey), [pendingFeed]);
  const selectedEntries = useMemo(() => feed.filter(entry => selected.has(auditKey(entry))), [feed, selected]);
  const allPendingSelected = pendingKeys.length > 0 && pendingKeys.every(key => selected.has(key));
  const toggleSort = (f: 'date'|'value') => { if (sortField===f) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('desc'); } };
  const toggleSel  = (entry: AuditEntry) => setSelected(prev => { const s=new Set(prev); const key = auditKey(entry); s.has(key)?s.delete(key):s.add(key); return s; });
  const toggleAllPending = () => setSelected(prev => {
    if (allPendingSelected) return new Set([...prev].filter(key => !pendingKeys.includes(key)));
    return new Set([...prev, ...pendingKeys]);
  });
  const handleBulk = async (newStatus: AuditMutationStatus) => {
    if (!selectedEntries.length) return;
    await approveMut.mutateAsync({ items: selectedEntries.map(entry => toAuditMutationItem(entry, newStatus)) });
    setSelected(new Set());
  };
  const SortIcon = ({ f }: { f: 'date'|'value' }) => sortField!==f ? <ChevronDown size={13} className="opacity-30"/> : sortDir==='asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>;

  const today = new Date().toISOString().slice(0,10);
  const kpi = {
    oggi:  rawFeed.filter(e=>e.date?.startsWith(today)).length,
    ore:   rawFeed.filter(e=>e.type==='ore').reduce((s,e)=>s+safeNumber(e.value),0).toFixed(1),
    spese: rawFeed.filter(e=>e.type==='spese').reduce((s,e)=>s+safeNumber(e.value),0),
    gps:   rawFeed.filter(e=>(e.input_method??'').toLowerCase().includes('gps')).length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-4 md:px-8 h-20 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><ClipboardList size={22} className="text-accent"/> Tabulati</h1>
          <p className="text-sm text-text-secondary">Ore, spese e timbrature — tutti i canali</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20"/>
            <span className="text-text-secondary">→</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20"/>
          </div>
          <button onClick={()=>{refetch();refetchLogs();}} className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background"><RefreshCw size={16}/></button>
          <RoleGuard allowedRoles={['ADMIN', 'HR']}>
            <button onClick={async()=>{try{setExporting(true);await downloadCsv({start:dateFrom||undefined,end:dateTo||undefined});toast.success('CSV esportato');}catch(e){toast.error('Export non riuscito', (e as Error).message);}finally{setExporting(false);}}}
              disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-background disabled:opacity-50">
              {exporting?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} CSV
            </button>
          </RoleGuard>
        </div>
      </div>

      <div className="p-4 md:p-8">
        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[
            { icon: MessageCircle, label: 'Messaggi Oggi', value: kpi.oggi, color: 'bg-accent' },
            { icon: Clock,         label: 'Ore Totali',    value: `${kpi.ore}h`, color: 'bg-emerald-500' },
            { icon: Banknote,      label: 'Spese Totali',  value: `€${kpi.spese.toLocaleString('it-IT')}`, color: 'bg-indigo-500' },
            { icon: MapPin,        label: 'Check-in GPS',  value: kpi.gps, color: 'bg-amber-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <motion.div key={label} whileHover={{ y: -3 }} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', color)}><Icon size={22} className="text-white"/></div>
              <div><p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div>
            </motion.div>
          ))}
        </div>

        {/* Section toggle */}
        <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 mb-6 w-fit">
          {([{ id:'audit', label:'Tabella Audit' }, ...(canViewLogs ? [{ id:'logs', label:`Log Grezzi (${logs.length})` }] : [])] as const).map(s => (
            <button key={s.id} onClick={()=>setSection(s.id)}
              className={cn('px-4 py-2 rounded-lg text-sm font-bold transition-all', section===s.id?'bg-card text-accent shadow-sm':'text-text-secondary hover:text-text-primary')}>
              {s.label}
            </button>
          ))}
        </div>

        {section === 'audit' ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"/>
                <input id="tabulati-search" type="text" placeholder="Cerca dipendente, cantiere..." value={search} onChange={e=>setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-background text-text-primary outline-none focus:ring-2 focus:ring-accent/20 w-full"/>
              </div>

              {/* Tipo */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                {(['tutti','ore','spese'] as TypeFilter[]).map(f=>(
                  <button key={f} onClick={()=>setTypeF(f)} className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize', typeF===f?'bg-card text-accent shadow-sm':'text-text-secondary hover:text-text-primary')}>{f}</button>
                ))}
              </div>

              <select
                id="tabulati-cantiere-filter"
                value={cantiereF}
                onChange={e=>setCantiereF(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">Tutti i cantieri</option>
                {cantieri.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>

              {/* Stato — evidenziato con colori */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                {([
                  { id:'tutti',    label:'Tutti',          cls:'' },
                  { id:'pending',  label:'⏳ In Attesa',   cls: statusF==='pending'  ? 'bg-warning-bg text-warning-text' : '' },
                  { id:'approved', label:'✅ Approvati',   cls: statusF==='approved' ? 'bg-success-bg text-success-text' : '' },
                  { id:'rejected', label:'❌ Rifiutati',   cls: statusF==='rejected' ? 'bg-danger-bg  text-danger-text'  : '' },
                ] as const).map(f=>(
                  <button key={f.id} onClick={()=>setStatusF(f.id as StatusFilter)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all', f.cls || (statusF===f.id?'bg-card text-accent shadow-sm':'text-text-secondary hover:text-text-primary'))}>
                    {f.label}
                  </button>
                ))}
              </div>

              <select
                id="tabulati-category-filter"
                value={categoryF}
                onChange={e=>setCategoryF(e.target.value as CategoryFilter)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="tutte">Tutte le categorie</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select
                id="tabulati-scope-filter"
                value={scopeF}
                onChange={e=>setScopeF(e.target.value as ScopeFilter)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="tutte">Tutte le destinazioni</option>
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              {/* Bulk */}
              {canManageAudit && selectedEntries.length > 0 && (
                <>
                  <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={()=>handleBulk('APPROVED')} disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50">
                    <CheckCircle2 size={14}/> Approva {selectedEntries.length}
                  </motion.button>
                  <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={()=>handleBulk('REJECTED')} disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger-bg text-danger-text border border-danger-border text-sm font-bold hover:opacity-80 disabled:opacity-50">
                    <XCircle size={14}/> Rifiuta {selectedEntries.length}
                  </motion.button>
                </>
              )}
              <span className="text-xs text-text-secondary ml-auto">{feed.length} record</span>
            </div>

            {/* Tabella */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-4">
                  <div className="md:hidden"><CardListSkeleton rows={6} /></div>
                  <div className="hidden md:block"><TableSkeleton rows={8} columns={10} /></div>
                </div>
              ) : error ? (
                <div className="py-16"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch}/></div>
              ) : (
                <>
                <div className="divide-y divide-border md:hidden">
                  {feed.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={ClipboardList}
                        title="Nessun record trovato"
                        description="Modifica i filtri o usa Raccolta Dati per inserire nuovi record."
                      />
                    </div>
                  ) : feed.map(entry => {
                    return (
                      <div key={`${entry.type}-${entry.id}-mobile`} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-text-primary">{entry.cantiere_nome || 'Senza cantiere'}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {formatAuditDate(entry.date)} · {`${entry.nome ?? ''} ${entry.cognome ?? ''}`.trim() || '—'}
                            </p>
                          </div>
                          <StatusBadge status={entry.status} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                          <span>Tipo: <strong className="text-text-primary">{entry.type === 'ore' ? 'Ore' : 'Spesa'}</strong></span>
                          <span>Valore: <strong className="text-text-primary">{formatAuditValue(entry)}</strong></span>
                          <span className="col-span-2">Task: <strong className="text-text-primary">{entry.task_title || '—'}</strong></span>
                          <span className="col-span-2">
                            Metodo:{' '}
                            <MethodBadge method={entry.input_method} />
                          </span>
                          {entry.type === 'spese' && entry.logistica_status && entry.logistica_status !== 'NOT_REQUIRED' && (
                            <span className="col-span-2">
                              Logistica:{' '}
                              <LogisticaBadge status={entry.logistica_status} />
                            </span>
                          )}
                          {entry.type === 'spese' && (
                            <span className="col-span-2">
                              Contabilità:{' '}
                              <CostBadges entry={entry} />
                            </span>
                          )}
                          {entry.type === 'spese' && entry.fattura_acquisto && (
                            <span className="col-span-2">
                              Documento:{' '}
                              <PurchaseInvoiceBadge entry={entry} />
                            </span>
                          )}
                          {entry.note && <span className="col-span-2">Note: <strong className="text-text-primary">{entry.note}</strong></span>}
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          {canManageAudit && entry.status === 'pending' && (
                            <>
                              <button onClick={()=>approveMut.mutate({ items: [toAuditMutationItem(entry, 'APPROVED')] })} disabled={approveMut.isPending}
                                className="rounded-xl bg-success-bg px-3 py-2 text-xs font-bold text-success-text disabled:opacity-40">
                                Approva
                              </button>
                              <button onClick={()=>approveMut.mutate({ items: [toAuditMutationItem(entry, 'REJECTED')] })} disabled={approveMut.isPending}
                                className="rounded-xl bg-danger-bg px-3 py-2 text-xs font-bold text-danger-text disabled:opacity-40">
                                Rifiuta
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left w-10">
                        <input type="checkbox" className="accent-accent"
                          checked={allPendingSelected}
                          onChange={toggleAllPending}/>
                      </th>
                      <th className="px-5 py-3 text-left">Tipo</th>
                      <th className="px-5 py-3 text-left">Dipendente</th>
                      <th className="px-5 py-3 text-left">Cantiere</th>
                      <th className="px-5 py-3 text-left">Task</th>
                      <th className="px-5 py-3 text-left cursor-pointer hover:text-text-primary select-none" onClick={()=>toggleSort('date')}>
                        <span className="flex items-center gap-1">Data <SortIcon f="date"/></span>
                      </th>
                      <th className="px-5 py-3 text-left cursor-pointer hover:text-text-primary select-none" onClick={()=>toggleSort('value')}>
                        <span className="flex items-center gap-1">Valore <SortIcon f="value"/></span>
                      </th>
                      <th className="px-5 py-3 text-left">Metodo</th>
                      <th className="px-5 py-3 text-left">Stato</th>
                      <th className="px-5 py-3 text-left">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feed.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-16 text-text-secondary text-sm">Nessun record trovato.</td></tr>
                    ) : feed.map(entry => {
                      const isApproved = isApprovedAuditStatus(entry.status);
                      return (
                        <tr key={`${entry.type}-${entry.id}`}
                          className={cn('border-b border-border/50 hover:bg-background/60 transition-colors', selected.has(auditKey(entry))&&'bg-accent/5')}>
                          <td className="px-5 py-3.5">
                            {canManageAudit && entry.status==='pending' &&
                              <input type="checkbox" className="accent-accent" checked={selected.has(auditKey(entry))} onChange={()=>toggleSel(entry)}/>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border',
                              entry.type==='ore'?'bg-success-bg text-success-text border-success-border':'bg-danger-bg text-danger-text border-danger-border')}>
                              {entry.type==='ore'?'🕐 Ore':'💶 Spesa'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-text-primary">{`${entry.nome??''} ${entry.cognome??''}`.trim()||'—'}</td>
                          <td className="px-5 py-3.5 text-text-secondary">{entry.cantiere_nome||'—'}</td>
                          <td className="px-5 py-3.5 text-text-secondary">{entry.task_title || '—'}</td>
                          <td className="px-5 py-3.5 text-text-secondary">{formatAuditDate(entry.date)}</td>
                          <td className="px-5 py-3.5 font-bold text-text-primary">
                            {formatAuditValue(entry)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col items-start gap-1">
                              <MethodBadge method={entry.input_method} />
                              {entry.type === 'spese' && <LogisticaBadge status={entry.logistica_status} />}
                              {entry.type === 'spese' && <CostBadges entry={entry} />}
                              {entry.type === 'spese' && <PurchaseInvoiceBadge entry={entry} />}
                            </div>
                          </td>
                          <td className="px-5 py-3.5"><StatusBadge status={entry.status}/></td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              {canManageAudit && entry.type==='ore' && !isApproved && (
                                <button id={`edit-${entry.id}`} onClick={()=>setEditEntry(entry)}
                                  className="p-1.5 rounded-lg bg-background border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-all" title="Modifica">
                                  <Pencil size={14}/>
                                </button>
                              )}
                              {canManageAudit && entry.status==='pending' && (
                                <>
                                  <button onClick={()=>approveMut.mutate({ items: [toAuditMutationItem(entry, 'APPROVED')] })} disabled={approveMut.isPending}
                                    className="p-1.5 rounded-lg bg-success-bg text-success-text hover:opacity-80 disabled:opacity-40" title="Approva">
                                    <CheckCircle2 size={14}/>
                                  </button>
                                  <button onClick={()=>approveMut.mutate({ items: [toAuditMutationItem(entry, 'REJECTED')] })} disabled={approveMut.isPending}
                                    className="p-1.5 rounded-lg bg-danger-bg text-danger-text hover:opacity-80 disabled:opacity-40" title="Rifiuta">
                                    <XCircle size={14}/>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <RawLogsPanel
            logs={logs}
            isLoading={isLogsLoading}
            error={logsError ? (logsError as Error).message : null}
            refetch={refetchLogs}
            search={logSearchInput}
            onSearchChange={setLogSearchInput}
            selectedEmployeeId={selectedLogEmployeeId}
            onEmployeeChange={setSelectedLogEmployeeId}
            selectedMessageType={selectedLogMessageType}
            onMessageTypeChange={setSelectedLogMessageType}
            onlyWithJson={onlyLogsWithJson}
            onOnlyWithJsonChange={setOnlyLogsWithJson}
          />
        )}
      </div>

      <AnimatePresence>
        {editEntry && <EditAuditModal entry={editEntry} onClose={()=>setEditEntry(null)}/>}
      </AnimatePresence>
    </div>
  );
}
