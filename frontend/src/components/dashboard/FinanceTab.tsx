import React from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Euro, TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFinanceKPIs } from '../../hooks/api/useDashboard';
import Spinner from '../Spinner';

const fmt = (v: number) => `€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;

export default function FinanceTab() {
  const { data, isLoading, error } = useFinanceKPIs();

  if (isLoading) return <Spinner label="Caricamento dati finanziari..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati finanziari.</p>;

  const marginePositivo = data.margine >= 0;
  const totalRevenue = data.valoreContrattoTotale ?? data.budgetTotale;
  const totalCosts = data.costiTotali ?? data.speseTotali;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ricavi Previsti', value: fmt(totalRevenue), icon: Euro,         color: 'text-accent',      bg: 'bg-accent/10' },
          { label: 'Costi Totali',    value: fmt(totalCosts),   icon: TrendingDown, color: 'text-rose-500',    bg: 'bg-rose-500/10' },
          { label: 'Margine',        value: fmt(data.margine),      icon: marginePositivo ? TrendingUp : AlertTriangle, color: marginePositivo ? 'text-emerald-500' : 'text-rose-500', bg: marginePositivo ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
          { label: 'CPI Medio',      value: data.cpiMedio?.toFixed(2) ?? '—', icon: Target, color: (data.cpiMedio ?? 0) >= 1 ? 'text-emerald-500' : 'text-amber-500', bg: (data.cpiMedio ?? 0) >= 1 ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl', bg, color)}><Icon size={20} /></div>
            <div><p className="text-xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary font-medium mt-0.5">{label}</p></div>
          </motion.div>
        ))}
      </div>

      {/* Margine % bar */}
      {data.marginePct !== null && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-text-primary">Margine Budget Globale</span>
            <span className={cn('text-sm font-bold', marginePositivo ? 'text-emerald-500' : 'text-rose-500')}>{data.marginePct}%</span>
          </div>
          <div className="h-3 bg-background rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(Math.abs(data.marginePct), 100)}%` }} transition={{ duration: 1 }}
              className={cn('h-full rounded-full', marginePositivo ? 'bg-emerald-500' : 'bg-rose-500')} />
          </div>
        </div>
      )}

      {/* Top 3 Cantieri Burn Rate */}
      {data.top3BurnRate.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Top 3 Cantieri — Burn Rate
          </h3>

          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top3BurnRate} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} labelStyle={{ color: '#888' }} />
                <Bar dataKey="burnRate" radius={[0, 8, 8, 0]}>
                  {data.top3BurnRate.map((c, i) => (
                    <Cell key={i} fill={c.burnRate > 0.9 ? '#f87171' : c.burnRate > 0.75 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-2 text-left">Cantiere</th><th className="px-4 py-2 text-right">Budget</th>
                <th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Burn Rate</th>
                <th className="px-4 py-2 text-right">CPI</th>
              </tr></thead>
              <tbody>
                {data.top3BurnRate.map(c => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-medium text-text-primary">{c.nome}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{fmt(c.budget)}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{fmt(c.costo)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('font-bold', c.burnRate > 0.9 ? 'text-rose-500' : c.burnRate > 0.75 ? 'text-amber-500' : 'text-emerald-500')}>
                        {(c.burnRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-text-primary">{c.cpi?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
