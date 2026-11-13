import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  const push = (n: number | '...') => pages.push(n);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
    if (page < totalPages - 2) push('...');
    push(totalPages);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{from}–{to} of {total}</span>
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-border bg-card px-1.5 text-xs outline-none focus:border-emerald-400"
          >
            {pageSizeOptions.map((o) => <option key={o} value={o}>{o} / page</option>)}
          </select>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground disabled:opacity-40 hover:enabled:border-emerald-500 hover:enabled:text-emerald-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1.5 text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium',
                p === page ? 'border-[#05b872] bg-[#05b872] text-white' : 'border-border text-muted-foreground hover:border-emerald-500 hover:text-emerald-600',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground disabled:opacity-40 hover:enabled:border-emerald-500 hover:enabled:text-emerald-600"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
