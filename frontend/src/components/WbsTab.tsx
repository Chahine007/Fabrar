import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, BarChart3, Building2, Euro, Hash, Plus, RefreshCw, X } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '../lib/utils';
import { useCreateWbsNode, useDeleteWbsNode, useUpdateWbsNode, useWbsTree } from '../hooks/api/useWbs';
import type { WbsNode, WbsNodeUpdateFields } from '../types/wbs';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { ConfirmDialog, useToast } from './ui';

interface WbsNodeRowProps {
  node: WbsNode;
  depth: number;
  onAddSub: (id: number) => void;
  onUpdate: (id: number, fields: WbsNodeUpdateFields) => void;
  onDelete: (id: number) => void;
}

function WbsNodeRow({ node, depth, onAddSub, onUpdate, onDelete }: WbsNodeRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(node.nome);
  const [editBudget, setEditBudget] = useState(node.budget_preventivato?.toString() ?? '');

  const handleSave = () => {
    onUpdate(node.id, {
      nome: editNome,
      budget_preventivato: editBudget === '' ? null : parseFloat(editBudget),
    });
    setIsEditing(false);
  };

  const pct = node.avanzamento_pct;
  const statusColor = !pct ? 'bg-border' : pct > 100 ? 'bg-danger-text' : pct > 85 ? 'bg-amber-500' : 'bg-success-text';

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "group flex items-center justify-between p-4 rounded-2xl border transition-all",
          depth === 0 ? "bg-accent/5 border-accent/20" : "bg-card border-border hover:border-accent/30",
          node.parent_id === null ? "ml-0" : depth === 1 ? "ml-8" : "ml-16"
        )}
      >
        <div className="flex items-center gap-4 flex-1">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              depth === 0 ? "bg-accent text-white" : "bg-background text-text-secondary border border-border"
            )}
          >
            {depth === 0 ? <Building2 size={20} /> : depth === 1 ? <Activity size={18} /> : <Hash size={16} />}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                className="bg-background border border-accent rounded-lg px-2 py-1 text-sm outline-none w-full max-w-[200px]"
                value={editNome}
                onChange={(event) => setEditNome(event.target.value)}
              />
              <div className="relative">
                <Euro size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  className="bg-background border border-accent rounded-lg pl-6 pr-2 py-1 text-sm outline-none w-24"
                  type="number"
                  placeholder="Budget"
                  value={editBudget}
                  onChange={(event) => setEditBudget(event.target.value)}
                />
              </div>
              <button onClick={handleSave} className="p-1 px-2 bg-accent text-white rounded-lg text-xs font-bold">Salva</button>
              <button onClick={() => setIsEditing(false)} className="p-1 px-2 bg-background border border-border rounded-lg text-xs">X</button>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-text-primary">{node.nome}</p>
                {node.is_variant && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold uppercase">
                    Variante
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-0.5 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Euro size={12} /> Prev: <b>{node.budget_preventivato ? node.budget_preventivato.toLocaleString() : '-'}</b>
                </span>
                <span className="flex items-center gap-1 font-medium text-text-primary">
                  <Activity size={12} /> Real: <b>{node.burn.totale.toLocaleString()} €</b>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {pct !== null && (
            <div className="hidden md:block w-32">
              <div className="flex items-center justify-between text-[10px] mb-1 font-bold italic">
                <span>Burn Rate</span>
                <span className={pct > 100 ? "text-danger-text" : "text-text-primary"}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-background border border-border rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct, 100)}%` }}
                  className={cn("h-full rounded-full transition-colors", statusColor)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {depth < 2 && (
              <button
                onClick={() => onAddSub(node.id)}
                className="p-2 text-text-secondary hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                title="Aggiungi sottofase"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-text-secondary hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <RefreshCw size={18} />
            </button>
            {node.parent_id !== null && (
              <button
                onClick={() => onDelete(node.id)}
                className="p-2 text-text-secondary hover:text-danger-text hover:bg-danger-bg rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <WbsNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddSub={onAddSub}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WbsTab({ cantiereId }: { cantiereId: number }) {
  const { data: tree, isLoading, error } = useWbsTree(cantiereId);
  const createMut = useCreateWbsNode(cantiereId);
  const updateMut = useUpdateWbsNode(cantiereId);
  const deleteMut = useDeleteWbsNode(cantiereId);
  const toast = useToast();

  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootNome, setNewRootNome] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<number | null>(null);

  const handleAddNode = async (parentId: number | null, nome: string) => {
    try {
      await createMut.mutateAsync({
        nome: nome || "Nuova Fase",
        parent_id: parentId,
        budget_preventivato: 0,
      });
      setIsAddingRoot(false);
      setNewRootNome('');
    } catch (err: unknown) {
      toast.error('Creazione fase non riuscita', err instanceof Error ? err.message : 'Errore creazione fase.');
    }
  };

  const handleUpdate = async (nodeId: number, fields: WbsNodeUpdateFields) => {
    try {
      await updateMut.mutateAsync({ nodeId, ...fields });
    } catch (err: unknown) {
      toast.error('Aggiornamento fase non riuscito', err instanceof Error ? err.message : 'Errore aggiornamento fase.');
    }
  };

  const confirmDelete = async () => {
    if (nodeToDelete == null) return;
    try {
      await deleteMut.mutateAsync(nodeToDelete);
      toast.success('Fase eliminata');
      setNodeToDelete(null);
    } catch (err: unknown) {
      toast.error('Eliminazione fase non riuscita', err instanceof Error ? err.message : 'Errore eliminazione fase.');
    }
  };

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento struttura WBS..." /></div>;
  if (error) return <ErrorMessage error={(error as Error).message} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-text-primary">The Job Costing Engine</h3>
          <p className="text-sm text-text-secondary">Analisi granulare dei costi per fase (WBS)</p>
        </div>
        <button
          onClick={() => setIsAddingRoot(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
        >
          <Plus size={16} /> Aggiungi Fase Root
        </button>
      </div>

      <AnimatePresence>
        {isAddingRoot && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-background p-4 rounded-2xl border-2 border-dashed border-accent/30">
              <input
                autoFocus
                placeholder="Nome nuova fase root..."
                className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                value={newRootNome}
                onChange={(event) => setNewRootNome(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddNode(null, newRootNome)}
              />
              <button
                onClick={() => handleAddNode(null, newRootNome)}
                className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-bold"
              >
                Conferma
              </button>
              <button onClick={() => setIsAddingRoot(false)} className="text-text-secondary"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {tree?.map((node) => (
          <WbsNodeRow
            key={node.id}
            node={node}
            depth={0}
            onAddSub={(parentId) => handleAddNode(parentId, "Nuova Sottofase")}
            onUpdate={handleUpdate}
            onDelete={setNodeToDelete}
          />
        ))}
        {(!tree || tree.length === 0) && (
          <div className="py-20 text-center text-text-secondary italic">
            Nessuna fase definita. Clicca su "Aggiungi Fase Root" per iniziare.
          </div>
        )}
      </div>

      <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
        <h4 className="font-bold text-text-primary mb-6 flex items-center gap-2">
          <BarChart3 size={18} className="text-accent" /> Confronto Preventivo vs Reale
        </h4>
        {tree && tree.length > 0 ? (
          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tree}>
                <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="budget_preventivato" name="Preventivo" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="burn.totale" name="Costo Reale" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-2xl text-text-secondary text-sm">
            Nessun dato grafico disponibile
          </div>
        )}
      </div>

      <ConfirmDialog
        open={nodeToDelete != null}
        onClose={() => setNodeToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminare fase WBS?"
        description="L'operazione fallirà se ci sono costi o sottofasi collegate."
        confirmLabel="Elimina"
        loading={deleteMut.isPending}
        variant="danger"
      />
    </div>
  );
}
