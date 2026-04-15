import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  compact?: boolean;
}

export default function ErrorMessage({ error, onRetry, compact = false }: ErrorMessageProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-danger-text text-sm font-medium">
        <AlertTriangle size={14} />
        <span>{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 underline hover:no-underline transition-all font-bold"
          >
            Riprova
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px] bg-background">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 bg-danger-bg rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle size={32} className="text-danger-text" />
        </div>
        <div>
          <h3 className="font-bold text-text-primary text-lg">Errore di caricamento</h3>
          <p className="text-sm text-text-secondary mt-1">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-card border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-background transition-all shadow-sm"
          >
            <RefreshCw size={14} />
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}
