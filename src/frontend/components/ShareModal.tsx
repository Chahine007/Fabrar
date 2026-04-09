import React, { useState } from 'react';
import { X, Send, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToShare: any; // The item being shared
  onShare: (conversationId: string, message: string, item: any) => void;
}

// Mock conversations for sharing
const MOCK_CONVERSATIONS = [
  { id: '1', name: 'Cantiere Milano Nord', type: 'project' },
  { id: '2', name: 'Squadra Manutenzione', type: 'team' },
  { id: '3', name: 'Marco Rossi', type: 'direct' },
];

export default function ShareModal({ isOpen, onClose, itemToShare, onShare }: ShareModalProps) {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredConvs = MOCK_CONVERSATIONS.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShare = () => {
    if (selectedConv) {
      onShare(selectedConv, message, itemToShare);
      onClose();
      setSelectedConv(null);
      setMessage('');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-xl font-bold text-text-primary">Condividi</h3>
            <button onClick={onClose} className="p-2 text-text-secondary hover:bg-background rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Item Preview */}
            <div className="p-4 bg-background border border-border rounded-2xl">
              <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-2">Elemento da condividere</p>
              <div className="font-medium text-text-primary">
                {itemToShare?.title || itemToShare?.name || 'Elemento'}
              </div>
              {itemToShare?.value && (
                <div className="text-2xl font-bold text-accent mt-1">{itemToShare.value}</div>
              )}
            </div>

            {/* Conversation Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-text-secondary">Invia a</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" 
                  placeholder="Cerca conversazione..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20 text-text-primary"
                />
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {filteredConvs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                      selectedConv === conv.id 
                        ? "bg-accent/10 border-accent text-accent" 
                        : "bg-background border-border hover:border-accent/50 text-text-primary"
                    )}
                  >
                    <span className="font-medium text-sm">{conv.name}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60">{conv.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-text-secondary">Aggiungi un messaggio (opzionale)</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi qualcosa..."
                className="w-full bg-background border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-accent/20 text-text-primary resize-none h-24"
              />
            </div>
          </div>

          <div className="p-6 border-t border-border bg-card shrink-0">
            <button 
              onClick={handleShare}
              disabled={!selectedConv}
              className="w-full py-3 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Invia
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
