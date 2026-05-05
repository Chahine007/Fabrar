import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, Save } from 'lucide-react';
import { useWbsTree } from '../../hooks/api/useWbs';
import {
  type BillingInstallment,
  type InstallmentStatus,
  useCreateInstallment,
  useUpdateInstallment,
} from '../../hooks/api/useBilling';
import { Button, Dialog } from '../ui';

interface InstallmentModalProps {
  cantiereId: number;
  installment?: BillingInstallment | null;
  onClose: () => void;
}

interface InstallmentFormState {
  nome: string;
  importo_previsto: string;
  data_scadenza_prevista: string;
  wbs_node_id: string;
  stato: InstallmentStatus;
}

const INSTALLMENT_STATUS_OPTIONS: Array<{ value: InstallmentStatus; label: string }> = [
  { value: 'PENDING', label: 'Da Fatturare' },
  { value: 'INVOICED', label: 'Fatturata' },
  { value: 'PAID', label: 'Incassata' },
];

function getInitialFormState(installment?: BillingInstallment | null): InstallmentFormState {
  return {
    nome: installment?.nome ?? '',
    importo_previsto:
      installment?.importo_previsto != null ? String(installment.importo_previsto) : '',
    data_scadenza_prevista: installment?.data_scadenza_prevista
      ? String(installment.data_scadenza_prevista).slice(0, 10)
      : '',
    wbs_node_id: installment?.wbs_node_id != null ? String(installment.wbs_node_id) : '',
    stato: installment?.stato ?? 'PENDING',
  };
}

function flattenWbs(nodes: any[], depth = 0): Array<{ id: number; label: string }> {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${'— '.repeat(depth)}${node.nome}`.trim(),
    },
    ...(Array.isArray(node.children) ? flattenWbs(node.children, depth + 1) : []),
  ]);
}

export default function InstallmentModal({
  cantiereId,
  installment = null,
  onClose,
}: InstallmentModalProps) {
  const { data: wbsTree = [], isLoading: loadingWbs } = useWbsTree(cantiereId);
  const createInstallment = useCreateInstallment(cantiereId);
  const updateInstallment = useUpdateInstallment(cantiereId);
  const isEditMode = Boolean(installment);
  const isBusy = createInstallment.isPending || updateInstallment.isPending;
  const [form, setForm] = useState<InstallmentFormState>(() => getInitialFormState(installment));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(getInitialFormState(installment));
    setError(null);
  }, [installment]);

  const wbsOptions = useMemo(() => flattenWbs(wbsTree), [wbsTree]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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

    const amount = Number(form.importo_previsto);
    if (!form.nome.trim()) {
      setError('Il nome della rata è obbligatorio.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('L\'importo previsto deve essere un numero valido.');
      return;
    }

    try {
      if (isEditMode && installment) {
        await updateInstallment.mutateAsync({
          installmentId: installment.id,
          data: {
            nome: form.nome,
            importo_previsto: amount,
            data_scadenza_prevista: form.data_scadenza_prevista || null,
            wbs_node_id: form.wbs_node_id ? Number(form.wbs_node_id) : null,
            stato: form.stato,
          },
        });
      } else {
        await createInstallment.mutateAsync({
          nome: form.nome,
          importo_previsto: amount,
          data_scadenza_prevista: form.data_scadenza_prevista || null,
          wbs_node_id: form.wbs_node_id ? Number(form.wbs_node_id) : null,
          stato: form.stato,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio della rata.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      closeDisabled={isBusy}
      title={isEditMode ? 'Modifica Rata' : 'Nuova Rata'}
      description="Pianifica una milestone di incasso libera o collegata a una fase WBS."
      icon={<CalendarRange size={18} />}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            Annulla
          </Button>
          <Button type="submit" form="installment-form" disabled={isBusy} className="gap-2">
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isBusy ? 'Salvataggio...' : 'Salva Rata'}
          </Button>
        </>
      }
    >
        <form id="installment-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-text-primary">Nome Rata</span>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                disabled={isBusy}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
                placeholder="Es. Acconto iniziale"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Importo Previsto</span>
              <input
                name="importo_previsto"
                type="number"
                min="0"
                step="0.01"
                value={form.importo_previsto}
                onChange={handleChange}
                disabled={isBusy}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
                placeholder="0.00"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Data Scadenza Prevista</span>
              <input
                name="data_scadenza_prevista"
                type="date"
                value={form.data_scadenza_prevista}
                onChange={handleChange}
                disabled={isBusy}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Nodo WBS</span>
              <select
                name="wbs_node_id"
                value={form.wbs_node_id}
                onChange={handleChange}
                disabled={isBusy || loadingWbs}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
              >
                <option value="">Nessun collegamento WBS</option>
                {wbsOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Stato</span>
              <select
                name="stato"
                value={form.stato}
                onChange={handleChange}
                disabled={isBusy}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
              >
                {INSTALLMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

        </form>
    </Dialog>
  );
}
