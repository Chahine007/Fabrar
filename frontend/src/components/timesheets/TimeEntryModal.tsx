import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Save } from 'lucide-react';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useAllTasks } from '../../hooks/api/useTasks';
import { useCreateMyTimeEntry, useUpdateMyTimeEntry } from '../../hooks/api/useMyTimesheets';
import { Button, Dialog, Field, FormError, Input, Select, Textarea } from '../ui';

export interface EditableTimeEntry {
  id: number;
  date?: string | null;
  value?: number | null;
  note?: string | null;
  cantiere_id?: number | null;
  task_id?: number | null;
  status?: string | null;
  stato_validazione?: string | null;
}

interface TimeEntryModalProps {
  entry?: EditableTimeEntry | null;
  onClose: () => void;
}

interface TimeEntryFormState {
  report_date: string;
  cantiere_id: string;
  task_id: string;
  ore_lavorate: string;
  descrizione: string;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value?: string | null) {
  if (!value) return todayDateOnly();
  return String(value).slice(0, 10);
}

function isApprovedRecord(entry?: EditableTimeEntry | null) {
  const raw = String(entry?.stato_validazione ?? entry?.status ?? '').toUpperCase();
  return raw === 'APPROVED' || raw === 'VERIFIED';
}

function getInitialForm(entry?: EditableTimeEntry | null): TimeEntryFormState {
  return {
    report_date: toDateOnly(entry?.date),
    cantiere_id: entry?.cantiere_id ? String(entry.cantiere_id) : '',
    task_id: entry?.task_id ? String(entry.task_id) : '',
    ore_lavorate: entry?.value != null ? String(entry.value) : '',
    descrizione: entry?.note ?? '',
  };
}

export default function TimeEntryModal({ entry = null, onClose }: TimeEntryModalProps) {
  const isEditMode = Boolean(entry);
  const isApproved = isApprovedRecord(entry);
  const { data: cantieri = [] } = useCantieri();
  const selectedCantiereId = entry?.cantiere_id ?? null;
  const [form, setForm] = useState<TimeEntryFormState>(() => getInitialForm(entry));
  const [error, setError] = useState<string | null>(null);
  const selectedFormCantiereId = form.cantiere_id ? Number(form.cantiere_id) : null;
  const { data: tasks = [] } = useAllTasks(selectedFormCantiereId ? { cantiere_id: selectedFormCantiereId } : {});
  const createEntry = useCreateMyTimeEntry();
  const updateEntry = useUpdateMyTimeEntry();
  const isBusy = createEntry.isPending || updateEntry.isPending;

  useEffect(() => {
    setForm(getInitialForm(entry));
    setError(null);
  }, [entry]);

  const taskOptions = useMemo(
    () =>
      selectedFormCantiereId
        ? tasks.filter((task) => task.cantiere_id === selectedFormCantiereId)
        : [],
    [selectedFormCantiereId, tasks]
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
    const ore = Number(form.ore_lavorate);

    if (!cantiereId || Number.isNaN(cantiereId)) {
      setError('Seleziona un cantiere valido.');
      return;
    }

    if (!ore || Number.isNaN(ore) || ore <= 0) {
      setError('Inserisci un numero di ore maggiore di zero.');
      return;
    }

    try {
      const payload = {
        cantiere_id: cantiereId,
        task_id: form.task_id ? Number(form.task_id) : null,
        ore_lavorate: ore,
        descrizione: form.descrizione,
      };

      if (isEditMode && entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          data: payload,
        });
      } else {
        await createEntry.mutateAsync({
          ...payload,
          report_date: form.report_date,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile salvare le ore.');
    }
  };

  const fieldsDisabled = isBusy || isApproved;

  return (
    <Dialog
      open
      onClose={onClose}
      closeDisabled={isBusy}
      title={isEditMode ? 'Modifica Ore' : 'Registra Ore'}
      description="Inserisci ore lavorate, cantiere e attività collegata."
      icon={<Clock size={18} />}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            Annulla
          </Button>
          <Button type="submit" form="time-entry-form" disabled={isBusy || isApproved} className="gap-2">
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isBusy ? 'Salvataggio...' : 'Salva'}
          </Button>
        </>
      }
    >
        <form id="time-entry-form" onSubmit={handleSubmit} className="space-y-5">
          {isApproved && (
            <div className="flex gap-3 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>Questo record è già stato approvato e non può essere modificato.</span>
            </div>
          )}

          {error && <FormError>{error}</FormError>}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data" hint={isEditMode ? 'La data resta quella del report giornaliero originale.' : undefined}>
              <Input
                name="report_date"
                type="date"
                value={form.report_date}
                onChange={handleChange}
                disabled={fieldsDisabled || isEditMode}
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
                {selectedCantiereId && !cantieri.some((cantiere) => cantiere.id === selectedCantiereId) && (
                  <option value={selectedCantiereId}>Cantiere #{selectedCantiereId}</option>
                )}
              </Select>
            </Field>

            <Field label="Task">
              <Select
                name="task_id"
                value={form.task_id}
                onChange={handleChange}
                disabled={fieldsDisabled || !selectedFormCantiereId}
              >
                <option value="">Nessun task collegato</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Ore Lavorate">
              <Input
                name="ore_lavorate"
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={form.ore_lavorate}
                onChange={handleChange}
                disabled={fieldsDisabled}
                required
                placeholder="Es. 7.5"
              />
            </Field>

            <Field label="Descrizione" className="md:col-span-2">
              <Textarea
                name="descrizione"
                value={form.descrizione}
                onChange={handleChange}
                disabled={fieldsDisabled}
                rows={4}
                placeholder="Descrivi l'attività svolta."
              />
            </Field>
          </div>
        </form>
    </Dialog>
  );
}
