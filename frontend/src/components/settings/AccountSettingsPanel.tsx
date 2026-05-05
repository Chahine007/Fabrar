import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import { useMe, useGenerateTelegramCode } from '../../hooks/api/useAuth';
import Spinner from '../Spinner';

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{label}</span>
      <div className="min-h-11 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-text-primary flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}

export function AccountSettingsPanel() {
  const { data: meData, isLoading: isMeLoading, refetch } = useMe();
  const generateCodeMutation = useGenerateTelegramCode();

  const handleGenerateCode = async () => {
    try {
      await generateCodeMutation.mutateAsync();
      refetch();
    } catch (error) {
      console.error(error);
    }
  };

  if (isMeLoading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Spinner label="Caricamento account..." />
      </div>
    );
  }

  const user = meData?.user;
  const employee = user?.employee;
  const fullName = `${employee?.nome ?? ''} ${employee?.cognome ?? ''}`.trim() || user?.username || 'Account';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
  const isTelegramLinked = Boolean(employee?.telegram_id);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-accent/20 shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-text-primary truncate">{fullName}</h3>
          <p className="text-sm text-text-secondary truncate">{user?.email || user?.username || 'N/D'}</p>
          <span className="inline-flex mt-2 px-2.5 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded-lg uppercase tracking-wider">
            {user?.role || employee?.ruolo || 'Utente'}
          </span>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-background/50 p-5"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-accent">
            <User size={18} />
          </div>
          <div>
            <h4 className="font-bold text-text-primary">Dati profilo</h4>
            <p className="text-xs text-text-secondary">Informazioni associate al tuo utente Fabrar ERP</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Nome completo">{fullName}</FieldRow>
          <FieldRow label="Email">
            <Mail size={15} className="text-text-secondary shrink-0" />
            <span className="truncate">{user?.email || 'N/D'}</span>
          </FieldRow>
          <FieldRow label="Ruolo applicativo">
            <Shield size={15} className="text-text-secondary shrink-0" />
            <span>{user?.role || 'N/D'}</span>
          </FieldRow>
          <FieldRow label="ID dipendente">{employee?.id ?? 'N/D'}</FieldRow>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border bg-background/50 p-5"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center text-info-text">
              <Send size={18} />
            </div>
            <div>
              <h4 className="font-bold text-text-primary">Telegram</h4>
              <p className="text-xs text-text-secondary">Collegamento per report, spese e posizioni GPS</p>
            </div>
          </div>
          {isTelegramLinked ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success-bg text-success-text border border-success-border text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 size={13} />
              Collegato
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger-bg text-danger-text border border-danger-border text-[10px] font-bold uppercase tracking-wider">
              <XCircle size={13} />
              Non collegato
            </span>
          )}
        </div>

        {isTelegramLinked ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-text-secondary">
            <p>Account Telegram collegato correttamente.</p>
            <p className="mt-2 text-xs">
              ID Telegram:{' '}
              <code className="rounded-md bg-background px-1.5 py-0.5 font-mono text-text-primary">
                {employee?.telegram_id}
              </code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-text-secondary">
              Collega Telegram per inviare report giornalieri, scontrini e check-in direttamente dal bot.
            </div>

            {!employee?.telegram_pairing_code ? (
              <button
                onClick={handleGenerateCode}
                disabled={generateCodeMutation.isPending}
                className="w-full min-h-11 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {generateCodeMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                Genera codice Telegram
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-info-border bg-info-bg p-5 text-center">
                  <p className="text-[10px] font-bold text-info-text uppercase tracking-widest mb-2">
                    Scrivi questo codice al bot
                  </p>
                  <div className="text-3xl font-mono font-black text-text-primary tracking-widest">
                    {employee.telegram_pairing_code}
                  </div>
                  <p className="mt-3 text-xs text-text-secondary">
                    Apri Telegram, cerca @FabrarBot e invia il codice.
                  </p>
                </div>
                <button
                  onClick={handleGenerateCode}
                  disabled={generateCodeMutation.isPending}
                  className="text-sm font-semibold text-accent hover:underline disabled:opacity-60"
                >
                  Genera un nuovo codice
                </button>
              </div>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}
