import React, { useState } from 'react';
import { motion, Reorder } from 'motion/react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import { ChevronRight, Settings2, GripVertical, X, Briefcase, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import SmartActionMenu from './SmartActionMenu';
import ShareModal from './ShareModal';

// Mock Data
const PROJECT_STATUS_DATA = [
  { name: 'In Corso', value: 60, color: '#1e2139' },
  { name: 'Completati', value: 30, color: '#6366f1' },
  { name: 'In Ritardo', value: 10, color: '#f87171' },
];

const RECENT_ACTIVITY = [
  { user: { name: 'Marco Rossi', avatar: 'https://i.pravatar.cc/150?u=1' }, task: 'Getto calcestruzzo pilastro A4', time: '10 min', status: 'Completato' },
  { user: { name: 'Elena Bianchi', avatar: 'https://i.pravatar.cc/150?u=2' }, task: 'Revisione planimetria settore B', time: '10 min', status: 'In Revisione' },
  { user: { name: 'Luca Verdi', avatar: 'https://i.pravatar.cc/150?u=3' }, task: 'Ordine materiale isolante', time: '20 min', status: 'In Revisione' },
];

const INVENTORY_DATA = [
  { name: 'Prodotto A', value: 3 },
  { name: 'B', value: 4 },
  { name: 'C', value: 2 },
];

const PROJECTS = [
  { name: 'App Mobile', date: '10/2023' },
  { name: 'Sito Web', date: '10/2023' },
  { name: 'Marketing Plan', date: '11/2023' },
];

const WIDGET_LIBRARY = [
  { id: 'revenue', title: 'Ricavi Mensili', value: '€245,600', trend: '+12.5%', trendType: 'positive' },
  { id: 'projects', title: 'Progetti Attivi', value: '18' },
  { id: 'invoices', title: 'Fatture Insolute', value: '7', trend: '-2', trendType: 'positive' },
  { id: 'clients', title: 'Nuovi Clienti', value: '12', trend: '+3', trendType: 'positive' },
  { id: 'hours', title: 'Ore Lavorate', value: '1,240h', trend: '+5%', trendType: 'positive' },
  { id: 'tasks', title: 'Task Completati', value: '342', trend: '+12', trendType: 'positive' },
  { id: 'issues', title: 'Problemi Aperti', value: '4', trend: '-1', trendType: 'positive' },
  { id: 'progress', title: 'Progresso Globale', value: '68%', trend: '+2%', trendType: 'positive' },
];

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
  const [activeWidgets, setActiveWidgets] = useState(['revenue', 'projects', 'invoices', 'clients']);
  
  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);

  const handleShare = (item: any) => {
    setItemToShare(item);
    setShareModalOpen(true);
  };

  const handleExecuteShare = (convId: string, message: string, item: any) => {
    console.log('Sharing to', convId, 'Message:', message, 'Item:', item);
    // In a real app, this would dispatch to a global store or API
    // For now, we'll just log it. The user requested it appears in chat, 
    // which we'll handle by simulating a shared state or just showing a success toast.
    alert(`Condiviso con successo! (Simulazione)`);
  };

  const toggleWidget = (id: string) => {
    if (activeWidgets.includes(id)) {
      setActiveWidgets(activeWidgets.filter(w => w !== id));
    } else {
      setActiveWidgets([...activeWidgets, id]);
    }
  };

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
              const widget = WIDGET_LIBRARY.find(w => w.id === id)!;
              return (
                <Reorder.Item 
                  key={id} 
                  value={id}
                  className="flex items-center justify-between p-4 bg-background border border-border rounded-xl cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical size={16} className="text-text-secondary" />
                    <div>
                      <p className="font-bold text-text-primary">{widget.title}</p>
                      <p className="text-xs text-text-secondary">{widget.value}</p>
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
              {WIDGET_LIBRARY.filter(w => !activeWidgets.includes(w.id)).map(widget => (
                <div key={widget.id} className="p-4 bg-background border border-border rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-primary text-sm">{widget.title}</p>
                  </div>
                  <button 
                    onClick={() => toggleWidget(widget.id)}
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
            const widget = WIDGET_LIBRARY.find(w => w.id === id)!;
            return (
              <motion.div 
                key={id}
                layoutId={`widget-${id}`}
                whileHover={{ y: -4 }}
                onClick={() => console.log('Navigate to filtered data for', widget.id)}
                className="bg-card p-6 rounded-3xl shadow-sm border border-border flex flex-col justify-between h-full transition-colors duration-300 relative group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-text-secondary font-medium text-sm">{widget.title}</p>
                  <SmartActionMenu 
                    onShare={() => handleShare(widget)}
                    onViewDetails={() => console.log('View details', widget.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-2xl font-bold text-text-primary">{widget.value}</h3>
                  {widget.trend && (
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded-full",
                      widget.trendType === 'positive' ? "bg-success-bg text-success-text border border-success-border" : "bg-danger-bg text-danger-text border border-danger-border"
                    )}>
                      {widget.trend}
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
                    data={PROJECT_STATUS_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {PROJECT_STATUS_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-2xl font-bold text-text-primary">60%</p>
                <p className="text-[10px] text-text-secondary uppercase tracking-wider">In Corso</p>
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
              {PROJECTS.map((project) => (
                <div key={project.name} className="flex items-center justify-between p-3 rounded-2xl hover:bg-background transition-colors cursor-pointer group relative">
                  <div>
                    <p className="font-semibold text-text-primary">{project.name}</p>
                    <p className="text-xs text-text-secondary">{project.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SmartActionMenu 
                      onShare={() => handleShare(project)}
                      onLinkProject={() => console.log('Link project', project.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    <ChevronRight size={18} className="text-text-secondary opacity-60 group-hover:text-accent transition-colors" />
                  </div>
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
                  {RECENT_ACTIVITY.map((activity, idx) => (
                    <tr key={idx} className="group/row hover:bg-background/50 transition-colors">
                      <td className="py-4">
                        <img 
                          src={activity.user.avatar} 
                          alt={activity.user.name} 
                          className="w-8 h-8 rounded-full border border-border"
                          referrerPolicy="no-referrer"
                        />
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
                          onShare={() => handleShare({ title: activity.task, value: activity.status, type: 'task' })}
                          onCreateTask={() => console.log('Create task from', activity.task)}
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
                <BarChart data={INVENTORY_DATA}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b8d97' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <ShareModal 
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        itemToShare={itemToShare}
        onShare={handleExecuteShare}
      />
    </div>
  );
}
