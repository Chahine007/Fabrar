import { Bot, RefreshCw } from 'lucide-react';
import { useTelegramFeed } from '../../../hooks/api/useTelegramAudit';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import MethodBadge from '../../ui/MethodBadge';

export default function TelegramFeedTab({ cantiereId }: { cantiereId: number }) {
  const { feed, isLoading, error, refetch } = useTelegramFeed({ cantiereId });

  const statusBadge = (status: string) => {
    if (status === 'verified') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-bg text-success-text border border-success-border">✅ Approvato</span>;
    }
    if (status === 'rejected') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-bg text-danger-text border border-danger-border">❌ Rifiutato</span>;
    }
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
                {feed.map((entry) => {
                  return (
                    <tr key={`${entry.type}-${entry.id}`} className="border-b border-border/50 hover:bg-background/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <MethodBadge method={entry.input_method} type={entry.type} />
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
}
