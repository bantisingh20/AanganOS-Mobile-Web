import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export function FormBanner({ message, tone = 'error' }: { message?: string; tone?: 'error' | 'success' }) {
  if (!message) return null;
  const isError = tone === 'error';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
        isError ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-accent text-accent-foreground',
      )}
    >
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}
