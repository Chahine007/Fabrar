import { Activity, AlertCircle } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import { useCantiereDetail } from '../../../hooks/api/useCantieri';
import { GpsSetButton, MetricCard } from './shared';

type LeafletDefaultIconPrototype = typeof L.Icon.Default.prototype & { _getIconUrl?: string };

const defaultIconPrototype = L.Icon.Default.prototype as LeafletDefaultIconPrototype;
delete defaultIconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function OverviewTab({ cantiereId }: { cantiereId: number }) {
  const { data, isLoading, error, refetch } = useCantiereDetail(cantiereId);

  if (isLoading) return <Spinner label="Caricamento dettagli cantiere..." />;
  if (error || !data) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  const { kpi, perDipendente } = data;
  const avanzamento = kpi.budget > 0 ? Math.min(100, Math.round((kpi.costoTotale / kpi.budget) * 100)) : 0;
  const remaining = Math.max(0, kpi.budget - kpi.costoTotale);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Avanzamento"
          value={`${avanzamento}%`}
          sub={avanzamento >= 80 ? 'In linea con i tempi' : 'Monitorare progressi'}
          trend={avanzamento >= 80 ? 'positive' : avanzamento >= 50 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="Budget Residuo"
          value={`€${remaining.toLocaleString('it-IT')}`}
          sub={`di €${kpi.budget.toLocaleString('it-IT')} totali`}
          trend={remaining > 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          title="Costo Reale"
          value={`€${kpi.costoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          sub={`Manodopera: €${kpi.costoManodopera.toLocaleString('it-IT')} | Mag: €${kpi.costoMateriali.toLocaleString('it-IT')} | Spese: €${(kpi.costoSpese ?? 0).toLocaleString('it-IT')}`}
          trend={kpi.costoTotale <= kpi.budget ? 'positive' : 'negative'}
        />
      </div>

      <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Activity size={20} /> Ore per Dipendente (Dati Reali)
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {perDipendente.length > 0 ? (
              <div className="space-y-3">
                {perDipendente.map((dipendente, index) => (
                  <div key={`${dipendente.nome ?? 'nd'}-${index}`} className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border">
                    <div>
                      <p className="font-bold text-text-primary text-sm">
                        {`${dipendente.nome || ''} ${dipendente.cognome || ''}`.trim() || 'N/D'}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Ultimo log: {dipendente.ultimo_accesso || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-text-primary">{dipendente.ore_tot}h</p>
                      <p className="text-xs text-text-secondary">€{dipendente.costo_calcolato.toLocaleString('it-IT')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-sm py-4">Nessuna attività registrata.</p>
            )}
          </div>

          <div className="flex flex-col h-[350px]">
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Geolocalizzazione Cantiere</h4>
            {data.cantiere.lat && data.cantiere.lng ? (
              <div className="flex-1 rounded-2xl overflow-hidden border border-border shadow-inner relative z-0">
                <MapContainer
                  center={[data.cantiere.lat, data.cantiere.lng]}
                  zoom={15}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />
                  <Marker position={[data.cantiere.lat, data.cantiere.lng]}>
                    <Popup>{data.cantiere.nome}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="flex-1 rounded-2xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-text-secondary text-sm gap-3">
                <AlertCircle className="opacity-50" size={32} />
                <span>Coordinate GPS non impostate.</span>
                <GpsSetButton cantiereId={cantiereId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
