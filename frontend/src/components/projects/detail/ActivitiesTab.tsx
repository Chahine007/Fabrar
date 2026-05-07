import { useState, type MouseEvent } from 'react';
import { CheckSquare, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuthContext } from '../../../context/AuthContext';
import {
  getTaskAssigneeName,
  type TaskPriorityCode,
  type TaskStatusCode,
  type TaskWithCantiere,
  useAllTasks,
  useDeleteTask,
} from '../../../hooks/api/useTasks';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import TaskModal from '../../tasks/TaskModal';
import { ConfirmDialog, useToast } from '../../ui';

const TASK_STATUS_STYLE: Record<TaskStatusCode, string> = {
  TODO: 'bg-background text-text-secondary border border-border',
  IN_PROGRESS: 'bg-info-bg text-info-text border border-info-border',
  DONE: 'bg-success-bg text-success-text border border-success-border',
};

const TASK_PRIORITY_STYLE: Record<TaskPriorityCode, string> = {
  LOW: 'bg-background text-text-secondary border border-border',
  MEDIUM: 'bg-info-bg text-info-text border border-info-border',
  HIGH: 'bg-warning-bg text-warning-text border border-warning-border',
  CRITICAL: 'bg-danger-bg text-danger-text border border-danger-border',
};

function formatProjectTaskDueDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function ActivitiesTab({
  cantiereId,
}: {
  cantiereId: number;
}) {
  const { user } = useAuthContext();
  const { data: tasks = [], isLoading, error, refetch } = useAllTasks({ cantiere_id: cantiereId });
  const deleteTask = useDeleteTask();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithCantiere | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithCantiere | null>(null);
  const toast = useToast();
  const isWorker = user?.role === 'WORKER';

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

  const handleDelete = async (task: TaskWithCantiere, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setTaskToDelete(task);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask.mutateAsync(taskToDelete.id);
      toast.success('Task eliminato', `"${taskToDelete.title}" è stato rimosso.`);
      setTaskToDelete(null);
    } catch (error: unknown) {
      toast.error('Eliminazione non riuscita', error instanceof Error ? error.message : 'Impossibile eliminare il task.');
    }
  };

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento task..." /></div>;
  if (error) return <div className="py-12"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Task di Progetto</h3>
          <p className="mt-1 text-sm text-text-secondary">{tasks.length} attività collegate a questo cantiere.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} /> Aggiungi Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border shadow-sm">
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-text-secondary">
            <CheckSquare size={40} className="opacity-30" />
            <div>
              <p className="font-medium">Nessun task presente per questo cantiere.</p>
              <p className="text-sm">Usa il modale per creare una nuova attività con assegnatario, priorità e scadenza.</p>
            </div>
            <button
              onClick={openCreateModal}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent/90"
            >
              Aggiungi Task
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-background border-b border-border text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                <th className="p-4">Task</th>
                <th className="p-4">Assegnato a</th>
                <th className="p-4">Scadenza</th>
                <th className="p-4">Priorità</th>
                <th className="p-4">Stato</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => openEditModal(task)}
                  className="hover:bg-background/50 transition-colors group cursor-pointer"
                >
                  <td className="p-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-text-primary">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-text-secondary line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-text-secondary">{getTaskAssigneeName(task)}</td>
                  <td className="p-4 text-sm text-text-secondary">{formatProjectTaskDueDate(task.due_date)}</td>
                  <td className="p-4">
                    <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold', TASK_PRIORITY_STYLE[task.priority_code])}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold', TASK_STATUS_STYLE[task.status_code])}>
                      {task.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {!isWorker && (
                      <button
                        type="button"
                        onClick={(event) => handleDelete(task, event)}
                        disabled={deleteTask.isPending}
                        className="p-2 text-text-secondary hover:text-danger-text transition-colors opacity-0 group-hover:opacity-100 inline-block disabled:opacity-50"
                        title="Elimina task"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditModal(task);
                      }}
                      className="p-2 text-text-secondary hover:text-accent transition-colors opacity-0 group-hover:opacity-100 inline-block"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <TaskModal
          onClose={closeModal}
          task={selectedTask}
          cantiereId={cantiereId}
        />
      )}
      <ConfirmDialog
        open={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminare task?"
        description={taskToDelete ? `"${taskToDelete.title}" verrà rimosso definitivamente.` : undefined}
        confirmLabel="Elimina"
        loading={deleteTask.isPending}
        variant="danger"
      />
    </div>
  );
}
