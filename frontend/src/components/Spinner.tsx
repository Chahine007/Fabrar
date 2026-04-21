import React from 'react';
import { cn } from '../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  label?: string;
}

export default function Spinner({ size = 'md', fullScreen = false, label }: SpinnerProps) {
  const sizeMap = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-14 h-14 border-4' };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          'rounded-full animate-spin',
          sizeMap[size],
          'border-border border-t-accent'
        )}
      />
      {label && <p className="text-sm text-text-secondary font-medium">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] bg-background">
        {spinner}
      </div>
    );
  }

  return spinner;
}
