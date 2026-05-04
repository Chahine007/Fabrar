import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, MapPin, TrendingUp, AlertTriangle, 
  Plus, Box, Search, X, Loader2
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useGiacenze, useArticoli, useUbicazioni, useCreaMovimento } from '../hooks/api/useMagazzino';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

interface CaricoFormData {
  articolo_id: number;
  ubicazione_a_id: number;
  quantita: number;
  costo_acquisto: number;
}

const CaricoModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CaricoFormData>();
  const { data: articoli } = useArticoli();
  const { data: ubicazioni } = useUbicazioni();
  const creaMovimento = useCreaMovimento();

  const onSubmit = async (data: CaricoFormData) => {
    try {
      await creaMovimento.mutateAsync({
        tipo_movimento: 'CARICO',
        articolo_id: Number(data.articolo_id),
        ubicazione_a_id: Number(data.ubicazione_a_id),
        quantita: Number(data.quantita),
        costo_acquisto: Number(data.costo_acquisto)
      });
      reset();
      onClose();
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <h2 className="text-lg font-bold flex items-center gap-2 text-text-primary">
            <Plus size={20} className="text-accent" />
            Nuovo Carico Merci
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-secondary">Articolo</label>
            <select 
              {...register('articolo_id', { required: true })}
              className="p-3 bg-background border border-border rounded-xl text-sm"
            >
              <option value="">-- Seleziona Articolo --</option>
              {articoli?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.codice_sku} - {a.descrizione}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-secondary">Ubicazione di Destinazione</label>
            <select 
              {...register('ubicazione_a_id', { required: true })}
              className="p-3 bg-background border border-border rounded-xl text-sm"
            >
              <option value="">-- Seleziona Ubicazione --</option>
              {ubicazioni?.map((u: any) => (
                <option key={u.id} value={u.id}>{u.codice} - {u.descrizione}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Quantità</label>
              <input 
                type="number" step="0.01" min="0.01"
                {...register('quantita', { required: true })}
                className="p-3 bg-background border border-border rounded-xl text-sm" 
                placeholder="Es. 100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Costo Unitario (€)</label>
              <input 
                type="number" step="0.01" min="0.01"
                {...register('costo_acquisto', { required: true })}
                className="p-3 bg-background border border-border rounded-xl text-sm" 
                placeholder="Es. 5.50"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
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
              {creaMovimento.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Registra Carico'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const WarehousePage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: giacenze, isLoading, error } = useGiacenze();
  const { user } = useAuth();
  
  const canCaricare = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'PM';

  const kpis = useMemo(() => {
    if (!giacenze) return { totaleMagazzino: 0, articoliSottoscorta: 0 };
    let totale = 0;
    giacenze.forEach((g: any) => {
      const q = parseFloat(g.quantita_disponibile);
      const cmp = parseFloat(g.articolo.costo_medio);
      totale += (q * cmp);
    });
    return {
      totaleMagazzino: totale,
      articoliSottoscorta: 0 // Mock: in futuro possiamo aggiungere threshold nel DB
    };
  }, [giacenze]);

  const filteredGiacenze = useMemo(() => {
    if (!giacenze) return [];
    return giacenze.filter((g: any) => {
      const q = g.articolo.descrizione.toLowerCase() + g.articolo.codice_sku.toLowerCase();
      return q.includes(search.toLowerCase());
    });
  }, [giacenze, search]);

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner label="Caricamento magazzino..." /></div>;
  if (error) return <div className="p-8"><ErrorMessage error={(error as Error).message} /></div>;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 font-sans pb-24">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Magazzino e Logistica</h1>
          <p className="text-text-secondary mt-1 text-sm md:text-base">Gestione centralizzata inventario e giacenze</p>
        </div>
        {canCaricare && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 group active:scale-95"
          >
            <Plus size={20} className="group-hover:scale-110 transition-transform" />
            Nuovo Carico Merci
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Valore Totale</p>
            <h3 className="text-2xl font-bold text-text-primary">
              € {kpis.totaleMagazzino.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-warning-bg flex items-center justify-center text-warning-text">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Sottoscorta</p>
            <h3 className="text-2xl font-bold text-text-primary">{kpis.articoliSottoscorta} Articoli</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-success-bg flex items-center justify-center text-success-text">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Movimenti Oggi</p>
            <h3 className="text-2xl font-bold text-text-primary">--</h3>
          </div>
        </motion.div>
      </div>

      {/* Table / Grid */}
      <div className="max-w-7xl mx-auto bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-background/50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Box size={20} className="text-text-secondary" />
            Giacenze Attuali
          </h2>
          <div className="relative w-full md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Cerca articolo..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                <th className="px-6 py-4 font-semibold">SKU</th>
                <th className="px-6 py-4 font-semibold">Articolo</th>
                <th className="px-6 py-4 font-semibold">Ubicazione</th>
                <th className="px-6 py-4 font-semibold text-right">Disp.</th>
                <th className="px-6 py-4 font-semibold text-right">CMP (€)</th>
                <th className="px-6 py-4 font-semibold text-right">Valore (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredGiacenze.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    Nessuna giacenza trovata.
                  </td>
                </tr>
              ) : (
                filteredGiacenze.map((g: any) => {
                  const q = parseFloat(g.quantita_disponibile);
                  const cmp = parseFloat(g.articolo.costo_medio);
                  const val = q * cmp;
                  return (
                    <tr key={g.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono bg-background border border-border px-2 py-1 rounded text-text-secondary">
                          {g.articolo.codice_sku}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary text-sm">{g.articolo.descrizione}</p>
                        <p className="text-xs text-text-secondary mt-0.5">Misura: {g.articolo.unita_misura}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-text-primary">
                          <MapPin size={14} className="text-text-secondary" />
                          {g.ubicazione.codice}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-bold ${q > 0 ? 'text-success-text' : 'text-error'}`}>
                          {q}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-text-secondary">
                        {cmp.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-text-primary">
                        {val.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && <CaricoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default WarehousePage;
