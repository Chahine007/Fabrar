import React, { useState, useMemo } from 'react';
import { motion, Reorder } from 'motion/react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import { ChevronRight, Settings2, GripVertical, X, Briefcase, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import SmartActionMenu from './SmartActionMenu';
import ShareModal from './ShareModal';
import { useApi } from '../../hooks/useApi';

// ─── API Types ───────────────────────────────────────────────
interface RadarData {
  total_workers: number;
  total_ore: number;
  total_anomalie: number;
  costo_stimato: number;
  cantieri: Array<{ name: string; costo_stimato: number }>;
}

interface Cantiere {
  id: number; name: string; status: string;
  budget: number | null; costo_reale: number | null;
}

interface Report {
  id: number;
  employee_name?: string;
  ore_lavorate: number;
  report_date: string;
  attivita_svolte?: string;
  luogo_cantiere?: string;
  status: string;
}

// ─── Static widget catalog (values injected at runtime) ──────
const WIDGET_IDS = ['revenue', 'projects', 'hours', 'anomalie'] as const;
type WidgetId = typeof WIDGET_IDS[number];

const WIDGET_CATALOG: Record<WidgetId, { title: string }> = {
  revenue:  { title: 'Costo Stimato' },
  projects: { title: 'Cantieri Attivi' },
  hours:    { title: 'Ore Totali' },
  anomalie: { title: 'Anomalie' },
};


const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Completato': 'bg-success-bg text-success-text border border-success-border',
    'In Revisione': 'bg-warning-bg text-warning-text border border-warning-border',
    'In Corso': 'bg-info-bg text-info-text border border-info-border',
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-300", styles[status] || 'bg-slate-100 text-slate-600')}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(['revenue', 'projects', 'hours', 'anomalie']);

  const { data: radar, isLoading: loadingRadar }     = useApi<RadarData>('/api/dashboard/radar');
  const { data: cantieri, isLoading: loadingCantieri } = useApi<Cantiere[]>('/api/cantieri');
  const { data: reports, isLoading: loadingReports }  = useApi<Report[]>('/api/reports');

  // ── Stabilize data arrays ────────────────────────────────
  const cantieriList = useMemo<Cantiere[]>(() => {
    if (!cantieri) return [];
    if (Array.isArray(cantieri)) return cantieri;
    if ((cantieri as any).data && Array.isArray((cantieri as any).data)) return (cantieri as any).data;
    return Object.values(cantieri);
  }, [cantieri]);

  const reportsList = useMemo<Report[]>(() => {
    if (!reports) return [];
    if (Array.isArray(reports)) return reports;
    if ((reports as any).data && Array.isArray((reports as any).data)) return (reports as any).data;
    return Object.values(reports);
  }, [reports]);

  // ── KPI values derived from real data ────────────────────
  const widgetValues = useMemo<Record<WidgetId, { value: string; trend?: string; trendType?: 'positive' | 'negative' }>>(() => ({
    revenue:  { value: radar ? `€${(radar.costo_stimato ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '…' },
    projects: { value: loadingCantieri ? '…' : String(cantieriList.length) },
    hours:    { value: radar ? `${(radar.total_ore ?? 0).toFixed(1)}h` : '…' },
    anomalie: { value: radar ? String(radar.total_anomalie ?? 0) : '…', trendType: 'negative' },
  }), [radar, cantieriList, loadingCantieri]);

  // ── Chart data from cantieri ─────────────────────────────
  const projectStatusData = useMemo(() => {
    const active    = cantieriList.filter(c => c.status === 'active').length;
    const completed = cantieriList.filter(c => c.status === 'completed').length;
    const delayed   = cantieriList.length - active - completed;
    return [
      { name: 'Attivi',     value: active,    color: '#6366f1' },
      { name: 'Completati', value: completed, color: '#22c55e' },
      { name: 'In Ritardo', value: Math.max(0, delayed), color: '#f87171' },
    ].filter(d => d.value > 0);
  }, [cantieriList]);

  // ── Recent activity from reports ─────────────────────────
  const recentActivity = useMemo(() => {
    return reportsList.slice(0, 6).map(r => ({
      id: r.id,
      name: r.employee_name ?? `ID ${r.id}`,
      task: r.attivita_svolte ?? 'Rendicontazione ore',
      time: r.report_date,
      status: r.status === 'verified' ? 'Completato' : r.status === 'rejected' ? 'Rifiutato' : 'In Revisione',
    }));
  }, [reportsList]);

  const toggleWidget = (id: WidgetId) => {
    setActiveWidgets(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  // Share modal kept for future use
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare]       = useState<unknown>(null);
  const handleShare = (item: unknown) => { setItemToShare(item); setShareModalOpen(true); };

  return (
    <div className="p-8 space-y-8">
      {/* Dashboard Header with Edit Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">Panoramica</h2>
        <button 
          onClick={() => setIsEditMode(!isEditMode)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
            isEditMode ? "bg-accent text-white shadow-lg shadow-accent/20" : "bg-card border border-border text-text-secondary hover:bg-background"
          )}
        >
          {isEditMode ? <X size={16} /> : <Settings2 size={16} />}
          {isEditMode ? 'Fine Modifica' : 'Personalizza KPI'}
        </button>
      </div>

      {/* KPI Widgets Area */}
      {isEditMode ? (
        <div className="bg-card border border-border rounded-3xl p-6 space-y-6">
          <h3 className="font-bold text-text-primary">Libreria Widget KPI</h3>
          <p className="text-sm text-text-secondary">Seleziona i widget da mostrare nella tua dashboard. Trascina per riordinare.</p>
          
          <Reorder.Group
            axis="y"
            values={activeWidgets}
            onReorder={setActiveWidgets}
            className="space-y-2"
          >
            {activeWidgets.map(id => {
              const catalog = WIDGET_CATALOG[id];
              const vals    = widgetValues[id];
              return (
                <Reorder.Item
                  key={id}
                  value={id}
                  className="flex items-center justify-between p-4 bg-background border border-border rounded-xl cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical size={16} className="text-text-secondary" />
                    <div>
                      <p className="font-bold text-text-primary">{catalog.title}</p>
                      <p className="text-xs text-text-secondary">{vals.value}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWidget(id)}
                    className="p-2 text-danger-text hover:bg-danger-bg rounded-lg transition-colors"
                  >
                    Rimuovi
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <div className="pt-6 border-t border-border">
            <h4 className="font-bold text-text-primary mb-4 text-sm">Widget Disponibili</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {WIDGET_IDS.filter(w => !activeWidgets.includes(w)).map(id => (
                <div key={id} className="p-4 bg-background border border-border rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-primary text-sm">{WIDGET_CATALOG[id].title}</p>
                  </div>
                  <button
                    onClick={() => toggleWidget(id)}
                    className="p-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-colors"
                  >
                    Aggiungi
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeWidgets.map(id => {
            const catalog = WIDGET_CATALOG[id];
            const vals    = widgetValues[id];
            return (
              <motion.div
                key={id}
                layoutId={`widget-${id}`}
                whileHover={{ y: -4 }}
                className="bg-card p-6 rounded-3xl shadow-sm border border-border flex flex-col justify-between h-full transition-colors duration-300 relative group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-text-secondary font-medium text-sm">{catalog.title}</p>
                  <SmartActionMenu
                    onShare={() => handleShare({ id, ...vals })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-bold text-text-primary">{vals.value}</h3>
                  {vals.trend && (
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded-full",
                      vals.trendType === 'negative'
                        ? "bg-danger-bg text-danger-text border border-danger-border"
                        : "bg-success-bg text-success-text border border-success-border"
                    )}>
                      {vals.trend}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all">
          <Briefcase size={18} /> Nuovo Progetto
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-text-primary rounded-xl font-bold hover:bg-background transition-all">
          <CheckCircle2 size={18} /> Nuovo Task
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-text-primary rounded-xl font-bold hover:bg-background transition-all">
          <Clock size={18} /> Registra Ore
        </button>
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-8">
          {/* Today Section */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-text-primary flex items-center gap-2">
                <AlertCircle size={18} className="text-warning-text" /> Oggi
              </h4>
              <button className="text-accent text-xs font-bold hover:underline">Vedi tutti</button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-danger-bg border border-danger-border flex items-start gap-3">
                <AlertCircle size={16} className="text-danger-text shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-danger-text">Scadenza Progetto Alpha</p>
                  <p className="text-xs text-danger-text opacity-80">Oggi, 18:00</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-warning-bg border border-warning-border flex items-start gap-3">
                <Clock size={16} className="text-warning-text shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-warning-text">Revisione Materiali</p>
                  <p className="text-xs text-warning-text opacity-80">Tra 2 ore</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-info-bg border border-info-border flex items-start gap-3">
                <CheckCircle2 size={16} className="text-info-text shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-info-text">Task: Aggiornamento Server</p>
                  <p className="text-xs text-info-text opacity-80">Assegnato a te</p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Status Chart */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300 relative group">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-text-primary">Stato Progetti</h4>
              <SmartActionMenu 
                onShare={() => handleShare({ title: 'Stato Progetti', type: 'chart' })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5} dataKey="value"
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-2xl font-bold text-text-primary">
                  {loadingCantieri ? '…' : cantieriList.filter(c => c.status === 'active').length}
                </p>
                <p className="text-[10px] text-text-secondary uppercase tracking-wider">Attivi</p>
              </div>
            </div>
          </div>

          {/* Project List */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-text-primary">5 Progetti</h4>
              <button className="text-accent text-xs font-bold hover:underline">Vedi tutti</button>
            </div>
            <div className="space-y-4">
              {loadingCantieri ? (
                <p className="text-sm text-text-secondary text-center py-4">Caricamento...</p>
              ) : cantieriList.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-background transition-colors cursor-pointer group relative">
                  <div>
                    <p className="font-semibold text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-secondary">{c.status}</p>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary opacity-60 group-hover:text-accent transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-5 space-y-8">
          {/* Recent Activity Table */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border h-full transition-colors duration-300 relative group">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-text-primary">Attività Recenti</h4>
              <SmartActionMenu 
                onShare={() => handleShare({ title: 'Attività Recenti', type: 'report' })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                    <th className="pb-4 font-medium">User</th>
                    <th className="pb-4 font-medium">Task description</th>
                    <th className="pb-4 font-medium">Tempo</th>
                    <th className="pb-4 font-medium">Statu</th>
                    <th className="pb-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingReports ? (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-text-secondary">Caricamento...</td></tr>
                  ) : recentActivity.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-text-secondary">Nessuna attività recente.</td></tr>
                  ) : recentActivity.map((activity) => (
                    <tr key={activity.id} className="group/row hover:bg-background/50 transition-colors">
                      <td className="py-4">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                          {activity.name.slice(0, 2).toUpperCase()}
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-sm font-medium text-text-primary">{activity.task}</p>
                      </td>
                      <td className="py-4">
                        <p className="text-xs text-text-secondary">{activity.time}</p>
                      </td>
                      <td className="py-4">
                        <StatusBadge status={activity.status} />
                      </td>
                      <td className="py-4 text-right">
                        <SmartActionMenu
                          onShare={() => handleShare(activity)}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity inline-block"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-3 space-y-8">
          {/* Inventory Chart */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border transition-colors duration-300 relative group">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-text-primary">Magazzino</h4>
              <SmartActionMenu 
                onShare={() => handleShare({ title: 'Magazzino', type: 'report' })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cantieriList.slice(0, 5).map(c => ({ name: (c.name || 'Scon').slice(0, 8), value: c.costo_reale ?? 0 }))}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b8d97' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

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
