import React from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, CheckCircle2, XCircle, Hourglass, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOpsKPIs } from '../../hooks/api/useDashboard';
import Spinner from '../Spinner';
import { DashboardKpiGrid, type DashboardKpiDefinition, type DashboardKpiSectionProps } from './DashboardKpiGrid';

export default function OperationsTab({ kpiControls }: { kpiControls: DashboardKpiSectionProps }) {
  const { data, isLoading, error } = useOpsKPIs();

  if (isLoading) return <Spinner label="Caricamento KPI operativi..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati operativi.</p>;

  const pieData = [
    { name: 'Approvate',   value: data.totalVerified, color: '#10b981' },
    { name: 'Rifiutate',   value: data.totalRejected, color: '#f87171' },
    { name: 'In Attesa',   value: data.totalPending,  color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const formatApproval = (hours: number | null) => {
    if (hours === null) return '—';
    if (hours < 1)  return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}g`;
  };
  const kpiDefinitions: DashboardKpiDefinition[] = [
    { id: 'ops-approval-time', label: 'Tempo Medio Approvaz.', value: formatApproval(data.avgApprovalHours), icon: Clock, tone: 'text-accent', bg: 'bg-accent/10' },
    { id: 'ops-rejection-rate', label: 'Tasso Rifiuto', value: `${data.tassoRifiuto}%`, icon: XCircle, tone: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'ops-approved', label: 'Entry Approvate', value: String(data.totalVerified), icon: CheckCircle2, tone: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'ops-total', label: 'Entry Totali', value: String(data.totalEntries), icon: Activity, tone: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-6">
      <DashboardKpiGrid definitions={[...kpiDefinitions, ...kpiControls.customKpis]} controls={kpiControls} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart distribuzione stati */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={16} className="text-accent" /> Distribuzione Stati Entry
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-text-secondary">{d.name}:</span>
                  <span className="font-bold text-text-primary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metriche dettagliate */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Metriche Processo</h3>
          <div className="space-y-4">
            {/* Time to approval */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex items-center gap-2"><Hourglass size={16} className="text-accent" /><span className="text-sm text-text-secondary">Tempo medio approvazione</span></div>
              <span className="text-lg font-bold text-text-primary">{formatApproval(data.avgApprovalHours)}</span>
            </div>
            {/* Rejection bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-secondary font-bold">Tasso di rifiuto</span>
                <span className={cn('font-bold', data.tassoRifiuto > 10 ? 'text-rose-500' : 'text-emerald-500')}>{data.tassoRifiuto}%</span>
              </div>
              <div className="h-2.5 bg-background rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(data.tassoRifiuto, 100)}%` }} transition={{ duration: 0.8 }}
                  className={cn('h-full rounded-full', data.tassoRifiuto > 10 ? 'bg-rose-500' : 'bg-emerald-500')} />
              </div>
            </div>
            {/* Pending */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-text-secondary">In attesa di revisione</span>
              <span className={cn('text-lg font-bold', data.totalPending > 0 ? 'text-amber-500' : 'text-text-primary')}>{data.totalPending}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
