/**
 * api.ts — Client API centralizzato per Fabrar
 * Inietta automaticamente il JWT token su ogni richiesta autenticata.
 * Usa il path relativo: in dev → Vite proxy → Express :3000
 *                        in prod → stesso origin (Express serve il build)
 */

const TOKEN_KEY = 'jwt_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    // Verifica scadenza (exp in secondi)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearToken();
      return false;
    }
    return true;
  } catch {
    clearToken();
    return false;
  }
}

export function getTokenPayload(): Record<string, unknown> | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Fetch autenticata — wrapper su fetch() con Authorization header automatico.
 * Gestisce automaticamente 401: cancella il token e ricarica la pagina.
 */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...opts, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
  }

  return res;
}

/**
 * Helper per le richieste più comuni
 */
export const api = {
  get: (path: string) => apiFetch(path, { method: 'GET' }),
  post: (path: string, body: unknown) =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};
