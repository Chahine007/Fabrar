import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuthContext } from '../context/AuthContext';
import { useCantieri } from '../hooks/api/useCantieri';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  getTaskAssigneeName,
  useAllTasks,
  useDeleteTask,
  type TaskFilters,
  type TaskPriorityCode,
  type TaskStatusCode,
  type TaskWithCantiere,
} from '../hooks/api/useTasks';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import TaskModal from '../components/tasks/TaskModal';

const STATUS_STYLE: Record<TaskStatusCode, string> = {
  TODO: 'bg-background text-text-secondary border border-border',
  IN_PROGRESS: 'bg-info-bg text-info-text border border-info-border',
  DONE: 'bg-success-bg text-success-text border border-success-border',
};

const PRIORITY_STYLE: Record<TaskPriorityCode, string> = {
  LOW: 'bg-background text-text-secondary border border-border',
  MEDIUM: 'bg-info-bg text-info-text border border-info-border',
  HIGH: 'bg-warning-bg text-warning-text border border-warning-border',
  CRITICAL: 'bg-danger-bg text-danger-text border border-danger-border',
};

function Badge({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold', className)}>
      {text}
    </span>
  );
}

function formatDueDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function ActivitiesPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isWorker = user?.role === 'WORKER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusCode | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityCode | ''>('');
  const [cantiereFilter, setCantiereFilter] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithCantiere | null>(null);

  const filters: TaskFilters = {
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    cantiere_id: cantiereFilter ?? undefined,
  };

  const { data: tasks = [], isLoading, error, refetch } = useAllTasks(filters);
  const { data: cantieri = [] } = useCantieri();
  const deleteTask = useDeleteTask();

  const displayedTasks = useMemo(() => {
    if (!search.trim()) return tasks;

    const normalizedQuery = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const assignee = getTaskAssigneeName(task).toLowerCase();
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        (task.description ?? '').toLowerCase().includes(normalizedQuery) ||
        task.cantiere.nome.toLowerCase().includes(normalizedQuery) ||
        assignee.includes(normalizedQuery)
      );
    });
  }, [search, tasks]);

  const kpi = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((task) => task.status_code === 'TODO').length,
      inProgress: tasks.filter((task) => task.status_code === 'IN_PROGRESS').length,
      done: tasks.filter((task) => task.status_code === 'DONE').length,
    }),
    [tasks]
  );

  const hasFilters = Boolean(search || statusFilter || priorityFilter || cantiereFilter);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCantiereFilter(null);
  };

  const openCreateModal = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task: TaskWithCantiere) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTask(null);
    setIsModalOpen(false);
  };

  const handleDelete = async (task: TaskWithCantiere, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const confirmed = window.confirm(`Eliminare il task "${task.title}"?`);
    if (!confirmed) return;

    try {
      await deleteTask.mutateAsync(task.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossibile eliminare il task.');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Tutte le Attività</h1>
            <p className="mt-1 text-sm text-text-secondary">Vista operativa cross-project con creazione, modifica e filtro.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-95"
            >
              <Plus size={16} />
              Nuova Attività
            </button>
            <button
              onClick={() => refetch()}
              className="rounded-xl border border-border p-2 text-text-secondary transition-all hover:bg-background"
              title="Aggiorna"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-border px-8 py-6 md:grid-cols-4">
        {[
          { label: 'Totali', value: kpi.total, icon: CheckSquare, color: 'text-accent' },
          { label: 'Da Fare', value: kpi.todo, icon: Clock, color: 'text-text-secondary' },
          { label: 'In Corso', value: kpi.inProgress, icon: AlertCircle, color: 'text-info-text' },
          { label: 'Completati', value: kpi.done, icon: CheckCircle2, color: 'text-success-text' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            whileHover={{ y: -2 }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className={cn('rounded-xl bg-background p-2', color)}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{value}</p>
              <p className="text-xs font-medium text-text-secondary">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/50 px-8 py-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca task, cantiere, descrizione, assegnatario..."
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm text-text-primary outline-none transition-all focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <select
          value={cantiereFilter ?? ''}
          onChange={(event) => setCantiereFilter(event.target.value ? Number(event.target.value) : null)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:ring-2 focus:ring-accent/20"
        >
          <option value="">Tutti i cantieri</option>
          {cantieri.map((cantiere) => (
            <option key={cantiere.id} value={cantiere.id}>
              {cantiere.nome}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter((event.target.value as TaskStatusCode | '') || '')}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:ring-2 focus:ring-accent/20"
        >
          <option value="">Tutti gli stati</option>
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter((event.target.value as TaskPriorityCode | '') || '')}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:ring-2 focus:ring-accent/20"
        >
          <option value="">Tutte le priorità</option>
          {TASK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2.5 text-xs font-bold text-danger-text transition-all hover:opacity-80"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 px-8 py-6">
        {isLoading ? (
          <Spinner fullScreen label="Caricamento attività..." />
        ) : error ? (
          <ErrorMessage error={(error as Error)?.message ?? 'Errore caricamento'} onRetry={refetch} />
        ) : displayedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
            <CheckSquare size={48} className="mb-4 opacity-30" />
            <p className="font-medium">
              {hasFilters ? 'Nessuna attività trovata con i filtri selezionati.' : 'Nessuna attività nel sistema.'}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {hasFilters && (
                <button onClick={resetFilters} className="text-sm text-accent hover:underline">
                  Rimuovi filtri
                </button>
              )}
              <button onClick={openCreateModal} className="text-sm text-accent hover:underline">
                Crea una nuova attività
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-background text-left text-xs font-bold uppercase tracking-wider text-text-secondary">
                  <th className="p-4 pl-6">Task</th>
                  <th className="p-4">Cantiere</th>
                  <th className="p-4 hidden md:table-cell">Assegnatario</th>
                  <th className="p-4 hidden lg:table-cell">Priorità</th>
                  <th className="p-4 hidden lg:table-cell">Scadenza</th>
                  <th className="p-4">Stato</th>
                  <th className="p-4 pr-6 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => openEditModal(task)}
                    className="cursor-pointer transition-colors hover:bg-background/60"
                  >
                    <td className="p-4 pl-6">
                      <div className="space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold text-text-primary">{task.title}</p>
                        {task.description && (
                          <p className="line-clamp-1 text-xs text-text-secondary">{task.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/projects/${task.cantiere.id}`);
                        }}
                        className="text-left text-xs font-bold text-accent hover:underline"
                      >
                        {task.cantiere.nome}
                      </button>
                    </td>
                    <td className="hidden p-4 md:table-cell">
                      <span className="text-sm text-text-secondary">{getTaskAssigneeName(task)}</span>
                    </td>
                    <td className="hidden p-4 lg:table-cell">
                      <Badge text={task.priority} className={PRIORITY_STYLE[task.priority_code]} />
                    </td>
                    <td className="hidden p-4 lg:table-cell">
                      <span className="text-xs text-text-secondary">{formatDueDate(task.due_date)}</span>
                    </td>
                    <td className="p-4">
                      <Badge text={task.status} className={STATUS_STYLE[task.status_code]} />
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/projects/${task.cantiere.id}`);
                          }}
                          className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-background hover:text-accent"
                          title="Apri progetto"
                        >
                          <FolderOpen size={16} />
                        </button>
                        {!isWorker && (
                          <button
                            type="button"
                            onClick={(event) => handleDelete(task, event)}
                            disabled={deleteTask.isPending}
                            className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-danger-bg hover:text-danger-text disabled:cursor-not-allowed disabled:opacity-50"
                            title="Elimina task"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-border px-6 py-3 text-xs text-text-secondary">
              {displayedTasks.length} task {hasFilters ? '(filtrati)' : 'totali'}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && <TaskModal onClose={closeModal} task={selectedTask} />}
    </div>
  );
}
