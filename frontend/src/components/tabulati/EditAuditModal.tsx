import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Pencil, X } from 'lucide-react';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useUpdateReportEntry } from '../../hooks/api/useHr';
import type { AuditEntry } from '../../hooks/api/useHr';
import { useToast } from '../ui';

export function EditAuditModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const update = useUpdateReportEntry();
  const { data: cantieri } = useCantieri();
  const toast = useToast();
  const [ore, setOre] = useState(String(entry.value));
  const [cid, setCid] = useState('');
  const [note, setNote] = useState(entry.note ?? '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await update.mutateAsync({
        id: entry.id,
        data: {
          ore_lavorate: parseFloat(ore) || undefined,
          cantiere_id: cid ? Number(cid) : undefined,
          attivita_svolte: note || null,
        },
      });
      onClose();
    } catch (err) {
      toast.error('Salvataggio non riuscito', (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
            <Pencil size={18} className="text-accent" />
            Modifica Timbratura
          </h2>
          <button onClick={onClose} className="rounded-xl p-1.5 text-text-secondary hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-0.5 rounded-2xl border border-border bg-background p-4 text-sm text-text-secondary">
          <p className="font-bold text-text-primary">{entry.nome} {entry.cognome}</p>
          <p>Data: {new Date(entry.date).toLocaleDateString('it-IT')}</p>
          <p>Cantiere: <span className="font-medium text-text-primary">{entry.cantiere_nome ?? '—'}</span></p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {entry.type === 'ore' && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Ore Lavorate</label>
              <input
                id="edit-ore"
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={ore}
                onChange={(event) => setOre(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Cantiere</label>
            <select
              id="edit-cantiere"
              value={cid}
              onChange={(event) => setCid(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">— Mantieni attuale —</option>
              {(cantieri ?? []).map((cantiere) => (
                <option key={cantiere.id} value={cantiere.id}>{cantiere.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-secondary">Note</label>
            <textarea
              id="edit-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold text-text-secondary transition-colors hover:bg-background"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {update.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Salvataggio...
                </>
              ) : 'Salva'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
