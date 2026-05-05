import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  type CantiereSettingsPatch,
  type ProjectManagerOption,
  useCantiereSettings,
  useUpdateCantiereSettings,
} from '../hooks/api/useCantiereSettings';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { MapPin, Bell, User as UserIcon, ShieldAlert, Building2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useToast } from './ui';

// Fix per l'icona del marker di Leaflet in React
type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface SettingsFormData {
  lat: number | null;
  lng: number | null;
  raggio_tolleranza: number;
  bot_checkin_gps: boolean;
  bot_anomaly_action: string;
  bot_wbs_prompt_thr: number;
  budget_contingency: number | null;
  kpi_warning_thr: number;
  kpi_critical_thr: number;
  client_name: string;
  client_ref_email: string;
  pm_id: number | null;
  site_manager_id: number | null;
  nome: string;
  indirizzo: string;
  budget: number | null;
}

export default function CantiereSettingsTab({ cantiereId }: { cantiereId: number }) {
  const { data, isLoading, error, refetch } = useCantiereSettings(cantiereId);
  const updateSettings = useUpdateCantiereSettings(cantiereId);
  const toast = useToast();

  const { register, handleSubmit, reset, watch } = useForm<SettingsFormData>();

  useEffect(() => {
    if (data?.settings) {
      reset({
        lat: data.settings.lat ?? null,
        lng: data.settings.lng ?? null,
        raggio_tolleranza: data.settings.raggio_tolleranza ?? 200,
        bot_checkin_gps: data.settings.bot_checkin_gps ?? true,
        bot_anomaly_action: data.settings.bot_anomaly_action ?? 'LOG',
        bot_wbs_prompt_thr: data.settings.bot_wbs_prompt_thr ?? 3,
        budget_contingency: data.settings.budget_contingency ?? null,
        kpi_warning_thr: data.settings.kpi_warning_thr ?? 80,
        kpi_critical_thr: data.settings.kpi_critical_thr ?? 95,
        client_name: data.settings.client_name ?? '',
        client_ref_email: data.settings.client_ref_email ?? '',
        pm_id: data.settings.pm_id ?? null,
        site_manager_id: data.settings.site_manager_id ?? null,
        nome: data.settings.nome ?? '',
        indirizzo: data.settings.indirizzo ?? '',
        budget: data.settings.budget ?? null,
      });
    }
  }, [data, reset]);

  const onSubmit = async (formData: SettingsFormData) => {
    try {
      // transform empty strings back to null
      const { budget: _budget, ...editableFormData } = formData;
      void _budget;
      const processedData: CantiereSettingsPatch = {
        ...editableFormData,
        lat: formData.lat || null,
        lng: formData.lng || null,
        budget_contingency: formData.budget_contingency || null,
        client_name: formData.client_name || null,
        client_ref_email: formData.client_ref_email || null,
        pm_id: formData.pm_id ? Number(formData.pm_id) : null,
        site_manager_id: formData.site_manager_id ? Number(formData.site_manager_id) : null,
        nome: formData.nome || null,
        indirizzo: formData.indirizzo || null,
      };

      await updateSettings.mutateAsync(processedData);
      toast.success('Impostazioni salvate');
    } catch (err: unknown) {
      toast.error('Salvataggio non riuscito', err instanceof Error ? err.message : undefined);
    }
  };

  if (isLoading) return <Spinner label="Caricamento impostazioni..." />;
  if (error || !data) return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;

  const { pms } = data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ANAGRAFICA BASE */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4 border-b border-border pb-3">
            <Building2 size={20} className="text-info-text" />
            Anagrafica Base
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Nome Cantiere</label>
              <input type="text" {...register('nome')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="Nome Cantiere" />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Indirizzo Cantiere (Testo libero per DDT/Documenti)</label>
              <input type="text" {...register('indirizzo')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="Via Roma 1..." />
            </div>
          </div>
        </div>

        {/* LOCALIZZAZIONE E CONFIGURAZIONE BOT */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4 border-b border-border pb-3">
            <MapPin size={20} className="text-accent" />
            Localizzazione e Configurazione Bot
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
              <label className="text-sm font-semibold text-text-secondary">Latitudine</label>
              <input type="number" step="any" {...register('lat')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="Es. 45.4642" />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
              <label className="text-sm font-semibold text-text-secondary">Longitudine</label>
              <input type="number" step="any" {...register('lng')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="Es. 9.1900" />
            </div>
            
            {(watch('lat') && watch('lng')) && (
              <div className="md:col-span-2 overflow-hidden rounded-xl border border-border shadow-sm relative z-0 h-64 mt-2">
                <MapContainer 
                  center={[Number(watch('lat')), Number(watch('lng'))]} 
                  zoom={16} 
                  scrollWheelZoom={false} 
                  className="h-full w-full"
                  key={`${watch('lat')}-${watch('lng')}-${watch('raggio_tolleranza')}`}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Marker position={[Number(watch('lat')), Number(watch('lng'))]}>
                    <Popup>
                      Centro del Cantiere
                    </Popup>
                  </Marker>
                  <Circle 
                    center={[Number(watch('lat')), Number(watch('lng'))]} 
                    radius={Number(watch('raggio_tolleranza')) || 200}
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }}
                  />
                </MapContainer>
                
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${watch('lat')},${watch('lng')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 z-[1000] bg-white text-accent hover:underline font-medium px-3 py-1.5 rounded-lg shadow-md text-sm flex items-center gap-1.5"
                >
                  <MapPin size={14} /> Apri in Maps
                </a>
              </div>
            )}

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary flex items-center justify-between">
                <span>Raggio Tolleranza Check-In (metri)</span>
                <span className="text-accent">{watch('raggio_tolleranza')}m</span>
              </label>
              <input type="range" min="50" max="2000" step="50" {...register('raggio_tolleranza')} className="w-full accent-accent" />
            </div>

            <div className="flex items-center gap-3 bg-background p-4 rounded-xl border border-border md:col-span-2 mt-2">
              <input type="checkbox" id="botCheckGps" {...register('bot_checkin_gps')} className="w-5 h-5 accent-accent" />
              <label htmlFor="botCheckGps" className="text-sm font-semibold text-text-primary cursor-pointer select-none">
                Attiva Controllo GPS su Bot (obbliga Check-In in prossimità)
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Azione su Anomalia</label>
              <select {...register('bot_anomaly_action')} className="p-2.5 bg-background border border-border rounded-xl text-sm">
                <option value="LOG">Solo Log</option>
                <option value="BLOCK">Blocca Invio</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Soglia attivazione domanda WBS (Su Bot)</label>
              <input type="number" min="1" {...register('bot_wbs_prompt_thr')} className="p-2.5 bg-background border border-border rounded-xl text-sm" />
            </div>
          </div>
        </div>

        {/* BUDGET E SOGLIE ALLARME */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4 border-b border-border pb-3">
            <ShieldAlert size={20} className="text-warning-text" />
            Budget e Soglie d'Allarme
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Budget Totale Preventivato (€)</label>
              <input type="number" value={watch('budget') || ''} readOnly className="p-2.5 md:w-1/2 bg-background border border-border rounded-xl text-sm opacity-60 cursor-not-allowed font-bold" />
              <p className="text-xs text-text-secondary">Sola lettura. È la somma dei budget assegnati nelle Root WBS.</p>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Contingency Reserve (Imprevisti €)</label>
              <input type="number" step="0.01" {...register('budget_contingency')} className="p-2.5 md:w-1/2 bg-background border border-border rounded-xl text-sm" placeholder="Es. 5000" />
              <p className="text-xs text-text-secondary">Un cuscinetto di sicurezza ignorato dal calcolo avanzamento standard, ma utile a compensare eccessi.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Soglia Warning (%)</label>
              <div className="relative">
                <input type="number" min="1" max="100" {...register('kpi_warning_thr')} className="w-full p-2.5 bg-background border border-border rounded-xl text-sm" />
                <span className="absolute right-3 top-2.5 text-text-secondary">%</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Soglia Critica (%)</label>
              <div className="relative">
                <input type="number" min="1" max="100" {...register('kpi_critical_thr')} className="w-full p-2.5 bg-background border border-border rounded-xl text-sm" />
                <span className="absolute right-3 top-2.5 text-text-secondary">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM & ANAGRAFICA BASE */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4 border-b border-border pb-3">
            <UserIcon size={20} className="text-success-text" />
            Team e Committente
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Project Manager Assegnato</label>
              <select {...register('pm_id')} className="p-2.5 bg-background border border-border rounded-xl text-sm md:w-1/2">
                <option value="">-- Nessun PM --</option>
                {pms.map((pm: ProjectManagerOption) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.employee?.nome} {pm.employee?.cognome} ({pm.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-text-secondary">Capo Cantiere Assegnato (Bot/Dashboard)</label>
              <select {...register('site_manager_id')} className="p-2.5 bg-background border border-border rounded-xl text-sm md:w-1/2">
                <option value="">-- Nessun Capo Cantiere --</option>
                {pms.map((pm: ProjectManagerOption) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.employee?.nome} {pm.employee?.cognome} ({pm.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Nome Referente Cliente</label>
              <input type="text" {...register('client_name')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="Es. Mario Rossi" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary">Email Referente (Avvisi)</label>
              <input type="email" {...register('client_ref_email')} className="p-2.5 bg-background border border-border rounded-xl text-sm" placeholder="mario@cliente.com" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <button 
            type="submit" 
            disabled={updateSettings.isPending}
            className="px-6 py-2.5 bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-accent/90 focus:ring-4 ring-accent/20 transition-all disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
          </button>
        </div>

      </form>
    </div>
  );
}
