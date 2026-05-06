import React from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Euro, Users, Target } from 'lucide-react';
import { useHrKPIs } from '../../hooks/api/useDashboard';
import Spinner from '../Spinner';
import { DashboardKpiGrid, type DashboardKpiDefinition, type DashboardKpiSectionProps } from './DashboardKpiGrid';

const fmt = (v: number) => `€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;

export default function HrTab({ kpiControls }: { kpiControls: DashboardKpiSectionProps }) {
  const { data, isLoading, error } = useHrKPIs();

  if (isLoading) return <Spinner label="Caricamento KPI HR..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati HR.</p>;

  const pieData = [
    { name: 'Fatturabili (WBS)', value: data.oreConWbs, color: '#6366f1' },
    { name: 'Non Fatturabili',   value: Math.max(0, data.oreTotaliMese - data.oreConWbs), color: '#e2e8f0' },
  ].filter(d => d.value > 0);
  const kpiDefinitions: DashboardKpiDefinition[] = [
    { id: 'hr-hourly-cost', label: 'Costo Orario Medio', value: `€${data.costoOrarioMedio.toFixed(2)}/h`, icon: Euro, tone: 'text-accent', bg: 'bg-accent/10' },
    { id: 'hr-month-hours', label: 'Ore Mese Corrente', value: `${data.oreTotaliMese}h`, icon: Clock, tone: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'hr-month-cost', label: 'Costo HR Mese', value: fmt(data.costoHrMese), icon: Euro, tone: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'hr-rated-employees', label: 'Dipendenti con Tariffa', value: String(data.dipendentiConTariffa), icon: Users, tone: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6">
      <DashboardKpiGrid definitions={[...kpiDefinitions, ...kpiControls.customKpis]} controls={kpiControls} />

      {/* Ore Fatturabili */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Target size={16} className="text-accent" /> Ore Fatturabili vs Totali
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}h`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-text-primary">{data.pctFatturabili}%</p>
                <p className="text-xs text-text-secondary font-medium">Ore fatturabili</p>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />{data.oreConWbs}h WBS</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" />{(data.oreTotaliMese - data.oreConWbs).toFixed(1)}h altre</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Riepilogo Mese</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-text-secondary font-bold">Ore con WBS</span><span className="text-text-primary font-bold">{data.oreConWbs}h / {data.oreTotaliMese}h</span></div>
              <div className="h-2.5 bg-background rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${data.pctFatturabili}%` }} transition={{ duration: 0.8 }} className="h-full bg-indigo-500 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-text-secondary">Costo complessivo HR</span>
              <span className="text-lg font-bold text-text-primary">{fmt(data.costoHrMese)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
