import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../../lib/api';
import { cantierKeys, dashboardKeys } from './queryKeys';

export interface DocumentUploader {
  id: number;
  nome?: string | null;
  cognome?: string | null;
  ruolo?: string | null;
}

export interface ProjectDocument {
  id: number;
  cantiere_id: number;
  name: string;
  file_path?: string | null;
  type: string;
  size: string;
  mime_type?: string | null;
  dimensione?: number | null;
  employee_id?: number | null;
  uploader?: string | null;
  uploaded_by?: DocumentUploader | null;
  tag?: string | null;
  numero_fattura?: string | null;
  data_emissione?: string | null;
  importo?: number | string | null;
  created_at: string;
}

export interface UploadDocumentPayload {
  file: File;
  cantiere_id: number;
  tag?: string;
  numero_fattura?: string;
  data_emissione?: string;
  importo?: number | string;
  spesa_id?: number;
  movimento_id?: number;
  fattura_id?: number;
}

async function parseJsonError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return getApiErrorMessage(body, fallback);
}

export function useDocuments(cantiereId: number | null, tag?: string) {
  return useQuery({
    queryKey: [...cantierKeys.docs(cantiereId!), tag].filter(Boolean),
    queryFn: async () => {
      const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
      const response = await apiFetch(`/api/documents/cantiere/${cantiereId}${params}`);
      if (!response.ok) {
        throw new Error(await parseJsonError(response, 'Errore caricamento documenti'));
      }
      return response.json() as Promise<ProjectDocument[]>;
    },
    enabled: cantiereId !== null,
  });
}

export function useUploadDocument(cantiereId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<UploadDocumentPayload, 'cantiere_id'>) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('cantiere_id', String(cantiereId));
      if (payload.tag) formData.append('tag', payload.tag);
      if (payload.numero_fattura) formData.append('numero_fattura', payload.numero_fattura);
      if (payload.data_emissione) formData.append('data_emissione', payload.data_emissione);
      if (payload.importo !== undefined && payload.importo !== null) formData.append('importo', String(payload.importo));
      if (payload.spesa_id) formData.append('spesa_id', String(payload.spesa_id));
      if (payload.movimento_id) formData.append('movimento_id', String(payload.movimento_id));
      if (payload.fattura_id) formData.append('fattura_id', String(payload.fattura_id));

      const response = await apiFetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response, 'Errore durante il caricamento del file'));
      }

      return response.json() as Promise<ProjectDocument>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cantierKeys.docs(cantiereId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
    },
  });
}

export function useDeleteDocument(cantiereId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiFetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseJsonError(response, 'Errore eliminazione documento'));
      }

      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cantierKeys.docs(cantiereId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
    },
  });
}

export async function downloadDocument(document: ProjectDocument) {
  const response = await apiFetch(`/api/documents/${document.id}/download`);

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Errore download documento'));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.name;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
