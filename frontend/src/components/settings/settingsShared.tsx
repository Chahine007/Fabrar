import React from 'react';
import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Clock,
  History,
  Key,
  LifeBuoy,
  ShieldCheck,
  ShoppingBag,
  User,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'Settings' | 'Security' | 'My Work' | 'System';
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
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

export const GROUP_LABELS: Record<SettingsSection['group'], string> = {
  Settings: 'Impostazioni',
  Security: 'Sicurezza',
  'My Work': 'Il mio lavoro',
  System: 'Sistema',
};

export const LANGUAGE_OPTIONS = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
] as const;

export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
];

export const PERMISSIONS = [
  { area: 'Dashboard e finanza', admin: true, hr: false, pm: false, worker: false },
  { area: 'Gestione personale', admin: true, hr: true, pm: false, worker: false },
  { area: 'Cantieri e attività', admin: true, hr: true, pm: true, worker: true },
  { area: 'Le proprie ore e spese', admin: true, hr: true, pm: true, worker: true },
  { area: 'Magazzino', admin: true, hr: false, pm: false, worker: false },
  { area: 'Messaggi', admin: true, hr: true, pm: true, worker: true },
];

export function getValidSettingsSection(section: string | undefined) {
  return SETTINGS_SECTIONS.some((item) => item.id === section) ? section! : 'account';
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return date.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value?: string | null) {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return date.toLocaleDateString('it-IT');
}

export function formatCurrency(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function formatQuantity(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

export function getCurrentEmployeeName(me?: {
  user?: {
    employee?: {
      nome?: string | null;
      cognome?: string | null;
    } | null;
  };
} | null) {
  const employee = me?.user?.employee;
  return `${employee?.nome ?? ''} ${employee?.cognome ?? ''}`.trim();
}

export function Toggle({
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

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-xl font-bold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

export function StatusBox({
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

export function SettingsEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-8 text-center">
      <Icon size={34} className="mx-auto mb-3 text-text-secondary opacity-50" />
      <p className="font-bold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}
