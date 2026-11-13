import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export interface EntityOption {
  value: string;
  label: string;
}

export interface EntityPage {
  items: EntityOption[];
  total: number;
}

export interface EntitySelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  fetchPage: (search: string, page: number, pageSize: number, signal: AbortSignal) => Promise<EntityPage>;
  resolveLabel?: (value: string, signal: AbortSignal) => Promise<string | null>;
  placeholder?: string;
  pageSize?: number;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

const ROW_H = 36;
const VIEWPORT = 288;
const OVERSCAN = 4;

export function EntitySelect({
  value,
  onChange,
  fetchPage,
  resolveLabel,
  placeholder = 'Select…',
  pageSize = 50,
  disabled,
  clearable = true,
  className,
}: EntitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<EntityOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const controller = new AbortController();
      setLoading(true);
      try {
        const res = await fetchPage(debounced, nextPage, pageSize, controller.signal);
        setTotal(res.total);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
      } catch {
        if (replace) { setItems([]); setTotal(0); }
      } finally {
        setLoading(false);
      }
      return () => controller.abort();
    },
    [fetchPage, debounced, pageSize],
  );

  useEffect(() => {
    if (!open) return;
    void load(1, true);
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debounced]);

  useEffect(() => {
    if (!open) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading && items.length < total) {
        void load(page + 1, false);
      }
    }, { root: listRef.current, rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [open, loading, items.length, total, page, load]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!value) { setSelectedLabel(null); return; }
    const known = items.find((i) => i.value === value);
    if (known) { setSelectedLabel(known.label); return; }
    if (resolveLabel) {
      void resolveLabel(value, controller.signal).then((l) => { if (!cancelled && l) setSelectedLabel(l); });
    }
    return () => { cancelled = true; controller.abort(); };
  }, [value, items, resolveLabel]);

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(items.length, Math.ceil((scrollTop + VIEWPORT) / ROW_H) + OVERSCAN);
  const visible = items.slice(startIdx, endIdx);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-50"
      >
        <span className={cn('truncate', !value ? 'text-muted-foreground' : '')}>
          {value ? selectedLabel ?? '…' : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && value ? (
            <span role="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </span>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            <div className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded-md bg-muted pl-8 pr-2 text-sm outline-none"
              />
            </div>
            <div
              ref={listRef}
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
              className="max-h-72 overflow-y-auto"
              style={{ maxHeight: VIEWPORT }}
            >
              {items.length === 0 && !loading ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results</div>
              ) : (
                <div style={{ height: items.length * ROW_H, position: 'relative' }}>
                  {visible.map((opt, i) => {
                    const idx = startIdx + i;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { onChange(opt.value); setSelectedLabel(opt.label); setOpen(false); }}
                        className={cn(
                          'absolute left-0 right-0 flex items-center truncate px-3 text-left text-sm hover:bg-accent',
                          opt.value === value ? 'bg-accent font-semibold text-emerald-600' : '',
                        )}
                        style={{ top: idx * ROW_H, height: ROW_H }}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div ref={sentinelRef} />
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
