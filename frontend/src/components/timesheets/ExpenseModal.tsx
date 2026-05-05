import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Banknote, Loader2, Save, X } from 'lucide-react';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useAllTasks } from '../../hooks/api/useTasks';
import { useCreateMyExpense, useUpdateMyExpense } from '../../hooks/api/useMyExpenses';

export interface EditableExpense {
  id: number;
  date?: string | null;
  value?: number | null;
  note?: string | null;
  cantiere_id?: number | null;
  task_id?: number | null;
  fornitore?: string | null;
  status?: string | null;
  stato_validazione?: string | null;
}

interface ExpenseModalProps {
  expense?: EditableExpense | null;
  onClose: () => void;
}

interface ExpenseFormState {
  date: string;
  cantiere_id: string;
  task_id: string;
  importo: string;
  fornitore: string;
  descrizione: string;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value?: string | null) {
  if (!value) return todayDateOnly();
  return String(value).slice(0, 10);
}

function isApprovedRecord(expense?: EditableExpense | null) {
  const raw = String(expense?.stato_validazione ?? expense?.status ?? '').toUpperCase();
  return raw === 'APPROVED' || raw === 'VERIFIED';
}

function getInitialForm(expense?: EditableExpense | null): ExpenseFormState {
  return {
    date: toDateOnly(expense?.date),
    cantiere_id: expense?.cantiere_id ? String(expense.cantiere_id) : '',
    task_id: expense?.task_id ? String(expense.task_id) : '',
    importo: expense?.value != null ? String(expense.value) : '',
    fornitore: expense?.fornitore ?? '',
    descrizione: expense?.note ?? '',
  };
}

export default function ExpenseModal({ expense = null, onClose }: ExpenseModalProps) {
  const isEditMode = Boolean(expense);
  const isApproved = isApprovedRecord(expense);
  const { data: cantieri = [] } = useCantieri();
  const selectedExpenseCantiereId = expense?.cantiere_id ?? null;
  const [form, setForm] = useState<ExpenseFormState>(() => getInitialForm(expense));
  const [error, setError] = useState<string | null>(null);
  const selectedCantiereId = form.cantiere_id ? Number(form.cantiere_id) : null;
  const { data: tasks = [] } = useAllTasks(selectedCantiereId ? { cantiere_id: selectedCantiereId } : {});
  const createExpense = useCreateMyExpense();
  const updateExpense = useUpdateMyExpense();
  const isBusy = createExpense.isPending || updateExpense.isPending;

  useEffect(() => {
    setForm(getInitialForm(expense));
    setError(null);
  }, [expense]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isBusy, onClose]);

  const taskOptions = useMemo(
    () =>
      selectedCantiereId
        ? tasks.filter((task) => task.cantiere_id === selectedCantiereId)
        : [],
    [selectedCantiereId, tasks]
  );

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'cantiere_id' ? { task_id: '' } : {}),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isApproved) {
      setError('Questo record è già stato approvato e non può essere modificato.');
      return;
    }

    const cantiereId = Number(form.cantiere_id);
    const importo = Number(form.importo);

    if (!cantiereId || Number.isNaN(cantiereId)) {
      setError('Seleziona un cantiere valido.');
      return;
    }

    if (!importo || Number.isNaN(importo) || importo <= 0) {
      setError('Inserisci un importo maggiore di zero.');
      return;
    }

    try {
      const payload = {
        date: form.date,
        cantiere_id: cantiereId,
        task_id: form.task_id ? Number(form.task_id) : null,
        importo,
        fornitore: form.fornitore,
        descrizione: form.descrizione,
      };

      if (isEditMode && expense) {
        await updateExpense.mutateAsync({
          id: expense.id,
          data: payload,
        });
      } else {
        await createExpense.mutateAsync(payload);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile salvare la spesa.');
    }
  };

  const fieldsDisabled = isBusy || isApproved;

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
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-danger-bg p-2.5 text-danger-text">
              <Banknote size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {isEditMode ? 'Modifica Spesa' : 'Nuova Spesa'}
              </h2>
              <p className="text-sm text-text-secondary">
                Registra spese operative collegate a cantiere e task.
              </p>
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
          {isApproved && (
            <div className="flex gap-3 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>Questo record è già stato approvato e non può essere modificato.</span>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Data</span>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Cantiere</span>
              <select
                name="cantiere_id"
                value={form.cantiere_id}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Seleziona cantiere</option>
                {cantieri.map((cantiere) => (
                  <option key={cantiere.id} value={cantiere.id}>
                    {cantiere.nome}
                  </option>
                ))}
                {selectedExpenseCantiereId && !cantieri.some((cantiere) => cantiere.id === selectedExpenseCantiereId) && (
                  <option value={selectedExpenseCantiereId}>Cantiere #{selectedExpenseCantiereId}</option>
                )}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Task</span>
              <select
                name="task_id"
                value={form.task_id}
                onChange={handleChange}
                disabled={fieldsDisabled || !selectedCantiereId}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Nessun task collegato</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Importo</span>
              <input
                name="importo"
                type="number"
                min="0"
                step="0.01"
                value={form.importo}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Es. 42.50"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-text-primary">Fornitore</span>
              <input
                name="fornitore"
                type="text"
                value={form.fornitore}
                onChange={handleChange}
                disabled={fieldsDisabled}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Es. Ferramenta Rossi"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-text-primary">Descrizione</span>
              <textarea
                name="descrizione"
                value={form.descrizione}
                onChange={handleChange}
                disabled={fieldsDisabled}
                rows={4}
                className="resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Descrivi la spesa sostenuta."
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
              disabled={isBusy || isApproved}
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
