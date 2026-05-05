import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import { useFinancialTimeline } from '../../../hooks/api/useCantieri';

export default function HoursTab({ cantiereId }: { cantiereId: number }) {
  const { data, isLoading, error, refetch } = useFinancialTimeline(cantiereId);

  if (isLoading) return <Spinner label="Caricamento dati finanziari..." />;
  if (error || !data) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  const chartData = data.months.map((month, index) => ({
    name: month,
    'Costo Mensile': data.costoPerMese[index],
    'Costo Cumulativo': data.costoReale[index],
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
}
