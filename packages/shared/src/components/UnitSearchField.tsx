import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { units } from '@shared/services';
import type { Unit } from '@shared/api/units';
import { Field } from './Field';
import { cn } from '@shared/lib/utils';

export function UnitSearchField({
  label,
  placeholder,
  communityId,
  value,
  onSelect,
  required,
}: {
  label: string;
  placeholder: string;
  communityId?: string | null;
  value: Unit | null;
  onSelect: (unit: Unit | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await units.list(
          { pageSize: 20, ...(query.trim() ? { search: query.trim() } : {}) },
          communityId ? { communityId } : {},
        );
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, open, communityId]);

  if (value) {
    return (
      <Field label={label} {...(required ? { required: true } : {})}>
        <div className="flex h-12 items-center justify-between rounded-md border border-input bg-background px-3">
          <span className="truncate text-sm font-semibold">{value.unitNumber}</span>
          <button type="button" onClick={() => onSelect(null)} aria-label="Clear" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} {...(required ? { required: true } : {})}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary"
        />
        {open ? (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
            {loading ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">—</p>
            ) : (
              results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { onSelect(u); setOpen(false); setQuery(''); }}
                  className={cn('block w-full px-3 py-2.5 text-left text-sm hover:bg-muted')}
                >
                  {u.unitNumber}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
