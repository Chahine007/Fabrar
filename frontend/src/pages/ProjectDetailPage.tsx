/**
 * ProjectDetailPage.tsx — Dettaglio singolo Cantiere.
 * Rotta: /projects/:id
 * Usato in: App.jsx
 *
 * Refactor completo di ProjectPage.tsx con:
 *   - useParams() per leggere l'ID dalla URL
 *   - React Query (useCantieri, useCantiereDetail, ecc.)
 *   - Tab aggiuntivo "Feed / Log" per il feed Telegram contestuale
 */
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Users, Clock, AlertCircle, CheckSquare, FileText,
  MessageSquare, Plus, ChevronRight, UploadCloud, FileText as FileTextIcon,
  Image as ImageIcon, CheckCircle2, Paperclip, Send, Download,
  Activity, ArrowLeft, Bot, RefreshCw, MessageCircle, Hash, BarChart3, Euro, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix per l'icona del marker di Leaflet in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import SmartActionMenu from '../components/SmartActionMenu';

import ShareModal from '../components/ShareModal';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

import {
  useCantieri, useCantiereDetail, useFinancialTimeline,
  useTasks, useCreateTask, useDocuments, useGenyaImport,
} from '../hooks/api/useCantieri';
import { useTelegramFeed } from '../hooks/api/useTelegramAudit';
import {
  useConversations, useMessages, useSendMessage,
} from '../hooks/api/useConversations';
import {
  useWbsTree, useCreateWbsNode, useUpdateWbsNode, useDeleteWbsNode,
} from '../hooks/api/useWbs';
import { UI_LABELS } from '../lib/labels';
import CantiereSettingsTab from '../components/CantiereSettingsTab';


// ─── Tab Configuration ────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'activities',  label: 'Attività' },
  { id: 'hours',      label: '⏱️ Ore' },
  { id: 'wbs',        label: '⚙️ Struttura / WBS' },
  { id: 'messages',   label: '💬 Messaggi' },
  { id: 'documents',   label: 'Documenti' },
  { id: 'warehouse',   label: 'Magazzino' },
  { id: 'invoices',    label: 'Fatture' },
  { id: 'telegram',    label: '🤖 Feed / Log' },
  { id: 'settings',    label: '⚙️ Impostazioni' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricCard = ({ title, value, sub, trend }: {
  title: string; value: string; sub: string; trend?: 'positive' | 'negative' | 'neutral';
}) => (
  <div className="bg-card p-6 rounded-3xl border border-border shadow-sm transition-colors duration-300">
    <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
    <h3 className="text-3xl font-bold text-text-primary">{value}</h3>
    <p className={cn('text-sm font-medium mt-2',
      trend === 'positive' ? 'text-success-text' :
      trend === 'negative' ? 'text-danger-text' : 'text-text-secondary'
    )}>{sub}</p>
  </div>
);

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const OverviewTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data, isLoading, error, refetch } = useCantiereDetail(cantiereId);

  if (isLoading) return <Spinner label="Caricamento dettagli cantiere..." />;
  if (error || !data) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  const { kpi, perDipendente } = data;
  const avanzamento = kpi.budget > 0 ? Math.min(100, Math.round((kpi.costoTotale / kpi.budget) * 100)) : 0;
  const remaining   = Math.max(0, kpi.budget - kpi.costoTotale);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Avanzamento" value={`${avanzamento}%`}
          sub={avanzamento >= 80 ? 'In linea con i tempi' : 'Monitorare progressi'}
          trend={avanzamento >= 80 ? 'positive' : avanzamento >= 50 ? 'neutral' : 'negative'} />
        <MetricCard title="Budget Residuo" value={`€${remaining.toLocaleString('it-IT')}`}
          sub={`di €${kpi.budget.toLocaleString('it-IT')} totali`}
          trend={remaining > 0 ? 'positive' : 'negative'} />
        <MetricCard title="Costo Reale" value={`€${kpi.costoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          sub={`Manodopera: €${kpi.costoManodopera.toLocaleString('it-IT')} | Mat: €${kpi.costoMateriali.toLocaleString('it-IT')}`}
          trend={kpi.costoTotale <= kpi.budget ? 'positive' : 'negative'} />
      </div>

      <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Activity size={20} /> Ore per Dipendente (Dati Reali)
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {perDipendente.length > 0 ? (
              <div className="space-y-3">
                {perDipendente.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border">
                    <div>
                      <p className="font-bold text-text-primary text-sm">
                        {`${d.nome || ''} ${d.cognome || ''}`.trim() || 'N/D'}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Ultimo log: {d.ultimo_accesso || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-text-primary">{d.ore_tot}h</p>
                      <p className="text-xs text-text-secondary">€{d.costo_calcolato.toLocaleString('it-IT')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm py-4">Nessuna attività registrata.</p>
            )}
          </div>
          
          <div className="flex flex-col h-[350px]">
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Geolocalizzazione Cantiere</h4>
            {data.cantiere.lat && data.cantiere.lng ? (
              <div className="flex-1 rounded-2xl overflow-hidden border border-border shadow-inner relative z-0">
                <MapContainer 
                  center={[data.cantiere.lat, data.cantiere.lng]} 
                  zoom={15} 
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <Marker position={[data.cantiere.lat, data.cantiere.lng]}>
                    <Popup>{data.cantiere.nome}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="flex-1 rounded-2xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary text-sm">
                 <AlertCircle className="mb-2 opacity-50" size={32} />
                 <span>Coordinate GPS non impostate.</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

// ─── Tab: Attività (Tasks) ────────────────────────────────────────────────────

const ActivitiesTab = ({ cantiereId, onShare }: { cantiereId: number; onShare: (item: unknown) => void }) => {
  const { data: tasks, isLoading, error, refetch } = useTasks(cantiereId);
  const createTask = useCreateTask(cantiereId);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAdd = async () => {
    if (!newTaskTitle.trim() || createTask.isPending) return;
    try {
      await createTask.mutateAsync(newTaskTitle.trim());
      setNewTaskTitle('');
    } catch {
      alert('Errore durante la creazione del task.');
    }
  };

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento task..." /></div>;
  if (error || !tasks) return <div className="py-12"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Task di Progetto</h3>
        <button
          onClick={() => document.getElementById('quick-task-input')?.focus()}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} /> Nuovo Task
        </button>
      </div>

      <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex gap-3 items-center">
        <div className="p-2 bg-background rounded-xl text-text-secondary"><Plus size={20} /></div>
        <input
          id="quick-task-input"
          type="text"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          disabled={createTask.isPending}
          placeholder="Aggiungi un task... (es. Verifica materiali settore C)"
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-text-primary placeholder:text-text-secondary"
        />
        <button
          onClick={handleAdd}
          disabled={createTask.isPending || !newTaskTitle.trim()}
          className="px-4 py-2 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          {createTask.isPending ? '...' : 'Aggiungi'}
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
            {tasks.map(task => (
              <tr key={task.id} className="hover:bg-background/50 transition-colors group">
                <td className="p-4 font-semibold text-text-primary">{task.title}</td>
                <td className="p-4 text-sm text-text-secondary">{task.assignee}</td>
                <td className="p-4 text-sm text-text-secondary">{task.due}</td>
                <td className="p-4">
                  <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold',
                    task.priority === 'Alta' ? 'bg-danger-bg text-danger-text border border-danger-border' : 'bg-warning-bg text-warning-text border border-warning-border'
                  )}>{task.priority}</span>
                </td>
                <td className="p-4">
                  <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold',
                    task.status === 'Completato' ? 'bg-success-bg text-success-text border border-success-border' :
                    task.status === 'In Corso' ? 'bg-info-bg text-info-text border border-info-border' :
                    'bg-background text-text-secondary'
                  )}>{task.status}</span>
                </td>
                <td className="p-4 text-right">
                  <SmartActionMenu onShare={() => onShare(task)} className="opacity-0 group-hover:opacity-100 transition-opacity inline-block mr-2" />
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
};

// ─── Tab: Ore (Financial) ─────────────────────────────────────────────────────

const HoursTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data, isLoading, error, refetch } = useFinancialTimeline(cantiereId);

  if (isLoading) return <Spinner label="Caricamento dati finanziari..." />;
  if (error || !data) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  const chartData = data.months.map((month, i) => ({
    name: month,
    'Costo Mensile': data.costoPerMese[i],
    'Costo Cumulativo': data.costoReale[i],
  }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-xl font-bold text-text-primary">Riepilogo Finanziario</h3>
      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
        <h4 className="font-bold text-text-primary mb-6">Andamento Costi Mensili</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'var(--background)' }}
                contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                formatter={(value: unknown) => `€${Number(value).toLocaleString('it-IT')}`}
              />
              <Bar dataKey="Costo Mensile" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Documenti ───────────────────────────────────────────────────────────

const DocumentsTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data: docs, isLoading, error, refetch } = useDocuments(cantiereId);

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento documenti..." /></div>;
  if (error || !docs) return <div className="py-12"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Documenti di Progetto</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
          <UploadCloud size={16} /> Carica File
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map(doc => (
          <div key={doc.id} className="bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className={cn('p-3 rounded-xl', doc.type === 'pdf' ? 'bg-danger-bg text-danger-text' : doc.type === 'image' ? 'bg-info-bg text-info-text' : 'bg-success-bg text-success-text')}>
                {doc.type === 'image' ? <ImageIcon size={24} /> : <FileTextIcon size={24} />}
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
      {docs.length === 0 && (
        <div className="text-center py-12 text-text-secondary text-sm">Nessun documento caricato per questo cantiere.</div>
      )}
    </div>
  );
};

// ─── Tab: Feed / Log Telegram (contestuale per cantiere) ─────────────────────

const TelegramFeedTab = ({ cantiereId }: { cantiereId: number }) => {
  const { feed, logs, isLoading, error, refetch } = useTelegramFeed({ cantiereId });

  const typeBadge = (type: string, method: string) => {
    const m = (method ?? '').toLowerCase();
    if (m.includes('gps'))  return { label: '📍 GPS',   cls: 'bg-info-bg text-info-text border-info-border' };
    if (m.includes('audio')) return { label: '🎙️ Vocale', cls: 'bg-warning-bg text-warning-text border-warning-border' };
    if (m.includes('ocr'))  return { label: '🖼️ Foto',   cls: 'bg-indigo-900/30 text-indigo-400 border-indigo-700/40' };
    if (type === 'ore')     return { label: '🕐 Ore',    cls: 'bg-success-bg text-success-text border-success-border' };
    if (type === 'spese')   return { label: '💶 Spesa',  cls: 'bg-danger-bg text-danger-text border-danger-border' };
    return { label: '💬 Log', cls: 'bg-background text-text-secondary border-border' };
  };

  const statusBadge = (status: string) => {
    if (status === 'verified') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-bg text-success-text border border-success-border">✅ Approvato</span>;
    if (status === 'rejected') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-bg text-danger-text border border-danger-border">❌ Rifiutato</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-text border border-warning-border">⏳ In Attesa</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Bot size={20} className="text-accent" /> Feed Telegram — Cantiere
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            Ore e spese registrate dal Bot per questo cantiere. &nbsp;
            <a href="/hr/audit" className="text-accent hover:underline font-medium">→ Vista globale</a>
          </p>
        </div>
        <button onClick={refetch} className="p-2 rounded-xl border border-border text-text-secondary hover:bg-background transition-all" title="Aggiorna">
          <RefreshCw size={16} />
        </button>
      </div>

      {isLoading ? (
        <Spinner label="Caricamento feed Telegram..." />
      ) : error ? (
        <ErrorMessage error={error} onRetry={refetch} />
      ) : feed.length === 0 ? (
        <div className="text-center py-16">
          <Bot size={40} className="mx-auto text-text-secondary opacity-30 mb-3" />
          <p className="text-text-secondary text-sm">Nessun dato Telegram registrato per questo cantiere.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-left">Dipendente</th>
                  <th className="px-5 py-3 text-left">Data</th>
                  <th className="px-5 py-3 text-left">Valore</th>
                  <th className="px-5 py-3 text-left">Note</th>
                  <th className="px-5 py-3 text-left">Stato</th>
                </tr>
              </thead>
              <tbody>
                {feed.map(entry => {
                  const badge = typeBadge(entry.type, entry.input_method);
                  return (
                    <tr key={`${entry.type}-${entry.id}`} className="border-b border-border/50 hover:bg-background/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-text-primary">
                        {`${entry.nome ?? ''} ${entry.cognome ?? ''}`.trim() || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {new Date(entry.date).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-text-primary">
                        {entry.type === 'ore' ? `${entry.value}h` : `€${Number(entry.value).toLocaleString('it-IT')}`}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary max-w-[180px] truncate">
                        {entry.note ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {statusBadge(entry.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Messaggi (Reale — Sprint 3) ───────────────────────────────────────

const MessagesTab = ({ cantiereId, cantierNome }: { cantiereId: number; cantierNome: string }) => {
  // Trova la conversazione associata al cantiere (matchando per nome contestuale)
  const { data: conversations, isLoading: loadingConv } = useConversations();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cerca conversazione associata al cantiere (per nome o ID)
  const conversation = conversations?.find(c =>
    c.name?.toLowerCase().includes(cantierNome.toLowerCase()) ||
    c.name?.toLowerCase().includes(`cantiere ${cantiereId}`) ||
    c.type === 'cantiere'
  ) ?? conversations?.[0] ?? null; // fallback alla prima se nessuna corrisponde

  const conversationId = conversation?.id ?? null;
  const { data: messages, isLoading: loadingMsgs, error } = useMessages(conversationId);
  const sendMsg = useSendMessage(conversationId ?? '');

  const [input, setInput] = useState('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendMsg.isPending || !conversationId) return;
    setInput('');
    try {
      await sendMsg.mutateAsync({ content: text });
    } catch {
      // messaggio fallito — potremmo aggiungere un toast in futuro
    }
  };

  if (loadingConv) return <div className="py-12"><Spinner label="Caricamento conversazioni..." /></div>;

  if (!conversationId) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center gap-4 bg-card rounded-3xl border border-border shadow-sm animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center border border-border">
          <MessageCircle size={28} className="text-text-secondary opacity-40" />
        </div>
        <p className="font-semibold text-text-primary">Nessuna conversazione attiva</p>
        <p className="text-sm text-text-secondary max-w-xs text-center opacity-70">
          Non è disponibile una conversazione collegata a questo cantiere.
          Crea una conversazione dalla pagina Messaggi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[580px] bg-card rounded-3xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header conversazione */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <Hash size={16} className="text-accent" />
        </div>
        <div>
          <p className="font-bold text-text-primary text-sm">{conversation.name}</p>
          <p className="text-[11px] text-text-secondary">
            Aggiornamento automatico ogni 5s
          </p>
        </div>
      </div>

      {/* Area messaggi */}
      <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar space-y-4">
        {loadingMsgs ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : error ? (
          <ErrorMessage error={(error as Error).message} onRetry={() => {}} />
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-2 py-8">
            <MessageSquare size={32} className="opacity-20" />
            <p className="text-sm">Nessun messaggio</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 items-end',
                msg.isMe ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold text-white',
                msg.isMe ? 'bg-accent' : 'bg-indigo-500'
              )}>
                {(msg.senderName ?? '?').charAt(0).toUpperCase()}
              </div>
              {/* Bubble */}
              <div className={cn(
                'max-w-[72%] px-4 py-2.5 rounded-2xl text-sm shadow-sm',
                msg.isMe
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-background text-text-primary border border-border rounded-bl-sm'
              )}>
                {!msg.isMe && (
                  <p className="text-[10px] font-bold text-accent mb-1">{msg.senderName}</p>
                )}
                <p className="leading-relaxed break-words">{msg.content}</p>
                <p className={cn(
                  'text-[10px] mt-1 text-right',
                  msg.isMe ? 'text-white/60' : 'text-text-secondary'
                )}>
                  {new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 bg-background border border-border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <button className="p-1 text-text-secondary hover:text-accent transition-colors">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Scrivi un messaggio..."
            disabled={sendMsg.isPending}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-secondary disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || sendMsg.isPending}
            className="p-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-accent/20"
          >
            {sendMsg.isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={16} />}
          </motion.button>
        </div>
        {sendMsg.error && (
          <p className="text-xs text-danger-text mt-1 px-2">
            ❌ {(sendMsg.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Tab: WBS (Job Costing Engine — Sprint 4) ─────────────────────────────

const WbsNodeRow = ({ 
  node, 
  depth, 
  onAddSub, 
  onUpdate, 
  onDelete 
}: { 
  node: any, 
  depth: number, 
  onAddSub: (id: number) => void,
  onUpdate: (id: number, fields: any) => void,
  onDelete: (id: number) => void
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(node.nome);
  const [editBudget, setEditBudget] = useState(node.budget_preventivato?.toString() ?? '');

  const handleSave = () => {
    onUpdate(node.id, { 
      nome: editNome, 
      budget_preventivato: editBudget === '' ? null : parseFloat(editBudget) 
    });
    setIsEditing(false);
  };

  const pct = node.avanzamento_pct;
  const statusColor = !pct ? 'bg-border' : pct > 100 ? 'bg-danger-text' : pct > 85 ? 'bg-amber-500' : 'bg-success-text';

  return (
    <div className="space-y-2">
      <div 
        className={cn(
          "group flex items-center justify-between p-4 rounded-2xl border transition-all",
          depth === 0 ? "bg-accent/5 border-accent/20" : "bg-card border-border hover:border-accent/30",
          node.parent_id === null ? "ml-0" : depth === 1 ? "ml-8" : "ml-16"
        )}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            depth === 0 ? "bg-accent text-white" : "bg-background text-text-secondary border border-border"
          )}>
            {depth === 0 ? <Building2 size={20} /> : depth === 1 ? <Activity size={18} /> : <Hash size={16} />}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <input 
                autoFocus
                className="bg-background border border-accent rounded-lg px-2 py-1 text-sm outline-none w-full max-w-[200px]"
                value={editNome}
                onChange={e => setEditNome(e.target.value)}
              />
              <div className="relative">
                <Euro size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input 
                  className="bg-background border border-accent rounded-lg pl-6 pr-2 py-1 text-sm outline-none w-24"
                  type="number"
                  placeholder="Budget"
                  value={editBudget}
                  onChange={e => setEditBudget(e.target.value)}
                />
              </div>
              <button onClick={handleSave} className="p-1 px-2 bg-accent text-white rounded-lg text-xs font-bold">Salva</button>
              <button onClick={() => setIsEditing(false)} className="p-1 px-2 bg-background border border-border rounded-lg text-xs">X</button>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-text-primary">{node.nome}</p>
                {node.is_variant && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold uppercase">Variante</span>}
              </div>
              <div className="flex items-center gap-4 mt-0.5 text-xs text-text-secondary">
                <span className="flex items-center gap-1"><Euro size={12} /> Prev: <b>{node.budget_preventivato ? node.budget_preventivato.toLocaleString() : '-'}</b></span>
                <span className="flex items-center gap-1 font-medium text-text-primary"><Activity size={12} /> Real: <b>{node.burn.totale.toLocaleString()} €</b></span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {pct !== null && (
            <div className="hidden md:block w-32">
              <div className="flex items-center justify-between text-[10px] mb-1 font-bold italic">
                <span>Burn Rate</span>
                <span className={pct > 100 ? "text-danger-text" : "text-text-primary"}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-background border border-border rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  className={cn("h-full rounded-full transition-colors", statusColor)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {depth < 2 && (
              <button 
                onClick={() => onAddSub(node.id)}
                className="p-2 text-text-secondary hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                title="Aggiungi sottofase"
              >
                <Plus size={18} />
              </button>
            )}
            <button 
              onClick={() => setIsEditing(true)}
              className="p-2 text-text-secondary hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <RefreshCw size={18} />
            </button>
            {node.parent_id !== null && (
              <button 
                onClick={() => onDelete(node.id)}
                className="p-2 text-text-secondary hover:text-danger-text hover:bg-danger-bg rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {node.children?.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child: any) => (
            <WbsNodeRow 
              key={child.id} 
              node={child} 
              depth={depth + 1} 
              onAddSub={onAddSub}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const WbsTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data: tree, isLoading, error } = useWbsTree(cantiereId);
  const createMut = useCreateWbsNode(cantiereId);
  const updateMut = useUpdateWbsNode(cantiereId);
  const deleteMut = useDeleteWbsNode(cantiereId);

  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootNome, setNewRootNome] = useState('');

  const handleAddNode = async (parentId: number | null, nome: string) => {
    try {
      await createMut.mutateAsync({ 
        nome: nome || "Nuova Fase", 
        parent_id: parentId,
        budget_preventivato: 0
      });
      setIsAddingRoot(false);
      setNewRootNome('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (nodeId: number, fields: any) => {
    try {
      await updateMut.mutateAsync({ nodeId, ...fields });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (nodeId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questa fase? L'operazione fallirà se ci sono costi o sottofasi collegate.")) return;
    try {
      await deleteMut.mutateAsync(nodeId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento struttura WBS..." /></div>;
  if (error) return <ErrorMessage error={(error as Error).message} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-text-primary">The Job Costing Engine</h3>
          <p className="text-sm text-text-secondary">Analisi granulare dei costi per fase (WBS)</p>
        </div>
        <button 
          onClick={() => setIsAddingRoot(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
        >
          <Plus size={16} /> Aggiungi Fase Root
        </button>
      </div>

      <AnimatePresence>
        {isAddingRoot && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-background p-4 rounded-2xl border-2 border-dashed border-accent/30">
              <input 
                autoFocus
                placeholder="Nome nuova fase root..."
                className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                value={newRootNome}
                onChange={e => setNewRootNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNode(null, newRootNome)}
              />
              <button 
                onClick={() => handleAddNode(null, newRootNome)}
                className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-bold"
              >
                Conferma
              </button>
              <button onClick={() => setIsAddingRoot(false)} className="text-text-secondary"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {tree?.map((node: any) => (
          <WbsNodeRow 
            key={node.id} 
            node={node} 
            depth={0} 
            onAddSub={(pid) => handleAddNode(pid, "Nuova Sottofase")}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        {(!tree || tree.length === 0) && (
          <div className="py-20 text-center text-text-secondary italic">
            Nessuna fase definita. Clicca su "Aggiungi Fase Root" per iniziare.
          </div>
        )}
      </div>

      <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
        <h4 className="font-bold text-text-primary mb-6 flex items-center gap-2">
          <BarChart3 size={18} className="text-accent" /> Confronto Preventivo vs Reale
        </h4>
        {tree && tree.length > 0 ? (
          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tree}>
                <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="budget_preventivato" name="Preventivo" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="burn.totale" name="Costo Reale" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-2xl text-text-secondary text-sm">
            Nessun dato grafico disponibile
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Warehouse (Magazzino) ───────────────────────────────────────────────

import { usePricebook, useCantiereMaterials, useAddMaterialToCantiere } from '../hooks/api/useWarehouse';

const WarehouseTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data: materials, isLoading, error } = useCantiereMaterials(cantiereId);
  const { data: pricebook } = usePricebook();
  const { data: tree } = useWbsTree(cantiereId);
  const addMaterial = useAddMaterialToCantiere(cantiereId);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [wbsNode, setWbsNode] = useState<string>('');

  const handleAdd = async () => {
    if (!selectedMaterial || !quantity) return;
    const material = pricebook?.find((p: any) => p.id.toString() === selectedMaterial);
    if (!material) return;

    try {
      await addMaterial.mutateAsync({
        pricebook_id: material.id,
        quantita: parseFloat(quantity),
        importo: parseFloat(quantity) * parseFloat(material.costo_unitario),
        wbs_node_id: wbsNode ? parseInt(wbsNode, 10) : undefined,
      });
      setIsDrawerOpen(false);
      setSelectedMaterial('');
      setQuantity('1');
      setWbsNode('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) return <Spinner label="Caricamento magazzino..." />;
  if (error || !materials) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} />;

  /** Helper to flatten the WBS tree for the select box */
  const getFlatWbs = (nodes: any[], depth = 0): any[] => {
    return nodes.reduce((acc, node) => [
      ...acc, 
      { id: node.id, nome: `${'—'.repeat(depth)} ${node.nome}` }, 
      ...(node.children ? getFlatWbs(node.children, depth + 1) : [])
    ], []);
  };
  const flatWbs = tree ? getFlatWbs(tree) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Materiali di Cantiere</h3>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} /> Preleva dal Magazzino
        </button>
      </div>

      {isDrawerOpen && (
        <div className="bg-card p-6 rounded-3xl border border-border flex flex-col gap-4 mb-6 shadow-sm">
          <h4 className="font-bold border-b border-border pb-2">Nuovo Prelievo Materiale</h4>
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="flex-1 min-w-[200px] p-2 bg-background border border-border rounded-xl text-sm outline-none"
            >
              <option value="">-- Seleziona Materiale --</option>
              {pricebook?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nome} (€{p.costo_unitario}/{p.unita})</option>
              ))}
            </select>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantità"
              className="w-24 p-2 bg-background border border-border rounded-xl text-sm outline-none"
            />
            <select
              value={wbsNode}
              onChange={(e) => setWbsNode(e.target.value)}
              className="flex-1 min-w-[200px] p-2 bg-background border border-border rounded-xl text-sm outline-none"
            >
              <option value="">-- Assegna a WBS (Opzionale) --</option>
              {flatWbs.map((w: any) => (
                <option key={w.id} value={w.id}>{w.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Annulla</button>
            <button onClick={handleAdd} disabled={addMaterial.isPending} className="px-4 py-2 text-sm bg-accent text-white rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50">
              {addMaterial.isPending ? 'Salvataggio...' : 'Conferma Prelievo'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-background border-b border-border">
            <tr className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              <th className="p-4">Materiale</th>
              <th className="p-4">Quantità</th>
              <th className="p-4">Costo Tot.</th>
              <th className="p-4">WBS Associata</th>
              <th className="p-4">Data Prelievo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {materials.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-text-secondary">Nessun materiale prelevato.</td></tr>
            ) : materials.map((m: any) => (
              <tr key={m.id} className="hover:bg-background/50">
                <td className="p-4 font-semibold text-text-primary">{m.pricebook?.nome}</td>
                <td className="p-4 text-text-secondary">{m.quantita} {m.pricebook?.unita}</td>
                <td className="p-4 font-bold text-text-primary">€{parseFloat(m.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                <td className="p-4">
                   <span className={cn("px-2 py-1 rounded-md text-xs font-bold", m.wbs_node ? "bg-accent/10 text-accent border border-accent/20" : "bg-background text-text-secondary")}>
                       {m.wbs_node ? m.wbs_node.nome : "—"}
                   </span>
                </td>
                <td className="p-4 text-text-secondary">{new Date(m.timestamp_utc).toLocaleDateString('it-IT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Tab: Invoices (Fatture) ──────────────────────────────────────────────────

const InvoicesTab = ({ cantiereId }: { cantiereId: number }) => {
  const { data: invoices, isLoading, error, refetch } = useDocuments(cantiereId, 'invoice');
  
  if (isLoading) return <Spinner label="Caricamento fatture..." />;
  if (error) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Fatture e DDT</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors">
          <UploadCloud size={16} /> Carica Fattura
        </button>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex flex-col gap-4">
        {(!invoices || invoices.length === 0) ? (
           <div className="py-12 flex flex-col items-center justify-center text-text-secondary border-2 border-dashed border-border rounded-2xl">
              <FileTextIcon size={48} className="mb-4 opacity-50" />
              <p>Nessuna fattura presente per questo cantiere.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="p-4 border border-border rounded-2xl bg-background hover:border-accent/40 transition-colors group cursor-pointer">
                 <div className="flex items-start gap-4">
                    <div className="p-3 bg-accent/10 text-accent rounded-xl">
                      <FileTextIcon size={24} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-text-primary text-sm truncate" title={inv.name}>{inv.name}</h4>
                      <p className="text-xs text-text-secondary mt-1">{inv.size} • {new Date(inv.created_at).toLocaleDateString('it-IT')}</p>
                      {inv.numero_fattura && <p className="text-xs font-bold text-text-primary mt-1">Fattura n. {inv.numero_fattura}</p>}
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cantiereId = id ? parseInt(id, 10) : null;

  const { data: cantieri, isLoading: loadingList } = useCantieri();
  const genyaImport = useGenyaImport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<unknown>(null);

  const cantiere = cantieri?.find(c => c.id === cantiereId) ?? null;

  const handleShare = (item: unknown) => { setItemToShare(item); setShareModalOpen(true); };

  const handleGenyaImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await genyaImport.mutateAsync(file);
      alert(`✅ Importate ${result.inserted ?? '?'} spese da ${file.name}`);
    } catch (err: unknown) {
      alert(`❌ ${err instanceof Error ? err.message : 'Errore import'}`);
    }
    e.target.value = '';
  };

  if (loadingList && !cantiere) return <Spinner fullScreen label="Caricamento progetto..." />;

  if (cantiereId === null || isNaN(cantiereId)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-secondary">ID progetto non valido.</p>
        <button onClick={() => navigate('/projects')} className="text-accent hover:underline text-sm">← Torna ai Progetti</button>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewTab cantiereId={cantiereId} />;
      case 'activities': return <ActivitiesTab cantiereId={cantiereId} onShare={handleShare} />;
      case 'hours':      return <HoursTab cantiereId={cantiereId} />;
      case 'wbs':        return <WbsTab cantiereId={cantiereId} />;
      case 'messages':   return <MessagesTab cantiereId={cantiereId} cantierNome={cantiere?.nome ?? ''} />;
      case 'documents':  return <DocumentsTab cantiereId={cantiereId} />;
      case 'warehouse':  return <WarehouseTab cantiereId={cantiereId} />;
      case 'invoices':   return <InvoicesTab cantiereId={cantiereId} />;
      case 'telegram':   return <TelegramFeedTab cantiereId={cantiereId} />;
      case 'settings':   return <CantiereSettingsTab cantiereId={cantiereId} />;
      default:           return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-hidden transition-colors duration-300">
      {/* Project Header */}
      <header className="bg-card border-b border-border px-8 pt-6 shrink-0 z-10 shadow-sm">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 hover:text-accent transition-colors font-medium"
          >
            <ArrowLeft size={14} /> Tutti i Progetti
          </button>
          <span>/</span>
          <span className="text-text-primary font-semibold truncate">{cantiere?.nome ?? `Cantiere #${cantiereId}`}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Info Cantiere */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-text-primary tracking-tight">
                {cantiere?.nome ?? `Cantiere #${cantiereId}`}
              </h2>
              {cantiere?.status && (
                <span className="px-3 py-1 bg-info-bg text-info-text text-xs font-bold rounded-lg uppercase tracking-wider border border-info-border">
                  {cantiere.status}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary font-medium">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="opacity-60" />
                Budget: €{(cantiere?.budget ?? 0).toLocaleString('it-IT')}
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="opacity-60" />
                Costo: €{(cantiere?.costo_reale ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {genyaImport.data && (
              <span className="text-xs font-medium text-text-secondary bg-card border border-border px-3 py-2 rounded-xl">
                ✅ Importate {genyaImport.data.inserted} spese
              </span>
            )}
            {genyaImport.error && (
              <span className="text-xs font-medium text-danger-text bg-danger-bg border border-danger-border px-3 py-2 rounded-xl">
                ❌ {(genyaImport.error as Error).message}
              </span>
            )}

            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />
            <button
              onClick={handleGenyaImport}
              disabled={genyaImport.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm disabled:opacity-50"
              title={UI_LABELS.module.genya.ui}
            >
              {genyaImport.isPending
                ? <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
                : <Download size={16} />}
              {UI_LABELS.module.genya.ui}
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm"
            >
              <FileText size={16} /> Documenti
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-background text-text-primary rounded-xl text-sm font-bold transition-all border border-border shadow-sm"
            >
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
        <div className="flex items-center gap-8 mt-8 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-4 text-sm font-bold transition-colors relative px-1 whitespace-nowrap shrink-0',
                activeTab === tab.id ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="projectDetailTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {renderTab()}
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
