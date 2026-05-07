import React, { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { useCreateEmployee } from '../../hooks/api/useHr';
import { Button, Dialog, Field, FormError, Input, Select } from '../ui';

type EmployeeRole = 'WORKER' | 'ADMIN' | 'PROJECT_MANAGER' | 'HR' | 'WAREHOUSEMAN';

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
    <Dialog
      open
      onClose={onClose}
      closeDisabled={createEmployee.isPending}
      title="Nuovo Dipendente"
      description="Crea l'anagrafica base per il flusso HR e l'accesso."
      icon={<UserPlus size={18} />}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={createEmployee.isPending}>
            Annulla
          </Button>
          <Button type="submit" form="create-employee-form" disabled={createEmployee.isPending} className="gap-2">
            {createEmployee.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {createEmployee.isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </>
      }
    >
      <form id="create-employee-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <FormError>{error}</FormError>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                placeholder="Mario"
              />
            </Field>

            <Field label="Cognome">
              <Input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                placeholder="Rossi"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ruolo">
              <Select
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="WORKER">WORKER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                <option value="WAREHOUSEMAN">WAREHOUSEMAN</option>
                <option value="HR">HR</option>
              </Select>
            </Field>

            <Field label="Costo Orario">
              <Input
                name="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={handleChange}
                placeholder="Es. 24.50"
              />
            </Field>
          </div>
      </form>
    </Dialog>
  );
}
