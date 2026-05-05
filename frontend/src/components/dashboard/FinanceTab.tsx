import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Euro, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFinanceKPIs } from '../../hooks/api/useDashboard';
import Spinner from '../Spinner';

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${percentFormatter.format(value)}%`;
}

function formatCompactProjectName(value: string) {
  if (value.length <= 20) return value;
  return `${value.slice(0, 20)}…`;
}

export default function FinanceTab() {
  const { data, isLoading, error } = useFinanceKPIs();

  if (isLoading) return <Spinner label="Caricamento dati finanziari..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati finanziari.</p>;

  const totalRevenue = data.valoreContrattoTotale ?? data.budgetTotale ?? 0;
  const totalCosts = data.costiTotali ?? data.speseTotali ?? 0;
  const marginPercent = data.marginePct;
  const isMarginAlert = marginPercent != null && marginPercent < 15;
  const isMarginPositive = data.margine >= 0;
  const topCantieri = data.topCantieri ?? [];
  const hasRevenue = totalRevenue > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Ricavi Previsti Totali',
            value: formatCurrency(totalRevenue),
            sublabel: hasRevenue ? 'Somma valori contratto cantieri attivi' : 'Nessun contratto valorizzato',
            icon: Euro,
            tone: 'text-accent',
            bg: 'bg-accent/10',
          },
          {
            label: 'Costi Totali Reali',
            value: formatCurrency(totalCosts),
            sublabel: `Manodopera ${formatCurrency(data.costoManodoperaTotale ?? 0)} | Materiali ${formatCurrency(data.costoMaterialiTotale ?? 0)} | Spese ${formatCurrency(data.costoSpeseTotale ?? 0)}`,
            icon: TrendingDown,
            tone: 'text-rose-500',
            bg: 'bg-rose-500/10',
          },
          {
            label: 'Margine Netto',
            value: formatCurrency(data.margine),
            sublabel: isMarginPositive ? 'Ricavi superiori ai costi' : 'Costi superiori ai ricavi',
            icon: isMarginPositive ? TrendingUp : AlertTriangle,
            tone: isMarginPositive ? 'text-emerald-500' : 'text-rose-500',
            bg: isMarginPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10',
          },
          {
            label: 'Margine Netto %',
            value: formatPercent(marginPercent),
            sublabel: marginPercent == null ? 'Contratti mancanti' : isMarginAlert ? 'Sotto soglia di allerta 15%' : 'Margine sopra soglia di controllo',
            icon: Percent,
            tone: marginPercent == null ? 'text-text-secondary' : isMarginAlert ? 'text-rose-500' : 'text-emerald-500',
            bg: marginPercent == null ? 'bg-background' : isMarginAlert ? 'bg-rose-500/10' : 'bg-emerald-500/10',
          },
        ].map(({ label, value, sublabel, icon: Icon, tone, bg }) => (
          <motion.div
            key={label}
            whileHover={{ y: -2 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
                <p className="text-2xl font-bold text-text-primary">{value}</p>
                <p className="text-xs text-text-secondary">{sublabel}</p>
              </div>
              <div className={cn('rounded-xl p-2.5', bg, tone)}>
                <Icon size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Top 5 Cantieri Attivi
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Confronto tra ricavo previsto da contratto e costo reale operativo.
            </p>
          </div>
          {marginPercent != null && (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-right',
                isMarginAlert
                  ? 'border-danger-border bg-danger-bg text-danger-text'
                  : 'border-success-border bg-success-bg text-success-text'
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider">Margine Globale</p>
              <p className="text-lg font-bold">{formatPercent(marginPercent)}</p>
            </div>
          )}
        </div>

        {!hasRevenue ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background text-center">
            <AlertTriangle size={28} className="text-text-secondary/60" />
            <div>
              <p className="font-medium text-text-primary">Nessun valore contratto disponibile.</p>
              <p className="mt-1 text-sm text-text-secondary">
                Valorizza il campo contratto nei cantieri per attivare il confronto P&amp;L.
              </p>
            </div>
          </div>
        ) : topCantieri.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-sm text-text-secondary">
            Nessun cantiere attivo con contratto valorizzato disponibile per il confronto.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCantieri} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, rgba(148, 163, 184, 0.18))" />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    tickFormatter={formatCompactProjectName}
                    interval={0}
                    angle={-10}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    tickFormatter={(value: number) => `€${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(value: string) => value}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid var(--color-border, rgba(148, 163, 184, 0.18))',
                      backgroundColor: 'var(--color-card, white)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ricavoPrevisto" name="Ricavo Previsto" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="costo" name="Costo Reale" fill="#f97316" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-text-secondary">
                    <th className="px-4 py-3">Cantiere</th>
                    <th className="px-4 py-3 text-right">Ricavo Previsto</th>
                    <th className="px-4 py-3 text-right">Costo Reale</th>
                    <th className="px-4 py-3 text-right">Margine</th>
                    <th className="px-4 py-3 text-right">Margine %</th>
                  </tr>
                </thead>
                <tbody>
                  {topCantieri.map((cantiere) => {
                    const rowAlert = cantiere.marginePct != null && cantiere.marginePct < 15;
                    return (
                      <tr key={cantiere.id} className="border-b border-border/60">
                        <td className="px-4 py-3 font-medium text-text-primary">{cantiere.nome}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(cantiere.ricavoPrevisto)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(cantiere.costo)}</td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold',
                            cantiere.margine >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          )}
                        >
                          {formatCurrency(cantiere.margine)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold',
                            cantiere.marginePct == null
                              ? 'text-text-secondary'
                              : rowAlert
                                ? 'text-rose-500'
                                : 'text-emerald-500'
                          )}
                        >
                          {formatPercent(cantiere.marginePct)}
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
    </div>
  );
}
