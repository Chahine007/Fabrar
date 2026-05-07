import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../lib/api';
import { billingKeys, dashboardKeys, magazzinoKeys, cantierKeys, taskKeys } from './queryKeys';
import type {
  WarehouseArticle,
  WarehouseArticleCreatePayload,
  WarehouseLocation,
  WarehouseMovementCreatePayload,
  WarehouseMovementRow,
  WarehouseStockRow,
} from '../../types/warehouse';

export const useArticoli = () => {
  return useQuery({
    queryKey: magazzinoKeys.articoli(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/articoli');
      return res.json() as Promise<WarehouseArticle[]>;
    },
    staleTime: 120_000,
  });
};

export const useUbicazioni = () => {
  return useQuery({
    queryKey: magazzinoKeys.ubicazioni(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/ubicazioni');
      return res.json() as Promise<WarehouseLocation[]>;
    },
    staleTime: 120_000,
  });
};

export const useGiacenze = () => {
  return useQuery({
    queryKey: magazzinoKeys.giacenze(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/giacenze');
      return res.json() as Promise<WarehouseStockRow[]>;
    },
    staleTime: 30_000,
  });
};

export const useCreateArticolo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WarehouseArticleCreatePayload) => {
      const res = await api.post('/api/magazzino/articoli', payload);
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getApiErrorMessage(body, `Errore creazione articolo (${res.status})`));
      }

      return body as WarehouseArticle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.articoli() });
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.giacenze() });
    },
  });
};

export const useMovimentiCantiere = (cantiereId: number) => {
  return useQuery({
    queryKey: magazzinoKeys.cantiere(cantiereId),
    queryFn: async () => {
      const res = await api.get(`/api/magazzino/cantiere/${cantiereId}`);
      return res.json() as Promise<WarehouseMovementRow[]>;
    },
    enabled: !!cantiereId,
    staleTime: 30_000,
  });
};

export const useCreaMovimento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WarehouseMovementCreatePayload) => {
      const res = await api.post('/api/magazzino/movimenti', payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.error === 'string' ? body.error : `Errore ${res.status}`);
      }
      return res.json() as Promise<WarehouseMovementRow>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.all() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
      
      if (variables.cantiere_id) {
        queryClient.invalidateQueries({ queryKey: cantierKeys.all() });
        queryClient.invalidateQueries({ queryKey: cantierKeys.detail(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: cantierKeys.timeline(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: billingKeys.project(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: taskKeys.all() });
      }
    },
  });
};
