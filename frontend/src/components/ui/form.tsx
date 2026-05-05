import React from 'react';
import { cn } from '../../lib/utils';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-2', className)}>
      {label && <span className="text-sm font-semibold text-text-primary">{label}</span>}
      {children}
      {hint && !error && <span className="text-xs text-text-secondary">{hint}</span>}
      {error && <span className="text-xs font-semibold text-danger-text">{error}</span>}
    </label>
  );
}

const controlClasses =
  'w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClasses, className)} {...props} />
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(controlClasses, className)} {...props} />
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlClasses, 'resize-none', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm font-medium text-danger-text">
      {children}
    </div>
  );
}
