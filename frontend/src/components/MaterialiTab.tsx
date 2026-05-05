import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Package, MapPin, X, Loader2, Euro } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { 
  useGiacenze, 
  useMovimentiCantiere, 
  useCreaMovimento 
} from '../hooks/api/useMagazzino';
import { useWbsTree } from '../hooks/api/useWbs';
import { useAllTasks } from '../hooks/api/useTasks';
import { useAuth } from '../hooks/useAuth';
import ErrorMessage from './ErrorMessage';
import { CardListSkeleton, EmptyState, FormError, TableSkeleton, useToast } from './ui';

interface ScaricoFormData {
  articolo_id: number;
  ubicazione_da_id: number;
  quantita: number;
  wbs_node_id: string; // lo convertiamo in int o null dopo
  task_id: string;
}

const PrelevaMaterialeModal = ({ cantiereId, isOpen, onClose }: { cantiereId: number, isOpen: boolean, onClose: () => void }) => {
  const { register, handleSubmit, watch, reset } = useForm<ScaricoFormData>();
  const creaMovimento = useCreaMovimento();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  
  const { data: giacenze, isLoading: loadingG } = useGiacenze();
  const { data: wbsNodes, isLoading: loadingW } = useWbsTree(cantiereId);
  const { data: tasks = [], isLoading: loadingTasks } = useAllTasks({ cantiere_id: cantiereId });

  // Filtriamo le giacenze per mostrare solo quelle con quantità > 0
  const giacenzeDisponibili = useMemo(() => {
    if (!giacenze) return [];
    return giacenze.filter((g: any) => parseFloat(g.quantita_disponibile) > 0);
  }, [giacenze]);

  // Articoli unici tra le giacenze disponibili
  const articoliDisponibili = useMemo(() => {
    const map = new Map();
    giacenzeDisponibili.forEach((g: any) => {
      if (!map.has(g.articolo.id)) {
        map.set(g.articolo.id, g.articolo);
      }
    });
    return Array.from(map.values());
  }, [giacenzeDisponibili]);

  const selectedArticoloId = watch('articolo_id');

  const flatWbsNodes = useMemo(() => {
    const flatten = (nodes: any[], depth = 0): any[] => {
      return nodes.flatMap((node) => [
        { ...node, label: `${'—'.repeat(depth)} ${node.nome}`.trim() },
        ...(node.children ? flatten(node.children, depth + 1) : []),
      ]);
    };

    return flatten(wbsNodes ?? []);
  }, [wbsNodes]);
  
  // Ubicazioni che contengono l'articolo selezionato (e quantità > 0)
  const ubicazioniValide = useMemo(() => {
    if (!selectedArticoloId) return [];
    return giacenzeDisponibili
      .filter((g: any) => g.articolo.id === Number(selectedArticoloId))
      .map((g: any) => ({
        ...g.ubicazione,
        disp: g.quantita_disponibile
      }));
  }, [giacenzeDisponibili, selectedArticoloId]);

  const onSubmit = async (data: ScaricoFormData) => {
    setError(null);
    try {
      await creaMovimento.mutateAsync({
        tipo_movimento: 'SCARICO_CANTIERE',
        articolo_id: Number(data.articolo_id),
        ubicazione_da_id: Number(data.ubicazione_da_id),
        quantita: Number(data.quantita),
        cantiere_id: cantiereId,
        wbs_node_id: data.wbs_node_id ? Number(data.wbs_node_id) : null,
        task_id: data.task_id ? Number(data.task_id) : null,
      });
      reset();
      toast.success('Materiale prelevato', 'Il costo è stato imputato al cantiere/task selezionato.');
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Errore nello scarico materiale.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <h2 className="text-lg font-bold flex items-center gap-2 text-text-primary">
            <Package size={20} className="text-accent" />
            Preleva Materiale per Cantiere
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {(loadingG || loadingW || loadingTasks) ? (
          <div className="p-6"><CardListSkeleton rows={3} /></div>
        ) : articoliDisponibili.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} className="text-text-secondary opacity-50" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Magazzino Vuoto</h3>
            <p className="text-text-secondary text-sm">Non ci sono materiali con giacenza positiva disponibili per il prelievo.</p>
            <div className="mt-6 flex justify-center border-t border-border pt-4">
              <button onClick={onClose} className="px-6 py-2.5 bg-background border border-border text-text-primary rounded-xl font-bold hover:bg-card transition-colors">
                Chiudi
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto">
            {error && <FormError>{error}</FormError>}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Articolo da Prelevare</label>
              <select 
                {...register('articolo_id', { required: true })}
                className="p-3 md:p-3.5 bg-background border border-border rounded-xl text-sm md:text-base focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="">-- Seleziona Articolo --</option>
                {articoliDisponibili.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.codice_sku} - {a.descrizione}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Ubicazione (Seleziona Magazzino)</label>
              <select 
                {...register('ubicazione_da_id', { required: true })}
                className="p-3 md:p-3.5 bg-background border border-border rounded-xl text-sm md:text-base focus:ring-2 focus:ring-accent outline-none disabled:opacity-50"
                disabled={!selectedArticoloId}
              >
                <option value="">-- Seleziona Ubicazione --</option>
                {ubicazioniValide.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.codice} - {u.descrizione} (Disp: {u.disp})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Quantità</label>
              <input 
                type="number" step="0.01" min="0.01"
                {...register('quantita', { required: true })}
                className="p-3 md:p-3.5 bg-background border border-border rounded-xl text-sm md:text-base focus:ring-2 focus:ring-accent outline-none" 
                placeholder="Es. 5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Fase WBS (Destinazione Costo)</label>
              <select 
                {...register('wbs_node_id')}
                className="p-3 md:p-3.5 bg-background border border-border rounded-xl text-sm md:text-base focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="">-- Nessuna (Imputa al Cantiere / Radice) --</option>
                {flatWbsNodes.map((node: any) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-1">Selezionando la fase, il costo del materiale andrà ad intaccare il budget specifico di questo nodo.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Task / Attività (Job Costing)</label>
              <select
                {...register('task_id')}
                className="p-3 md:p-3.5 bg-background border border-border rounded-xl text-sm md:text-base focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="">-- Nessun task specifico --</option>
                {tasks.map((task: any) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-1">
                Selezionando un task, il costo materiale finirà nella riga Job Costing della relativa attività.
              </p>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border mt-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary hover:bg-background transition-colors"
                disabled={creaMovimento.isPending}
              >
                Annulla
              </button>
              <button 
                type="submit"
                disabled={creaMovimento.isPending}
                className="px-6 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-70 flex items-center gap-2"
              >
                {creaMovimento.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Conferma Scarico'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

interface MaterialiTabProps {
  cantiereId: number;
}

const MaterialiTab: React.FC<MaterialiTabProps> = ({ cantiereId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: movimenti, isLoading, error } = useMovimentiCantiere(cantiereId);
  const { user } = useAuth();
  
  const canPrelevare = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'].includes(user?.role ?? '');

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="md:hidden"><CardListSkeleton rows={4} /></div>
        <div className="hidden md:block"><TableSkeleton rows={5} columns={7} /></div>
      </div>
    );
  }
  if (error) return <div className="p-8"><ErrorMessage error={(error as Error).message} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Package size={22} className="text-accent" />
            Materiali Utilizzati
          </h3>
          <p className="text-sm text-text-secondary mt-1">Storico dei prelievi di magazzino associati a questo cantiere.</p>
        </div>
        {canPrelevare && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus size={18} />
            Preleva Materiale
          </button>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {(!movimenti || movimenti.length === 0) ? (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title="Nessun materiale prelevato"
              description="Non è stato ancora effettuato alcuno scarico verso questo cantiere."
              action={canPrelevare ? { label: 'Preleva materiale', onClick: () => setIsModalOpen(true) } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {movimenti.map((mov: any) => {
                const dataMov = new Date(mov.data_movimento).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
                const q = parseFloat(mov.quantita);
                const val = parseFloat(mov.valore_totale);
                return (
                  <div key={`${mov.id}-mobile`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-text-primary">{mov.articolo.descrizione}</p>
                        <span className="mt-1 inline-flex rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                          {mov.articolo.codice_sku}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-accent">
                        {q} <span className="text-xs font-normal text-text-secondary">{mov.articolo.unita_misura}</span>
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                      <span>Data: <strong className="text-text-primary">{dataMov}</strong></span>
                      <span>Valore: <strong className="text-text-primary">{val.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</strong></span>
                      <span>Ubicazione: <strong className="text-text-primary">{mov.ubicazione_da?.codice || '--'}</strong></span>
                      <span>WBS: <strong className="text-text-primary">{mov.wbs_node?.nome || 'Radice'}</strong></span>
                      <span className="col-span-2">Task: <strong className="text-text-primary">{mov.task?.title || 'Non allocato'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                <th className="px-6 py-4 font-semibold">Data e Ora</th>
                <th className="px-6 py-4 font-semibold">Articolo</th>
                <th className="px-6 py-4 font-semibold">Ubicazione Partenza</th>
                <th className="px-6 py-4 font-semibold">Destinazione WBS</th>
                <th className="px-6 py-4 font-semibold">Task</th>
                <th className="px-6 py-4 font-semibold text-right">Q.tà</th>
                <th className="px-6 py-4 font-semibold text-right">Valore (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {movimenti.map((mov: any) => {
                  const dataMov = new Date(mov.data_movimento).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
                  const q = parseFloat(mov.quantita);
                  const val = parseFloat(mov.valore_totale);
                  return (
                    <tr key={mov.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                        {dataMov}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary text-sm">{mov.articolo.descrizione}</span>
                          <span className="text-xs text-text-secondary font-mono bg-background border border-border px-1.5 py-0.5 rounded w-fit mt-1">
                            {mov.articolo.codice_sku}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-text-primary">
                          <MapPin size={14} className="text-text-secondary" />
                          {mov.ubicazione_da?.codice || '--'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary">
                        {mov.wbs_node ? mov.wbs_node.nome : <span className="text-text-secondary italic">Radice Cantiere</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-primary">
                        {mov.task ? mov.task.title : <span className="text-text-secondary italic">Non allocato</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-accent">
                          {q} <span className="text-xs text-text-secondary font-normal">{mov.articolo.unita_misura}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-text-primary">
                        {val.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && <PrelevaMaterialeModal cantiereId={cantiereId} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default MaterialiTab;
