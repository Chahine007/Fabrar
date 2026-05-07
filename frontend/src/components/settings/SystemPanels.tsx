import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useMe } from '../../hooks/api/useAuth';
import { useCreateConversation } from '../../hooks/api/useConversations';
import { useSupportContact } from '../../hooks/api/useUserSettings';
import { PERMISSIONS, SectionHeader, StatusBox } from './settingsShared';

export function RolesPanel() {
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

export function CompanyPanel() {
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

export function SupportPanel() {
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
