import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useWbsTree } from '../../../hooks/api/useWbs';
import { useAddMaterialToCantiere, useCantiereMaterials, usePricebook } from '../../../hooks/api/useWarehouse';
import type { WbsNode, WbsSelectOption } from '../../../types/wbs';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import { useToast } from '../../ui';

function flattenWbs(nodes: WbsNode[], depth = 0): WbsSelectOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, nome: node.nome, label: `${'—'.repeat(depth)} ${node.nome}`.trim() },
    ...flattenWbs(node.children, depth + 1),
  ]);
}

export default function WarehouseTab({ cantiereId }: { cantiereId: number }) {
  const { data: materials = [], isLoading, error } = useCantiereMaterials(cantiereId);
  const { data: pricebook = [] } = usePricebook();
  const { data: tree = [] } = useWbsTree(cantiereId);
  const addMaterial = useAddMaterialToCantiere(cantiereId);
  const toast = useToast();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [wbsNode, setWbsNode] = useState('');

  const flatWbs = useMemo(() => flattenWbs(tree), [tree]);

  const handleAdd = async () => {
    if (!selectedMaterial || !quantity) return;

    const material = pricebook.find((item) => item.id.toString() === selectedMaterial);
    if (!material) return;

    const quantityValue = parseFloat(quantity);
    const unitCost = Number(material.costo_unitario);

    try {
      await addMaterial.mutateAsync({
        pricebook_id: material.id,
        quantita: quantityValue,
        importo: quantityValue * unitCost,
        wbs_node_id: wbsNode ? parseInt(wbsNode, 10) : null,
      });
      setIsDrawerOpen(false);
      setSelectedMaterial('');
      setQuantity('1');
      setWbsNode('');
      toast.success('Materiale aggiunto al cantiere');
    } catch (error: unknown) {
      toast.error('Prelievo non riuscito', error instanceof Error ? error.message : 'Errore prelievo materiale.');
    }
  };

  if (isLoading) return <Spinner label="Caricamento magazzino..." />;
  if (error) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Materiali di Cantiere</h3>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} /> Preleva dal Magazzino
        </button>
      </div>

      {isDrawerOpen && (
        <div className="bg-card p-6 rounded-3xl border border-border flex flex-col gap-4 mb-6 shadow-sm">
          <h4 className="font-bold border-b border-border pb-2">Nuovo Prelievo Materiale</h4>
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={selectedMaterial}
              onChange={(event) => setSelectedMaterial(event.target.value)}
              className="flex-1 min-w-[200px] p-2 bg-background border border-border rounded-xl text-sm outline-none"
            >
              <option value="">-- Seleziona Materiale --</option>
              {pricebook.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} (€{item.costo_unitario}/{item.unita})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Quantita"
              className="w-24 p-2 bg-background border border-border rounded-xl text-sm outline-none"
            />
            <select
              value={wbsNode}
              onChange={(event) => setWbsNode(event.target.value)}
              className="flex-1 min-w-[200px] p-2 bg-background border border-border rounded-xl text-sm outline-none"
            >
              <option value="">-- Assegna a WBS (Opzionale) --</option>
              {flatWbs.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Annulla</button>
            <button onClick={handleAdd} disabled={addMaterial.isPending} className="px-4 py-2 text-sm bg-accent text-white rounded-xl font-bold hover:bg-accent/90 disabled:opacity-50">
              {addMaterial.isPending ? 'Salvataggio...' : 'Conferma Prelievo'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-background border-b border-border">
            <tr className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              <th className="p-4">Materiale</th>
              <th className="p-4">Quantita</th>
              <th className="p-4">Costo Tot.</th>
              <th className="p-4">WBS Associata</th>
              <th className="p-4">Data Prelievo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {materials.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-text-secondary">Nessun materiale prelevato.</td>
              </tr>
            ) : materials.map((material) => (
              <tr key={material.id} className="hover:bg-background/50">
                <td className="p-4 font-semibold text-text-primary">{material.pricebook?.nome}</td>
                <td className="p-4 text-text-secondary">
                  {material.quantita} {material.pricebook?.unita}
                </td>
                <td className="p-4 font-bold text-text-primary">
                  €{Number(material.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-4">
                  <span className={cn('px-2 py-1 rounded-md text-xs font-bold', material.wbs_node ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-background text-text-secondary')}>
                    {material.wbs_node ? material.wbs_node.nome : '—'}
                  </span>
                </td>
                <td className="p-4 text-text-secondary">{new Date(material.timestamp_utc).toLocaleDateString('it-IT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
