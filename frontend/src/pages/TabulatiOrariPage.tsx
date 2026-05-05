import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList, Clock, Banknote, MapPin, RefreshCw, Download,
  CheckCircle2, XCircle, Search, Mic, Camera, MessageCircle,
  ChevronDown, ChevronUp, Eye, Loader2, Pencil, X, Bot,
  Plus, Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAudit, useUpdateReportEntry, useExportCsv } from '../hooks/api/useHr';
import { useMessageLogs, useApproveTelegramEntry } from '../hooks/api/useTelegramAudit';
import { useCantieri } from '../hooks/api/useCantieri';
import type { AuditEntry, AuditStatus, AuditFilters } from '../hooks/api/useHr';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import { useAuthContext } from '../context/AuthContext';
import { RoleGuard } from '../components/auth/RoleGuard';
import TimeEntryModal from '../components/timesheets/TimeEntryModal';
import ExpenseModal from '../components/timesheets/ExpenseModal';
import { useDeleteMyTimeEntry } from '../hooks/api/useMyTimesheets';
import { useDeleteMyExpense } from '../hooks/api/useMyExpenses';

type TypeFilter   = 'tutti' | 'ore' | 'spese';
type StatusFilter = 'tutti' | 'pending' | 'verified' | 'rejected';

function isApprovedAuditStatus(status: AuditStatus | string | null | undefined) {
  const raw = String(status ?? '').toUpperCase();
  return raw === 'APPROVED' || raw === 'VERIFIED';
}

function methodBadge(method: string) {
  const m = (method ?? '').toLowerCase();
  if (m.includes('audio') || m.includes('voice')) return { label: 'Vocale',   icon: Mic,           cls: 'bg-warning-bg text-warning-text border-warning-border' };
  if (m.includes('ocr')  || m.includes('foto'))   return { label: 'Foto OCR', icon: Camera,        cls: 'bg-indigo-900/30 text-indigo-400 border-indigo-700/40' };
  if (m.includes('gps'))                           return { label: 'GPS',      icon: MapPin,        cls: 'bg-info-bg text-info-text border-info-border' };
  if (m.includes('testo')|| m.includes('text'))   return { label: 'Testo',    icon: MessageCircle, cls: 'bg-success-bg text-success-text border-success-border' };
  return { label: method || 'Manuale', icon: Bot, cls: 'bg-background text-text-secondary border-border' };
}

const StatusBadge = ({ status }: { status: AuditStatus }) => {
  const map: Record<AuditStatus, { label: string; cls: string }> = {
    pending:  { label: '⏳ In Attesa', cls: 'bg-warning-bg text-warning-text border border-warning-border' },
    approved: { label: '✅ Approvato', cls: 'bg-success-bg text-success-text border border-success-border' },
    verified: { label: '✅ Approvato', cls: 'bg-success-bg text-success-text border border-success-border' },
    rejected: { label: '❌ Rifiutato', cls: 'bg-danger-bg text-danger-text border border-danger-border' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-background text-text-secondary' };
  return <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap', s.cls)}>{s.label}</span>;
};

const EditModal = ({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) => {
  const update = useUpdateReportEntry();
  const { data: cantieri } = useCantieri();
  const [ore, setOre]       = useState(String(entry.value));
  const [cid, setCid]       = useState('');
  const [note, setNote]     = useState(entry.note ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: entry.id, data: {
        ore_lavorate:    parseFloat(ore) || undefined,
        cantiere_id:     cid ? Number(cid) : undefined,
        attivita_svolte: note || null,
      }});
      onClose();
    } catch (err) { alert((err as Error).message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2"><Pencil size={18} className="text-accent" /> Modifica Timbratura</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-background text-text-secondary"><X size={18} /></button>
        </div>
        <div className="mb-4 p-4 bg-background border border-border rounded-2xl text-sm text-text-secondary space-y-0.5">
          <p className="font-bold text-text-primary">{entry.nome} {entry.cognome}</p>
          <p>Data: {new Date(entry.date).toLocaleDateString('it-IT')}</p>
          <p>Cantiere: <span className="text-text-primary font-medium">{entry.cantiere_nome ?? '—'}</span></p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {entry.type === 'ore' && (
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Ore Lavorate</label>
              <input id="edit-ore" type="number" step="0.5" min="0" max="24" value={ore} onChange={e => setOre(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Cantiere</label>
            <select id="edit-cantiere" value={cid} onChange={e => setCid(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20">
              <option value="">— Mantieni attuale —</option>
              {(cantieri ?? []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Note</label>
            <textarea id="edit-note" value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm font-bold hover:bg-background transition-colors">Annulla</button>
            <button type="submit" disabled={update.isPending}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {update.isPending ? <><Loader2 size={14} className="animate-spin" /> Salvataggio...</> : 'Salva'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default function TabulatiOrariPage() {
  const { user } = useAuthContext();
  const userRole = user?.role ?? '';
  const canManageAudit = userRole === 'ADMIN' || userRole === 'HR';
  const canViewLogs = canManageAudit;
  const [searchParams] = useSearchParams();
  const initEmp = searchParams.get('employee_id') ?? '';

  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [search, setSearch]       = useState('');
  const [typeF, setTypeF]         = useState<TypeFilter>('tutti');
  const [statusF, setStatusF]     = useState<StatusFilter>('tutti');
  const [sortField, setSortField] = useState<'date'|'value'>('date');
  const [sortDir, setSortDir]     = useState<'asc'|'desc'>('desc');
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [editEntry, setEditEntry] = useState<AuditEntry | null>(null);
  const [timeModal, setTimeModal] = useState<{ mode: 'create' } | { mode: 'edit'; entry: AuditEntry } | null>(null);
  const [expenseModal, setExpenseModal] = useState<{ mode: 'create' } | { mode: 'edit'; entry: AuditEntry } | null>(null);
  const [section, setSection]     = useState<'audit'|'logs'>('audit');
  const [exporting, setExporting] = useState(false);

  const filters: AuditFilters = {
    type:        typeF !== 'tutti' ? typeF : undefined,
    status:      statusF !== 'tutti' ? statusF : undefined,
    employee_id: initEmp || undefined,
    from:        dateFrom || undefined,
    to:          dateTo   || undefined,
  };

  const { data: rawFeed = [], isLoading, error, refetch } = useAudit(filters);
  const { data: logs = [], refetch: refetchLogs } = useMessageLogs({
    from: dateFrom || undefined,
    to:   dateTo   || undefined,
  }, canViewLogs);
  const approveMut       = useApproveTelegramEntry();
  const { downloadCsv }  = useExportCsv();
  const deleteTimeEntry = useDeleteMyTimeEntry();
  const deleteExpense = useDeleteMyExpense();

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
      const av = sortField === 'date' ? new Date(a.date).getTime() : a.value;
      const bv = sortField === 'date' ? new Date(b.date).getTime() : b.value;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rawFeed, search, sortField, sortDir]);

  const pendingFeed = feed.filter(e => e.status === 'pending');
  const toggleSort = (f: 'date'|'value') => { if (sortField===f) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('desc'); } };
  const toggleSel  = (id: number) => setSelected(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  const handleBulk = async (action: 'verify'|'reject') => { if(!selected.size) return; await approveMut.mutateAsync({ids:[...selected],action}); setSelected(new Set()); };
  const handleDeletePersonalRecord = async (entry: AuditEntry) => {
    if (isApprovedAuditStatus(entry.status)) return;
    const label = entry.type === 'ore' ? 'questa registrazione ore' : 'questa spesa';
    if (!window.confirm(`Eliminare ${label}?`)) return;
    if (entry.type === 'ore') await deleteTimeEntry.mutateAsync(entry.id);
    else await deleteExpense.mutateAsync(entry.id);
  };
  const SortIcon = ({ f }: { f: 'date'|'value' }) => sortField!==f ? <ChevronDown size={13} className="opacity-30"/> : sortDir==='asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>;

  const today = new Date().toISOString().slice(0,10);
  const kpi = {
    oggi:  rawFeed.filter(e=>e.date?.startsWith(today)).length,
    ore:   rawFeed.filter(e=>e.type==='ore').reduce((s,e)=>s+e.value,0).toFixed(1),
    spese: rawFeed.filter(e=>e.type==='spese').reduce((s,e)=>s+e.value,0),
    gps:   rawFeed.filter(e=>(e.input_method??'').toLowerCase().includes('gps')).length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-8 h-20 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><ClipboardList size={22} className="text-accent"/> Tabulati Orari</h1>
          <p className="text-sm text-text-secondary">Ore, spese e timbrature — tutti i canali</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20"/>
            <span className="text-text-secondary">→</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-accent/20"/>
          </div>
          <button onClick={()=>{refetch();refetchLogs();}} className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background"><RefreshCw size={16}/></button>
          <button
            onClick={() => setTimeModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold hover:brightness-95"
          >
            <Plus size={14} /> Registra Ore
          </button>
          <button
            onClick={() => setExpenseModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold text-text-primary hover:bg-background"
          >
            <Banknote size={14} /> Nuova Spesa
          </button>
          <RoleGuard allowedRoles={['ADMIN', 'HR']}>
            <button onClick={async()=>{try{setExporting(true);await downloadCsv({start:dateFrom||undefined,end:dateTo||undefined});}catch(e){alert((e as Error).message);}finally{setExporting(false);}}}
              disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-background disabled:opacity-50">
              {exporting?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} CSV
            </button>
          </RoleGuard>
        </div>
      </div>

      <div className="p-8">
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

              {/* Stato — evidenziato con colori */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                {([
                  { id:'tutti',    label:'Tutti',          cls:'' },
                  { id:'pending',  label:'⏳ In Attesa',   cls: statusF==='pending'  ? 'bg-warning-bg text-warning-text' : '' },
                  { id:'verified', label:'✅ Approvati',   cls: statusF==='verified' ? 'bg-success-bg text-success-text' : '' },
                  { id:'rejected', label:'❌ Rifiutati',   cls: statusF==='rejected' ? 'bg-danger-bg  text-danger-text'  : '' },
                ] as const).map(f=>(
                  <button key={f.id} onClick={()=>setStatusF(f.id as StatusFilter)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-all', f.cls || (statusF===f.id?'bg-card text-accent shadow-sm':'text-text-secondary hover:text-text-primary'))}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Bulk */}
              {canManageAudit && selected.size > 0 && (
                <>
                  <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={()=>handleBulk('verify')} disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50">
                    <CheckCircle2 size={14}/> Approva {selected.size}
                  </motion.button>
                  <motion.button initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} onClick={()=>handleBulk('reject')} disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-danger-bg text-danger-text border border-danger-border text-sm font-bold hover:opacity-80 disabled:opacity-50">
                    <XCircle size={14}/> Rifiuta {selected.size}
                  </motion.button>
                </>
              )}
              <span className="text-xs text-text-secondary ml-auto">{feed.length} record</span>
            </div>

            {/* Tabella */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="py-16 flex justify-center"><Spinner label="Caricamento..."/></div>
              ) : error ? (
                <div className="py-16"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch}/></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left w-10">
                        <input type="checkbox" className="accent-accent"
                          checked={selected.size===pendingFeed.length && pendingFeed.length>0}
                          onChange={()=>selected.size===pendingFeed.length?setSelected(new Set()):setSelected(new Set(pendingFeed.map(e=>e.id)))}/>
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
                      const mb = methodBadge(entry.input_method);
                      const MIcon = mb.icon;
                      const isApproved = isApprovedAuditStatus(entry.status);
                      const isOwnRecord = user?.employee_id != null && entry.employee_id === user.employee_id;
                      const canUsePersonalActions = isOwnRecord && !canManageAudit;
                      const isDeleting = entry.type === 'ore' ? deleteTimeEntry.isPending : deleteExpense.isPending;
                      return (
                        <tr key={`${entry.type}-${entry.id}`}
                          className={cn('border-b border-border/50 hover:bg-background/60 transition-colors', selected.has(entry.id)&&'bg-accent/5')}>
                          <td className="px-5 py-3.5">
                            {canManageAudit && entry.status==='pending' &&
                              <input type="checkbox" className="accent-accent" checked={selected.has(entry.id)} onChange={()=>toggleSel(entry.id)}/>}
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
                          <td className="px-5 py-3.5 text-text-secondary">{new Date(entry.date).toLocaleDateString('it-IT')}</td>
                          <td className="px-5 py-3.5 font-bold text-text-primary">
                            {entry.type==='ore'?`${entry.value}h`:`€${Number(entry.value).toLocaleString('it-IT')}`}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border w-fit', mb.cls)}>
                              <MIcon size={11}/> {mb.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5"><StatusBadge status={entry.status}/></td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              {canUsePersonalActions && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (entry.type === 'ore') setTimeModal({ mode: 'edit', entry });
                                      else setExpenseModal({ mode: 'edit', entry });
                                    }}
                                    disabled={isApproved}
                                    className="p-1.5 rounded-lg bg-background border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-secondary disabled:hover:border-border"
                                    title={isApproved ? 'Record approvato non modificabile' : 'Modifica'}
                                  >
                                    <Pencil size={14}/>
                                  </button>
                                  {!isApproved && (
                                    <button
                                      onClick={() => handleDeletePersonalRecord(entry)}
                                      disabled={isDeleting}
                                      className="p-1.5 rounded-lg bg-danger-bg text-danger-text hover:opacity-80 disabled:opacity-40"
                                      title="Elimina"
                                    >
                                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14}/>}
                                    </button>
                                  )}
                                </>
                              )}
                              {canManageAudit && entry.type==='ore' && !isApproved && (
                                <button id={`edit-${entry.id}`} onClick={()=>setEditEntry(entry)}
                                  className="p-1.5 rounded-lg bg-background border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-all" title="Modifica">
                                  <Pencil size={14}/>
                                </button>
                              )}
                              {canManageAudit && entry.status==='pending' && (
                                <>
                                  <button onClick={()=>approveMut.mutate({ids:[entry.id],action:'verify'})} disabled={approveMut.isPending}
                                    className="p-1.5 rounded-lg bg-success-bg text-success-text hover:opacity-80 disabled:opacity-40" title="Approva">
                                    <CheckCircle2 size={14}/>
                                  </button>
                                  <button onClick={()=>approveMut.mutate({ids:[entry.id],action:'reject'})} disabled={approveMut.isPending}
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
              )}
            </div>
          </div>
        ) : (
          /* Log Grezzi */
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {logs.length === 0 ? (
              <div className="py-16 text-center text-text-secondary text-sm">Nessun log disponibile.</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map(log => (
                  <div key={log.id} className="p-5 hover:bg-background/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-accent">{log.employee_name ?? `#${log.employee_id}`}</span>
                          <span className="text-xs text-text-secondary">{new Date(log.timestamp_utc).toLocaleString('it-IT')}</span>
                          {log.message_type && (
                            <span className="px-2 py-0.5 bg-background text-text-secondary border border-border rounded text-[10px] font-bold uppercase">{log.message_type}</span>
                          )}
                        </div>
                        {log.raw_text && (
                          <p className="text-sm text-text-primary bg-background border border-border rounded-xl p-3 font-mono leading-relaxed">{log.raw_text}</p>
                        )}
                        {log.extracted_json && (
                          <details className="mt-2">
                            <summary className="text-xs text-accent cursor-pointer hover:underline flex items-center gap-1"><Eye size={11}/> JSON Estratto</summary>
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

      <AnimatePresence>
        {editEntry && <EditModal entry={editEntry} onClose={()=>setEditEntry(null)}/>}
        {timeModal && (
          <TimeEntryModal
            entry={timeModal.mode === 'edit' ? timeModal.entry : null}
            onClose={() => setTimeModal(null)}
          />
        )}
        {expenseModal && (
          <ExpenseModal
            expense={expenseModal.mode === 'edit' ? expenseModal.entry : null}
            onClose={() => setExpenseModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
