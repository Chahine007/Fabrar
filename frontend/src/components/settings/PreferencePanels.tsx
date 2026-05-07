import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Globe,
  Loader2,
  Mail,
  Moon,
  Smartphone,
  Sun,
} from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  SectionHeader,
  StatusBox,
  TIMEZONE_OPTIONS,
  Toggle,
} from './settingsShared';
import {
  UserNotificationSettings,
  UserPreferenceSettings,
  useUpdateUserSettings,
  useUserSettings,
} from '../../hooks/api/useUserSettings';

export function NotificationsPanel() {
  const { data, isLoading, error } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const settings = data?.settings.notifications;

  const rows = [
    { key: 'email', label: 'Notifiche email', desc: 'Riepiloghi e avvisi importanti via email.', icon: Mail },
    { key: 'push', label: 'Notifiche browser', desc: 'Aggiornamenti operativi quando sei online.', icon: Smartphone },
    { key: 'telegram', label: 'Avvisi Telegram', desc: 'Notifiche critiche sul bot collegato al tuo profilo.', icon: Globe },
    { key: 'dailySummary', label: 'Riepilogo giornaliero', desc: 'Sintesi quotidiana di attività, ore e messaggi.', icon: Clock },
    { key: 'criticalAlerts', label: 'Alert critici', desc: 'Segnalazioni prioritarie su sicurezza e anomalie operative.', icon: AlertCircle },
  ] as const;

  const toggle = (key: keyof UserNotificationSettings) => {
    if (!settings) return;
    updateSettings.mutate({
      notifications: {
        ...settings,
        [key]: !settings[key],
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Notifiche" description="Canali e priorità salvati sul tuo profilo utente." />

      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento preferenze notifiche...</StatusBox>}

      {settings && (
        <div className="space-y-4">
          {rows.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-background border border-border">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2 bg-card rounded-xl shadow-sm text-text-secondary">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{label}</p>
                  <p className="text-xs text-text-secondary">{desc}</p>
                </div>
              </div>
              <Toggle
                checked={Boolean(settings[key])}
                disabled={updateSettings.isPending}
                onChange={() => toggle(key)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreferencesPanel() {
  const { data, isLoading, error } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const [draft, setDraft] = useState<UserPreferenceSettings | null>(null);

  useEffect(() => {
    if (data?.settings.preferences) {
      setDraft(data.settings.preferences);
      document.documentElement.classList.toggle('dark', data.settings.preferences.theme === 'dark');
    }
  }, [data?.settings.preferences]);

  const updateDraft = (patch: Partial<UserPreferenceSettings>) => {
    setDraft((current) => {
      const next = { ...(current ?? data?.settings.preferences), ...patch } as UserPreferenceSettings;
      if (patch.theme) {
        document.documentElement.classList.toggle('dark', patch.theme === 'dark');
        updateSettings.mutate({ preferences: next });
      }
      return next;
    });
  };

  const save = async () => {
    if (!draft) return;
    await updateSettings.mutateAsync({ preferences: draft });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Preferenze" description="Tema, lingua e formato dati persistiti sul tuo account." />

      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento preferenze...</StatusBox>}

      {draft && (
        <div className="p-6 rounded-2xl bg-background border border-border space-y-6 max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-card rounded-xl text-text-secondary">
                {draft.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} className="text-amber-500" />}
              </div>
              <div>
                <p className="font-semibold text-text-primary">Tema scuro</p>
                <p className="text-xs text-text-secondary">Applicato subito e salvato sul profilo.</p>
              </div>
            </div>
            <Toggle
              checked={draft.theme === 'dark'}
              disabled={updateSettings.isPending}
              onChange={() => updateDraft({ theme: draft.theme === 'dark' ? 'light' : 'dark' })}
            />
          </div>

          <div className="h-px bg-border" />

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-text-secondary">Lingua</span>
              <select
                value={draft.language}
                onChange={(event) => updateDraft({ language: event.target.value as UserPreferenceSettings['language'] })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-text-secondary">Timezone</span>
              <select
                value={draft.timezone}
                onChange={(event) => updateDraft({ timezone: event.target.value })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary"
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-text-secondary">Formato data</span>
              <select
                value={draft.dateFormat}
                onChange={(event) => updateDraft({ dateFormat: event.target.value as UserPreferenceSettings['dateFormat'] })}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
          </div>

          <button
            onClick={save}
            disabled={updateSettings.isPending}
            className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {updateSettings.isPending && <Loader2 size={16} className="animate-spin" />}
            Salva preferenze
          </button>
        </div>
      )}
    </div>
  );
}
