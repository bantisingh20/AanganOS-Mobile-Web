import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { BottomSheet } from '@shared/components/ui/bottom-sheet';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';

/** Where a filter control is being drawn: the inline desktop row, or the phone bottom sheet. */
export type FilterLayout = 'inline' | 'sheet';

/** Classes for an Input or SelectTrigger used as a filter. `inlineWidth` e.g. 'w-28'. */
export function filterControlClass(layout: FilterLayout, inlineWidth: string): string {
  return layout === 'sheet'
    ? 'h-11 w-full rounded-lg bg-background px-3 text-sm'
    : cn('h-9 rounded-md border-border/80 bg-background px-3 text-xs', inlineWidth);
}

/** Same as filterControlClass for EntitySelect, which styles its inner button. */
export function filterEntityClass(layout: FilterLayout, inlineWidth: string): string {
  return layout === 'sheet'
    ? 'w-full text-sm [&>button]:h-11 [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-sm'
    : cn('text-xs [&>button]:h-9 [&>button]:rounded-md [&>button]:px-3 [&>button]:text-xs', inlineWidth);
}

export interface FilterBarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  /** Render the filter controls for the given layout; use filterControlClass / filterEntityClass. */
  filters?: (layout: FilterLayout) => ReactNode;
  /** Number of filters not at their default, shown on the phone "Filters" button. */
  activeCount?: number;
  onReset?: () => void;
  /** Totals, refresh, primary action. Visible in both layouts. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Search + filters for list pages.
 *  - Desktop: one row (search, filters, then `trailing` on the right).
 *  - Compact (phone app / narrow admin): full-width search with a Filters button that opens a
 *    bottom sheet with the filters stacked full width; `trailing` on its own row.
 */
export function FilterBar({ search, filters, activeCount = 0, onReset, trailing, className }: FilterBarProps) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const [open, setOpen] = useState(false);

  // Search is debounced here, once for every list page: the box updates on each keystroke, but
  // search.onChange (which triggers the API call) fires only after the user pauses for 300 ms.
  const [searchText, setSearchText] = useState(search?.value ?? '');
  const emitted = useRef(search?.value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Value changed from outside (e.g. reset) -> show it.
    if (search && search.value !== emitted.current) { emitted.current = search.value; setSearchText(search.value); }
  }, [search?.value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onSearchInput = (v: string) => {
    setSearchText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { emitted.current = v; search?.onChange(v); }, 300);
  };

  if (!compact) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/60 p-2 text-xs', className)}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {search ? (
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchText} onChange={(e) => onSearchInput(e.target.value)} placeholder={search.placeholder}
                className="h-9 w-full rounded-md bg-muted/40 pl-8 pr-3 text-xs" />
            </div>
          ) : null}
          {filters?.('inline')}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {search ? (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchText} onChange={(e) => onSearchInput(e.target.value)} placeholder={search.placeholder}
              className="h-11 w-full rounded-lg bg-card pl-9 pr-3 text-sm" />
          </div>
        ) : <div className="flex-1" />}
        {filters ? (
          <button type="button" onClick={() => setOpen(true)} aria-label={t('common.filters', 'Filters')}
            className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground active:scale-[0.98]">
            <SlidersHorizontal className="h-4 w-4" />
            <span>{t('common.filters', 'Filters')}</span>
            {activeCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{activeCount}</span>
            ) : null}
          </button>
        ) : null}
      </div>
      {trailing ? <div className="flex items-center justify-between gap-2">{trailing}</div> : null}

      {filters ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={t('common.filters', 'Filters')}
          footer={(
            <div className="flex gap-2">
              {onReset ? (
                <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => { onReset(); setOpen(false); }}>
                  {t('common.reset', 'Reset')}
                </Button>
              ) : null}
              <Button type="button" className="h-11 flex-1" onClick={() => setOpen(false)}>{t('common.done', 'Done')}</Button>
            </div>
          )}>
          <div className="flex flex-col gap-3">{filters('sheet')}</div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
