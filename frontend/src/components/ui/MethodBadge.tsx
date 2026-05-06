import { Banknote, Bot, Camera, Clock, Download, MapPin, MessageCircle, Mic } from 'lucide-react';
import { cn } from '../../lib/utils';

type MethodBadgeProps = {
  method?: string | null;
  type?: string | null;
  className?: string;
};

const styles = {
  import: 'bg-info-bg text-info-text border-info-border',
  voice: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20',
  ocr: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20',
  gps: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-400/20',
  text: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20',
  hours: 'bg-success-bg text-success-text border-success-border',
  expense: 'bg-danger-bg text-danger-text border-danger-border',
  default: 'bg-background text-text-secondary border-border',
};

function getBadge(method?: string | null, type?: string | null) {
  const m = String(method ?? '').toLowerCase();
  const t = String(type ?? '').toLowerCase();

  if (m.includes('genya') || m.includes('genia') || m.includes('import')) {
    return { label: 'Import Genya', icon: Download, cls: styles.import };
  }
  if (m.includes('audio') || m.includes('voice')) {
    return { label: 'Vocale', icon: Mic, cls: styles.voice };
  }
  if (m.includes('ocr') || m.includes('foto') || m.includes('photo')) {
    return { label: 'Foto OCR', icon: Camera, cls: styles.ocr };
  }
  if (m.includes('gps')) {
    return { label: 'GPS', icon: MapPin, cls: styles.gps };
  }
  if (m.includes('testo') || m.includes('text')) {
    return { label: 'Testo', icon: MessageCircle, cls: styles.text };
  }
  if (t === 'ore') {
    return { label: 'Ore', icon: Clock, cls: styles.hours };
  }
  if (t === 'spese') {
    return { label: 'Spesa', icon: Banknote, cls: styles.expense };
  }
  return { label: method || 'Manuale', icon: Bot, cls: styles.default };
}

export default function MethodBadge({ method, type, className }: MethodBadgeProps) {
  const badge = getBadge(method, type);
  const Icon = badge.icon;

  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-[82px] items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold leading-none whitespace-nowrap',
        badge.cls,
        className
      )}
    >
      <Icon size={12} strokeWidth={2.2} />
      {badge.label}
    </span>
  );
}
