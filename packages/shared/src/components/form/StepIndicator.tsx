import { Check } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center px-6 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] text-xs font-extrabold',
              i < current
                ? 'border-primary bg-primary text-primary-foreground'
                : i === current
                  ? 'border-primary bg-accent text-primary'
                  : 'border-border bg-card text-muted-foreground',
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 ? <div className={cn('mx-1 h-0.5 w-9', i < current ? 'bg-primary' : 'bg-border')} /> : null}
        </div>
      ))}
    </div>
  );
}
