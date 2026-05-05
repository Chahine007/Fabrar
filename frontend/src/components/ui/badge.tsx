import React from 'react';
import { cn } from '../../lib/utils';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-background text-text-secondary border-border',
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  info: 'bg-info-bg text-info-text border-info-border',
  accent: 'bg-accent/10 text-accent border-accent/20',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const normalized = String(status).toUpperCase();
  const tone: BadgeTone =
    normalized.includes('APPROVED') || normalized.includes('DONE') || normalized.includes('PAID') || normalized.includes('FULFILLED')
      ? 'success'
      : normalized.includes('PENDING') || normalized.includes('TODO') || normalized.includes('DRAFT')
        ? 'warning'
        : normalized.includes('REJECTED') || normalized.includes('CRITICAL')
          ? 'danger'
          : normalized.includes('IN_PROGRESS') || normalized.includes('ISSUED') || normalized.includes('INVOICED')
            ? 'info'
            : 'neutral';

  return <Badge tone={tone}>{label ?? status}</Badge>;
}
