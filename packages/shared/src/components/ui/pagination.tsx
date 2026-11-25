import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';

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
    <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 py-0.5 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
        <span>{from}–{to} of {total}</span>
        {onPageSizeChange ? (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-6 w-[88px] gap-1 rounded-[4px] border-border bg-background px-1.5 text-[11px] font-normal shadow-none [&_svg]:size-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[88px] w-[88px] p-0.5 rounded-[4px] shadow-sm">
              {pageSizeOptions.map((o) => (
                <SelectItem key={o} value={String(o)} className="py-1 pl-2 pr-5 text-[11px] rounded-[3px] [&_svg]:size-3">
                  {o} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-6.5 w-6.5 items-center justify-center rounded-[4px] border border-border text-muted-foreground disabled:opacity-40 hover:enabled:border-primary hover:enabled:text-primary transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-0.5 text-muted-foreground text-[11px]">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'flex h-6.5 min-w-6.5 items-center justify-center rounded-[4px] border px-1.5 text-[11px] font-medium transition-colors',
                p === page
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
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
          className="flex h-6.5 w-6.5 items-center justify-center rounded-[4px] border border-border text-muted-foreground disabled:opacity-40 hover:enabled:border-primary hover:enabled:text-primary transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
