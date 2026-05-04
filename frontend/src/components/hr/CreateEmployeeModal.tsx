import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { useCreateEmployee } from '../../hooks/api/useHr';

type EmployeeRole = 'WORKER' | 'ADMIN' | 'PROJECT_MANAGER' | 'HR';

interface CreateEmployeeModalProps {
  onClose: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  hourlyRate: string;
}

const initialForm: FormState = {
  firstName: '',
  lastName: '',
  role: 'WORKER',
  hourlyRate: '',
};

export default function CreateEmployeeModal({ onClose }: CreateEmployeeModalProps) {
  const createEmployee = useCreateEmployee();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createEmployee.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [createEmployee.isPending, onClose]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await createEmployee.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role,
        ...(form.hourlyRate !== '' ? { hourly_rate: Number(form.hourlyRate) } : {}),
      });
      setForm(initialForm);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile creare il dipendente.');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi modale"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!createEmployee.isPending) onClose();
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Nuovo Dipendente</h2>
            <p className="mt-1 text-sm text-slate-500">Crea l'anagrafica base per il flusso HR e l'accesso.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={createEmployee.isPending}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Nome</span>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Mario"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Cognome</span>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Rossi"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Ruolo</span>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              >
                <option value="WORKER">WORKER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                <option value="HR">HR</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Costo Orario</span>
              <input
                name="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={handleChange}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Es. 24.50"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={createEmployee.isPending}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createEmployee.isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createEmployee.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {createEmployee.isPending ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
