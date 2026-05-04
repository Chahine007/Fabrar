import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface GoogleLoginParams {
  idToken: string;
  inviteCode?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    employee_id: number | null;
    nome: string | null;
    cognome: string | null;
  };
  needsInviteCode?: boolean; // Se true, l'utente esiste su Google ma non nel nostro sistema
}

export interface GenerateInviteResponse {
  invite_code: string;
  employee_id: number;
}

export interface MeResponse {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    is_active: number;
    employee: {
      id: number;
      nome: string | null;
      cognome: string | null;
      telegram_id: string | null;
      ruolo: string | null;
      telegram_pairing_code: string | null;
    } | null;
  };
}

export interface TelegramCodeResponse {
  telegram_pairing_code: string;
}

// Custom fetch per il login per evitare che l'interceptor 401 ricarichi la pagina in caso di credenziali errate
const loginFetch = async (params: GoogleLoginParams): Promise<AuthResponse> => {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    // Includi tutto il payload di errore per poter leggere `needsInviteCode`
    throw data;
  }
  return data;
};

export const useGoogleLogin = () => {
  return useMutation<AuthResponse, any, GoogleLoginParams>({
    mutationFn: loginFetch,
  });
};

export const useGenerateInvite = (employeeId: number) => {
  return useMutation<GenerateInviteResponse, Error>({
    mutationFn: async () => {
      const res = await api.post(`/api/auth/invite/${employeeId}`, {});
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nella generazione del codice invito');
      }
      return res.json();
    },
  });
};

export const useMe = () => {
  return useQuery<MeResponse, Error>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/api/user/me');
      if (!res.ok) {
        throw new Error('Errore nel recupero del profilo');
      }
      return res.json();
    },
  });
};

export const useGenerateTelegramCode = () => {
  return useMutation<TelegramCodeResponse, Error>({
    mutationFn: async () => {
      const res = await api.post('/api/user/telegram-code', {});
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nella generazione del codice Telegram');
      }
      return res.json();
    },
  });
};
