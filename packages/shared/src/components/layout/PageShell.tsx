import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { HelpDeskHeader } from '@shared/features/helpdesk/HelpDeskHeader';
import { useTranslation } from 'react-i18next';
import { useSurface } from '@shared/lib/surface';
import { useBackNavigation } from '@shared/lib/routing';
import { cn } from '@shared/lib/utils';

export interface PageShellProps {
  title: string;
  subtitle?: string;
  /** Small icon shown before the title in admin (e.g. <LifeBuoy />). */
  icon?: ReactNode;
  /** Buttons for the header. In the app they sit in the top bar, so keep them small. */
  actions?: ReactNode;
  /** Show a back button. Defaults to true in the app, false in admin (AdminShell has navigation). */
  showBack?: boolean;
  /** Custom back action. Default: browser back, or `backTo` when there's no history. */
  onBack?: () => void;
  /** Where Back goes when there's no history. Default: '/home' in the app, '/dashboard' in admin. */
  backTo?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Page frame shared by app and admin.
 *  - app:   full-screen column with the green top bar and a scrolling body.
 *  - admin: compact title row (icon + title + subtitle, actions on the right; actions wrap under
 *           the title on narrow screens). AdminShell supplies the outer chrome and scrolling.
 */
export function PageShell({ title, subtitle, icon, actions, showBack, onBack, backTo, children, className }: PageShellProps) {
  const { t } = useTranslation();
  const surface = useSurface();
  const back = useBackNavigation(backTo ?? (surface === 'app' ? '/home' : '/dashboard'), onBack);

  if (surface === 'app') {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-background">
        <HelpDeskHeader title={title} subtitle={subtitle} mode="mobile" showBack={showBack ?? true} onBack={back} rightActions={actions} />
        <div className={cn('min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-6', className)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-col gap-2 py-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {showBack ? (
            <button type="button" onClick={back} aria-label={t('common.back', 'Back')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold tracking-tight text-foreground">
              {icon ? <span className="shrink-0 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
              {title}
            </h1>
            {subtitle ? <p className="truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
