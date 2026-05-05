import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Loader2, Save, X } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useEmployees } from '../../hooks/api/useHr';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type Task,
  type TaskPriorityCode,
  type TaskStatusCode,
  useCreateTask,
  useUpdateTask,
} from '../../hooks/api/useTasks';

interface TaskModalProps {
  onClose: () => void;
  task?: Task | null;
  cantiereId?: number;
}

interface TaskFormState {
  title: string;
  description: string;
  cantiere_id: string;
  assignee_id: string;
  status: TaskStatusCode;
  priority: TaskPriorityCode;
  due_date: string;
}

function getInitialFormState(task?: Task | null, fixedCantiereId?: number): TaskFormState {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    cantiere_id: String(fixedCantiereId ?? task?.cantiere_id ?? ''),
    assignee_id: task?.assignee_id != null ? String(task.assignee_id) : '',
    status: task?.status_code ?? 'TODO',
    priority: task?.priority_code ?? 'MEDIUM',
    due_date: task?.due_date ? String(task.due_date).slice(0, 10) : '',
  };
}

export default function TaskModal({ onClose, task = null, cantiereId }: TaskModalProps) {
  const { user } = useAuthContext();
  const { data: cantieri = [] } = useCantieri();
  const shouldLoadEmployees = user?.role !== 'WORKER';
  const {
    data: employees = [],
    error: employeesError,
  } = useEmployees(shouldLoadEmployees);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const isEditMode = Boolean(task);
  const isWorkerEdit = user?.role === 'WORKER' && isEditMode;
  const isBusy = createTask.isPending || updateTask.isPending;
  const [form, setForm] = useState<TaskFormState>(() => getInitialFormState(task, cantiereId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(getInitialFormState(task, cantiereId));
    setError(null);
  }, [task, cantiereId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isBusy, onClose]);

  const selectedCantiereName = useMemo(() => {
    const resolvedId = Number(form.cantiere_id);
    return cantieri.find((item) => item.id === resolvedId)?.nome ?? null;
  }, [cantieri, form.cantiere_id]);

  const assigneeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: `${employee.nome ?? ''} ${employee.cognome ?? ''}`.trim() || `Dipendente #${employee.id}`,
        role: employee.ruolo ?? 'WORKER',
      })),
    [employees]
  );

  const fallbackAssigneeOption = useMemo(() => {
    if (!form.assignee_id || assigneeOptions.some((option) => option.value === form.assignee_id)) {
      return null;
    }

    return {
      value: form.assignee_id,
      label: task?.assignee ?? `Dipendente #${form.assignee_id}`,
      role: task?.assignee_employee?.ruolo ?? '',
    };
  }, [assigneeOptions, form.assignee_id, task]);

  const isFieldDisabled = (fieldName: keyof TaskFormState) => {
    if (isBusy) return true;
    if (!isWorkerEdit) return false;
    return fieldName !== 'status';
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const resolvedCantiereId = Number(cantiereId ?? form.cantiere_id);
    if (!isEditMode && (!resolvedCantiereId || Number.isNaN(resolvedCantiereId))) {
      setError('Seleziona un cantiere valido.');
      return;
    }

    try {
      if (isEditMode && task) {
        const payload = isWorkerEdit
          ? { status: form.status }
          : {
              cantiere_id: resolvedCantiereId,
              title: form.title.trim(),
              description: form.description,
              status: form.status,
              priority: form.priority,
              assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
              due_date: form.due_date || null,
            };

        await updateTask.mutateAsync({
          taskId: task.id,
          data: payload,
        });
      } else {
        await createTask.mutateAsync({
          cantiere_id: resolvedCantiereId,
          title: form.title.trim(),
          description: form.description,
          status: form.status,
          priority: form.priority,
          assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
          due_date: form.due_date || null,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile salvare il task.');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi modale"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!isBusy) onClose();
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-accent/10 p-2.5 text-accent">
                <ClipboardList size={18} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {isEditMode ? 'Modifica Attività' : 'Nuova Attività'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {isEditMode
                    ? 'Aggiorna stato, assegnatario, scadenza e priorità del task.'
                    : 'Crea una nuova attività operativa sul cantiere.'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-background hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {isWorkerEdit && (
            <div className="rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
              Come WORKER puoi modificare solo lo stato del task esistente.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-text-primary">Titolo</span>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                disabled={isFieldDisabled('title')}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Es. Verifica materiali settore C"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-text-primary">Descrizione</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={isFieldDisabled('description')}
                rows={4}
                className="resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Dettagli operativi, note, vincoli o materiale richiesto."
              />
            </label>

            {!cantiereId ? (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">Cantiere</span>
                <select
                  name="cantiere_id"
                  value={form.cantiere_id}
                  onChange={handleChange}
                  required
                  disabled={isFieldDisabled('cantiere_id')}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Seleziona un cantiere</option>
                  {cantieri.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">Cantiere</span>
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-secondary">
                  {selectedCantiereName ?? `Cantiere #${form.cantiere_id}`}
                </div>
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Assegnatario</span>
              <select
                name="assignee_id"
                value={form.assignee_id}
                onChange={handleChange}
                disabled={isFieldDisabled('assignee_id') || Boolean(employeesError)}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Non assegnato</option>
                {fallbackAssigneeOption && (
                  <option value={fallbackAssigneeOption.value}>
                    {fallbackAssigneeOption.label}
                    {fallbackAssigneeOption.role ? ` · ${fallbackAssigneeOption.role}` : ''}
                  </option>
                )}
                {assigneeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.role}
                  </option>
                ))}
              </select>
              {!shouldLoadEmployees && (
                <span className="text-xs text-text-secondary">
                  I WORKER possono creare task, ma non caricano l&apos;anagrafica completa dei dipendenti. Il task può restare non assegnato.
                </span>
              )}
              {shouldLoadEmployees && employeesError && (
                <span className="text-xs text-text-secondary">
                  Elenco dipendenti non disponibile per il ruolo corrente. Il task verrà salvato non assegnato.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Stato</span>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={isFieldDisabled('status')}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Priorità</span>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                disabled={isFieldDisabled('priority')}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Scadenza</span>
              <input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={handleChange}
                disabled={isFieldDisabled('due_date')}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isBusy ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
