/**
 * useConversations.ts — React Query hooks per le Conversazioni e Messaggi.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { conversationKeys } from './queryKeys';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  name: string;
  preview: string;
  timestamp: string;
  unreadCount: number;
  type: string;
  avatar: string;
  isPinned: boolean;
  projectContext?: { status: string; team: string };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: string;
  content: string;
  timestamp: string;
  isMe: boolean;
  status: string;
  metadata: null | Record<string, unknown>;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Errore ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: () => fetchJson<Conversation[]>('/api/conversations'),
    staleTime: 10_000,
  });
}

/** Totale messaggi non letti — usato dal badge in topbar */
export function useTotalUnread(): number {
  const { data } = useConversations();
  return (data ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId!),
    queryFn: () => fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`),
    enabled: conversationId !== null,
    refetchInterval: 5_000, // polling leggero se WebSocket non è disponibile
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, type = 'text' }: { content: string; type?: string }) => {
      const res = await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      });
      if (!res.ok) throw new Error('Errore invio messaggio');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: conversationKeys.list() });
    },
  });
}
