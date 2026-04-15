import React, { useState, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  Clock, 
  AlertCircle, 
  CheckSquare, 
  FileText, 
  MessageSquare, 
  Plus, 
  MoreVertical,
  Calendar,
  ChevronRight,
  ChevronDown,
  UploadCloud,
  File,
  Image as ImageIcon,
  CheckCircle2,
  PlayCircle,
  Paperclip,
  Mic,
  Send,
  Download,
  Settings,
  Download as DownloadIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import SmartActionMenu from './SmartActionMenu';
import ShareModal from './ShareModal';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../lib/api';
import { UI_LABELS } from '../../lib/labels';

// --- Static mock data (for tabs without backend yet) ---

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'activities', label: 'Attività' },
  { id: 'hours',      label: 'Ore' },
  { id: 'messages',   label: 'Messaggi' },
  { id: 'documents',  label: 'Documenti' },
  { id: 'warehouse',  label: 'Magazzino' },
  { id: 'invoices',   label: 'Fatture' },
];

const TIMELINE_EVENTS = [
  { id: 1, type: 'issue',   user: 'Marco Rossi',  avatar: '', time: '10:45', content: 'Tubo rotto nel settore B. Necessario intervento idraulico urgente.', status: 'Aperto' },
  { id: 2, type: 'hours',   user: 'Luca Verdi',   avatar: '', time: '09:30', content: 'Loggate 4h - Getto calcestruzzo pilastro A4' },
  { id: 3, type: 'message', user: 'Giulia Neri',  avatar: '', time: 'Ieri, 16:20', content: 'I materiali per la copertura sono arrivati in cantiere. Iniziamo lo scarico.' },
  { id: 4, type: 'task',    user: 'Sistema',      avatar: '', time: 'Ieri, 15:00', content: 'Task completato: Preparazione area cantiere nord', metadata: { assignedTo: 'Squadra A' } },
];

const TASKS = [
  { id: 1, title: 'Getto calcestruzzo pilastro A4',  assignee: 'Luca Verdi',  status: 'In Corso',   priority: 'Alta',  due: 'Oggi' },
  { id: 2, title: 'Verifica armatura settore B',      assignee: 'Marco Rossi', status: 'Da Fare',    priority: 'Media', due: 'Domani' },
  { id: 3, title: 'Preparazione area cantiere nord', assignee: 'Squadra A',   status: 'Completato', priority: 'Alta',  due: 'Ieri' },
];

const HOURS_DATA = [
  { day: 'Lun', hours: 24 },
  { day: 'Mar', hours: 32 },
  { day: 'Mer', hours: 28 },
  { day: 'Gio', hours: 36 },
  { day: 'Ven', hours: 16 },
];

const DOCUMENTS = [
  { id: 1, name: 'Planimetria_Piano_Terra_v2.pdf',      type: 'pdf',   size: '4.2 MB',  date: '10 Apr 2024', uploader: 'Arch. Bianchi' },
  { id: 2, name: 'Foto_Sopralluogo_SettoreB.jpg',       type: 'image', size: '1.8 MB',  date: '09 Apr 2024', uploader: 'Marco Rossi' },
  { id: 3, name: 'Computo_Metrico_Aggiornato.xlsx',     type: 'doc',   size: '850 KB', date: '05 Apr 2024', uploader: 'Giulia Neri' },
];

// --- API Types ---
interface Cantiere {
  id:           number;
  name:         string;
  status:       string;
  budget:       number | null;
  costo_reale:  number | null;
}

// --- Components ---

const MetricCard = ({ title, value, sub, trend }: { title: string, value: string, sub: string, trend?: 'positive' | 'negative' | 'neutral' }) => (
  <div className="bg-card p-6 rounded-3xl border border-border shadow-sm transition-colors duration-300">
    <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
    <h3 className="text-3xl font-bold text-text-primary">{value}</h3>
    <p className={cn(
      "text-sm font-medium mt-2",
      trend === 'positive' ? "text-success-text" : trend === 'negative' ? "text-danger-text" : "text-text-secondary"
    )}>{sub}</p>
  </div>
);

const TimelineCard: React.FC<{ event: any, onShare?: (e: any) => void }> = ({ event, onShare }) => {
  const isMessage = event.type === 'message';
  const isTask = event.type === 'task';
  const isHours = event.type === 'hours';
  const isIssue = event.type === 'issue';

  return (
    <div className="flex gap-4 relative group">
      <div className="w-10 shrink-0 flex flex-col items-center">
        {event.avatar ? (
          <img src={event.avatar} alt={event.user} className="w-10 h-10 rounded-full border-2 border-card shadow-sm z-10" referrerPolicy="no-referrer" />
        ) : (
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-sm border-2 border-card",
            isTask ? "bg-info-bg text-info-text border border-info-border" : "bg-background text-text-secondary"
          )}>
            {isTask ? <CheckSquare size={18} /> : <Settings size={18} />}
          </div>
        )}
        <div className="w-px h-full bg-border absolute top-10 bottom-[-24px] -z-0" />
      </div>
      
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-text-primary">{event.user}</span>
          <span className="text-xs font-medium text-text-secondary">{event.time}</span>
        </div>
        
        <div className={cn(
          "p-4 rounded-2xl border shadow-sm mt-2 relative",
          isIssue ? "bg-danger-bg border-danger-border" :
          isHours ? "bg-success-bg border-success-border" :
          isTask ? "bg-info-bg border-info-border" :
          "bg-card border-border"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-xl bg-card shadow-sm shrink-0",
              isIssue ? "text-danger-text" :
              isHours ? "text-success-text" :
              isTask ? "text-info-text" :
              "text-text-secondary"
            )}>
              {isIssue ? <AlertCircle size={18} /> :
               isHours ? <Clock size={18} /> :
               isTask ? <CheckSquare size={18} /> :
               <MessageSquare size={18} />}
            </div>
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium",
                isIssue ? "text-danger-text" :
                isHours ? "text-success-text" :
                isTask ? "text-info-text" :
                "text-text-primary"
              )}>{event.content}</p>
              {event.status && (
                <span className="inline-block mt-2 px-2 py-1 bg-card rounded text-[10px] font-bold text-danger-text uppercase tracking-wider shadow-sm">
                  Stato: {event.status}
                </span>
              )}
              {event.metadata && (
                <div className="mt-2 text-xs opacity-80 flex gap-4 text-text-secondary">
                  {Object.entries(event.metadata).map(([key, val]) => (
                    <span key={key} className="capitalize font-medium">{key}: {val as string}</span>
                  ))}
                </div>
              )}
            </div>
            {onShare && (
              <SmartActionMenu 
                onShare={() => onShare(event)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ProjectPage() {
  // ── Cantieri real data ────────────────────────────────
  const { data: cantieri, isLoading: loadingCantieri, error: errorCantieri, refetch } =
    useApi<Cantiere[]>('/api/cantieri');

  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [genyaLoading, setGenyaLoading] = useState(false);
  const [genyaMsg, setGenyaMsg]         = useState<string | null>(null);

  // Auto-select first cantiere on load
  React.useEffect(() => {
    if (cantieri && cantieri.length > 0 && selectedId === null) {
      setSelectedId(cantieri[0].id);
    }
  }, [cantieri, selectedId]);

  const selected = cantieri?.find(c => c.id === selectedId) ?? null;

  // Derived KPIs from selected cantiere
  const budget     = selected?.budget ?? 0;
  const costoReale = selected?.costo_reale ?? 0;
  const avanzamento = budget > 0 ? Math.min(100, Math.round((costoReale / budget) * 100)) : 0;
  const remaining  = Math.max(0, budget - costoReale);

  // ── Genya Import ────────────────────────────────────────
  const handleGenyaImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setGenyaLoading(true);
      setGenyaMsg(null);
      try {
        // Content-Type must NOT be set manually — fetch sets multipart boundary
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('jwt_token');
        const res = await fetch('/api/admin/spese/bulk', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Errore ${res.status}`);
        }
        const data = await res.json();
        setGenyaMsg(`✅ Importate ${data.inserted ?? '?'} spese da ${file.name}`);
        refetch();
      } catch (err: unknown) {
        setGenyaMsg(`❌ ${err instanceof Error ? err.message : 'Errore import'}`);
      } finally {
        setGenyaLoading(false);
      }
    };
    input.click();
  }, [refetch]);

  // ── Share (kept for future) ───────────────────────────────
  const [activeTab, setActiveTab]       = useState('overview');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare]   = useState<unknown>(null);

  const handleShare = (item: unknown) => {
    setItemToShare(item);
    setShareModalOpen(true);
  };

  // ── Early returns for loading/error states ─────────────────────────
  if (loadingCantieri) return <Spinner fullScreen label="Caricamento progetti..." />;
  if (errorCantieri)   return <ErrorMessage error={errorCantieri} onRetry={refetch} />;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Avanzamento"
                value={`${avanzamento}%`}
                sub={avanzamento >= 80 ? 'In linea con i tempi' : 'Monitorare progressi'}
                trend={avanzamento >= 80 ? 'positive' : avanzamento >= 50 ? 'neutral' : 'negative'}
              />
              <MetricCard
                title="Budget Residuo"
                value={`€${remaining.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`}
                sub={`di €${budget.toLocaleString('it-IT')} totali`}
                trend={remaining > 0 ? 'positive' : 'negative'}
              />
              <MetricCard
                title="Costo Reale"
                value={`€${costoReale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                sub={budget > 0 ? `${avanzamento}% del budget` : 'Nessun budget impostato'}
                trend={costoReale <= budget ? 'positive' : 'negative'}
              />
            </div>

            <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-text-primary">Timeline Operativa</h3>
                <button className="text-sm font-bold text-accent hover:underline">Vedi tutto</button>
              </div>
              <div className="space-y-2">
                {TIMELINE_EVENTS.map(event => (
                  <TimelineCard key={event.id} event={event} onShare={handleShare} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'activities':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Task di Progetto</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
                <Plus size={16} /> Nuovo Task
              </button>
            </div>

            {/* Quick Task Creation */}
            <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex gap-3 items-center">
              <div className="p-2 bg-background rounded-xl text-text-secondary">
                <Plus size={20} />
              </div>
              <input 
                type="text" 
                placeholder="Aggiungi rapidamente un task... (es. Verifica materiali settore C)"
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-text-primary placeholder:text-text-secondary"
              />
              <button className="px-4 py-2 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-all">
                Aggiungi
              </button>
            </div>

            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-background border-b border-border text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                    <th className="p-4">Task</th>
                    <th className="p-4">Assegnato a</th>
                    <th className="p-4">Scadenza</th>
                    <th className="p-4">Priorità</th>
                    <th className="p-4">Stato</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TASKS.map(task => (
                    <tr key={task.id} className="hover:bg-background/50 transition-colors group">
                      <td className="p-4 font-semibold text-text-primary">{task.title}</td>
                      <td className="p-4 text-sm text-text-secondary">{task.assignee}</td>
                      <td className="p-4 text-sm text-text-secondary">{task.due}</td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold",
                          task.priority === 'Alta' ? "bg-danger-bg text-danger-text border border-danger-border" : "bg-warning-bg text-warning-text border border-warning-border"
                        )}>{task.priority}</span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold",
                          task.status === 'Completato' ? "bg-success-bg text-success-text border border-success-border" : 
                          task.status === 'In Corso' ? "bg-info-bg text-info-text border border-info-border" : "bg-background text-text-secondary"
                        )}>{task.status}</span>
                      </td>
                      <td className="p-4 text-right">
                        <SmartActionMenu 
                          onShare={() => handleShare(task)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-block mr-2"
                        />
                        <button className="p-2 text-text-secondary hover:text-accent transition-colors opacity-0 group-hover:opacity-100 inline-block">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'hours':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Riepilogo Ore</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-success-bg text-success-text border border-success-border rounded-xl text-sm font-bold hover:opacity-80 transition-colors">
                <Clock size={16} /> Log Ore
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-card p-6 rounded-3xl border border-border shadow-sm">
                <h4 className="font-bold text-text-primary mb-6">Ore per giorno (Questa settimana)</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={HOURS_DATA}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'var(--background)' }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="hours" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex flex-col">
                <h4 className="font-bold text-text-primary mb-6">Ultimi Log</h4>
                <div className="space-y-4 flex-1">
                  {[
                    { user: 'Luca Verdi', hours: 4, task: 'Getto calcestruzzo', date: 'Oggi' },
                    { user: 'Marco Rossi', hours: 8, task: 'Armatura pilastri', date: 'Ieri' },
                    { user: 'Giulia Neri', hours: 2, task: 'Sopralluogo', date: 'Ieri' },
                  ].map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-background border border-border">
                      <div>
                        <p className="font-bold text-text-primary text-sm">{log.user}</p>
                        <p className="text-xs text-text-secondary">{log.task} • {log.date}</p>
                      </div>
                      <div className="px-3 py-1 bg-success-bg text-success-text border border-success-border font-bold text-sm rounded-lg">
                        {log.hours}h
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'messages':
        return (
          <div className="h-[600px] bg-card rounded-3xl border border-border shadow-sm flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex-1 overflow-y-auto bg-background/50 p-6 space-y-6">
              <div className="flex justify-center">
                <span className="px-3 py-1 bg-card border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest shadow-sm">Oggi</span>
              </div>
              {/* Reusing TimelineCard for messages in this context for consistency, or standard bubbles */}
              <div className="flex gap-3 px-4">
                <img src="https://i.pravatar.cc/150?u=1" alt="User" className="w-8 h-8 rounded-full border border-border self-end mb-1" referrerPolicy="no-referrer" />
                <div className="max-w-[70%] space-y-1 items-start">
                  <p className="text-[10px] font-bold text-text-secondary ml-1 mb-1">Marco Rossi</p>
                  <div className="p-4 rounded-2xl shadow-sm bg-card text-text-primary border border-border rounded-tl-none">
                    <p className="text-sm leading-relaxed">Buongiorno a tutti. Abbiamo iniziato i lavori sul pilastro A4.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 justify-start">
                    <span className="text-[10px] text-text-secondary font-medium">09:00</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center my-4 px-4">
                <div className="max-w-md w-full p-4 rounded-2xl border flex items-start gap-4 shadow-sm bg-info-bg border-info-border text-info-text">
                  <div className="p-2 rounded-xl bg-card shadow-sm shrink-0 text-info-text">
                    <CheckSquare size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">Nuovo Task Creato: Verifica armatura pilastro A4</p>
                    <div className="mt-2 text-xs opacity-80 grid grid-cols-2 gap-2">
                      <span className="capitalize">assignedTo: Luca Verdi</span>
                      <span className="capitalize">priority: Alta</span>
                    </div>
                    <p className="mt-2 text-[10px] opacity-50">09:05</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-4 flex-row-reverse">
                <div className="max-w-[70%] space-y-1 items-end">
                  <div className="p-4 rounded-2xl shadow-sm bg-accent text-white rounded-tr-none">
                    <p className="text-sm leading-relaxed">Ottimo Marco. Avete bisogno di altro materiale per oggi?</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 justify-end">
                    <span className="text-[10px] text-text-secondary font-medium">09:15</span>
                    <div className="w-3 h-3 flex items-center justify-center text-accent">
                      <CheckCircle2 size={12} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-card border-t border-border">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-full text-[10px] font-bold transition-all border border-border">
                  <Paperclip size={14} /> Allega File
                </button>
                <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-full text-[10px] font-bold transition-all border border-border">
                  <ImageIcon size={14} /> Immagine
                </button>
                <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-success-bg hover:opacity-80 text-success-text rounded-full text-[10px] font-bold transition-all border border-success-border">
                  <Clock size={14} /> Log Ore
                </button>
              </div>
              <div className="flex items-end gap-3 mt-2">
                <div className="flex-1 bg-background border border-border rounded-2xl p-2 focus-within:ring-2 focus-within:ring-accent/20 focus-within:bg-card transition-all">
                  <textarea 
                    placeholder="Scrivi un messaggio al team del progetto..."
                    className="w-full bg-transparent border-none outline-none text-sm p-2 resize-none min-h-[44px] max-h-32 text-text-primary"
                    rows={1}
                  />
                </div>
                <button className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all hover:scale-105 active:scale-95 shrink-0">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Documenti di Progetto</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
                <UploadCloud size={16} /> Carica File
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DOCUMENTS.map(doc => (
                <div key={doc.id} className="bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      doc.type === 'pdf' ? "bg-danger-bg text-danger-text" :
                      doc.type === 'image' ? "bg-info-bg text-info-text" : "bg-success-bg text-success-text"
                    )}>
                      {doc.type === 'image' ? <ImageIcon size={24} /> : <FileText size={24} />}
                    </div>
                    <button className="p-2 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all">
                      <Download size={18} />
                    </button>
                  </div>
                  <p className="font-bold text-text-primary text-sm truncate mb-1">{doc.name}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 text-xs text-text-secondary">
                    <span>{doc.size}</span>
                    <span>{doc.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'warehouse':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Materiali Assegnati</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
                <Plus size={16} /> Richiedi Materiale
              </button>
            </div>
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden p-6">
              <p className="text-text-secondary text-sm">Nessun materiale assegnato a questo progetto al momento.</p>
            </div>
          </div>
        );
      case 'invoices':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-primary">Fatture di Progetto</h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
                <Plus size={16} /> Nuova Fattura
              </button>
            </div>
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden p-6">
              <p className="text-text-secondary text-sm">Nessuna fattura emessa per questo progetto al momento.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-hidden transition-colors duration-300">
      {/* Project Header */}
      <header className="bg-card border-b border-border px-8 pt-8 shrink-0 z-10 shadow-sm">
        {/* Project selector */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            {/* Cantiere selector dropdown */}
            <div className="relative mb-3">
              <button
                onClick={() => setShowSelector(!showSelector)}
                className="flex items-center gap-2 group"
              >
                <h2 className="text-3xl font-bold text-text-primary tracking-tight">
                  {selected?.name ?? 'Seleziona progetto'}
                </h2>
                <span className="px-3 py-1 bg-info-bg text-info-text text-xs font-bold rounded-lg uppercase tracking-wider border border-info-border">
                  {selected?.status ?? '—'}
                </span>
                <ChevronDown size={20} className={cn('text-text-secondary transition-transform', showSelector && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {showSelector && cantieri && cantieri.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-xl z-30 overflow-hidden"
                  >
                    {cantieri.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedId(c.id); setShowSelector(false); }}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-background transition-colors text-left',
                          c.id === selectedId ? 'bg-accent/10 text-accent font-bold' : 'text-text-primary'
                        )}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-text-secondary ml-2 shrink-0">{c.status}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary font-medium">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-text-secondary opacity-60" />
                Budget: €{budget.toLocaleString('it-IT')}
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-text-secondary opacity-60" />
                Costo: €{costoReale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-text-secondary opacity-60" />
                {cantieri?.length ?? 0} {UI_LABELS.module.projects.ui} totali
              </div>
            </div>
          </div>
          {/* Action buttons + Genya import */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Genya import status */}
            {genyaMsg && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs font-medium text-text-secondary bg-card border border-border px-3 py-2 rounded-xl"
              >
                {genyaMsg}
              </motion.span>
            )}

            {/* Importa Genya */}
            <button
              onClick={handleGenyaImport}
              disabled={genyaLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm disabled:opacity-50"
              title={UI_LABELS.module.genya.ui}
            >
              {genyaLoading ? (
                <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
              ) : (
                <DownloadIcon size={16} />
              )}
              {UI_LABELS.module.genya.ui}
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm"
            >
              <FileText size={16} /> Documenti
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm">
              <CheckSquare size={16} /> Nuovo Task
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-success-bg hover:opacity-80 text-success-text rounded-xl text-sm font-bold transition-all border border-success-border shadow-sm">
              <Clock size={16} /> Log Ore
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-danger-bg hover:opacity-80 text-danger-text rounded-xl text-sm font-bold transition-all border border-danger-border shadow-sm">
              <AlertCircle size={16} /> Segnala
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-8 mt-8">
          {TABS.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-4 text-sm font-bold transition-colors relative px-1",
                activeTab === tab.id ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="projectTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {renderTabContent()}
          </AnimatePresence>
        </div>
      </main>

      {shareModalOpen && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          itemToShare={itemToShare}
          onShare={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
}
