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
  lastActivityAt?: string | null;
  unreadCount?: number;
  type: string;
  avatar: string;
  isPinned: boolean;
  cantiereId?: number | null;
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
  sender_name?: string | null;
  sender_avatar?: string | null;
  type: string;
  content: string;
  created_at: string;
  metadata?: null | Record<string, unknown>;
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
  conversationId?: string | null;
  content: string;
  type?: string;
}

interface SendMessageContext {
  previousMessages?: ChatMessage[];
  previousConversations?: Conversation[];
  tempId: string;
  conversationId: string | null;
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

  const currentEmployeeId = getCurrentUserIdentity().employee_id;
  if (currentEmployeeId != null) {
    const currentParticipant = conversation.participants?.find(
      (participant) => participant.employee_id === currentEmployeeId
    );
    if (currentParticipant) {
      return currentParticipant.unread_count ?? 0;
    }
  }

  return 0;
}

function getConversationPreview(content: string): string {
  return content.trim();
}

function getConversationSortTimestamp(conversation: Conversation): number {
  const rawDate = conversation.lastActivityAt;
  if (!rawDate) return 0;
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return getConversationSortTimestamp(right) - getConversationSortTimestamp(left);
  });
}

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    type: String(conversation.type || 'system').toLowerCase(),
    unreadCount: getConversationUnreadCount(conversation),
    lastActivityAt: conversation.lastActivityAt ?? null,
    cantiereId: typeof conversation.cantiereId === 'number' ? conversation.cantiereId : null,
  };
}

function mapApiCreatedMessageToChatMessage(
  message: ApiCreatedMessage,
  currentUser?: CurrentChatUser | null
): ChatMessage {
  const senderName = message.sender_name?.trim() || buildSenderName(message.sender_id, currentUser);
  const isMe = getCurrentUserIdentity(currentUser).employee_id === message.sender_id;

  return {
    id: String(message.id),
    senderId: message.sender_id != null ? String(message.sender_id) : 'system',
    senderName,
    senderAvatar: message.sender_avatar || buildAvatar(senderName, message.sender_id),
    type: message.type,
    content: message.content,
    timestamp: formatMessageTime(message.created_at),
    isMe,
    status: 'read',
    metadata: message.metadata ?? null,
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
    metadata: { optimistic: true, clientCreatedAt: Date.now() },
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
  updates: Partial<Pick<Conversation, 'preview' | 'timestamp' | 'unreadCount' | 'lastActivityAt'>>
): Conversation[] | undefined {
  if (!conversations) return conversations;

  return sortConversations(conversations.map((conversation) =>
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
  ));
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
    select: (conversations) => sortConversations(conversations.map(normalizeConversation)),
  });
}

export function useTotalUnread(): number {
  const { data } = useConversations();
  return (data ?? []).reduce((sum, conversation) => sum + getConversationUnreadCount(conversation), 0);
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: conversationId ? conversationKeys.messages(conversationId) : ['messages', 'idle'],
    queryFn: () => fetchJson<ChatMessage[]>(`/api/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!conversationId || !query.data) return;

    queryClient.setQueryData<Conversation[]>(
      conversationKeys.list(),
      (conversations) =>
        updateConversationList(conversations, conversationId, {
          unreadCount: 0,
        })
    );
  }, [conversationId, query.data, queryClient]);

  return query;
}

export function useSendMessage(conversationId: string | null, currentUser?: CurrentChatUser | null) {
  const queryClient = useQueryClient();

  return useMutation<ApiCreatedMessage, Error, SendMessageInput, SendMessageContext>({
    mutationFn: async ({ conversationId: targetConversationId, content, type = 'text' }) => {
      const resolvedConversationId = targetConversationId ?? conversationId;
      if (!resolvedConversationId) {
        throw new Error('Conversazione non selezionata');
      }

      const response = await apiFetch(`/api/conversations/${resolvedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Errore invio messaggio');
      }

      return response.json() as Promise<ApiCreatedMessage>;
    },
    onMutate: async ({ conversationId: targetConversationId, content, type = 'text' }) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const resolvedConversationId = targetConversationId ?? conversationId;

      if (!resolvedConversationId) {
        return { tempId, conversationId: null };
      }

      await queryClient.cancelQueries({ queryKey: conversationKeys.messages(resolvedConversationId) });

      const previousMessages = queryClient.getQueryData<ChatMessage[]>(conversationKeys.messages(resolvedConversationId));
      const previousConversations = queryClient.getQueryData<Conversation[]>(conversationKeys.list());
      const optimisticMessage = createOptimisticMessage(tempId, content, type, currentUser);
      const preview = getConversationPreview(content);
      const nowIso = new Date().toISOString();

      queryClient.setQueryData<ChatMessage[]>(
        conversationKeys.messages(resolvedConversationId),
        (existingMessages = []) => [...existingMessages, optimisticMessage]
      );

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, resolvedConversationId, {
            preview,
            timestamp: optimisticMessage.timestamp,
            lastActivityAt: nowIso,
            unreadCount: 0,
          })
      );

      return {
        previousMessages,
        previousConversations,
        tempId,
        conversationId: resolvedConversationId,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context?.conversationId) return;

      if (context.previousMessages) {
        queryClient.setQueryData(conversationKeys.messages(context.conversationId), context.previousMessages);
      }

      if (context.previousConversations) {
        queryClient.setQueryData(conversationKeys.list(), context.previousConversations);
      }
    },
    onSuccess: (createdMessage, _variables, context) => {
      if (!context?.conversationId) return;

      const mappedMessage = mapApiCreatedMessageToChatMessage(createdMessage, currentUser);
      const preview = getConversationPreview(mappedMessage.content);

      queryClient.setQueryData<ChatMessage[]>(
        conversationKeys.messages(context.conversationId),
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
          updateConversationList(conversations, context.conversationId, {
            preview,
            timestamp: mappedMessage.timestamp,
            lastActivityAt: createdMessage.created_at,
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
            return sortConversations(existingConversations.map((item) =>
              item.id === normalizedConversation.id ? normalizedConversation : item
            ));
          }

          return sortConversations([normalizedConversation, ...existingConversations]);
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
      const preview = getConversationPreview(mappedMessage.content);
      const messagesKey = conversationKeys.messages(conversationId);
      const existingMessages = queryClient.getQueryData<ChatMessage[]>(messagesKey);
      const existingConversations = queryClient.getQueryData<Conversation[]>(conversationKeys.list());

      if (existingMessages) {
        queryClient.setQueryData<ChatMessage[]>(
          messagesKey,
          (messages = []) => mergeIncomingMessage(messages, mappedMessage)
        );
      }

      if (!existingConversations?.some((conversation) => conversation.id === conversationId)) {
        queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
        return;
      }

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (conversations) =>
          updateConversationList(conversations, conversationId, {
            preview,
            timestamp: mappedMessage.timestamp,
            lastActivityAt: message.created_at,
          })
      );
    };

    const handleConversationUpdated = ({ conversationId, unreadCount }: ConversationUpdatedPayload) => {
      if (!conversationId) return;

      const existingConversations = queryClient.getQueryData<Conversation[]>(conversationKeys.list());
      if (!existingConversations?.some((conversation) => conversation.id === conversationId)) {
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
