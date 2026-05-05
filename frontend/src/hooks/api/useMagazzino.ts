import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { magazzinoKeys, cantierKeys, taskKeys } from './queryKeys';
import type {
  WarehouseArticle,
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
  });
};

export const useUbicazioni = () => {
  return useQuery({
    queryKey: magazzinoKeys.ubicazioni(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/ubicazioni');
      return res.json() as Promise<WarehouseLocation[]>;
    },
  });
};

export const useGiacenze = () => {
  return useQuery({
    queryKey: magazzinoKeys.giacenze(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/giacenze');
      return res.json() as Promise<WarehouseStockRow[]>;
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
  });
};

export const useCreaMovimento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WarehouseMovementCreatePayload) => {
      const res = await api.post('/api/magazzino/movimenti', payload);
      return res.json() as Promise<WarehouseMovementRow>;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.all() });
      
      if (variables.cantiere_id) {
        queryClient.invalidateQueries({ queryKey: cantierKeys.detail(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: cantierKeys.timeline(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: taskKeys.all() });
      }
    },
  });
};
