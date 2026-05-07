import React, { useState } from 'react';
import {
  Clock,
  Globe,
  History,
  Loader2,
  MessageCircle,
  ShieldCheck,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTokenPayload } from '../../lib/api';
import { useMe } from '../../hooks/api/useAuth';
import { useChangePassword } from '../../hooks/api/useUserSettings';
import { SectionHeader, StatusBox, formatDateTime } from './settingsShared';

export function PasswordPanel() {
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

      <form onSubmit={submit} className="max-w-md space-y-6">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-text-secondary">Password corrente</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-text-secondary">Nuova password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-text-secondary">Conferma nuova password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={!me?.user.has_password}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!me?.user.has_password || changePassword.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-bold text-white shadow-lg transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          {changePassword.isPending && <Loader2 size={16} className="animate-spin" />}
          Aggiorna password
        </button>
      </form>
    </div>
  );
}

export function SessionsPanel() {
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
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
            <div className="rounded-xl bg-card p-3 text-text-secondary shadow-sm">
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

export function TwoFactorPanel() {
  const { data: me } = useMe();
  const telegramLinked = Boolean(me?.user.employee?.telegram_id);
  const googleLinked = Boolean(me?.user.google_connected);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title="Sicurezza accesso" description="Stato reale dei fattori disponibili oggi sul profilo." />
      <div className="grid gap-4">
        <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-5">
          <div className={cn('rounded-xl p-3', googleLinked ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text')}>
            <Globe size={22} />
          </div>
          <div>
            <p className="font-bold text-text-primary">Google Sign-In</p>
            <p className="text-sm text-text-secondary">{googleLinked ? 'Collegato a questo account.' : 'Non collegato.'}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-5">
          <div className={cn('rounded-xl p-3', telegramLinked ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text')}>
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
