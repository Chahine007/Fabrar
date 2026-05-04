import React from 'react';
import { motion } from 'motion/react';
import { Package, AlertTriangle, TrendingUp, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWarehouseKPIs } from '../../hooks/api/useDashboard';
import Spinner from '../Spinner';

const fmt = (v: number) => `€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;

export default function WarehouseTab() {
  const { data, isLoading, error } = useWarehouseKPIs();

  if (isLoading) return <Spinner label="Caricamento dati magazzino..." />;
  if (error || !data) return <p className="text-danger-text text-sm">Errore caricamento dati magazzino.</p>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Capitale Immobilizzato', value: fmt(data.capitaleImmobilizzato), icon: Package,    color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Articoli a Giacenza',    value: String(data.totalArticoli),      icon: Layers,     color: 'text-accent',     bg: 'bg-accent/10' },
          { label: 'Movimenti Totali',       value: String(data.totalMovimenti),     icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl', bg, color)}><Icon size={20} /></div>
            <div><p className="text-xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary font-medium mt-0.5">{label}</p></div>
          </motion.div>
        ))}
      </div>

      {/* Dead Stock */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" /> Dead Stock (senza movimenti da 60+ giorni)
        </h3>
        {data.deadStock.length === 0 ? (
          <p className="text-sm text-text-secondary italic">Nessun articolo in dead stock — ottimo! 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-left">Descrizione</th>
                <th className="px-4 py-2 text-right">Qtà</th>
                <th className="px-4 py-2 text-right">Valore</th>
                <th className="px-4 py-2 text-right">Ultimo Mov.</th>
              </tr></thead>
              <tbody>
                {data.deadStock.map(item => (
                  <tr key={item.articolo_id} className="border-b border-border/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{item.codice_sku}</td>
                    <td className="px-4 py-2.5 font-medium text-text-primary truncate max-w-[200px]">{item.descrizione}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">{item.quantita}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-500">{fmt(item.valore)}</td>
                    <td className="px-4 py-2.5 text-right text-text-secondary text-xs">
                      {item.ultimo_movimento ? new Date(item.ultimo_movimento).toLocaleDateString('it-IT') : 'Mai'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
