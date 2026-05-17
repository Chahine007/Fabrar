import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Building2, CalendarClock, Columns3, Edit2, Loader2, MessageCircle, Plus, Search, Ticket, Trash2, Users } from 'lucide-react';
import ErrorMessage from '../components/ErrorMessage';
import {
  Button,
  ConfirmDialog,
  DataToolbar,
  Dialog,
  Field,
  FormError,
  IconButton,
  Input,
  ResponsiveDataView,
  TableSkeleton,
  Textarea,
  useToast,
} from '../components/ui';
import { getApiErrorMessage } from '../lib/api';
import ProjectSubTabs from '../components/projects/detail/ProjectSubTabs';
import type { CrmAccount, CrmAccountPayload } from '../hooks/api/useCrmAccounts';
import { useCreateCrmAccount, useCrmAccounts, useDeleteCrmAccount, useUpdateCrmAccount } from '../hooks/api/useCrmAccounts';
import { useCrmAccountInteractions, useCreateCrmInteraction, type CrmInteractionPayload } from '../hooks/api/useCrmInteractions';
import { useCrmAccountDeals, useCrmPipeline } from '../hooks/api/useCrmDeals';
import { useCrmAccountTickets } from '../hooks/api/useCrmTickets';
import { useCrmCampaigns } from '../hooks/api/useCrmCampaigns';

const emptyPayload: CrmAccountPayload = {
  name: '',
  vat_number: '',
  tax_code: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'IT',
  notes: '',
};

function normalizePayload(payload: CrmAccountPayload): CrmAccountPayload {
  return {
    name: payload.name.trim(),
    vat_number: payload.vat_number?.trim() || null,
    tax_code: payload.tax_code?.trim() || null,
    email: payload.email?.trim() || null,
    phone: payload.phone?.trim() || null,
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    province: payload.province?.trim().toUpperCase() || null,
    postal_code: payload.postal_code?.trim() || null,
    country: payload.country?.trim().toUpperCase() || 'IT',
    notes: payload.notes?.trim() || null,
  };
}

function AccountModal({ account, onClose }: { account: CrmAccount | null; onClose: () => void }) {
  const [form, setForm] = useState<CrmAccountPayload>(emptyPayload);
  const [error, setError] = useState<string | null>(null);
  const createAccount = useCreateCrmAccount();
  const updateAccount = useUpdateCrmAccount();
  const isEditing = Boolean(account);
  const isSaving = createAccount.isPending || updateAccount.isPending;

  useEffect(() => {
    setForm(
      account
        ? {
            name: account.name,
            vat_number: account.vat_number ?? '',
            tax_code: account.tax_code ?? '',
            email: account.email ?? '',
            phone: account.phone ?? '',
            address: account.address ?? '',
            city: account.city ?? '',
            province: account.province ?? '',
            postal_code: account.postal_code ?? '',
            country: account.country ?? 'IT',
            notes: account.notes ?? '',
          }
        : emptyPayload
    );
    setError(null);
  }, [account]);

  const updateField = (field: keyof CrmAccountPayload, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const payload = normalizePayload(form);
    if (!payload.name) {
      setError('Il nome account è obbligatorio.');
      return;
    }

    try {
      if (account) {
        await updateAccount.mutateAsync({ id: account.id, data: payload });
      } else {
        await createAccount.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Errore salvataggio account.'));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      closeDisabled={isSaving}
      title={isEditing ? 'Modifica Cliente' : 'Nuovo Cliente'}
      description="Anagrafica CRM: account con contatti e note."
      icon={<Users size={20} />}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button
            type="submit"
            form="account-form"
            disabled={isSaving}
            icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : undefined}
          >
            Salva
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
        <FormError>{error}</FormError>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome / Ragione sociale" className="md:col-span-2">
            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Es. Cliente S.p.A." />
          </Field>

          <Field label="Partita IVA">
            <Input value={form.vat_number ?? ''} onChange={(e) => updateField('vat_number', e.target.value)} />
          </Field>
          <Field label="Codice fiscale">
            <Input value={form.tax_code ?? ''} onChange={(e) => updateField('tax_code', e.target.value)} />
          </Field>

          <Field label="Email">
            <Input type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} />
          </Field>
          <Field label="Telefono">
            <Input value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} />
          </Field>

          <Field label="Indirizzo" className="md:col-span-2">
            <Input value={form.address ?? ''} onChange={(e) => updateField('address', e.target.value)} />
          </Field>
          <Field label="Comune">
            <Input value={form.city ?? ''} onChange={(e) => updateField('city', e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-4 md:col-span-2">
            <Field label="Provincia">
              <Input value={form.province ?? ''} onChange={(e) => updateField('province', e.target.value)} />
            </Field>
            <Field label="CAP">
              <Input value={form.postal_code ?? ''} onChange={(e) => updateField('postal_code', e.target.value)} />
            </Field>
            <Field label="Paese">
              <Input value={form.country ?? 'IT'} onChange={(e) => updateField('country', e.target.value)} />
            </Field>
          </div>

          <Field label="Note" className="md:col-span-2">
            <Textarea value={form.notes ?? ''} onChange={(e) => updateField('notes', e.target.value)} rows={3} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

function AccountDetailDialog({
  account,
  onClose,
}: {
  account: CrmAccount;
  onClose: () => void;
}) {
  const toast = useToast();

  const interactionsQuery = useCrmAccountInteractions(account.id);
  const dealsQuery = useCrmAccountDeals(account.id);
  const ticketsQuery = useCrmAccountTickets(account.id);
  const pipelineQuery = useCrmPipeline();
  const campaignsQuery = useCrmCampaigns();

  const createInteraction = useCreateCrmInteraction(account.id);
  const [interactionForm, setInteractionForm] = useState<CrmInteractionPayload>({
    type: 'note',
    subject: '',
    body: '',
    occurred_at: new Date().toISOString(),
  });

  const saveInteraction = async () => {
    try {
      const payload: CrmInteractionPayload = {
        type: interactionForm.type,
        subject: interactionForm.subject?.trim() || null,
        body: interactionForm.body?.trim() || null,
        occurred_at: interactionForm.occurred_at,
      };
      await createInteraction.mutateAsync(payload);
      toast.success('Interazione salvata', 'Aggiunta alla timeline.');
      setInteractionForm({ type: 'note', subject: '', body: '', occurred_at: new Date().toISOString() });
    } catch (err: unknown) {
      toast.error('Salvataggio non riuscito', getApiErrorMessage(err, 'Errore creazione interazione.'));
    }
  };

  const interactions = interactionsQuery.data ?? [];
  const deals = dealsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const stages = pipelineQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  const tabs = [
    {
      id: 'timeline',
      label: 'Timeline',
      icon: CalendarClock,
      description: 'Interazioni, note, chiamate e meeting col cliente.',
      render: () => (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Tipo">
                <select
                  value={interactionForm.type}
                  onChange={(e) => setInteractionForm((c) => ({ ...c, type: e.target.value as CrmInteractionPayload['type'] }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="note">Nota</option>
                  <option value="call">Chiamata</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                </select>
              </Field>
              <Field label="Quando (ISO)">
                <Input value={interactionForm.occurred_at} onChange={(e) => setInteractionForm((c) => ({ ...c, occurred_at: e.target.value }))} />
              </Field>
              <div className="flex items-end">
                <Button onClick={saveInteraction} disabled={createInteraction.isPending} icon={createInteraction.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
                  Aggiungi
                </Button>
              </div>
              <Field label="Oggetto" className="md:col-span-3">
                <Input value={interactionForm.subject ?? ''} onChange={(e) => setInteractionForm((c) => ({ ...c, subject: e.target.value }))} />
              </Field>
              <Field label="Dettagli" className="md:col-span-3">
                <Textarea value={interactionForm.body ?? ''} onChange={(e) => setInteractionForm((c) => ({ ...c, body: e.target.value }))} rows={4} />
              </Field>
            </div>
          </div>

          {interactionsQuery.isLoading ? (
            <TableSkeleton rows={6} columns={3} />
          ) : interactionsQuery.error ? (
            <ErrorMessage error={(interactionsQuery.error as Error).message} />
          ) : (
            <div className="space-y-3">
              {interactions.map((it) => (
                <div key={it.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text-primary">
                        <span className="mr-2 inline-flex items-center gap-2 text-text-secondary">
                          <MessageCircle size={16} />
                          {it.type}
                        </span>
                        {it.subject || '—'}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">{it.occurred_at}</p>
                    </div>
                  </div>
                  {it.body && <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{it.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'deals',
      label: 'Deals',
      icon: Columns3,
      description: 'Pipeline semplificata per stage.',
      render: () => {
        const byStage = new Map<string, typeof deals>();
        deals.forEach((d) => {
          const key = d.stage || 'unknown';
          byStage.set(key, [...(byStage.get(key) ?? []), d]);
        });
        const stageList = stages.length > 0 ? [...stages].sort((a, b) => a.order - b.order).map((s) => s.id) : Array.from(byStage.keys());

        if (dealsQuery.isLoading) return <TableSkeleton rows={6} columns={4} />;
        if (dealsQuery.error) return <ErrorMessage error={(dealsQuery.error as Error).message} />;

        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {stageList.map((stageId) => {
              const stageLabel = stages.find((s) => s.id === stageId)?.label ?? stageId;
              const items = byStage.get(stageId) ?? [];
              return (
                <div key={stageId} className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border bg-background px-5 py-4">
                    <p className="text-sm font-extrabold text-text-primary">{stageLabel}</p>
                    <p className="mt-1 text-xs text-text-secondary">{items.length} deal</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nessun deal in questo stage.</p>
                    ) : (
                      items.map((deal) => (
                        <div key={deal.id} className="rounded-2xl border border-border bg-background p-3">
                          <p className="text-sm font-bold text-text-primary">{deal.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {deal.amount != null ? `${deal.amount} ${deal.currency ?? ''}` : '—'} · {deal.expected_close_date ?? 'N/D'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: 'tickets',
      label: 'Tickets',
      icon: Ticket,
      description: 'Richieste di supporto e stato.',
      render: () => {
        if (ticketsQuery.isLoading) return <TableSkeleton rows={6} columns={4} />;
        if (ticketsQuery.error) return <ErrorMessage error={(ticketsQuery.error as Error).message} />;
        return (
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                    <th className="px-6 py-4 font-semibold">Oggetto</th>
                    <th className="px-6 py-4 font-semibold">Stato</th>
                    <th className="px-6 py-4 font-semibold">Priorità</th>
                    <th className="px-6 py-4 font-semibold">Aggiornato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-text-primary">{t.subject}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{t.status}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{t.priority ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{t.updated_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      },
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: Building2,
      description: 'Campagne associate (lista base).',
      render: () => {
        if (campaignsQuery.isLoading) return <TableSkeleton rows={6} columns={4} />;
        if (campaignsQuery.error) return <ErrorMessage error={(campaignsQuery.error as Error).message} />;
        return (
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left border-collapse">
                <thead>
                  <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                    <th className="px-6 py-4 font-semibold">Nome</th>
                    <th className="px-6 py-4 font-semibold">Stato</th>
                    <th className="px-6 py-4 font-semibold">Canale</th>
                    <th className="px-6 py-4 font-semibold">Periodo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-text-primary">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{c.status}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{c.channel ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {[c.start_date, c.end_date].filter(Boolean).join(' → ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title={account.name}
      description="Dettaglio cliente CRM: timeline, deals, tickets, campaigns."
      icon={<Users size={20} />}
      size="xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm md:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Contatti</p>
            <p className="mt-1 text-sm text-text-primary">{account.email || '—'}</p>
            <p className="mt-1 text-sm text-text-primary">{account.phone || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Fiscale</p>
            <p className="mt-1 text-sm text-text-primary">P.IVA: {account.vat_number || '—'}</p>
            <p className="mt-1 text-sm text-text-primary">CF: {account.tax_code || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Sede</p>
            <p className="mt-1 text-sm text-text-primary">{[account.postal_code, account.city, account.province].filter(Boolean).join(' ') || '—'}</p>
            <p className="mt-1 text-sm text-text-primary">{account.address || '—'}</p>
          </div>
        </div>

        <ProjectSubTabs tabs={tabs} initialTab="timeline" />
      </div>
    </Dialog>
  );
}

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [editingAccount, setEditingAccount] = useState<CrmAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<CrmAccount | null>(null);
  const [detailAccount, setDetailAccount] = useState<CrmAccount | null>(null);
  const toast = useToast();

  const { data: accounts = [], isLoading, error } = useCrmAccounts();
  const deleteAccount = useDeleteCrmAccount();

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((acc) =>
      [acc.name, acc.vat_number, acc.tax_code, acc.email, acc.phone, acc.city, acc.province]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [accounts, search]);

  const openCreate = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const openEdit = (account: CrmAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const openDetail = (account: CrmAccount) => {
    setDetailAccount(account);
  };

  const handleDelete = (account: CrmAccount) => {
    setAccountToDelete(account);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    try {
      await deleteAccount.mutateAsync(accountToDelete.id);
      toast.success('Cliente eliminato', accountToDelete.name);
      if (detailAccount?.id === accountToDelete.id) setDetailAccount(null);
      setAccountToDelete(null);
    } catch (err: unknown) {
      toast.error('Eliminazione non riuscita', getApiErrorMessage(err, 'Errore eliminazione account.'));
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <TableSkeleton rows={7} columns={5} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 md:p-8">
        <ErrorMessage error={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Clienti</h1>
            <p className="text-text-secondary mt-1 text-sm md:text-base">CRM base: account, timeline, deals, tickets e campaigns.</p>
          </div>
          <Button onClick={openCreate} size="lg" icon={<Plus size={20} />}>
            Nuovo Cliente
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <DataToolbar title="Account CRM" icon={<Users size={20} className="text-text-secondary" />}>
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder="Cerca cliente..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none"
              />
            </div>
          </DataToolbar>

          <div className="p-4">
            <ResponsiveDataView
              data={filteredAccounts}
              getKey={(account) => account.id}
              emptyIcon={Users}
              emptyTitle="Nessun cliente trovato"
              emptyDescription="Modifica la ricerca o crea una nuova anagrafica cliente."
              emptyAction={
                <Button onClick={openCreate} icon={<Plus size={16} />}>
                  Nuovo cliente
                </Button>
              }
              renderCard={(account) => (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left" onClick={() => openDetail(account)}>
                      <p className="font-bold text-text-primary hover:underline">{account.name}</p>
                      {account.address && <p className="mt-1 text-xs text-text-secondary">{account.address}</p>}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label="Modifica cliente" size="sm" variant="secondary" onClick={() => openEdit(account)}>
                        <Edit2 size={16} />
                      </IconButton>
                      <IconButton label="Elimina cliente" size="sm" variant="danger" onClick={() => handleDelete(account)} disabled={deleteAccount.isPending}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <span>
                      P.IVA: <strong className="text-text-primary">{account.vat_number || '--'}</strong>
                    </span>
                    <span>
                      CF: <strong className="text-text-primary">{account.tax_code || '--'}</strong>
                    </span>
                    <span>
                      Tel: <strong className="text-text-primary">{account.phone || '--'}</strong>
                    </span>
                    <span>
                      Sede:{' '}
                      <strong className="text-text-primary">
                        {[account.postal_code, account.city, account.province].filter(Boolean).join(' ') || '--'}
                      </strong>
                    </span>
                    <span className="col-span-2">
                      Email: <strong className="text-text-primary">{account.email || '--'}</strong>
                    </span>
                  </div>
                  <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={() => openDetail(account)}>
                      Apri dettaglio
                    </Button>
                  </div>
                </div>
              )}
              renderTable={(rows) => (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-background text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                        <th className="px-6 py-4 font-semibold">Cliente</th>
                        <th className="px-6 py-4 font-semibold">Fiscale</th>
                        <th className="px-6 py-4 font-semibold">Contatti</th>
                        <th className="px-6 py-4 font-semibold">Sede</th>
                        <th className="px-6 py-4 font-semibold text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((account) => (
                        <tr key={account.id} className="hover:bg-background/50 transition-colors">
                          <td className="px-6 py-4">
                            <button type="button" className="text-left" onClick={() => openDetail(account)}>
                              <p className="font-bold text-text-primary text-sm hover:underline">{account.name}</p>
                              {account.address && <p className="text-xs text-text-secondary mt-1">{account.address}</p>}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            <p>
                              P.IVA: <span className="text-text-primary">{account.vat_number || '--'}</span>
                            </p>
                            <p className="mt-1 text-xs">CF: {account.tax_code || '--'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            <p>{account.email || '--'}</p>
                            <p className="mt-1 text-xs">{account.phone || '--'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            <p>{[account.postal_code, account.city, account.province].filter(Boolean).join(' ') || '--'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => openDetail(account)}>
                                Dettaglio
                              </Button>
                              <IconButton onClick={() => openEdit(account)} label="Modifica cliente" size="sm" variant="secondary">
                                <Edit2 size={17} />
                              </IconButton>
                              <IconButton
                                onClick={() => handleDelete(account)}
                                disabled={deleteAccount.isPending}
                                label="Elimina cliente"
                                size="sm"
                                variant="danger"
                              >
                                <Trash2 size={17} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <AccountModal
            account={editingAccount}
            onClose={() => {
              setIsModalOpen(false);
              setEditingAccount(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailAccount && <AccountDetailDialog account={detailAccount} onClose={() => setDetailAccount(null)} />}
      </AnimatePresence>

      <ConfirmDialog
        open={!!accountToDelete}
        onClose={() => setAccountToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminare cliente?"
        description={accountToDelete ? `"${accountToDelete.name}" verrà rimosso dall'anagrafica CRM.` : undefined}
        confirmLabel="Elimina"
        isBusy={deleteAccount.isPending}
        tone="danger"
      />
    </div>
  );
}

