import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Hash, MessageCircle, MessageSquare, Paperclip, Send } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useConversations, useMessages, useSendMessage } from '../../../hooks/api/useConversations';
import Spinner from '../../Spinner';
import ErrorMessage from '../../ErrorMessage';

function formatMessageTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesTab({
  cantiereId,
  cantiereName,
}: {
  cantiereId: number;
  cantiereName: string;
}) {
  const { data: conversations, isLoading: loadingConv } = useConversations();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const conversation = conversations?.find((item) =>
    item.name.toLowerCase().includes(cantiereName.toLowerCase()) ||
    item.name.toLowerCase().includes(`cantiere ${cantiereId}`) ||
    item.type === 'cantiere'
  ) ?? conversations?.[0] ?? null;

  const conversationId = conversation?.id ?? null;
  const { data: messages, isLoading: loadingMsgs, error } = useMessages(conversationId);
  const sendMsg = useSendMessage(conversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendMsg.isPending || !conversationId) return;
    setInput('');
    try {
      await sendMsg.mutateAsync({ content: text });
    } catch {
      // lasciamo che l'errore resti visibile nel footer
    }
  };

  if (loadingConv) return <div className="py-12"><Spinner label="Caricamento conversazioni..." /></div>;

  if (!conversationId) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center gap-4 bg-card rounded-3xl border border-border shadow-sm animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center border border-border">
          <MessageCircle size={28} className="text-text-secondary opacity-40" />
        </div>
        <p className="font-semibold text-text-primary">Nessuna conversazione attiva</p>
        <p className="text-sm text-text-secondary max-w-xs text-center opacity-70">
          Non è disponibile una conversazione collegata a questo cantiere.
          Crea una conversazione dalla pagina Messaggi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[580px] bg-card rounded-3xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <Hash size={16} className="text-accent" />
        </div>
        <div>
          <p className="font-bold text-text-primary text-sm">{conversation.name}</p>
          <p className="text-[11px] text-text-secondary">Aggiornamento in tempo reale</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar space-y-4">
        {loadingMsgs ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : error ? (
          <ErrorMessage error={(error as Error).message} onRetry={() => {}} />
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-2 py-8">
            <MessageSquare size={32} className="opacity-20" />
            <p className="text-sm">Nessun messaggio</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex gap-3 items-end', message.isMe ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold text-white',
                  message.isMe ? 'bg-accent' : 'bg-indigo-500'
                )}
              >
                {(message.senderName ?? '?').charAt(0).toUpperCase()}
              </div>
              <div
                className={cn(
                  'max-w-[72%] px-4 py-2.5 rounded-2xl text-sm shadow-sm',
                  message.isMe
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-background text-text-primary border border-border rounded-bl-sm'
                )}
              >
                {!message.isMe && (
                  <p className="text-[10px] font-bold text-accent mb-1">{message.senderName}</p>
                )}
                <p className="leading-relaxed break-words">{message.content}</p>
                <p className={cn('text-[10px] mt-1 text-right', message.isMe ? 'text-white/60' : 'text-text-secondary')}>
                  {formatMessageTimestamp(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 bg-background border border-border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <button className="p-1 text-text-secondary hover:text-accent transition-colors">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSend()}
            placeholder="Scrivi un messaggio..."
            disabled={sendMsg.isPending}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-secondary disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || sendMsg.isPending}
            className="p-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-accent/20"
          >
            {sendMsg.isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={16} />}
          </motion.button>
        </div>
        {sendMsg.error && (
          <p className="text-xs text-danger-text mt-1 px-2">
            ❌ {sendMsg.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
