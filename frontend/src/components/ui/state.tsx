import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { TableSkeleton } from './skeleton';

export function FullPageLoader({ label = 'Caricamento...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
        <Loader2 size={26} className="animate-spin text-accent" />
        <p className="text-sm font-semibold text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

export function InlineError({
  title = 'Errore caricamento',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-danger-border bg-danger-bg p-4 text-danger-text', className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          {message && <p className="mt-1 text-sm opacity-85">{message}</p>}
          {onRetry && (
            <Button className="mt-3" size="sm" variant="danger" onClick={onRetry}>
              Riprova
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageState({
  isLoading,
  error,
  isEmpty,
  loadingRows = 6,
  loadingColumns = 5,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRetry,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  loadingRows?: number;
  loadingColumns?: number;
  emptyTitle: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: React.ElementType;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) return <TableSkeleton rows={loadingRows} columns={loadingColumns} />;
  if (error) {
    return (
      <InlineError
        message={error instanceof Error ? error.message : 'Errore imprevisto.'}
        onRetry={onRetry}
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
}

export function SectionHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text-primary">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DataToolbar({
  title,
  icon,
  children,
  className,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border bg-background/50 p-4 md:flex-row md:items-center md:justify-between', className)}>
      {title && (
        <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          {icon}
          {title}
        </h3>
      )}
      {children && <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">{children}</div>}
    </div>
  );
}
