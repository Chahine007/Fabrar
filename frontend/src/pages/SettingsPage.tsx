import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  History,
  Key,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  Moon,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sun,
  User,
  X,
  Settings as SettingsIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getTokenPayload } from '../lib/api';
import { useAuthContext } from '../context/AuthContext';
import { AccountSettingsPanel } from '../components/settings/AccountSettingsPanel';
import { useMe } from '../hooks/api/useAuth';
import { useAllTasks } from '../hooks/api/useTasks';
import { useAudit } from '../hooks/api/useHr';
import { useCreateConversation } from '../hooks/api/useConversations';
import {
  MaterialRequest,
  UserNotificationSettings,
  UserPreferenceSettings,
  useChangePassword,
  useMyMaterialRequests,
  useSupportContact,
  useUpdateUserSettings,
  useUserSettings,
} from '../hooks/api/useUserSettings';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'Settings' | 'Security' | 'My Work' | 'System';
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'account', label: 'Il mio account', icon: User, group: 'Settings' },
  { id: 'notifications', label: 'Notifiche', icon: Bell, group: 'Settings' },
  { id: 'preferences', label: 'Preferenze', icon: SettingsIcon, group: 'Settings' },
  { id: 'password', label: 'Password', icon: Key, group: 'Security' },
  { id: 'sessions', label: 'Sessione attiva', icon: History, group: 'Security' },
  { id: '2fa', label: 'Sicurezza accesso', icon: ShieldCheck, group: 'Security' },
  { id: 'activities', label: 'Le mie attività', icon: Briefcase, group: 'My Work' },
  { id: 'hours', label: 'Le mie ore e spese', icon: Clock, group: 'My Work' },
  { id: 'orders', label: 'Richieste materiali', icon: ShoppingBag, group: 'My Work' },
  { id: 'roles', label: 'Ruoli e permessi', icon: ShieldCheck, group: 'System' },
  { id: 'company', label: 'Azienda', icon: Building2, group: 'System' },
  { id: 'support', label: 'Supporto', icon: LifeBuoy, group: 'System' },
  { id: 'help', label: 'Guida', icon: BookOpen, group: 'System' },
];

const GROUP_LABELS: Record<SettingsSection['group'], string> = {
  Settings: 'Impostazioni',
  Security: 'Sicurezza',
  'My Work': 'Il mio lavoro',
  System: 'Sistema',
};

const LANGUAGE_OPTIONS = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
] as const;

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
];

const PERMISSIONS = [
  { area: 'Dashboard e finanza', admin: true, hr: false, pm: false, worker: false },
  { area: 'Gestione personale', admin: true, hr: true, pm: false, worker: false },
  { area: 'Cantieri e attività', admin: true, hr: true, pm: true, worker: true },
  { area: 'Le proprie ore e spese', admin: true, hr: true, pm: true, worker: true },
  { area: 'Magazzino', admin: true, hr: false, pm: false, worker: false },
  { area: 'Messaggi', admin: true, hr: true, pm: true, worker: true },
];

function getValidSettingsSection(section: string | undefined) {
  return SETTINGS_SECTIONS.some((item) => item.id === section) ? section! : 'account';
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return date.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(value?: string | null) {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return date.toLocaleDateString('it-IT');
}

function formatCurrency(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatQuantity(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

function getCurrentEmployeeName(me: ReturnType<typeof useMe>['data']) {
  const employee = me?.user.employee;
  return `${employee?.nome ?? ''} ${employee?.cognome ?? ''}`.trim();
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-card shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-xl font-bold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </div>
  );
}

function StatusBox({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const cls = {
    info: 'bg-info-bg text-info-text border-info-border',
    success: 'bg-success-bg text-success-text border-success-border',
    warning: 'bg-warning-bg text-warning-text border-warning-border',
    danger: 'bg-danger-bg text-danger-text border-danger-border',
  }[tone];

  return <div className={cn('rounded-2xl border p-4 text-sm', cls)}>{children}</div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-2xl bg-background border border-border p-8 text-center">
      <Icon size={34} className="mx-auto text-text-secondary opacity-50 mb-3" />
      <p className="font-bold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </div>
  );
}

function NotificationsPanel() {
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

function PreferencesPanel() {
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

function PasswordPanel() {
  const { data: me } = useMe();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setLocalError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('La conferma non corrisponde alla nuova password.');
      return;
    }

    try {
      const result = await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(result.message);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Errore aggiornamento password.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Password" description="Cambio password reale per account con credenziali locali." />

      {!me?.user.has_password && (
        <StatusBox tone="warning">
          Questo account usa Google Sign-In. Non esiste una password locale da modificare.
        </StatusBox>
      )}

      {(localError || changePassword.error) && (
        <StatusBox tone="danger">{localError ?? changePassword.error?.message}</StatusBox>
      )}
      {success && <StatusBox tone="success">{success}</StatusBox>}

      <form onSubmit={submit} className="space-y-6 max-w-md">
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-text-secondary">Password corrente</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary disabled:opacity-50"
          />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-text-secondary">Nuova password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary disabled:opacity-50"
          />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-text-secondary">Conferma nuova password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 text-text-primary disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!me?.user.has_password || changePassword.isPending}
          className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {changePassword.isPending && <Loader2 size={16} className="animate-spin" />}
          Aggiorna password
        </button>
      </form>
    </div>
  );
}

function SessionsPanel() {
  const { data: me } = useMe();
  const payload = getTokenPayload();
  const issuedAt = typeof payload?.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : null;
  const expiresAt = typeof payload?.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Sessione attiva" description="Il sistema usa JWT stateless: qui mostriamo la sessione corrente verificabile." />
      <div className="space-y-4">
        {[
          { label: 'Utente', value: me?.user.username ?? 'Non disponibile', icon: User },
          { label: 'Ultimo login registrato', value: formatDateTime(me?.user.last_login_at), icon: History },
          { label: 'Token emesso', value: formatDateTime(issuedAt), icon: Clock },
          { label: 'Scadenza token', value: formatDateTime(expiresAt), icon: ShieldCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 p-4 rounded-2xl bg-background border border-border">
            <div className="p-3 bg-card rounded-xl shadow-sm text-text-secondary">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{label}</p>
              <p className="text-xs text-text-secondary">{value}</p>
            </div>
          </div>
        ))}
      </div>
      <StatusBox>
        La revoca di singole sessioni richiede una tabella sessioni persistente. Al momento il logout locale elimina il token dal browser.
      </StatusBox>
    </div>
  );
}

function TwoFactorPanel() {
  const { data: me } = useMe();
  const telegramLinked = Boolean(me?.user.employee?.telegram_id);
  const googleLinked = Boolean(me?.user.google_connected);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Sicurezza accesso" description="Stato reale dei fattori disponibili oggi sul profilo." />
      <div className="grid gap-4">
        <div className="p-5 rounded-2xl bg-background border border-border flex items-start gap-4">
          <div className={cn('p-3 rounded-xl', googleLinked ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text')}>
            <Globe size={22} />
          </div>
          <div>
            <p className="font-bold text-text-primary">Google Sign-In</p>
            <p className="text-sm text-text-secondary">{googleLinked ? 'Collegato a questo account.' : 'Non collegato.'}</p>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-background border border-border flex items-start gap-4">
          <div className={cn('p-3 rounded-xl', telegramLinked ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text')}>
            <MessageCircle size={22} />
          </div>
          <div>
            <p className="font-bold text-text-primary">Telegram operativo</p>
            <p className="text-sm text-text-secondary">
              {telegramLinked ? 'Profilo Telegram collegato e disponibile per alert.' : 'Telegram non ancora collegato al dipendente.'}
            </p>
          </div>
        </div>
        <StatusBox tone="warning">
          2FA TOTP non è ancora configurato nel backend. La sezione non abilita fattori fittizi.
        </StatusBox>
      </div>
    </div>
  );
}

function ActivitiesPanel() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: tasks = [], isLoading, error } = useAllTasks();
  const employeeName = getCurrentEmployeeName(me);
  const username = me?.user.username?.toLowerCase() ?? '';

  const myTasks = useMemo(() => {
    const normalizedName = employeeName.toLowerCase();
    return tasks.filter((task) => {
      const assignee = (task.assignee ?? '').toLowerCase();
      return Boolean(assignee) && assignee !== 'non assegnato' && (
        assignee === normalizedName ||
        assignee.includes(normalizedName) ||
        assignee === username ||
        (username && assignee.includes(username))
      );
    });
  }, [employeeName, tasks, username]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Le mie attività" description="Task assegnati al tuo nome nei cantieri." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento attività...</StatusBox>}
      {!isLoading && myTasks.length === 0 ? (
        <EmptyState icon={Briefcase} title="Nessuna attività assegnata" description="I task appariranno qui quando il tuo nome sarà assegnato su un cantiere." />
      ) : (
        <div className="space-y-3">
          {myTasks.slice(0, 8).map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/projects/${task.cantiere.id}`)}
              className="w-full p-4 rounded-2xl bg-background border border-border hover:border-accent/30 transition-all flex items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="font-semibold text-text-primary">{task.title}</p>
                <p className="text-xs text-text-secondary">{task.cantiere.nome} · {task.status} · {task.priority}</p>
              </div>
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HoursPanel() {
  const { user } = useAuthContext();
  const { data: entries = [], isLoading, error } = useAudit({
    employee_id: user?.employee_id ? String(user.employee_id) : undefined,
  });

  const totals = useMemo(() => {
    const hours = entries.filter((entry) => entry.type === 'ore').reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
    const expenses = entries.filter((entry) => entry.type === 'spese').reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);
    const pending = entries.filter((entry) => entry.status === 'pending').length;
    return { hours, expenses, pending };
  }, [entries]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Le mie ore e spese" description="Riepilogo personale dai tabulati reali." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento tabulati...</StatusBox>}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Ore registrate', value: `${totals.hours.toFixed(1)}h` },
          { label: 'Spese registrate', value: formatCurrency(totals.expenses) },
          { label: 'In attesa', value: String(totals.pending) },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-2xl bg-background border border-border">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {entries.slice(0, 6).map((entry) => (
          <div key={`${entry.type}-${entry.id}`} className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text-primary">{entry.type === 'ore' ? 'Ore lavorate' : 'Spesa'} · {entry.cantiere_nome ?? 'Senza cantiere'}</p>
              <p className="text-xs text-text-secondary">{formatDate(entry.date)} · {entry.status}</p>
            </div>
            <p className="font-bold text-text-primary">{entry.type === 'ore' ? `${entry.value}h` : formatCurrency(entry.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersPanel() {
  const { data: requests = [], isLoading, error } = useMyMaterialRequests();

  const totals = useMemo(() => ({
    count: requests.length,
    value: requests.reduce((sum, item) => sum + Number(item.valore_totale ?? 0), 0),
  }), [requests]);

  const renderMovementLabel = (request: MaterialRequest) => {
    if (request.tipo_movimento === 'SCARICO_CANTIERE') return 'Scarico su cantiere';
    if (request.tipo_movimento === 'CARICO') return 'Carico magazzino';
    return request.tipo_movimento;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Richieste materiali" description="Movimenti materiali registrati dal tuo account." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {isLoading && <StatusBox>Caricamento richieste materiali...</StatusBox>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-background border border-border">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Movimenti</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totals.count}</p>
        </div>
        <div className="p-4 rounded-2xl bg-background border border-border">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Valore totale</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{formatCurrency(totals.value)}</p>
        </div>
      </div>
      {!isLoading && requests.length === 0 ? (
        <EmptyState icon={Package} title="Nessuna richiesta materiale" description="I movimenti magazzino eseguiti dal tuo account appariranno qui." />
      ) : (
        <div className="space-y-3">
          {requests.slice(0, 8).map((request) => (
            <div key={request.id} className="p-4 rounded-2xl bg-background border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-text-primary">{request.articolo.descrizione}</p>
                  <p className="text-xs text-text-secondary">
                    {renderMovementLabel(request)} · {request.cantiere?.nome ?? 'Magazzino'} · {formatDate(request.data_movimento)}
                  </p>
                </div>
                <p className="font-bold text-text-primary">{formatCurrency(request.valore_totale)}</p>
              </div>
              <p className="text-xs text-text-secondary mt-3">
                Quantità: {formatQuantity(request.quantita)} {request.articolo.unita_misura}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RolesPanel() {
  const { user } = useAuthContext();
  const role = user?.role ?? 'UNKNOWN';
  const cols = [
    { key: 'admin', label: 'ADMIN' },
    { key: 'hr', label: 'HR' },
    { key: 'pm', label: 'PM' },
    { key: 'worker', label: 'WORKER' },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Ruoli e permessi" description="Matrice RBAC applicata nel backend e nel frontend." />
      <StatusBox tone="success">Ruolo corrente: <strong>{role}</strong></StatusBox>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="text-left p-3 text-text-secondary">Area</th>
              {cols.map((col) => <th key={col.key} className="p-3 text-text-secondary">{col.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMISSIONS.map((row) => (
              <tr key={row.area}>
                <td className="p-3 font-medium text-text-primary">{row.area}</td>
                {cols.map((col) => (
                  <td key={col.key} className="p-3 text-center">
                    {row[col.key] ? <CheckCircle2 size={16} className="mx-auto text-success-text" /> : <X size={16} className="mx-auto text-text-secondary opacity-40" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyPanel() {
  const { data: me } = useMe();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Azienda" description="Fabrar ERP è configurato in modalità azienda singola." />
      <div className="p-5 rounded-2xl bg-accent/5 border border-accent flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center font-bold">F</div>
          <div>
            <p className="font-bold text-text-primary">Fabrar ERP</p>
            <p className="text-xs text-text-secondary">Azienda attiva · {me?.user.role ?? 'Ruolo non disponibile'}</p>
          </div>
        </div>
        <CheckCircle2 size={20} className="text-accent" />
      </div>
      <StatusBox>
        Non è presente un modello multi-company nel database. La selezione azienda resta informativa finché il dominio non viene introdotto.
      </StatusBox>
    </div>
  );
}

function SupportPanel() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { data, isLoading, error } = useSupportContact();
  const createConversation = useCreateConversation();
  const [localError, setLocalError] = useState<string | null>(null);
  const support = data?.employee;
  const supportName = `${support?.firstName ?? ''} ${support?.lastName ?? ''}`.trim() || 'Supporto interno';
  const isSelf = support?.id != null && support.id === user?.employee_id;

  const openSupportChat = async () => {
    setLocalError(null);
    if (!support?.id) return;
    if (isSelf) {
      setLocalError('Sei tu il contatto supporto configurato. Non posso aprire una chat diretta con te stesso.');
      return;
    }

    try {
      await createConversation.mutateAsync({ targetEmployeeId: support.id });
      navigate('/messages');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Errore apertura chat supporto.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Supporto" description="Apre una conversazione reale con il referente interno configurato." />
      {error && <StatusBox tone="danger">{error.message}</StatusBox>}
      {localError && <StatusBox tone="danger">{localError}</StatusBox>}
      {isLoading && <StatusBox>Caricamento contatto supporto...</StatusBox>}
      {support && (
        <div className="p-6 rounded-2xl bg-background border border-border space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center font-bold">
              {supportName[0]}
            </div>
            <div>
              <p className="font-bold text-text-primary">{supportName}</p>
              <p className="text-sm text-text-secondary">{support.role}</p>
            </div>
          </div>
          <button
            onClick={openSupportChat}
            disabled={createConversation.isPending || isSelf}
            className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createConversation.isPending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            Apri chat supporto
          </button>
        </div>
      )}
    </div>
  );
}

type HelpTab = 'manuals' | 'qa' | 'faq' | 'links';

interface HelpManual {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  tags: string[];
  steps: string[];
  notes: string[];
}

interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

const HELP_MANUALS: HelpManual[] = [
  {
    id: 'first-access',
    title: 'Primo accesso e account',
    desc: 'Login Google, profilo personale, password locale e collegamento Telegram.',
    icon: User,
    tags: ['account', 'login', 'telegram'],
    steps: [
      'Apri la pagina di login e accedi con Google usando l’account autorizzato.',
      'Se sei un nuovo dipendente, usa il codice invito generato da Admin o HR.',
      'Controlla i dati in Impostazioni > Il mio account.',
      'Per collegare Telegram, genera il codice pairing e invialo al bot quando richiesto.',
      'Se il tuo account usa Google Sign-In, la password locale non è modificabile.',
    ],
    notes: [
      'Il codice Telegram serve a collegare il profilo web al bot operativo.',
      'Gli account Google-only non hanno password locale nel database.',
    ],
  },
  {
    id: 'timesheets',
    title: 'Ore e spese',
    desc: 'Consultazione tabulati, stati di verifica, filtri e riepiloghi personali.',
    icon: Clock,
    tags: ['ore', 'spese', 'tabulati'],
    steps: [
      'Vai in Le mie ore e spese o nella pagina Tabulati.',
      'Usa i filtri per data, tipo record e stato di validazione.',
      'Leggi pending come record in attesa di verifica amministrativa.',
      'Leggi verified come record approvato e rejected come record rifiutato.',
      'Controlla il riepilogo per totale ore, totale spese e record ancora aperti.',
    ],
    notes: [
      'I Worker vedono solo i propri record.',
      'Admin e HR possono gestire e verificare i record secondo i permessi RBAC.',
    ],
  },
  {
    id: 'messages',
    title: 'Messaggi',
    desc: 'Chat dirette, ricerca colleghi, supporto e badge non letti.',
    icon: MessageCircle,
    tags: ['chat', 'messaggi', 'supporto'],
    steps: [
      'Apri Messaggi dalla sidebar o da Impostazioni > Supporto.',
      'Cerca una conversazione esistente dalla barra laterale.',
      'Se non trovi il collega, usa la ricerca globale e avvia una chat diretta.',
      'Scrivi il messaggio e invialo: i partecipanti ricevono l’evento realtime.',
      'Il badge non letti si aggiorna sulle conversazioni in cui sei partecipante.',
    ],
    notes: [
      'Le chat sono filtrate per partecipante: non sono pubbliche.',
      'Il supporto apre una conversazione con il referente configurato.',
    ],
  },
  {
    id: 'projects',
    title: 'Cantieri e attività',
    desc: 'Progetti, attività assegnate, documenti e dati operativi di cantiere.',
    icon: Briefcase,
    tags: ['cantieri', 'attività', 'documenti'],
    steps: [
      'Apri Cantieri per vedere l’elenco dei progetti accessibili.',
      'Entra nel dettaglio cantiere per attività, documenti, materiali e dati economici.',
      'Consulta Le mie attività per i task assegnati al tuo nome.',
      'Usa i documenti del cantiere per file operativi, fatture, DDT e allegati.',
      'Aggiorna stati e attività solo se il tuo ruolo lo consente.',
    ],
    notes: [
      'La visibilità dei cantieri dipende dal ruolo e dalle policy applicate.',
      'I dati economici sensibili sono riservati ai ruoli autorizzati.',
    ],
  },
  {
    id: 'personnel',
    title: 'Gestione personale',
    desc: 'Creazione dipendente, ruoli, codice invito e accessi Admin/HR.',
    icon: ShieldCheck,
    tags: ['hr', 'dipendenti', 'ruoli'],
    steps: [
      'Apri Gestione Personale con ruolo Admin o HR.',
      'Crea un nuovo dipendente inserendo nome, cognome, ruolo e costo orario se disponibile.',
      'Genera il codice invito per consentire il primo accesso web.',
      'Imposta il ruolo corretto: ADMIN, HR, PROJECT_MANAGER o WORKER.',
      'Controlla il dettaglio dipendente per dati anagrafici, KPI e storico.',
    ],
    notes: [
      'Solo Admin e HR possono creare o modificare dipendenti.',
      'Il ruolo determina sia le rotte accessibili sia i pulsanti visibili in UI.',
    ],
  },
  {
    id: 'warehouse',
    title: 'Magazzino e materiali',
    desc: 'Movimenti materiali, richieste personali e scarichi su cantiere.',
    icon: Package,
    tags: ['magazzino', 'materiali', 'ordini'],
    steps: [
      'Usa Magazzino per articoli, ubicazioni, giacenze e movimenti.',
      'Registra carichi o scarichi su cantiere secondo il flusso operativo.',
      'In Impostazioni > Richieste materiali trovi i movimenti eseguiti dal tuo account.',
      'Associa il materiale a cantiere e WBS quando serve al job costing.',
      'Controlla quantità, valore e data movimento per verifiche successive.',
    ],
    notes: [
      'Il magazzino completo è riservato ai ruoli autorizzati.',
      'I movimenti personali sono letti dal tuo utente loggato.',
    ],
  },
  {
    id: 'settings',
    title: 'Impostazioni',
    desc: 'Notifiche, preferenze, sicurezza, azienda, ruoli e supporto.',
    icon: SettingsIcon,
    tags: ['impostazioni', 'sicurezza', 'preferenze'],
    steps: [
      'Usa Notifiche per scegliere canali e priorità.',
      'Usa Preferenze per tema, lingua, timezone e formato data.',
      'Usa Password solo se hai un account con password locale.',
      'Usa Ruoli e permessi per leggere la matrice RBAC applicata.',
      'Usa Supporto per aprire una chat diretta con il referente interno.',
    ],
    notes: [
      'Le preferenze sono salvate sul profilo utente.',
      'Sessioni e 2FA mostrano lo stato reale disponibile, senza azioni simulate.',
    ],
  },
];

const HELP_QA: HelpQuestion[] = [
  {
    id: 'qa-section-hidden',
    question: 'Perché non vedo una sezione?',
    answer: 'La sidebar e le rotte sono filtrate dal ruolo. Per esempio Dashboard, Finanza e Magazzino sono riservate ad Admin, mentre Gestione Personale è riservata ad Admin e HR.',
    tags: ['ruoli', 'permessi'],
  },
  {
    id: 'qa-telegram',
    question: 'Come genero o uso il codice Telegram?',
    answer: 'Vai in Impostazioni > Il mio account, genera il codice Telegram e invialo al bot quando richiesto. Il codice collega il profilo web al dipendente Telegram.',
    tags: ['telegram', 'account'],
  },
  {
    id: 'qa-pending',
    question: 'Perché una spesa o un’ora è in attesa?',
    answer: 'Lo stato pending indica che il record è stato acquisito ma non ancora verificato. Admin o HR possono approvarlo o rifiutarlo dai tabulati.',
    tags: ['ore', 'spese'],
  },
  {
    id: 'qa-chat',
    question: 'Come apro una chat con un collega?',
    answer: 'Vai in Messaggi, cerca il collega. Se non c’è una conversazione esistente, la ricerca globale ti permette di crearne una diretta.',
    tags: ['messaggi', 'chat'],
  },
  {
    id: 'qa-password',
    question: 'Perché non posso cambiare password?',
    answer: 'Gli account Google-only non hanno password locale. In quel caso la sicurezza della password è gestita dall’account Google.',
    tags: ['password', 'login'],
  },
];

const HELP_FAQ: HelpQuestion[] = [
  {
    id: 'faq-hours',
    question: 'Dove trovo le mie ore?',
    answer: 'Apri Impostazioni > Le mie ore e spese oppure la rotta Timesheets. I Worker vedono solo i propri dati.',
    tags: ['ore', 'timesheets'],
  },
  {
    id: 'faq-create-employee',
    question: 'Chi può creare dipendenti?',
    answer: 'Solo gli utenti con ruolo ADMIN o HR possono creare dipendenti e generare codici invito.',
    tags: ['hr', 'dipendenti'],
  },
  {
    id: 'faq-tunnel',
    question: 'Cosa fare se tunnel o servizio non rispondono?',
    answer: 'Prima verifica che il backend sia avviato su localhost:3000. Se cloudflared segnala connection refused, il tunnel è attivo ma l’origine locale non sta rispondendo.',
    tags: ['cloudflared', 'backend'],
  },
  {
    id: 'faq-roles',
    question: 'Come vengono gestiti ADMIN, HR, PROJECT_MANAGER e WORKER?',
    answer: 'Il backend protegge le API con JWT e middleware RBAC. Il frontend nasconde rotte e pulsanti non consentiti, ma la protezione effettiva resta sul backend.',
    tags: ['rbac', 'ruoli'],
  },
  {
    id: 'faq-support',
    question: 'Come contatto il supporto?',
    answer: 'Apri Impostazioni > Supporto. Il sistema usa il referente configurato e crea o recupera una chat diretta.',
    tags: ['supporto', 'messaggi'],
  },
];

function matchesHelpQuery(
  query: string,
  item: HelpManual | HelpQuestion
) {
  if (!query) return true;
  const haystack = 'steps' in item
    ? [
        item.title,
        item.desc,
        ...item.tags,
        ...item.steps,
        ...item.notes,
      ]
    : [
        item.question,
        item.answer,
        ...item.tags,
      ];

  return haystack.join(' ').toLowerCase().includes(query);
}

function HelpPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HelpTab>('manuals');
  const [searchQuery, setSearchQuery] = useState('');
  const [openManualId, setOpenManualId] = useState<string | null>(HELP_MANUALS[0]?.id ?? null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const links = [
    { title: 'Il mio account', desc: 'Profilo, codice Telegram e stato accesso.', to: '/settings/account', icon: User },
    { title: 'Tabulati', desc: 'Ore, spese e verifiche personali.', to: '/timesheets', icon: Clock },
    { title: 'Messaggi', desc: 'Chat dirette, supporto e conversazioni di progetto.', to: '/messages', icon: MessageCircle },
    { title: 'Cantieri', desc: 'Attività, documenti e dati operativi.', to: '/projects', icon: Briefcase },
    { title: 'Supporto', desc: 'Apri una chat con il referente interno.', to: '/settings/support', icon: LifeBuoy },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const manuals = HELP_MANUALS.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const qa = HELP_QA.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const faq = HELP_FAQ.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const filteredLinks = links.filter((item) =>
    [item.title, item.desc, item.to].join(' ').toLowerCase().includes(normalizedQuery)
  );

  const tabs = [
    { id: 'manuals', label: 'Manuali', count: manuals.length },
    { id: 'qa', label: 'Q&A', count: qa.length },
    { id: 'faq', label: 'FAQ', count: faq.length },
    { id: 'links', label: 'Link rapidi', count: filteredLinks.length },
  ] as const;

  const hasResults = {
    manuals: manuals.length > 0,
    qa: qa.length > 0,
    faq: faq.length > 0,
    links: filteredLinks.length > 0,
  }[activeTab];

  const renderQuestionList = (items: HelpQuestion[], prefix: string) => (
    <div className="space-y-3">
      {items.map((item) => {
        const key = `${prefix}-${item.id}`;
        const isOpen = openQuestionId === key;
        return (
          <div key={item.id} className="rounded-2xl bg-background border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenQuestionId(isOpen ? null : key)}
              className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-card/40 transition-colors"
            >
              <div>
                <p className="font-bold text-text-primary">{item.question}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronDown size={18} className={cn('text-text-secondary transition-transform shrink-0', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm text-text-secondary leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <SectionHeader title="Guida" description="Manuali operativi, Q&A e FAQ per usare Fabrar ERP." />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cerca manuali, FAQ, ruoli, Telegram, ore, messaggi..."
            className="w-full bg-background border border-border rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20 text-text-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                activeTab === tab.id
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-background text-text-secondary border-border hover:text-text-primary'
              )}
            >
              {tab.label}
              <span className={cn('ml-2', activeTab === tab.id ? 'text-white/80' : 'text-text-secondary')}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!hasResults && (
        <div className="space-y-4">
          <EmptyState icon={BookOpen} title="Nessun risultato" description="Prova con una ricerca diversa oppure contatta il supporto interno." />
          <button
            type="button"
            onClick={() => navigate('/settings/support')}
            className="w-full py-3 rounded-xl bg-accent text-white font-bold shadow-lg hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
          >
            <LifeBuoy size={16} />
            Contatta supporto
          </button>
        </div>
      )}

      {activeTab === 'manuals' && manuals.length > 0 && (
        <div className="space-y-4">
          {manuals.map((manual) => {
            const Icon = manual.icon;
            const isOpen = openManualId === manual.id;
            return (
              <div key={manual.id} className="rounded-2xl bg-background border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenManualId(isOpen ? null : manual.id)}
                  className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-card/40 transition-colors"
                >
                  <div className="flex gap-4 min-w-0">
                    <div className="p-2 rounded-xl bg-card text-text-secondary shrink-0">
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary">{manual.title}</p>
                      <p className="text-sm text-text-secondary mt-1">{manual.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {manual.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-bold text-text-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={18} className={cn('text-text-secondary transition-transform shrink-0 mt-1', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-5">
                    <div className="pl-12">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Procedura</p>
                      <ol className="space-y-2">
                        {manual.steps.map((step, index) => (
                          <li key={step} className="flex gap-3 text-sm text-text-secondary leading-relaxed">
                            <span className="w-6 h-6 rounded-lg bg-card border border-border text-[11px] font-bold text-text-primary flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="ml-12 rounded-xl bg-card border border-border p-4">
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Note operative</p>
                      <ul className="space-y-1.5">
                        {manual.notes.map((note) => (
                          <li key={note} className="text-sm text-text-secondary flex gap-2">
                            <CheckCircle2 size={14} className="text-success-text shrink-0 mt-0.5" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'qa' && qa.length > 0 && renderQuestionList(qa, 'qa')}
      {activeTab === 'faq' && faq.length > 0 && renderQuestionList(faq, 'faq')}

      {activeTab === 'links' && filteredLinks.length > 0 && (
        <div className="grid gap-3">
          {filteredLinks.map(({ title, desc, to, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="p-4 rounded-2xl bg-background border border-border hover:border-accent/30 transition-all flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-card text-text-secondary"><Icon size={20} /></div>
                <div>
                  <p className="font-semibold text-text-primary">{title}</p>
                  <p className="text-xs text-text-secondary">{desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-background border border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-bold text-text-primary">Non hai trovato la risposta?</p>
          <p className="text-sm text-text-secondary">Apri una conversazione con il referente supporto configurato.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings/support')}
          className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
        >
          <LifeBuoy size={16} />
          Contatta supporto
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const activeSection = getValidSettingsSection(section);
  const groups = ['Settings', 'Security', 'My Work', 'System'] as const;

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettingsPanel />;
      case 'notifications':
        return <NotificationsPanel />;
      case 'preferences':
        return <PreferencesPanel />;
      case 'password':
        return <PasswordPanel />;
      case 'sessions':
        return <SessionsPanel />;
      case '2fa':
        return <TwoFactorPanel />;
      case 'activities':
        return <ActivitiesPanel />;
      case 'hours':
        return <HoursPanel />;
      case 'orders':
        return <OrdersPanel />;
      case 'roles':
        return <RolesPanel />;
      case 'company':
        return <CompanyPanel />;
      case 'support':
        return <SupportPanel />;
      case 'help':
        return <HelpPanel />;
      default:
        return <AccountSettingsPanel />;
    }
  };

  return (
    <div className="flex h-full bg-card overflow-hidden transition-colors duration-300">
      <aside className="w-72 border-r border-border flex flex-col bg-background/50">
        <div className="p-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Impostazioni</h2>
            <p className="text-xs text-text-secondary mt-1">Account, sicurezza e lavoro</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:bg-card hover:text-text-primary rounded-xl transition-all"
            title="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-8 no-scrollbar">
          {groups.map((group) => (
            <div key={group} className="space-y-2">
              <h4 className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">{GROUP_LABELS[group]}</h4>
              <div className="space-y-1">
                {SETTINGS_SECTIONS.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/settings/${item.id}`)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
                      activeSection === item.id
                        ? 'bg-card text-accent shadow-sm border border-border'
                        : 'text-text-secondary hover:bg-card hover:text-text-primary'
                    )}
                  >
                    <item.icon
                      size={18}
                      className={cn(
                        'transition-colors shrink-0',
                        activeSection === item.id ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
                      )}
                    />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-card no-scrollbar">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-3xl mx-auto p-12"
        >
          {renderContent()}
        </motion.div>
      </main>
    </div>
  );
}
