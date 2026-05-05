import React from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white border-accent shadow-sm shadow-accent/20 hover:bg-accent/90',
  secondary: 'bg-card text-text-primary border-border hover:bg-background',
  ghost: 'bg-transparent text-text-secondary border-transparent hover:bg-background hover:text-text-primary',
  danger: 'bg-danger-bg text-danger-text border-danger-border hover:opacity-85',
  success: 'bg-success-bg text-success-text border-success-border hover:opacity-85',
  warning: 'bg-warning-bg text-warning-text border-warning-border hover:opacity-85',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs rounded-xl',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-sm rounded-2xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', icon, trailingIcon, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 border font-bold transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  )
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', label, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center border font-bold transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15',
        'disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
