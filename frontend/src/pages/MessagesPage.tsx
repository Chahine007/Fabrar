import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Pin,
  MoreVertical,
  Phone,
  Video,
  ExternalLink,
  CheckSquare,
  Clock,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Send,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import SmartActionMenu from '../components/SmartActionMenu';
import ShareModal from '../components/ShareModal';
import Spinner from '../components/Spinner';
import { useAuthContext } from '../context/AuthContext';
import {
  ChatMessage,
  Conversation,
  getConversationUnreadCount,
  useCreateConversation,
  useConversations,
  useMessages,
  useSendMessage,
} from '../hooks/api/useConversations';
import { useSearchEmployees } from '../hooks/api/useHr';
import { useTypingIndicator } from '../hooks/useTypingIndicator';

const MessageBubble: React.FC<{ message: ChatMessage; onShare: (message: ChatMessage) => void }> = ({ message, onShare }) => {
  const isSystem = message.type.startsWith('system_');

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 px-4 group relative">
        <div
          className={cn(
            'max-w-md w-full p-4 rounded-2xl border flex items-start gap-4 shadow-sm',
            message.type === 'system_task'
              ? 'bg-info-bg border-info-border text-info-text'
              : message.type === 'system_hours'
                ? 'bg-success-bg border-success-border text-success-text'
                : 'bg-danger-bg border-danger-border text-danger-text'
          )}
        >
          <div
            className={cn(
              'p-2 rounded-xl bg-card shadow-sm shrink-0',
              message.type === 'system_task'
                ? 'text-info-text'
                : message.type === 'system_hours'
                  ? 'text-success-text'
                  : 'text-danger-text'
            )}
          >
            {message.type === 'system_task' ? (
              <CheckSquare size={20} />
            ) : message.type === 'system_hours' ? (
              <Clock size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{message.content}</p>
            {message.metadata && (
              <div className="mt-2 text-xs opacity-80 grid grid-cols-2 gap-2">
                {Object.entries(message.metadata).map(([key, value]) => (
                  <span key={key} className="capitalize">
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] opacity-50">{message.timestamp}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button className="p-1 hover:bg-card/50 rounded-lg transition-colors">
              <ChevronRight size={16} />
            </button>
            <SmartActionMenu
              onShare={() => onShare(message)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3 mb-6 px-6 group', message.isMe ? 'flex-row-reverse' : 'flex-row')}>
      {!message.isMe && (
        <img
          src={message.senderAvatar}
          alt={message.senderName}
          className="w-8 h-8 rounded-full border border-border self-end mb-1"
          referrerPolicy="no-referrer"
        />
      )}
      <div className={cn('max-w-[70%] space-y-1', message.isMe ? 'items-end' : 'items-start')}>
        {!message.isMe && <p className="text-[10px] font-bold text-text-secondary ml-1 mb-1">{message.senderName}</p>}

        <div className="flex items-center gap-2">
          {message.isMe && (
            <SmartActionMenu
              onShare={() => onShare(message)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
          <div
            className={cn(
              'p-4 rounded-2xl shadow-sm',
              message.isMe
                ? 'bg-accent text-white rounded-tr-none'
                : 'bg-card text-text-primary border border-border rounded-tl-none',
              message.type === 'image' && 'p-1 overflow-hidden'
            )}
          >
            {message.type === 'text' && <p className="text-sm leading-relaxed">{message.content}</p>}
            {message.type === 'shared_item' && (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{message.content}</p>
                <div className="p-3 bg-background/50 rounded-xl border border-border/50 text-text-primary">
                  <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-1">Elemento Condiviso</p>
                  <p className="font-medium">{String(message.metadata?.title ?? '')}</p>
                  {message.metadata?.value && (
                    <p className="text-lg font-bold text-accent mt-1">{String(message.metadata.value)}</p>
                  )}
                </div>
              </div>
            )}
            {message.type === 'image' && (
              <img
                src={message.content}
                alt="Message attachment"
                className="rounded-xl w-full h-auto max-h-80 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          {!message.isMe && (
            <SmartActionMenu
              onShare={() => onShare(message)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>

        <div className={cn('flex items-center gap-2 mt-1 px-1', message.isMe ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] text-text-secondary font-medium">{message.timestamp}</span>
          {message.isMe && (
            <div
              className={cn(
                'w-3 h-3 flex items-center justify-center',
                message.status === 'read' ? 'text-accent' : 'text-text-secondary'
              )}
            >
              <CheckCircle2 size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MessagesPage() {
  const { user } = useAuthContext();
  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<unknown>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const createConversation = useCreateConversation();

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const {
    data: messages = [],
    isLoading: loadingMessages,
    error: messagesError,
  } = useMessages(activeConversationId);
  const sendMessage = useSendMessage(activeConversationId, user);
  const { typingUsers, handleTypingStart, handleTypingStop } = useTypingIndicator(activeConversationId, user);

  const visibleConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) =>
      [conversation.name, conversation.preview, conversation.type].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [conversations, searchQuery]);

  const pinnedConversations = visibleConversations.filter((conversation) => conversation.isPinned);
  const usersTypingInActiveConversation = activeConversationId ? typingUsers[activeConversationId] ?? [] : [];
  const shouldSearchEmployees = searchQuery.trim().length >= 2 && visibleConversations.length === 0;
  const {
    data: employeeResults = [],
    isLoading: loadingEmployeeSearch,
  } = useSearchEmployees(searchQuery, shouldSearchEmployees);

  useEffect(() => {
    if (!conversations.length) {
      setActiveConversationId(null);
      return;
    }

    if (!activeConversationId || !conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleShare = (message: ChatMessage) => {
    setItemToShare({
      title: message.content || 'Messaggio',
      value: message.type === 'shared_item' ? message.metadata?.title : undefined,
      type: 'message',
    });
    setShareModalOpen(true);
  };

  const handleExecuteShare = (conversationId: string, message: string, item: unknown) => {
    console.log('Sharing to', conversationId, 'Message:', message, 'Item:', item);
    alert('Messaggio condiviso con successo! (Simulazione)');
  };

  const handleStartDirectConversation = async (targetEmployeeId: number) => {
    try {
      const conversation = await createConversation.mutateAsync({ targetEmployeeId });
      setActiveConversationId(conversation.id);
      setSearchQuery('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore creazione conversazione');
    }
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !activeConversationId || sendMessage.isPending) return;

    setNewMessage('');
    handleTypingStop();

    try {
      await sendMessage.mutateAsync({ content, type: 'text' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore invio messaggio');
    }
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
      return;
    }

    handleTypingStart();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(event.target.value);
    handleTypingStart();
  };

  const conversationsErrorMessage =
    conversationsError instanceof Error ? conversationsError.message : null;
  const messagesErrorMessage = messagesError instanceof Error ? messagesError.message : null;

  return (
    <div className="flex h-full bg-card overflow-hidden transition-colors duration-300">
      <aside className="w-80 border-r border-border flex flex-col bg-background/50">
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Messaggi</h2>
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Cerca conversazioni..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-6 no-scrollbar">
          {conversationsErrorMessage && (
            <div className="p-4 mx-3 bg-danger-bg border border-danger-border rounded-xl text-danger-text text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              {conversationsErrorMessage}
            </div>
          )}

          <div className="space-y-2">
            <div className="px-3 flex items-center gap-2 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              <Pin size={10} />
              Pinned
            </div>
            {loadingConversations && <div className="px-3"><Spinner /></div>}
            {!loadingConversations &&
              pinnedConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-2xl transition-all group',
                    activeConversationId === conversation.id
                      ? 'bg-card shadow-md border border-border'
                      : 'hover:bg-card/50'
                  )}
                >
                  <div className="relative shrink-0">
                    <img
                      src={conversation.avatar}
                      alt={conversation.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-bold text-text-primary truncate">{conversation.name}</p>
                      <span className="text-[10px] text-text-secondary font-medium">{conversation.timestamp}</span>
                    </div>
                    <p className="text-xs text-text-secondary truncate">{conversation.preview}</p>
                  </div>
                  {getConversationUnreadCount(conversation) > 0 && (
                    <div className="w-5 h-5 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm shadow-accent/20">
                      {getConversationUnreadCount(conversation)}
                    </div>
                  )}
                </button>
              ))}
          </div>

          <div className="space-y-4">
            {shouldSearchEmployees && (
              <div className="space-y-2">
                <div className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Nuovo Messaggio
                </div>
                {loadingEmployeeSearch && (
                  <div className="px-3 py-3">
                    <Spinner size="sm" />
                  </div>
                )}
                {!loadingEmployeeSearch && employeeResults.map((employee) => {
                  const fullName = `${employee.firstName} ${employee.lastName}`.trim() || `Utente ${employee.id}`;
                  return (
                    <button
                      key={employee.id}
                      onClick={() => handleStartDirectConversation(employee.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all group hover:bg-card/50"
                    >
                      <div className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center shrink-0 text-accent">
                        <UserPlus size={18} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-text-primary truncate">{fullName}</p>
                        <p className="text-xs text-text-secondary truncate">{employee.role}</p>
                      </div>
                    </button>
                  );
                })}
                {!loadingEmployeeSearch && employeeResults.length === 0 && (
                  <div className="px-3 py-3 text-sm text-text-secondary">
                    Nessun dipendente trovato
                  </div>
                )}
              </div>
            )}

            {(['project', 'team', 'direct', 'system'] as Conversation['type'][]).map((type) => {
              const groupedConversations = visibleConversations.filter(
                (conversation) => conversation.type === type && !conversation.isPinned
              );
              if (groupedConversations.length === 0) return null;

              return (
                <div key={type} className="space-y-2">
                  <div className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                    {type === 'project'
                      ? 'Progetti'
                      : type === 'team'
                        ? 'Teams'
                        : type === 'direct'
                          ? 'Diretti'
                          : 'Sistema'}
                  </div>
                  {groupedConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-2xl transition-all group',
                        activeConversationId === conversation.id
                          ? 'bg-card shadow-md border border-border'
                          : 'hover:bg-card/50'
                      )}
                    >
                      <img
                        src={conversation.avatar}
                        alt={conversation.name}
                        className="w-12 h-12 rounded-xl object-cover border border-border"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-bold text-text-primary truncate">{conversation.name}</p>
                          <span className="text-[10px] text-text-secondary font-medium">{conversation.timestamp}</span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">{conversation.preview}</p>
                      </div>
                      {getConversationUnreadCount(conversation) > 0 && (
                        <div className="w-5 h-5 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                          {getConversationUnreadCount(conversation)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-card">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            {loadingConversations ? <Spinner /> : 'Seleziona una conversazione'}
          </div>
        ) : (
          <>
            <header className="h-20 border-b border-border px-8 flex items-center justify-between shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <img
                  src={activeConversation.avatar}
                  alt={activeConversation.name}
                  className="w-10 h-10 rounded-xl object-cover border border-border"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-base font-bold text-text-primary">{activeConversation.name}</h3>
                  {activeConversation.projectContext && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-success-bg text-success-text rounded uppercase tracking-wider border border-success-border">
                        {activeConversation.projectContext.status}
                      </span>
                      <span className="text-[10px] text-text-secondary font-medium">
                        {activeConversation.projectContext.team}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 mr-4">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-colors">
                    <ExternalLink size={14} />
                    Progetto
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-colors">
                    <CheckSquare size={14} />
                    Task
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-colors">
                    <Clock size={14} />
                    Log Ore
                  </button>
                </div>
                <div className="w-px h-6 bg-border mx-2" />
                <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all">
                  <Phone size={20} />
                </button>
                <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all">
                  <Video size={20} />
                </button>
                <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-background/30 py-8 no-scrollbar">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-center mb-8">
                  <span className="px-3 py-1 bg-card border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest shadow-sm">
                    Oggi
                  </span>
                </div>

                {loadingMessages && messages.length === 0 && (
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                )}

                {messagesErrorMessage && (
                  <div className="p-4 mx-6 bg-danger-bg border border-danger-border rounded-xl text-danger-text text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    {messagesErrorMessage}
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onShare={handleShare} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <AnimatePresence>
              {usersTypingInActiveConversation.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="px-8 text-xs font-medium text-text-secondary italic"
                >
                  {usersTypingInActiveConversation.join(', ')} sta scrivendo...
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-6 bg-card border-t border-border">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-success-bg hover:opacity-80 text-success-text rounded-full text-[10px] font-bold transition-all border border-success-border">
                    <Clock size={14} />
                    Log Ore
                  </button>
                  <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-info-bg hover:opacity-80 text-info-text rounded-full text-[10px] font-bold transition-all border border-info-border">
                    <PlusCircle size={14} />
                    Crea Task
                  </button>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 bg-background border border-border rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-accent/20 focus-within:bg-card transition-all flex items-end gap-1">
                    <div className="flex items-center gap-1 mb-1 ml-1">
                      <button className="p-2 text-text-secondary hover:bg-border rounded-xl transition-colors" title="Allega File">
                        <Paperclip size={18} />
                      </button>
                      <button className="p-2 text-text-secondary hover:bg-border rounded-xl transition-colors" title="Immagine">
                        <ImageIcon size={18} />
                      </button>
                    </div>
                    <textarea
                      placeholder="Scrivi un messaggio..."
                      className="flex-1 bg-transparent border-none outline-none text-sm p-2 resize-none min-h-[44px] max-h-32 text-text-primary"
                      rows={1}
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="flex items-center gap-1 mb-1 mr-1">
                      <button className="p-2 text-text-secondary hover:bg-border rounded-xl transition-colors" title="Nota Vocale">
                        <Mic size={18} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all hover:scale-105 active:scale-95 shrink-0 mb-0.5 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    {sendMessage.isPending ? <Spinner size="sm" /> : <Send size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        itemToShare={itemToShare}
        onShare={handleExecuteShare}
      />
    </div>
  );
}
