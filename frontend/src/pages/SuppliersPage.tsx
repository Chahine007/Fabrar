import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Building2, Edit2, Loader2, Plus, Search, Trash2, Truck } from 'lucide-react';
import {
  Supplier,
  SupplierPayload,
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '../hooks/api/useSuppliers';
import ErrorMessage from '../components/ErrorMessage';
import {
  Button,
  ConfirmDialog,
  DataToolbar,
  Dialog,
  Field,
  FormError,
  IconButton,
  Input,
  ResponsiveDataView,
  TableSkeleton,
  Textarea,
  useToast,
} from '../components/ui';
import { getApiErrorMessage } from '../lib/api';

interface SupplierModalProps {
  supplier: Supplier | null;
  onClose: () => void;
}

const emptyPayload: SupplierPayload = {
  ragione_sociale: '',
  partita_iva: '',
  codice_fiscale: '',
  email: '',
  telefono: '',
  indirizzo: '',
  comune: '',
  provincia: '',
  cap: '',
  paese: 'IT',
  iban_default: '',
  note: '',
};

function normalizePayload(payload: SupplierPayload): SupplierPayload {
  return {
    ragione_sociale: payload.ragione_sociale.trim(),
    partita_iva: payload.partita_iva?.trim() || null,
    codice_fiscale: payload.codice_fiscale?.trim() || null,
    email: payload.email?.trim() || null,
    telefono: payload.telefono?.trim() || null,
    indirizzo: payload.indirizzo?.trim() || null,
    comune: payload.comune?.trim() || null,
    provincia: payload.provincia?.trim().toUpperCase() || null,
    cap: payload.cap?.trim() || null,
    paese: payload.paese?.trim().toUpperCase() || 'IT',
    iban_default: payload.iban_default?.replace(/\s+/g, '').toUpperCase() || null,
    note: payload.note?.trim() || null,
  };
}

function SupplierModal({ supplier, onClose }: SupplierModalProps) {
  const [form, setForm] = useState<SupplierPayload>(emptyPayload);
  const [error, setError] = useState<string | null>(null);
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const isEditing = Boolean(supplier);
  const isSaving = createSupplier.isPending || updateSupplier.isPending;

  useEffect(() => {
    setForm(
      supplier
        ? {
            ragione_sociale: supplier.ragione_sociale,
            partita_iva: supplier.partita_iva ?? '',
            codice_fiscale: supplier.codice_fiscale ?? '',
            email: supplier.email ?? '',
            telefono: supplier.telefono ?? '',
            indirizzo: supplier.indirizzo ?? '',
            comune: supplier.comune ?? '',
            provincia: supplier.provincia ?? '',
            cap: supplier.cap ?? '',
            paese: supplier.paese ?? 'IT',
            iban_default: supplier.iban_default ?? '',
            note: supplier.note ?? '',
          }
        : emptyPayload
    );
    setError(null);
  }, [supplier]);

  const updateField = (field: keyof SupplierPayload, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = normalizePayload(form);
    if (!payload.ragione_sociale) {
      setError('La ragione sociale è obbligatoria.');
      return;
    }

    try {
      if (supplier) {
        await updateSupplier.mutateAsync({ id: supplier.id, data: payload });
      } else {
        await createSupplier.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Errore salvataggio fornitore.'));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      closeDisabled={isSaving}
      title={isEditing ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
      description="Anagrafica fornitore per carichi, DDT e fatture acquisto."
      icon={<Truck size={20} />}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button type="submit" form="supplier-form" disabled={isSaving} icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            Salva
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <FormError>{error}</FormError>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ragione Sociale" className="md:col-span-2">
              <Input
                value={form.ragione_sociale}
                onChange={(event) => updateField('ragione_sociale', event.target.value)}
                placeholder="Es. Rossi Materiali S.r.l."
              />
            </Field>

            <Field label="Partita IVA">
              <Input
                value={form.partita_iva ?? ''}
                onChange={(event) => updateField('partita_iva', event.target.value)}
              />
            </Field>

            <Field label="Codice fiscale">
              <Input
                value={form.codice_fiscale ?? ''}
                onChange={(event) => updateField('codice_fiscale', event.target.value)}
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </Field>

            <Field label="Telefono">
              <Input
                value={form.telefono ?? ''}
                onChange={(event) => updateField('telefono', event.target.value)}
              />
            </Field>

            <Field label="Indirizzo">
              <Input
                value={form.indirizzo ?? ''}
                onChange={(event) => updateField('indirizzo', event.target.value)}
              />
            </Field>

            <Field label="Comune">
              <Input
                value={form.comune ?? ''}
                onChange={(event) => updateField('comune', event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-4 md:col-span-2">
              <Field label="Provincia">
                <Input
                  value={form.provincia ?? ''}
                  onChange={(event) => updateField('provincia', event.target.value)}
                />
              </Field>
              <Field label="CAP">
                <Input
                  value={form.cap ?? ''}
                  onChange={(event) => updateField('cap', event.target.value)}
                />
              </Field>
              <Field label="Paese">
                <Input
                  value={form.paese ?? 'IT'}
                  onChange={(event) => updateField('paese', event.target.value)}
                />
              </Field>
            </div>

            <Field label="IBAN predefinito" className="md:col-span-2">
              <Input
                value={form.iban_default ?? ''}
                onChange={(event) => updateField('iban_default', event.target.value)}
              />
            </Field>

            <Field label="Note" className="md:col-span-2">
              <Textarea
                value={form.note ?? ''}
                onChange={(event) => updateField('note', event.target.value)}
                rows={3}
              />
            </Field>
          </div>
        </form>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const toast = useToast();

  const { data: suppliers = [], isLoading, error } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();

  const filteredSuppliers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      [
        supplier.ragione_sociale,
        supplier.partita_iva,
        supplier.codice_fiscale,
        supplier.email,
        supplier.telefono,
        supplier.comune,
        supplier.provincia,
        supplier.iban_default,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [suppliers, search]);

  const openCreate = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    setSupplierToDelete(supplier);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      toast.success('Fornitore eliminato', supplierToDelete.ragione_sociale);
      setSupplierToDelete(null);
    } catch (err: unknown) {
      toast.error('Eliminazione non riuscita', getApiErrorMessage(err, 'Errore eliminazione fornitore.'));
    }
  };

  if (isLoading) return <div className="p-4 md:p-8"><TableSkeleton rows={7} columns={5} /></div>;
  if (error) return <div className="p-4 md:p-8"><ErrorMessage error={(error as Error).message} /></div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Fornitori</h1>
            <p className="text-text-secondary mt-1 text-sm md:text-base">Anagrafiche collegate a carichi, articoli e documenti DDT.</p>
          </div>
          <Button
            onClick={openCreate}
            size="lg"
            icon={<Plus size={20} />}
          >
            Nuovo Fornitore
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <DataToolbar title="Anagrafiche Fornitori" icon={<Building2 size={20} className="text-text-secondary" />}>
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder="Cerca fornitore..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none"
              />
            </div>
          </DataToolbar>

          <div className="p-4">
            <ResponsiveDataView
              data={filteredSuppliers}
              getKey={(supplier) => supplier.id}
              emptyIcon={Truck}
              emptyTitle="Nessun fornitore trovato"
              emptyDescription="Modifica la ricerca o crea una nuova anagrafica fornitore."
              emptyAction={<Button onClick={openCreate} icon={<Plus size={16} />}>Nuovo fornitore</Button>}
              renderCard={(supplier) => (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-text-primary">{supplier.ragione_sociale}</p>
                        {supplier.indirizzo && <p className="mt-1 text-xs text-text-secondary">{supplier.indirizzo}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton label="Modifica fornitore" size="sm" variant="secondary" onClick={() => openEdit(supplier)}>
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton label="Elimina fornitore" size="sm" variant="danger" onClick={() => handleDelete(supplier)} disabled={deleteSupplier.isPending}>
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                      <span>P.IVA: <strong className="text-text-primary">{supplier.partita_iva || '--'}</strong></span>
                      <span>CF: <strong className="text-text-primary">{supplier.codice_fiscale || '--'}</strong></span>
                      <span>Tel: <strong className="text-text-primary">{supplier.telefono || '--'}</strong></span>
                      <span>Sede: <strong className="text-text-primary">{[supplier.cap, supplier.comune, supplier.provincia].filter(Boolean).join(' ') || '--'}</strong></span>
                      <span className="col-span-2">Email: <strong className="text-text-primary">{supplier.email || '--'}</strong></span>
                      <span className="col-span-2">IBAN: <strong className="text-text-primary">{supplier.iban_default || '--'}</strong></span>
                    </div>
                </div>
              )}
              renderTable={(rows) => (
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                  <th className="px-6 py-4 font-semibold">Ragione Sociale</th>
                  <th className="px-6 py-4 font-semibold">Fiscale</th>
                  <th className="px-6 py-4 font-semibold">Contatti</th>
                  <th className="px-6 py-4 font-semibold">Sede / Pagamento</th>
                  <th className="px-6 py-4 font-semibold text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-text-primary text-sm">{supplier.ragione_sociale}</p>
                        {supplier.indirizzo && <p className="text-xs text-text-secondary mt-1">{supplier.indirizzo}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        <p>P.IVA: <span className="text-text-primary">{supplier.partita_iva || '--'}</span></p>
                        <p className="mt-1 text-xs">CF: {supplier.codice_fiscale || '--'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        <p>{supplier.email || '--'}</p>
                        <p className="mt-1 text-xs">{supplier.telefono || '--'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        <p>{[supplier.cap, supplier.comune, supplier.provincia].filter(Boolean).join(' ') || '--'}</p>
                        <p className="mt-1 text-xs">{supplier.iban_default || '--'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            onClick={() => openEdit(supplier)}
                            label="Modifica fornitore"
                            size="sm"
                            variant="secondary"
                          >
                            <Edit2 size={17} />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDelete(supplier)}
                            disabled={deleteSupplier.isPending}
                            label="Elimina fornitore"
                            size="sm"
                            variant="danger"
                          >
                            <Trash2 size={17} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
                </div>
              )}
            />
          </div>
          </div>
        </div>

      <AnimatePresence>
        {isModalOpen && (
          <SupplierModal
            supplier={editingSupplier}
            onClose={() => {
              setIsModalOpen(false);
              setEditingSupplier(null);
            }}
          />
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminare fornitore?"
        description={supplierToDelete ? `"${supplierToDelete.ragione_sociale}" verrà rimosso dall'anagrafica.` : undefined}
        confirmLabel="Elimina"
        isBusy={deleteSupplier.isPending}
        tone="danger"
      />
    </div>
  );
}
