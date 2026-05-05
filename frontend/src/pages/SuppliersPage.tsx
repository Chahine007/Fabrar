import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Edit2, Loader2, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import {
  Supplier,
  SupplierPayload,
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '../hooks/api/useSuppliers';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

interface SupplierModalProps {
  supplier: Supplier | null;
  onClose: () => void;
}

const emptyPayload: SupplierPayload = {
  ragione_sociale: '',
  partita_iva: '',
  email: '',
  telefono: '',
  indirizzo: '',
  note: '',
};

function normalizePayload(payload: SupplierPayload): SupplierPayload {
  return {
    ragione_sociale: payload.ragione_sociale.trim(),
    partita_iva: payload.partita_iva?.trim() || null,
    email: payload.email?.trim() || null,
    telefono: payload.telefono?.trim() || null,
    indirizzo: payload.indirizzo?.trim() || null,
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
            email: supplier.email ?? '',
            telefono: supplier.telefono ?? '',
            indirizzo: supplier.indirizzo ?? '',
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
    } catch (err: any) {
      setError(err.message ?? 'Errore salvataggio fornitore.');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-background">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Truck size={20} className="text-accent" />
              {isEditing ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">Anagrafica fornitore per carichi e DDT.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-text-secondary hover:bg-card hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-danger-text/20 bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Ragione Sociale</label>
              <input
                value={form.ragione_sociale}
                onChange={(event) => updateField('ragione_sociale', event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                placeholder="Es. Rossi Materiali S.r.l."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Partita IVA</label>
              <input
                value={form.partita_iva ?? ''}
                onChange={(event) => updateField('partita_iva', event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Email</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(event) => updateField('email', event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Telefono</label>
              <input
                value={form.telefono ?? ''}
                onChange={(event) => updateField('telefono', event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Indirizzo</label>
              <input
                value={form.indirizzo ?? ''}
                onChange={(event) => updateField('indirizzo', event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Note</label>
              <textarea
                value={form.note ?? ''}
                onChange={(event) => updateField('note', event.target.value)}
                rows={3}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:bg-background" disabled={isSaving}>
              Annulla
            </button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold shadow-md shadow-accent/20 hover:bg-accent/90 disabled:opacity-70 flex items-center gap-2">
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              Salva
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: suppliers = [], isLoading, error } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();

  const filteredSuppliers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      [
        supplier.ragione_sociale,
        supplier.partita_iva,
        supplier.email,
        supplier.telefono,
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
    if (!window.confirm(`Eliminare il fornitore "${supplier.ragione_sociale}"?`)) return;
    await deleteSupplier.mutateAsync(supplier.id);
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner label="Caricamento fornitori..." /></div>;
  if (error) return <div className="p-8"><ErrorMessage error={(error as Error).message} /></div>;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Fornitori</h1>
            <p className="text-text-secondary mt-1 text-sm md:text-base">Anagrafiche collegate a carichi, articoli e documenti DDT.</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={20} />
            Nuovo Fornitore
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-background/50 flex flex-col md:flex-row gap-4 justify-between items-center">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Building2 size={20} className="text-text-secondary" />
              Anagrafiche Fornitori
            </h2>
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                  <th className="px-6 py-4 font-semibold">Ragione Sociale</th>
                  <th className="px-6 py-4 font-semibold">P.IVA</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Telefono</th>
                  <th className="px-6 py-4 font-semibold text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
                      Nessun fornitore trovato.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-text-primary text-sm">{supplier.ragione_sociale}</p>
                        {supplier.indirizzo && <p className="text-xs text-text-secondary mt-1">{supplier.indirizzo}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{supplier.partita_iva || '--'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{supplier.email || '--'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{supplier.telefono || '--'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(supplier)}
                            className="p-2 rounded-xl text-text-secondary hover:text-accent hover:bg-accent/10"
                            title="Modifica"
                          >
                            <Edit2 size={17} />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier)}
                            disabled={deleteSupplier.isPending}
                            className="p-2 rounded-xl text-text-secondary hover:text-danger-text hover:bg-danger-bg disabled:opacity-50"
                            title="Elimina"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
    </div>
  );
}
