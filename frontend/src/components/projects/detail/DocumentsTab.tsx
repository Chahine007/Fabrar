import { useRef, type ChangeEvent } from 'react';
import { Download, FileText as FileTextIcon, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDocuments, useUploadDocument } from '../../../hooks/api/useCantieri';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';
import { useToast } from '../../ui';

export default function DocumentsTab({ cantiereId }: { cantiereId: number }) {
  const { data: docs, isLoading, error, refetch } = useDocuments(cantiereId);
  const uploadDoc = useUploadDocument(cantiereId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadDoc.mutateAsync({ file });
      toast.success('Documento caricato', file.name);
    } catch (error: unknown) {
      toast.error('Upload non riuscito', error instanceof Error ? error.message : 'Errore upload');
    }

    event.target.value = '';
  };

  const handleDownload = (docId: number) => {
    window.open(`/api/cantieri/${cantiereId}/documents/${docId}/download`, '_blank');
  };

  if (isLoading) return <div className="py-12"><Spinner label="Caricamento documenti..." /></div>;
  if (error || !docs) return <div className="py-12"><ErrorMessage error={(error as Error)?.message ?? 'Errore'} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelected}
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
      />
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">Documenti di Progetto</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDoc.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          <UploadCloud size={16} />
          {uploadDoc.isPending ? 'Caricamento...' : 'Carica File'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className={cn('p-3 rounded-xl', doc.type === 'pdf' ? 'bg-danger-bg text-danger-text' : doc.type === 'image' ? 'bg-info-bg text-info-text' : 'bg-success-bg text-success-text')}>
                {doc.type === 'image' ? <ImageIcon size={24} /> : <FileTextIcon size={24} />}
              </div>
              <button
                onClick={() => handleDownload(doc.id)}
                className="p-2 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                title="Scarica documento"
              >
                <Download size={18} />
              </button>
            </div>
            <p className="font-bold text-text-primary text-sm truncate mb-1">{doc.name}</p>
            <div className="flex items-center justify-between mt-auto pt-4 text-xs text-text-secondary">
              <span>{doc.size}</span>
              <span>{new Date(doc.created_at).toLocaleDateString('it-IT')}</span>
            </div>
          </div>
        ))}
      </div>
      {docs.length === 0 && (
        <div className="text-center py-12 text-text-secondary text-sm">Nessun documento caricato per questo cantiere.</div>
      )}
    </div>
  );
}
