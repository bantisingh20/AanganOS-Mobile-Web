import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';

export interface ResponsiveTab<K extends string> {
  key: K;
  label: string;
}

/** Tabs that render as a full-width segmented control on phones and a tab row on desktop. */
export function ResponsiveTabs<K extends string>({ tabs, value, onChange, className }: {
  tabs: ResponsiveTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  const compact = useIsCompact();

  if (compact) {
    return (
      <div className={cn('flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/60 p-1', className)}>
        {tabs.map((tb) => (
          <button key={tb.key} type="button" onClick={() => onChange(tb.key)}
            className={cn('min-w-fit flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              value === tb.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>
            {tb.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 border-b border-border/70 pb-1', className)}>
      {tabs.map((tb) => (
        <button key={tb.key} type="button" onClick={() => onChange(tb.key)}
          className={cn('h-7 rounded-[4px] px-3 text-xs font-semibold transition-colors',
            value === tb.key ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}
