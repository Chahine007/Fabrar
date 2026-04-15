import React, { useState } from 'react';
import { 
  Search, 
  Pin, 
  Users, 
  FolderRoot, 
  User, 
  Bell, 
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
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import SmartActionMenu from './SmartActionMenu';
import ShareModal from './ShareModal';

// --- Types ---

type MessageType = 'text' | 'image' | 'file' | 'voice' | 'system_task' | 'system_hours' | 'system_issue' | 'shared_item';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: MessageType;
  content: string;
  timestamp: string;
  isMe: boolean;
  status: 'sent' | 'delivered' | 'read';
  metadata?: any;
}

interface Conversation {
  id: string;
  name: string;
  preview: string;
  timestamp: string;
  unreadCount: number;
  type: 'team' | 'project' | 'direct' | 'system';
  avatar: string;
  isPinned?: boolean;
  isOnline?: boolean;
  projectContext?: {
    status: string;
    team: string;
  };
}

// --- Mock Data ---

const CONVERSATIONS: Conversation[] = [
  { 
    id: '1', 
    name: 'Cantiere Milano Nord', 
    preview: 'Marco: Abbiamo finito il getto del pilastro A4.', 
    timestamp: '10:45', 
    unreadCount: 3, 
    type: 'project', 
    avatar: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?w=100&h=100&fit=crop',
    isPinned: true,
    projectContext: { status: 'In Corso', team: 'Squadra A' }
  },
  { 
    id: '2', 
    name: 'Squadra Manutenzione', 
    preview: 'Luca: Qualcuno ha visto la chiave da 22?', 
    timestamp: '09:30', 
    unreadCount: 0, 
    type: 'team', 
    avatar: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=100&h=100&fit=crop',
    isPinned: true
  },
  { 
    id: '3', 
    name: 'Marco Rossi', 
    preview: 'Ti ho inviato il verbale di sopralluogo.', 
    timestamp: 'Ieri', 
    unreadCount: 0, 
    type: 'direct', 
    avatar: 'https://i.pravatar.cc/150?u=1',
    isOnline: true
  },
  { 
    id: '4', 
    name: 'Notifiche Sistema', 
    preview: 'Nuovo ordine approvato: #ORD-2024-001', 
    timestamp: 'Lun', 
    unreadCount: 1, 
    type: 'system', 
    avatar: 'https://ui-avatars.com/api/?name=S&background=6366f1&color=fff'
  },
];

const MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'u1',
    senderName: 'Marco Rossi',
    senderAvatar: 'https://i.pravatar.cc/150?u=1',
    type: 'text',
    content: 'Buongiorno a tutti. Abbiamo iniziato i lavori sul pilastro A4.',
    timestamp: '09:00',
    isMe: false,
    status: 'read'
  },
  {
    id: 'm2',
    senderId: 'system',
    senderName: 'Sistema',
    senderAvatar: '',
    type: 'system_task',
    content: 'Nuovo Task Creato: Verifica armatura pilastro A4',
    timestamp: '09:05',
    isMe: false,
    status: 'read',
    metadata: { assignedTo: 'Luca Verdi', priority: 'Alta' }
  },
  {
    id: 'm3',
    senderId: 'me',
    senderName: 'Alessandro Rossi',
    senderAvatar: 'https://i.pravatar.cc/150?u=me',
    type: 'text',
    content: 'Ottimo Marco. Avete bisogno di altro materiale per oggi?',
    timestamp: '09:15',
    isMe: true,
    status: 'read'
  },
  {
    id: 'm4',
    senderId: 'u1',
    senderName: 'Marco Rossi',
    senderAvatar: 'https://i.pravatar.cc/150?u=1',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
    timestamp: '09:20',
    isMe: false,
    status: 'read'
  },
  {
    id: 'm5',
    senderId: 'u2',
    senderName: 'Luca Verdi',
    senderAvatar: 'https://i.pravatar.cc/150?u=3',
    type: 'system_hours',
    content: 'Ore Loggate: 4h - Getto calcestruzzo',
    timestamp: '10:30',
    isMe: false,
    status: 'read'
  },
  {
    id: 'm6',
    senderId: 'u1',
    senderName: 'Marco Rossi',
    senderAvatar: 'https://i.pravatar.cc/150?u=1',
    type: 'text',
    content: 'Abbiamo finito il getto del pilastro A4.',
    timestamp: '10:45',
    isMe: false,
    status: 'delivered'
  },
  {
    id: 'm7',
    senderId: 'me',
    senderName: 'Alessandro Rossi',
    senderAvatar: 'https://i.pravatar.cc/150?u=me',
    type: 'shared_item',
    content: 'Guarda i ricavi di questo mese, stiamo andando benissimo!',
    timestamp: '11:00',
    isMe: true,
    status: 'read',
    metadata: {
      title: 'Ricavi Mensili',
      value: '€245,600',
      type: 'kpi'
    }
  }
];

// --- Components ---

const MessageBubble: React.FC<{ message: Message, onShare: (msg: Message) => void }> = ({ message, onShare }) => {
  const isSystem = message.type.startsWith('system_');

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 px-4 group relative">
        <div className={cn(
          "max-w-md w-full p-4 rounded-2xl border flex items-start gap-4 shadow-sm",
          message.type === 'system_task' ? "bg-info-bg border-info-border text-info-text" :
          message.type === 'system_hours' ? "bg-success-bg border-success-border text-success-text" :
          "bg-danger-bg border-danger-border text-danger-text"
        )}>
          <div className={cn(
            "p-2 rounded-xl bg-card shadow-sm shrink-0",
            message.type === 'system_task' ? "text-info-text" :
            message.type === 'system_hours' ? "text-success-text" : "text-danger-text"
          )}>
            {message.type === 'system_task' ? <CheckSquare size={20} /> :
             message.type === 'system_hours' ? <Clock size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{message.content}</p>
            {message.metadata && (
              <div className="mt-2 text-xs opacity-80 grid grid-cols-2 gap-2">
                {Object.entries(message.metadata).map(([key, val]) => (
                  <span key={key} className="capitalize">{key}: {val as string}</span>
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
    <div className={cn("flex gap-3 mb-6 px-6 group", message.isMe ? "flex-row-reverse" : "flex-row")}>
      {!message.isMe && (
        <img 
          src={message.senderAvatar} 
          alt={message.senderName} 
          className="w-8 h-8 rounded-full border border-border self-end mb-1"
          referrerPolicy="no-referrer"
        />
      )}
      <div className={cn("max-w-[70%] space-y-1", message.isMe ? "items-end" : "items-start")}>
        {!message.isMe && <p className="text-[10px] font-bold text-text-secondary ml-1 mb-1">{message.senderName}</p>}
        
        <div className="flex items-center gap-2">
          {message.isMe && (
            <SmartActionMenu 
              onShare={() => onShare(message)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
          <div className={cn(
            "p-4 rounded-2xl shadow-sm",
            message.isMe ? "bg-accent text-white rounded-tr-none" : "bg-card text-text-primary border border-border rounded-tl-none",
            message.type === 'image' && "p-1 overflow-hidden"
          )}>
            {message.type === 'text' && <p className="text-sm leading-relaxed">{message.content}</p>}
            {message.type === 'shared_item' && (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{message.content}</p>
                <div className="p-3 bg-background/50 rounded-xl border border-border/50 text-text-primary">
                  <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-1">Elemento Condiviso</p>
                  <p className="font-medium">{message.metadata?.title}</p>
                  {message.metadata?.value && <p className="text-lg font-bold text-accent mt-1">{message.metadata.value}</p>}
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
        
        <div className={cn("flex items-center gap-2 mt-1 px-1", message.isMe ? "justify-end" : "justify-start")}>
          <span className="text-[10px] text-text-secondary font-medium">{message.timestamp}</span>
          {message.isMe && (
            <div className={cn(
              "w-3 h-3 flex items-center justify-center",
              message.status === 'read' ? "text-accent" : "text-text-secondary"
            )}>
              <CheckCircle2 size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MessagesPage() {
  const [activeConv, setActiveConv] = useState(CONVERSATIONS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);

  const handleShare = (item: any) => {
    setItemToShare({
      title: item.content || 'Messaggio',
      value: item.type === 'shared_item' ? item.metadata?.title : undefined,
      type: 'message'
    });
    setShareModalOpen(true);
  };

  const handleExecuteShare = (convId: string, message: string, item: any) => {
    console.log('Sharing to', convId, 'Message:', message, 'Item:', item);
    alert(`Messaggio condiviso con successo! (Simulazione)`);
  };

  return (
    <div className="flex h-full bg-card overflow-hidden transition-colors duration-300">
      {/* Conversations Sidebar */}
      <aside className="w-80 border-r border-border flex flex-col bg-background/50">
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Messaggi</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Cerca conversazioni..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all text-text-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-6 no-scrollbar">
          {/* Pinned */}
          <div className="space-y-2">
            <div className="px-3 flex items-center gap-2 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              <Pin size={10} /> Pinned
            </div>
            {CONVERSATIONS.filter(c => c.isPinned).map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group",
                  activeConv.id === conv.id ? "bg-card shadow-md border border-border" : "hover:bg-card/50"
                )}
              >
                <div className="relative shrink-0">
                  <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-xl object-cover border border-border" referrerPolicy="no-referrer" />
                  {conv.isOnline && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success-text border-2 border-card rounded-full" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-bold text-text-primary truncate">{conv.name}</p>
                    <span className="text-[10px] text-text-secondary font-medium">{conv.timestamp}</span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">{conv.preview}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm shadow-accent/20">
                    {conv.unreadCount}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* All Conversations */}
          <div className="space-y-4">
            {['project', 'team', 'direct'].map(type => {
              const filtered = CONVERSATIONS.filter(c => c.type === type && !c.isPinned);
              if (filtered.length === 0) return null;
              
              return (
                <div key={type} className="space-y-2">
                  <div className="px-3 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                    {type === 'project' ? 'Progetti' : type === 'team' ? 'Teams' : 'Diretti'}
                  </div>
                  {filtered.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConv(conv)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group",
                        activeConv.id === conv.id ? "bg-card shadow-md border border-border" : "hover:bg-card/50"
                      )}
                    >
                      <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-xl object-cover border border-border" referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-bold text-text-primary truncate">{conv.name}</p>
                          <span className="text-[10px] text-text-secondary font-medium">{conv.timestamp}</span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">{conv.preview}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                          {conv.unreadCount}
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

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-card">
        {/* Chat Header */}
        <header className="h-20 border-b border-border px-8 flex items-center justify-between shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <img src={activeConv.avatar} alt={activeConv.name} className="w-10 h-10 rounded-xl object-cover border border-border" referrerPolicy="no-referrer" />
            <div>
              <h3 className="text-base font-bold text-text-primary">{activeConv.name}</h3>
              {activeConv.projectContext && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-success-bg text-success-text rounded uppercase tracking-wider border border-success-border">{activeConv.projectContext.status}</span>
                  <span className="text-[10px] text-text-secondary font-medium">{activeConv.projectContext.team}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 mr-4">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-colors">
                <ExternalLink size={14} /> Progetto
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-border text-text-secondary rounded-xl text-xs font-bold transition-colors">
                <CheckSquare size={14} /> Task
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-colors">
                <Clock size={14} /> Log Ore
              </button>
            </div>
            <div className="w-px h-6 bg-border mx-2" />
            <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all"><Phone size={20} /></button>
            <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all"><Video size={20} /></button>
            <button className="p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-xl transition-all"><MoreVertical size={20} /></button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto bg-background/30 py-8 no-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <span className="px-3 py-1 bg-card border border-border rounded-full text-[10px] font-bold text-text-secondary uppercase tracking-widest shadow-sm">Oggi</span>
            </div>
            {MESSAGES.map(msg => (
              <MessageBubble key={msg.id} message={msg} onShare={handleShare} />
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-card border-t border-border">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-success-bg hover:opacity-80 text-success-text rounded-full text-[10px] font-bold transition-all border border-success-border">
                <Clock size={14} /> Log Ore
              </button>
              <button className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-info-bg hover:opacity-80 text-info-text rounded-full text-[10px] font-bold transition-all border border-info-border">
                <PlusCircle size={14} /> Crea Task
              </button>
            </div>

            {/* Main Input */}
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
                />
                <div className="flex items-center gap-1 mb-1 mr-1">
                  <button className="p-2 text-text-secondary hover:bg-border rounded-xl transition-colors" title="Nota Vocale">
                    <Mic size={18} />
                  </button>
                </div>
              </div>
              <button className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all hover:scale-105 active:scale-95 shrink-0 mb-0.5">
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
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
