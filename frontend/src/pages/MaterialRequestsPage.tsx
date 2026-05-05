import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import {
  MaterialRequest,
  MaterialRequestStatus,
  useFulfillMaterialRequest,
  useMaterialRequests,
  useUpdateMaterialRequestStatus,
} from '../hooks/api/useMaterialRequests';
import { type Cantiere, useCantieri } from '../hooks/api/useCantieri';
import { getApiErrorMessage } from '../lib/api';
import MaterialRequestModal from '../components/materials/MaterialRequestModal';
import ErrorMessage from '../components/ErrorMessage';
import { CardListSkeleton, ConfirmDialog, EmptyState, useToast } from '../components/ui';

const STATUS_LABELS: Record<MaterialRequestStatus, string> = {
  PENDING: 'In Attesa',
  APPROVED: 'Approvata',
  REJECTED: 'Rifiutata',
  FULFILLED: 'Evasa',
};

const STATUS_CLASSES: Record<MaterialRequestStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-text border-warning-text/20',
  APPROVED: 'bg-accent/10 text-accent border-accent/20',
  REJECTED: 'bg-danger-bg text-danger-text border-danger-text/20',
  FULFILLED: 'bg-success-bg text-success-text border-success-text/20',
};

const REQUEST_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN', 'WORKER'];
const STATUS_ROLES = ['ADMIN', 'PROJECT_MANAGER'];
const FULFILL_ROLES = ['ADMIN', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];

function formatEmployee(request: MaterialRequest) {
  const name = [request.richiedente?.nome, request.richiedente?.cognome].filter(Boolean).join(' ').trim();
  return name || `Dipendente #${request.richiedente_id}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

export default function MaterialRequestsPage() {
  const { user } = useAuthContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MaterialRequestStatus | ''>('');
  const [cantiereFilter, setCantiereFilter] = useState('');
  const [requestToFulfill, setRequestToFulfill] = useState<MaterialRequest | null>(null);
  const toast = useToast();

  const role = user?.role ?? '';
  const canCreate = REQUEST_ROLES.includes(role);
  const canChangeStatus = STATUS_ROLES.includes(role);
  const canFulfill = FULFILL_ROLES.includes(role);

  const { data: cantieri = [] } = useCantieri();
  const { data: requests = [], isLoading, error } = useMaterialRequests({
    status: statusFilter,
    cantiere_id: cantiereFilter ? Number(cantiereFilter) : null,
  });
  const updateStatus = useUpdateMaterialRequestStatus();
  const fulfillRequest = useFulfillMaterialRequest();

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;

    return requests.filter((request) => {
      const text = [
        request.id,
        request.cantiere?.nome,
        request.task?.title,
        formatEmployee(request),
        request.note,
        request.status,
        ...request.righe.map((line) => `${line.articolo.codice_sku} ${line.articolo.descrizione}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(needle);
    });
  }, [requests, search]);

  const changeStatus = async (request: MaterialRequest, status: Extract<MaterialRequestStatus, 'APPROVED' | 'REJECTED'>) => {
    try {
      await updateStatus.mutateAsync({ id: request.id, status });
      toast.success(
        status === 'APPROVED' ? 'Richiesta approvata' : 'Richiesta rifiutata',
        `Richiesta #${request.id} aggiornata.`
      );
    } catch (err: unknown) {
      toast.error('Aggiornamento non riuscito', getApiErrorMessage(err, 'Errore aggiornamento stato richiesta.'));
    }
  };

  const fulfill = async (request: MaterialRequest) => {
    setRequestToFulfill(request);
  };

  const confirmFulfill = async () => {
    if (!requestToFulfill) return;
    try {
      await fulfillRequest.mutateAsync(requestToFulfill.id);
      toast.success('Richiesta evasa', `Richiesta #${requestToFulfill.id} evasa e giacenze scalate.`);
      setRequestToFulfill(null);
    } catch (err: unknown) {
      toast.error('Evasione non riuscita', getApiErrorMessage(err, 'Errore evasione richiesta.'));
    }
  };

  if (isLoading) return <div className="p-8"><CardListSkeleton rows={6} /></div>;
  if (error) return <div className="p-8"><ErrorMessage error={(error as Error).message} /></div>;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Richieste Materiali</h1>
            <p className="text-text-secondary mt-1 text-sm md:text-base">
              Richieste dai cantieri, approvazione e evasione da magazzino.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={20} />
              Nuova Richiesta
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {(['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED'] as MaterialRequestStatus[]).map((status) => {
            const count = requests.filter((request) => request.status === status).length;
            return (
              <div key={status} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">{STATUS_LABELS[status]}</p>
                <p className="text-2xl font-extrabold text-text-primary mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-background/50 flex flex-col xl:flex-row gap-4 justify-between xl:items-center">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <ClipboardList size={20} className="text-text-secondary" />
              Elenco Richieste
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_240px] gap-3 w-full xl:w-auto">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="text"
                  placeholder="Cerca richiesta..."
                  className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as MaterialRequestStatus | '')}
                className="px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="">Tutti gli stati</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={cantiereFilter}
                onChange={(event) => setCantiereFilter(event.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none"
              >
                <option value="">Tutti i cantieri</option>
                {(cantieri as Cantiere[]).map((cantiere) => (
                  <option key={cantiere.id} value={cantiere.id}>{cantiere.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-border">
            {filteredRequests.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="Nessuna richiesta trovata"
                  description="Modifica i filtri o crea una nuova richiesta materiali."
                  action={canCreate ? { label: 'Nuova richiesta', onClick: () => setIsModalOpen(true) } : undefined}
                />
              </div>
            ) : (
              filteredRequests.map((request) => {
                const isStatusPending = updateStatus.isPending;
                const isFulfillPending = fulfillRequest.isPending;
                return (
                  <div key={request.id} className="p-5 hover:bg-background/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs bg-background border border-border rounded-lg px-2 py-1 text-text-secondary">
                            #{request.id}
                          </span>
                          <span className={`text-xs font-bold border rounded-full px-2.5 py-1 ${STATUS_CLASSES[request.status]}`}>
                            {STATUS_LABELS[request.status]}
                          </span>
                          <span className="text-xs text-text-secondary">{formatDate(request.data_richiesta)}</span>
                        </div>

                        <h3 className="text-lg font-bold text-text-primary mt-3">{request.cantiere?.nome ?? `Cantiere #${request.cantiere_id}`}</h3>
                        <p className="text-sm text-text-secondary mt-1">
                          Richiedente: <span className="font-semibold text-text-primary">{formatEmployee(request)}</span>
                        </p>
                        {request.task && (
                          <p className="text-sm text-text-secondary mt-1">
                            Task: <span className="font-semibold text-text-primary">{request.task.title}</span>
                          </p>
                        )}
                        {request.note && <p className="text-sm text-text-secondary mt-2">{request.note}</p>}

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {request.righe.map((line) => (
                            <div key={line.id} className="bg-background border border-border rounded-2xl p-3">
                              <p className="text-sm font-bold text-text-primary truncate">{line.articolo.descrizione}</p>
                              <p className="text-xs text-text-secondary mt-1">
                                <span className="font-mono">{line.articolo.codice_sku}</span>
                                {' '}· {line.quantita} {line.articolo.unita_misura}
                              </p>
                              {line.note && <p className="text-xs text-text-secondary mt-2">{line.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap lg:flex-col gap-2 lg:items-end shrink-0">
                        {canChangeStatus && request.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => changeStatus(request, 'APPROVED')}
                              disabled={isStatusPending}
                              className="px-4 py-2 rounded-xl bg-success-bg text-success-text text-sm font-bold hover:opacity-80 disabled:opacity-60 flex items-center gap-2"
                            >
                              {isStatusPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                              Approva
                            </button>
                            <button
                              onClick={() => changeStatus(request, 'REJECTED')}
                              disabled={isStatusPending}
                              className="px-4 py-2 rounded-xl bg-danger-bg text-danger-text text-sm font-bold hover:opacity-80 disabled:opacity-60 flex items-center gap-2"
                            >
                              {isStatusPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                              Rifiuta
                            </button>
                          </>
                        )}

                        {canFulfill && request.status === 'APPROVED' && (
                          <button
                            onClick={() => fulfill(request)}
                            disabled={isFulfillPending}
                            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-bold shadow-md shadow-accent/20 hover:bg-accent/90 disabled:opacity-60 flex items-center gap-2"
                          >
                            {isFulfillPending ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                            Evadi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && <MaterialRequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      </AnimatePresence>
      <ConfirmDialog
        open={!!requestToFulfill}
        onClose={() => setRequestToFulfill(null)}
        onConfirm={confirmFulfill}
        title="Evadere richiesta?"
        description={requestToFulfill ? `La richiesta #${requestToFulfill.id} scalerà le giacenze disponibili.` : undefined}
        confirmLabel="Evadi"
        loading={fulfillRequest.isPending}
      />
    </div>
  );
}
