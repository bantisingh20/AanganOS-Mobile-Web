import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';

/** The refresh icon button used by every list page (bigger tap target on phones, spins while loading). */
export function RefreshButton({ onClick, loading, className }: { onClick: () => void; loading?: boolean; className?: string }) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  return (
    <button type="button" onClick={onClick} aria-label={t('common.refresh', 'Refresh')} title={t('common.refresh', 'Refresh')}
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center border border-border/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        compact ? 'rounded-lg' : 'rounded-md', className)}>
      <RefreshCw className={cn(compact ? 'h-4 w-4' : 'h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
    </button>
  );
}
