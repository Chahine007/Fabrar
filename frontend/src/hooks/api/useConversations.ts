import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getTokenPayload } from '../../lib/api';
import { useSocket } from '../useSocket';
import { conversationKeys } from './queryKeys';

export interface ConversationParticipant {
  employee_id: number;
  unread_count: number;
  joined_at?: string;
}

export interface Conversation {
  id: string;
  name: string;
  preview: string;
  timestamp: string;
  unreadCount?: number;
  type: string;
  avatar: string;
  isPinned: boolean;
  projectContext?: { status: string; team: string };
  participants?: ConversationParticipant[];
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

interface CreateConversationPayload {
  targetEmployeeId: number;
}

interface CurrentChatUser {
  employee_id?: number | null;
  username?: string | null;
  nome?: string | null;
  cognome?: string | null;
}

interface ApiCreatedMessage {
  id: string | number;
  conversation_id: string;
  sender_id: number | null;
  type: string;
  content: string;
  created_at: string;
}

interface NewMessagePayload {
  conversationId: string;
  message: ApiCreatedMessage;
}

interface ConversationUpdatedPayload {
  conversationId: string;
  unreadCount: number;
}

interface SendMessageInput {
  content: string;
  type?: string;
}

interface SendMessageContext {
  previousMessages?: ChatMessage[];
  previousConversations?: Conversation[];
  tempId: string;
}

function getFallbackCurrentUser(): CurrentChatUser {
  const payload = getTokenPayload();
  return {
    employee_id: typeof payload?.employee_id === 'number' ? payload.employee_id : null,
    username: typeof payload?.username === 'string' ? payload.username : null,
  };
}

function getCurrentUserIdentity(currentUser?: CurrentChatUser | null): CurrentChatUser {
  return currentUser ?? getFallbackCurrentUser();
}

function formatMessageTime(dateValue?: string | Date | null): string {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function buildSenderName(senderId: number | null, currentUser?: CurrentChatUser | null): string {
  const identity = getCurrentUserIdentity(currentUser);
  if (senderId != null && identity.employee_id === senderId) {
    return 'Tu';
  }

  return senderId != null ? `Utente ${senderId}` : 'Sistema';
}

function buildAvatar(senderName: string, senderId: number | null): string {
  if (senderId == null) return '';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`;
}

export function getConversationUnreadCount(conversation: Conversation): number {
  if (typeof conversation.unreadCount === 'number') {
    return conversation.unreadCount;
  }

  return conversation.participants?.[0]?.unread_count ?? 0;
}

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    type: String(conversation.type || 'system').toLowerCase(),
    unreadCount: getConversationUnreadCount(conversation),
  };
}

function mapApiCreatedMessageToChatMessage(
  message: ApiCreatedMessage,
  currentUser?: CurrentChatUser | null
): ChatMessage {
  const senderName = buildSenderName(message.sender_id, currentUser);
  const isMe = getCurrentUserIdentity(currentUser).employee_id === message.sender_id;

  return {
    id: String(message.id),
    senderId: message.sender_id != null ? String(message.sender_id) : 'system',
    senderName,
    senderAvatar: buildAvatar(senderName, message.sender_id),
    type: message.type,
    content: message.content,
    timestamp: formatMessageTime(message.created_at),
    isMe,
    status: 'read',
    metadata: null,
  };
}

function createOptimisticMessage(
  tempId: string,
  content: string,
  type: string,
  currentUser?: CurrentChatUser | null
): ChatMessage {
  const identity = getCurrentUserIdentity(currentUser);
  const senderName =
    `${identity.nome || ''} ${identity.cognome || ''}`.trim() ||
    identity.username ||
    'Tu';

  return {
    id: tempId,
    senderId: identity.employee_id != null ? String(identity.employee_id) : 'me',
    senderName,
    senderAvatar: buildAvatar(senderName, identity.employee_id ?? null),
    type,
    content,
    timestamp: formatMessageTime(new Date()),
    isMe: true,
    status: 'sent',
    metadata: {
      optimistic: true,
      clientCreatedAt: Date.now(),
    },
  };
}

function isOptimisticDuplicate(candidate: ChatMessage, incoming: ChatMessage): boolean {
  return Boolean(candidate.metadata?.optimistic) &&
    candidate.senderId === incoming.senderId &&
    candidate.type === incoming.type &&
    candidate.content === incoming.content;
}

function mergeIncomingMessage(existingMessages: ChatMessage[], incomingMessage: ChatMessage): ChatMessage[] {
  if (existingMessages.some((message) => message.id === incomingMessage.id)) {
    return existingMessages;
  }

  const nextMessages = [...existingMessages];
  const optimisticIndex = nextMessages.findIndex((message) => isOptimisticDuplicate(message, incomingMessage));

  if (optimisticIndex >= 0) {
    nextMessages.splice(optimisticIndex, 1);
  }

  nextMessages.push(incomingMessage);
  return nextMessages;
}

function updateConversationList(
  conversations: Conversation[] | undefined,
  conversationId: string,
  updates: Partial<Pick<Conversation, 'preview' | 'timestamp' | 'unreadCount'>>
): Conversation[] | undefined {
  if (!conversations) return conversations;

  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? normalizeConversation({
          ...conversation,
          ...updates,
          unreadCount:
            typeof updates.unreadCount === 'number'
              ? updates.unreadCount
              : getConversationUnreadCount(conversation),
        })
      : normalizeConversation(conversation)
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Errore ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: () => fetchJson<Conversation[]>('/api/conversations'),
    staleTime: 10_000,
    select: (conversations) => conversations.map(normalizeConversation),
  });
}

export function useTotalUnread(): number {
  const { data } = useConversations();
  return (data ?? []).reduce((sum, conversation) => sum + getConversationUnreadCount(conversation), 0);
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId ? conversationKeys.messages(conversationId) : ['messages', 'idle'],
    queryFn: () => fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage(conversationId: string | null, currentUser?: CurrentChatUser | null) {
  const queryClient = useQueryClient();

  return useMutation<ApiCreatedMessage, Error, SendMessageInput, SendMessageContext>({
    mutationFn: async ({ content, type = 'text' }) => {
      if (!conversationId) {
        throw new Error('Conversazione non selezionata');
      }

      const response = await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Errore invio messaggio');
      }

      return response.json() as Promise<ApiCreatedMessage>;
    },
    onMutate: async ({ content, type = 'text' }) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (!conversationId) {
        return { tempId };
      }

      await queryClient.cancelQueries({ queryKey: conversationKeys.messages(conversationId) });

      const previousMessages = queryClient.getQueryData<ChatMessage[]>(conversationKeys.messages(conversationId));
      const previousConversations = queryClient.getQueryData<Conversation[]>(conversationKeys.list());
      const optimisticMessage = createOptimisticMessage(tempId, content, type, currentUser);

      queryClient.setQueryData<ChatMessage[]>(
        conversationKeys.messages(conversationId),
        (existingMessages = []) => [...existingMessages, optimisticMessage]
      );

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, conversationId, {
            preview: content,
            timestamp: optimisticMessage.timestamp,
            unreadCount: 0,
          })
      );

      return {
        previousMessages,
        previousConversations,
        tempId,
      };
    },
    onError: (_error, _variables, context) => {
      if (!conversationId || !context) return;

      if (context.previousMessages) {
        queryClient.setQueryData(conversationKeys.messages(conversationId), context.previousMessages);
      }

      if (context.previousConversations) {
        queryClient.setQueryData(conversationKeys.list(), context.previousConversations);
      }
    },
    onSuccess: (createdMessage, _variables, context) => {
      if (!conversationId) return;

      const mappedMessage = mapApiCreatedMessageToChatMessage(createdMessage, currentUser);

      queryClient.setQueryData<ChatMessage[]>(
        conversationKeys.messages(conversationId),
        (existingMessages = []) => {
          const withoutOptimistic = context?.tempId
            ? existingMessages.filter((message) => message.id !== context.tempId)
            : existingMessages;

          if (withoutOptimistic.some((message) => message.id === mappedMessage.id)) {
            return withoutOptimistic;
          }

          return [...withoutOptimistic, mappedMessage];
        }
      );

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, conversationId, {
            preview: mappedMessage.content,
            timestamp: mappedMessage.timestamp,
            unreadCount: 0,
          })
      );
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetEmployeeId }: CreateConversationPayload) => {
      const response = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ targetEmployeeId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Errore creazione conversazione');
      }

      return response.json() as Promise<Conversation>;
    },
    onSuccess: (conversation) => {
      const normalizedConversation = normalizeConversation(conversation);

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (existingConversations = []) => {
          if (existingConversations.some((item) => item.id === normalizedConversation.id)) {
            return existingConversations.map((item) =>
              item.id === normalizedConversation.id ? normalizedConversation : item
            );
          }

          return [normalizedConversation, ...existingConversations];
        }
      );

      queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
    },
  });
}

export function useChatSockets(currentUser?: CurrentChatUser | null) {
  const identity = useMemo(
    () => getCurrentUserIdentity(currentUser),
    [currentUser?.employee_id, currentUser?.username, currentUser?.nome, currentUser?.cognome]
  );
  const { socket } = useSocket(identity.employee_id ?? undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }: NewMessagePayload) => {
      if (!conversationId || !message) return;

      const mappedMessage = mapApiCreatedMessageToChatMessage(message, identity);
      const messagesKey = conversationKeys.messages(conversationId);
      const existingMessages = queryClient.getQueryData<ChatMessage[]>(messagesKey);

      if (existingMessages) {
        queryClient.setQueryData<ChatMessage[]>(
          messagesKey,
          (messages = []) => mergeIncomingMessage(messages, mappedMessage)
        );
      }

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, conversationId, {
            preview: mappedMessage.content,
            timestamp: mappedMessage.timestamp,
          })
      );
    };

    const handleConversationUpdated = ({ conversationId, unreadCount }: ConversationUpdatedPayload) => {
      if (!conversationId) return;

      const existingConversations = queryClient.getQueryData<Conversation[]>(conversationKeys.list());
      if (!existingConversations) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
        return;
      }

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, conversationId, {
            unreadCount,
          })
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_updated', handleConversationUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_updated', handleConversationUpdated);
    };
  }, [identity, queryClient, socket]);
}
