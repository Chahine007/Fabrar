import React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import Spinner from '../Spinner';
import ErrorMessage from '../ErrorMessage';
import { useAllTasks } from '../../hooks/api/useTasks';

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return currencyFormatter.format(value);
}

export default function JobCostingTab({ cantiereId }: { cantiereId: number }) {
  const { data: tasks = [], isLoading, error, refetch } = useAllTasks({ cantiere_id: cantiereId });

  if (isLoading) return <Spinner label="Caricamento job costing..." />;
  if (error) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Job Costing per Task</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Budget stimato, costo reale e delta economico per ogni attivita del cantiere.
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card text-center text-text-secondary">
          <BarChart3 size={36} className="opacity-30" />
          <div>
            <p className="font-medium text-text-primary">Nessun task disponibile.</p>
            <p className="mt-1 text-sm text-text-secondary">
              Crea almeno un task per visualizzare il dettaglio dei costi reali.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background text-left text-xs font-bold uppercase tracking-wider text-text-secondary">
                <th className="px-4 py-3">Nome Task</th>
                <th className="px-4 py-3 text-right">Budget Stimato</th>
                <th className="px-4 py-3 text-right">Costo Manodopera</th>
                <th className="px-4 py-3 text-right">Costo Materiali</th>
                <th className="px-4 py-3 text-right">Costo Spese</th>
                <th className="px-4 py-3 text-right">Costo Totale Reale</th>
                <th className="px-4 py-3 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => {
                const delta = task.deltaBudget;
                const hasBudget = task.budget_stimato != null;

                return (
                  <tr key={task.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-text-primary">{task.title}</p>
                        {task.description && (
                          <p className="max-w-xl text-xs text-text-secondary line-clamp-2">{task.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(task.budget_stimato)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(task.costoManodopera)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(task.costoMateriali)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(task.costoSpese)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(task.costoTotale)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-semibold',
                        !hasBudget || delta == null
                          ? 'text-text-secondary'
                          : delta >= 0
                            ? 'text-emerald-500'
                            : 'text-rose-500'
                      )}
                    >
                      {!hasBudget || delta == null ? '—' : formatCurrency(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
