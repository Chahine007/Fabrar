import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { useCantieri } from '../../hooks/api/useCantieri';
import { useArticoli } from '../../hooks/api/useMagazzino';
import { useCreateMaterialRequest } from '../../hooks/api/useMaterialRequests';

interface MaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RequestLineDraft {
  articolo_id: string;
  quantita: string;
  note: string;
}

const emptyLine = (): RequestLineDraft => ({
  articolo_id: '',
  quantita: '1',
  note: '',
});

export default function MaterialRequestModal({ isOpen, onClose }: MaterialRequestModalProps) {
  const [cantiereId, setCantiereId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<RequestLineDraft[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: cantieri = [], isLoading: loadingCantieri } = useCantieri();
  const { data: articoli = [], isLoading: loadingArticoli } = useArticoli();
  const createRequest = useCreateMaterialRequest();

  const sortedArticles = useMemo(() => {
    return [...(articoli as any[])].sort((a, b) =>
      `${a.codice_sku} ${a.descrizione}`.localeCompare(`${b.codice_sku} ${b.descrizione}`)
    );
  }, [articoli]);

  const updateLine = (index: number, patch: Partial<RequestLineDraft>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (index: number) => {
    setLines((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const resetAndClose = () => {
    setCantiereId('');
    setNote('');
    setLines([emptyLine()]);
    setFormError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsedCantiereId = Number(cantiereId);
    const parsedLines = lines
      .map((line) => ({
        articolo_id: Number(line.articolo_id),
        quantita: Number(line.quantita),
        note: line.note.trim() || null,
      }))
      .filter((line) => Number.isInteger(line.articolo_id) && line.articolo_id > 0 && Number.isInteger(line.quantita) && line.quantita > 0);

    if (!Number.isInteger(parsedCantiereId) || parsedCantiereId <= 0) {
      setFormError('Seleziona un cantiere.');
      return;
    }

    if (parsedLines.length === 0) {
      setFormError('Aggiungi almeno una riga materiale valida.');
      return;
    }

    try {
      await createRequest.mutateAsync({
        cantiere_id: parsedCantiereId,
        note: note.trim() || null,
        righe: parsedLines,
      });
      resetAndClose();
    } catch (err: any) {
      setFormError(err.message ?? 'Errore durante la creazione della richiesta.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-3xl rounded-2xl shadow-xl border border-border overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-background">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Package size={20} className="text-accent" />
              Nuova Richiesta Materiali
            </h2>
            <p className="text-sm text-text-secondary mt-1">Seleziona il cantiere e i materiali necessari.</p>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-xl text-text-secondary hover:bg-card hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto">
          {formError && (
            <div className="rounded-xl border border-danger-text/20 bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Cantiere</label>
              <select
                value={cantiereId}
                onChange={(event) => setCantiereId(event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                disabled={loadingCantieri}
              >
                <option value="">-- Seleziona Cantiere --</option>
                {(cantieri as any[]).map((cantiere) => (
                  <option key={cantiere.id} value={cantiere.id}>
                    {cantiere.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Note generali</label>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full p-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                placeholder="Es. materiale urgente per avanzamento lavori"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Righe richiesta</h3>
              <button
                type="button"
                onClick={addLine}
                className="px-3 py-2 rounded-xl bg-accent/10 text-accent text-sm font-bold flex items-center gap-2 hover:bg-accent/15"
              >
                <Plus size={16} />
                Aggiungi Riga
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_44px] gap-3 bg-background border border-border rounded-2xl p-3">
                  <select
                    value={line.articolo_id}
                    onChange={(event) => updateLine(index, { articolo_id: event.target.value })}
                    className="p-3 bg-card border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                    disabled={loadingArticoli}
                  >
                    <option value="">-- Articolo --</option>
                    {sortedArticles.map((articolo: any) => (
                      <option key={articolo.id} value={articolo.id}>
                        {articolo.codice_sku} - {articolo.descrizione}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantita}
                    onChange={(event) => updateLine(index, { quantita: event.target.value })}
                    className="p-3 bg-card border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                    placeholder="Q.tà"
                  />
                  <input
                    value={line.note}
                    onChange={(event) => updateLine(index, { note: event.target.value })}
                    className="p-3 bg-card border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
                    placeholder="Note riga"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="h-11 w-11 rounded-xl text-danger-text hover:bg-danger-bg disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
                    title="Rimuovi riga"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:bg-background"
              disabled={createRequest.isPending}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createRequest.isPending}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold shadow-md shadow-accent/20 hover:bg-accent/90 disabled:opacity-70 flex items-center gap-2"
            >
              {createRequest.isPending && <Loader2 size={16} className="animate-spin" />}
              Invia Richiesta
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
