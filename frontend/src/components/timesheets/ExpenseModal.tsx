import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Loader2, Save } from 'lucide-react';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useAllTasks } from '../../hooks/api/useTasks';
import { useCreateMyExpense, useUpdateMyExpense } from '../../hooks/api/useMyExpenses';
import { Button, Dialog, Field, FormError, Input, Select, Textarea } from '../ui';

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
    <Dialog
      open
      onClose={onClose}
      closeDisabled={isBusy}
      title={isEditMode ? 'Modifica Spesa' : 'Nuova Spesa'}
      description="Registra spese operative collegate a cantiere e task."
      icon={<Banknote size={18} />}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            Annulla
          </Button>
          <Button type="submit" form="expense-form" disabled={isBusy || isApproved} className="gap-2">
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isBusy ? 'Salvataggio...' : 'Salva'}
          </Button>
        </>
      }
    >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
          {isApproved && (
            <div className="flex gap-3 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>Questo record è già stato approvato e non può essere modificato.</span>
            </div>
          )}

          {error && <FormError>{error}</FormError>}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data">
              <Input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
              />
            </Field>

            <Field label="Cantiere">
              <Select
                name="cantiere_id"
                value={form.cantiere_id}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
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
              </Select>
            </Field>

            <Field label="Task">
              <Select
                name="task_id"
                value={form.task_id}
                onChange={handleChange}
                disabled={fieldsDisabled || !selectedCantiereId}
              >
                <option value="">Nessun task collegato</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Importo">
              <Input
                name="importo"
                type="number"
                min="0"
                step="0.01"
                value={form.importo}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
                placeholder="Es. 42.50"
              />
            </Field>

            <Field label="Fornitore" className="md:col-span-2">
              <Input
                name="fornitore"
                type="text"
                value={form.fornitore}
                onChange={handleChange}
                disabled={fieldsDisabled}
                placeholder="Es. Ferramenta Rossi"
              />
            </Field>

            <Field label="Descrizione" className="md:col-span-2">
              <Textarea
                name="descrizione"
                value={form.descrizione}
                onChange={handleChange}
                disabled={fieldsDisabled}
                rows={4}
                placeholder="Descrivi la spesa sostenuta."
              />
            </Field>
          </div>
        </form>
    </Dialog>
  );
}
