import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Send, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useMe, useGenerateTelegramCode } from '../hooks/api/useAuth';
import { useAuthContext } from '../context/AuthContext';

export default function AccountPage() {
  const { data: meData, isLoading: isMeLoading, refetch } = useMe();
  const generateCodeMutation = useGenerateTelegramCode();
  const { user: authUser } = useAuthContext();

  const handleGenerateCode = async () => {
    try {
      await generateCodeMutation.mutateAsync();
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  if (isMeLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const user = meData?.user;
  const employee = user?.employee;
  const isTelegramLinked = !!employee?.telegram_id;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Il mio Account</h1>
        <p className="text-text-secondary">Gestisci i tuoi dati personali e le integrazioni esterne.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sezione 1: I tuoi dati */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-8 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-accent/10 rounded-xl text-accent">
              <User size={24} />
            </div>
            <h2 className="text-xl font-bold text-text-primary">I tuoi dati</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Nome Completo</label>
              <div className="bg-background rounded-xl p-4 text-text-primary font-medium border border-border/50">
                {employee?.nome} {employee?.cognome}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Email</label>
              <div className="bg-background rounded-xl p-4 text-text-primary font-medium border border-border/50 flex items-center gap-2">
                <Mail size={16} className="text-text-secondary" />
                {user?.email || 'N/D'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Ruolo</label>
              <div className="bg-background rounded-xl p-4 text-text-primary font-medium border border-border/50 flex items-center gap-2">
                <Shield size={16} className="text-text-secondary" />
                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-lg text-xs font-bold">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sezione 2: Integrazione Telegram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-[#0088cc]/10 rounded-xl text-[#0088cc]">
              <Send size={24} />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Integrazione Telegram</h2>
          </div>

          <div className="flex-1">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-text-secondary">Stato:</span>
                {isTelegramLinked ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-bold">
                    <CheckCircle2 size={14} />
                    Collegato
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-bold">
                    <XCircle size={14} />
                    Non collegato
                  </div>
                )}
              </div>

              {isTelegramLinked ? (
                <div className="p-4 bg-background border border-border/50 rounded-2xl text-sm text-text-secondary">
                  Il tuo account è correttamente collegato al bot Telegram. Puoi inviare report, spese e posizioni GPS direttamente dalla chat.
                  <p className="mt-2 text-xs">ID Telegram: <code className="bg-slate-800 p-1 rounded text-white">{employee?.telegram_id}</code></p>
                </div>
              ) : (
                <div className="p-4 bg-background border border-border/50 rounded-2xl text-sm text-text-secondary">
                  Collega il tuo account al bot Telegram per semplificare l'invio dei report giornalieri e delle spese.
                </div>
              )}
            </div>

            {!isTelegramLinked && (
              <div className="space-y-6">
                {!employee?.telegram_pairing_code ? (
                  <button
                    onClick={handleGenerateCode}
                    disabled={generateCodeMutation.isPending}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                  >
                    {generateCodeMutation.isPending ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                    Genera Codice Telegram
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#0088cc]/5 border border-[#0088cc]/30 rounded-2xl p-6 text-center">
                      <p className="text-xs font-bold text-[#0088cc] uppercase tracking-widest mb-3">Scrivi questo codice al Bot</p>
                      <div className="text-4xl font-mono font-black text-text-primary tracking-widest mb-3">
                        {employee.telegram_pairing_code}
                      </div>
                      <p className="text-sm text-text-secondary">
                        Cerca <strong>@FabrarBot</strong> su Telegram e incolla il codice qui sopra.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateCode}
                      className="w-full text-sm font-medium text-accent hover:underline text-center"
                    >
                      Genera un nuovo codice
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
