import * as React from 'react';
import { cn } from '@shared/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONES: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function Badge({ tone = 'default', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}
