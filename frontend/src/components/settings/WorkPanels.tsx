import { useMemo } from 'react';
import { Briefcase, ChevronRight, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useMe } from '../../hooks/api/useAuth';
import { useAudit } from '../../hooks/api/useHr';
import { useAllTasks } from '../../hooks/api/useTasks';
import { MaterialRequest, useMyMaterialRequests } from '../../hooks/api/useUserSettings';
import {
  SectionHeader,
  SettingsEmptyState as EmptyState,
  StatusBox,
  formatCurrency,
  formatDate,
  formatQuantity,
  getCurrentEmployeeName,
} from './settingsShared';

export function ActivitiesPanel() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: tasks = [], isLoading, error } = useAllTasks();
  const employeeName = getCurrentEmployeeName(me);
  const username = me?.user.username?.toLowerCase() ?? '';

  const myTasks = useMemo(() => {
    const normalizedName = employeeName.toLowerCase();
    return tasks.filter((task) => {
      const assignee = (task.assignee ?? '').toLowerCase();
      return Boolean(assignee) && assignee !== 'non assegnato' && (
        assignee === normalizedName ||
        assignee.includes(normalizedName) ||
        assignee === username ||
        (username && assignee.includes(username))
      );
    });
  }, [employeeName, tasks, username]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Le mie attività" description="Task assegnati al tuo nome nei cantieri." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento attività...</StatusBox>}
      {!isLoading && myTasks.length === 0 ? (
        <EmptyState icon={Briefcase} title="Nessuna attività assegnata" description="I task appariranno qui quando il tuo nome sarà assegnato su un cantiere." />
      ) : (
        <div className="space-y-3">
          {myTasks.slice(0, 8).map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/projects/${task.cantiere.id}`)}
              className="w-full p-4 rounded-2xl bg-background border border-border hover:border-accent/30 transition-all flex items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="font-semibold text-text-primary">{task.title}</p>
                <p className="text-xs text-text-secondary">{task.cantiere.nome} · {task.status} · {task.priority}</p>
              </div>
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HoursPanel() {
  const { user } = useAuthContext();
  const { data: entries = [], isLoading, error } = useAudit({
    employee_id: user?.employee_id ? String(user.employee_id) : undefined,
  });

  const totals = useMemo(() => {
    const hours = entries.filter((entry) => entry.type === 'ore').reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
    const expenses = entries.filter((entry) => entry.type === 'spese').reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
    const pending = entries.filter((entry) => entry.status === 'pending').length;
    return { hours, expenses, pending };
  }, [entries]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Le mie ore e spese" description="Riepilogo personale dai tabulati reali." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento tabulati...</StatusBox>}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Ore registrate', value: `${totals.hours.toFixed(1)}h` },
          { label: 'Spese registrate', value: formatCurrency(totals.expenses) },
          { label: 'In attesa', value: String(totals.pending) },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-2xl bg-background border border-border">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {entries.slice(0, 6).map((entry) => (
          <div key={`${entry.type}-${entry.id}`} className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text-primary">{entry.type === 'ore' ? 'Ore lavorate' : 'Spesa'} · {entry.cantiere_nome ?? 'Senza cantiere'}</p>
              <p className="text-xs text-text-secondary">{formatDate(entry.date)} · {entry.status}</p>
            </div>
            <p className="font-bold text-text-primary">{entry.type === 'ore' ? `${entry.value}h` : formatCurrency(entry.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrdersPanel() {
  const { data: requests = [], isLoading, error } = useMyMaterialRequests();

  const totals = useMemo(() => ({
    count: requests.length,
    value: requests.reduce((sum, item) => sum + Number(item.valore_totale ?? 0), 0),
  }), [requests]);

  const renderMovementLabel = (request: MaterialRequest) => {
    if (request.tipo_movimento === 'SCARICO_CANTIERE') return 'Scarico su cantiere';
    if (request.tipo_movimento === 'CARICO') return 'Carico magazzino';
    return request.tipo_movimento;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Richieste materiali" description="Movimenti materiali registrati dal tuo account." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento richieste materiali...</StatusBox>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-background border border-border">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Movimenti</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totals.count}</p>
        </div>
        <div className="p-4 rounded-2xl bg-background border border-border">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Valore totale</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{formatCurrency(totals.value)}</p>
        </div>
      </div>
      {!isLoading && requests.length === 0 ? (
        <EmptyState icon={Package} title="Nessuna richiesta materiale" description="I movimenti magazzino eseguiti dal tuo account appariranno qui." />
      ) : (
        <div className="space-y-3">
          {requests.slice(0, 8).map((request) => (
            <div key={request.id} className="p-4 rounded-2xl bg-background border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-text-primary">{request.articolo.descrizione}</p>
                  <p className="text-xs text-text-secondary">
                    {renderMovementLabel(request)} · {request.cantiere?.nome ?? 'Magazzino'} · {formatDate(request.data_movimento)}
                  </p>
                </div>
                <p className="font-bold text-text-primary">{formatCurrency(request.valore_totale)}</p>
              </div>
              <p className="text-xs text-text-secondary mt-3">
                Quantità: {formatQuantity(request.quantita)} {request.articolo.unita_misura}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
