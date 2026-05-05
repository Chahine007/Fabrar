import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { magazzinoKeys, cantierKeys } from './queryKeys';

export const useArticoli = () => {
  return useQuery({
    queryKey: magazzinoKeys.articoli(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/articoli');
      return res.json();
    },
  });
};

export const useUbicazioni = () => {
  return useQuery({
    queryKey: magazzinoKeys.ubicazioni(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/ubicazioni');
      return res.json();
    },
  });
};

export const useGiacenze = () => {
  return useQuery({
    queryKey: magazzinoKeys.giacenze(),
    queryFn: async () => {
      const res = await api.get('/api/magazzino/giacenze');
      return res.json();
    },
  });
};

export const useMovimentiCantiere = (cantiereId: number) => {
  return useQuery({
    queryKey: magazzinoKeys.cantiere(cantiereId),
    queryFn: async () => {
      const res = await api.get(`/api/magazzino/cantiere/${cantiereId}`);
      return res.json();
    },
    enabled: !!cantiereId,
  });
};

interface CreaMovimentoParams {
  tipo_movimento: 'CARICO' | 'SCARICO_CANTIERE';
  articolo_id: number;
  quantita: number;
  ubicazione_da_id?: number;
  ubicazione_a_id?: number;
  cantiere_id?: number;
  wbs_node_id?: number | null;
  costo_acquisto?: number;
  documento_id?: number | null;
  fornitore_id?: number | null;
}

export const useCreaMovimento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreaMovimentoParams) => {
      const res = await api.post('/api/magazzino/movimenti', payload);
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalida le chiavi magazzino per rifrescare le giacenze/articoli
      queryClient.invalidateQueries({ queryKey: magazzinoKeys.all() });
      
      // Se era uno scarico su un cantiere, invalida il cantiere (per far ripartire la wbs e la timeline costi)
      if (variables.cantiere_id) {
        queryClient.invalidateQueries({ queryKey: cantierKeys.detail(variables.cantiere_id) });
        queryClient.invalidateQueries({ queryKey: cantierKeys.timeline(variables.cantiere_id) });
      }
    },
  });
};
