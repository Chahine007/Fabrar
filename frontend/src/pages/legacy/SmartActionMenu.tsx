import React, { useState } from 'react';
import { MoreVertical, Share2, Eye, PlusCircle, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface SmartActionMenuProps {
  onShare: () => void;
  onViewDetails?: () => void;
  onCreateTask?: () => void;
  onLinkProject?: () => void;
  className?: string;
}

export default function SmartActionMenu({ onShare, onViewDetails, onCreateTask, onLinkProject, className }: SmartActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 text-text-secondary hover:bg-background hover:text-text-primary rounded-lg transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="py-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); onShare(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                >
                  <Share2 size={14} className="text-accent" />
                  Condividi
                </button>
                {onViewDetails && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); onViewDetails(); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                  >
                    <Eye size={14} className="text-text-secondary" />
                    Vedi Dettagli
                  </button>
                )}
                {onCreateTask && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); onCreateTask(); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                  >
                    <PlusCircle size={14} className="text-text-secondary" />
                    Crea Task
                  </button>
                )}
                {onLinkProject && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); onLinkProject(); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                  >
                    <LinkIcon size={14} className="text-text-secondary" />
                    Collega a Progetto
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
