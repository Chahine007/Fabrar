import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Download,
  FileText as FileTextIcon,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  downloadDocument,
  type ProjectDocument,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from '../../../hooks/api/useDocuments';
import ErrorMessage from '../../ErrorMessage';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  ResponsiveDataView,
  TableSkeleton,
  useToast,
} from '../../ui';
import { useAuthContext } from '../../../context/AuthContext';

const DELETE_ROLES = ['ADMIN', 'HR', 'PROJECT_MANAGER', 'WAREHOUSEMAN'];

function getDocumentIcon(doc: ProjectDocument) {
  if (doc.type === 'image' || doc.mime_type?.startsWith('image/')) return ImageIcon;
  return FileTextIcon;
}

function getUploaderLabel(doc: ProjectDocument) {
  const uploadedBy = doc.uploaded_by;
  const fullName = [uploadedBy?.nome, uploadedBy?.cognome].filter(Boolean).join(' ').trim();
  return fullName || doc.uploader || 'N/D';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('it-IT');
}

export default function DocumentsTab({ cantiereId }: { cantiereId: number }) {
  const { user } = useAuthContext();
  const { data: docs = [], isLoading, error, refetch } = useDocuments(cantiereId);
  const uploadDocument = useUploadDocument(cantiereId);
  const deleteDocumentMutation = useDeleteDocument(cantiereId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ProjectDocument | null>(null);
  const toast = useToast();

  const canDelete = DELETE_ROLES.includes(user?.role ?? '');

  const uploadFile = async (file: File) => {
    try {
      await uploadDocument.mutateAsync({ file, tag: 'generic' });
      toast.success('Documento caricato', file.name);
    } catch (error: unknown) {
      toast.error('Upload non riuscito', error instanceof Error ? error.message : 'Errore upload');
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadFile(file);
    event.target.value = '';
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      await downloadDocument(doc);
    } catch (error: unknown) {
      toast.error('Download non riuscito', error instanceof Error ? error.message : 'Errore download');
    }
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      await deleteDocumentMutation.mutateAsync(documentToDelete.id);
      toast.success('Documento eliminato', documentToDelete.name);
      setDocumentToDelete(null);
    } catch (error: unknown) {
      toast.error('Eliminazione non riuscita', error instanceof Error ? error.message : 'Errore eliminazione');
    }
  };

  if (isLoading) {
    return <TableSkeleton rows={5} columns={5} />;
  }

  if (error) {
    return <ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} />;
  }

  const renderActions = (doc: ProjectDocument) => (
    <div className="flex items-center justify-end gap-2">
      <IconButton
        aria-label="Scarica documento"
        variant="secondary"
        size="sm"
        onClick={() => handleDownload(doc)}
      >
        <Download size={16} />
      </IconButton>
      {canDelete && (
        <IconButton
          aria-label="Elimina documento"
          variant="danger"
          size="sm"
          disabled={deleteDocumentMutation.isPending}
          onClick={() => setDocumentToDelete(doc)}
        >
          <Trash2 size={16} />
        </IconButton>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelected}
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Documenti di Progetto</h3>
          <p className="mt-1 text-sm text-text-secondary">DDT, fatture, scontrini e allegati collegati al cantiere.</p>
        </div>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDocument.isPending}
          className="gap-2"
        >
          {uploadDocument.isPending ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {uploadDocument.isPending ? 'Caricamento...' : 'Carica File'}
        </Button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors',
          isDragging ? 'border-accent bg-accent/5' : 'border-border'
        )}
      >
        <UploadCloud className="mx-auto mb-3 text-text-secondary" size={28} />
        <p className="text-sm font-bold text-text-primary">Trascina un file qui o selezionalo manualmente</p>
        <p className="mt-1 text-xs text-text-secondary">PDF, immagini, Word ed Excel. Dimensione massima 10MB.</p>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="Nessun documento caricato"
          description="Carica DDT, fatture o scontrini per mantenere il fascicolo del cantiere completo."
          action={{ label: 'Carica file', onClick: () => fileInputRef.current?.click() }}
        />
      ) : (
        <ResponsiveDataView
          data={docs}
          getKey={(doc) => doc.id}
          emptyTitle="Nessun documento"
          emptyDescription="Nessun documento caricato per questo cantiere."
          renderCard={(doc) => {
            const Icon = getDocumentIcon(doc);
            return (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn('rounded-xl p-3', doc.type === 'image' ? 'bg-info-bg text-info-text' : doc.type === 'pdf' ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text')}>
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text-primary">{doc.name}</p>
                      <p className="mt-1 text-xs text-text-secondary">{doc.size} · {formatDate(doc.created_at)}</p>
                      <p className="mt-1 text-xs text-text-secondary">Uploader: {getUploaderLabel(doc)}</p>
                    </div>
                  </div>
                  {renderActions(doc)}
                </div>
              </div>
            );
          }}
          renderTable={(rows) => (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-xs font-bold uppercase tracking-wider text-text-secondary">
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Dimensione</th>
                  <th className="px-5 py-3">Uploader</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((doc) => {
                  const Icon = getDocumentIcon(doc);
                  return (
                    <tr key={doc.id} className="transition-colors hover:bg-background/50">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn('rounded-xl p-2.5', doc.type === 'image' ? 'bg-info-bg text-info-text' : doc.type === 'pdf' ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text')}>
                            <Icon size={18} />
                          </div>
                          <span className="truncate font-bold text-text-primary">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text-secondary">{doc.mime_type || doc.type}</td>
                      <td className="px-5 py-4 text-text-secondary">{doc.size}</td>
                      <td className="px-5 py-4 text-text-secondary">{getUploaderLabel(doc)}</td>
                      <td className="px-5 py-4 text-text-secondary">{formatDate(doc.created_at)}</td>
                      <td className="px-5 py-4">{renderActions(doc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        />
      )}

      <ConfirmDialog
        open={!!documentToDelete}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminare documento?"
        description={documentToDelete ? `"${documentToDelete.name}" verrà rimosso dal database e dal disco.` : undefined}
        confirmLabel="Elimina"
        loading={deleteDocumentMutation.isPending}
        variant="danger"
      />
    </div>
  );
}
