import { useState } from 'react';
import { useUpdateGps } from '../../../hooks/api/useCantieri';
import { useToast } from '../../ui';
import { cn } from '../../../lib/utils';

export function MetricCard({
  title,
  value,
  sub,
  trend,
}: {
  title: string;
  value: string;
  sub: string;
  trend?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="bg-card p-6 rounded-3xl border border-border shadow-sm transition-colors duration-300">
      <p className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">{title}</p>
      <h3 className="text-3xl font-bold text-text-primary">{value}</h3>
      <p
        className={cn(
          'text-sm font-medium mt-2',
          trend === 'positive'
            ? 'text-success-text'
            : trend === 'negative'
              ? 'text-danger-text'
              : 'text-text-secondary'
        )}
      >
        {sub}
      </p>
    </div>
  );
}

export function GpsSetButton({ cantiereId }: { cantiereId: number }) {
  const updateGps = useUpdateGps(cantiereId);
  const toast = useToast();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      toast.error('Coordinate non valide', 'Inserisci valori numerici validi.');
      return;
    }

    try {
      await updateGps.mutateAsync({ lat: latN, lng: lngN });
      toast.success('Coordinate aggiornate');
      setOpen(false);
    } catch (error: unknown) {
      toast.error('Aggiornamento GPS non riuscito', error instanceof Error ? error.message : 'Errore aggiornamento GPS.');
    }
  };

  return open ? (
    <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-2xl w-full max-w-xs">
      <p className="text-xs font-bold text-text-secondary">Imposta coordinate manualmente</p>
      <input value={lat} onChange={(event) => setLat(event.target.value)} placeholder="Latitudine (es. 45.4654)" className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
      <input value={lng} onChange={(event) => setLng(event.target.value)} placeholder="Longitudine (es. 9.1859)" className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={updateGps.isPending} className="flex-1 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-50">
          {updateGps.isPending ? 'Salvataggio...' : 'Salva'}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-2 bg-background border border-border text-xs rounded-xl hover:bg-card transition-colors">
          Annulla
        </button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="px-4 py-2 bg-accent/10 text-accent border border-accent/20 text-xs font-bold rounded-xl hover:bg-accent/20 transition-colors">
      📍 Imposta Coordinate
    </button>
  );
}
