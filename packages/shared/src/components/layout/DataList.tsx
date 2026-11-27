import type { ReactNode } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@shared/components/ui/pagination';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';

export interface DataListPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export interface DataListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  loading?: boolean;
  emptyText?: ReactNode;
  emptyIcon?: ReactNode;
  /** Desktop layout: the full <Table>. */
  renderTable: () => ReactNode;
  /** Compact layout: the contents of one card (DataList adds the padding and dividers). */
  renderCard: (item: T, index: number) => ReactNode;
  /** Makes each card tappable in the compact layout. */
  onItemClick?: (item: T) => void;
  pagination?: DataListPagination;
  className?: string;
}

/**
 * List container shared by app and admin. Exactly one layout is rendered, chosen by
 * useIsCompact(): a table on desktop, cards on phones/narrow screens. Loading, empty and
 * pagination states look the same everywhere.
 */
export function DataList<T>({
  items, keyOf, loading, emptyText, emptyIcon, renderTable, renderCard, onItemClick, pagination, className,
}: DataListProps<T>) {
  const { t } = useTranslation();
  const compact = useIsCompact();

  let body: ReactNode;
  if (loading && items.length === 0) {
    body = (
      <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading', 'Loading…')}
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
        {emptyIcon ?? <Inbox className="h-6 w-6 text-muted-foreground/50" />}
        <p className="text-xs font-semibold text-foreground">{emptyText ?? t('common.noResults', 'Nothing here yet')}</p>
      </div>
    );
  } else if (compact) {
    body = (
      <div className="divide-y divide-border/60">
        {items.map((item, i) => (
          <div key={keyOf(item)} onClick={onItemClick ? () => onItemClick(item) : undefined}
            className={cn('flex flex-col gap-2 p-3', onItemClick && 'cursor-pointer active:bg-muted/30')}>
            {renderCard(item, i)}
          </div>
        ))}
      </div>
    );
  } else {
    body = <div className="overflow-x-auto">{renderTable()}</div>;
  }

  return (
    <div className={cn('overflow-hidden rounded-md border border-border/80 bg-card', compact && 'rounded-xl', className)}>
      {body}
      {pagination && pagination.total > 0 ? (
        <div className="border-t border-border bg-muted/20 px-2.5 py-1.5">
          <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total}
            onPageChange={pagination.onPageChange}
            // Phones get prev/next + page numbers only; the page-size picker is a desktop control.
            onPageSizeChange={compact ? undefined : pagination.onPageSizeChange} />
        </div>
      ) : null}
    </div>
  );
}
