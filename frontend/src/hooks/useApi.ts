/**
 * useApi.ts — Hook generico per fetch autenticata con stato loading/error/data.
 * Supporta refetch manuale e dependencies (come useEffect).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * @example
 * const { data, isLoading, error, refetch } = useApi<Report[]>('/api/reports');
 */
export function useApi<T>(
  path: string | null,
  opts: RequestInit = {},
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData]         = useState<T | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(path !== null);
  const counterRef              = useRef(0);

  const fetchData = useCallback(async () => {
    if (!path) return;
    const id = ++counterRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(path, opts);
      if (id !== counterRef.current) return; // stale request
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
      const json = await res.json();
      if (id !== counterRef.current) return;
      setData(json);
    } catch (err: unknown) {
      if (id !== counterRef.current) return;
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      if (id === counterRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, error, isLoading, refetch: fetchData };
}
