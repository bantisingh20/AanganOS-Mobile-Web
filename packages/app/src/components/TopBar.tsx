import { Bell } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export function TopBar({
  title,
  subtitle,
  notificationCount = 0,
  onNotifications,
  className,
}: {
  title: string;
  subtitle?: string;
  notificationCount?: number;
  onNotifications?: () => void;
  className?: string;
}) {
  return (
    <header className={cn('safe-top flex shrink-0 items-center gap-3 bg-primary px-5 pb-3 pt-3 text-primary-foreground', className)}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-extrabold leading-tight">{title}</div>
        {subtitle ? <div className="truncate text-sm text-primary-foreground/85">{subtitle}</div> : null}
      </div>
      {onNotifications ? (
        <button
          type="button"
          onClick={onNotifications}
          aria-label="Notifications"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <Bell className="h-[22px] w-[22px]" />
          {notificationCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}
