import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';

export interface HelpDeskHeaderProps {
  title: string;
  subtitle?: string;
  mode?: 'admin' | 'mobile';
  showBack?: boolean;
  onBack?: () => void;
  rightActions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function HelpDeskHeader({
  title,
  subtitle,
  mode,
  showBack,
  onBack,
  rightActions,
  className,
}: HelpDeskHeaderProps) {
  const isSmall = useIsSmallScreen();
  const effectiveMode = mode ?? (isSmall ? 'mobile' : 'admin');
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate(-1));
  const shouldShowBack = showBack ?? (effectiveMode === 'mobile');

  // MOBILE APP HEADER: Exactly matches PageLayout from invite visitor and other app screens
  if (effectiveMode === 'mobile') {
    return (
      <header
        className={cn(
          'safe-top flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-3 text-primary-foreground',
          className,
        )}
      >
        {shouldShowBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15 active:scale-95 transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold leading-tight">{title}</div>
          {subtitle ? <div className="truncate text-sm text-primary-foreground/85">{subtitle}</div> : null}
        </div>
        {rightActions ? <div className="shrink-0">{rightActions}</div> : null}
      </header>
    );
  }

  // ADMIN HEADER: Toolbar row inside single card matching the screenshot style:
  // Left: vertical green indicator bar (|) + Title
  // Right: Action buttons (New in green, Filters in sky blue, etc.)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 pt-0.5 px-0.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {showBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted active:scale-95 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-5 w-1 shrink-0 rounded-full bg-emerald-500" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      {rightActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {rightActions}
        </div>
      ) : null}
    </div>
  );
}

export default HelpDeskHeader;
