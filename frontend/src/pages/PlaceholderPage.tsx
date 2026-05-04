import React from 'react';
import { motion } from 'motion/react';
import { Construction } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background h-full">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 max-w-md"
      >
        <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <Construction size={48} />
        </div>
        <h2 className="text-3xl font-bold text-text-primary">{title}</h2>
        <p className="text-text-secondary leading-relaxed">{description}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-card border border-border text-text-primary rounded-xl font-bold shadow-sm hover:bg-background transition-all"
        >
          Torna alla Dashboard
        </button>
      </motion.div>
    </div>
  );
}
