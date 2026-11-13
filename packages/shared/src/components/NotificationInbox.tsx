import { memo, useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import type { AppNotification } from '@shared/api/notifications';

function parseUtc(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

function formatWhen(iso: string): string {
  try {
    const d = parseUtc(iso);
    const diff = Math.round((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    if (diff < 2880) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export interface NotificationInboxHandle {
  markAllRead: () => Promise<void>;
  busy: boolean;
}

export function NotificationInbox({
  onChanged,
  onItemClick,
  controlsRef,
}: {
  onChanged?: () => void;
  onItemClick?: (payloadJson: string | null) => void;
  controlsRef?: (handle: NotificationInboxHandle) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);
  const query = useAsync(
    (signal) => notifications.list({ pageSize: 50, sort: 'createdAtUtc:desc' }, { unreadOnly: filter === 'unread', signal }),
    [filter],
  );
  const [rows, setRows] = useState<AppNotification[]>([]);
  useEffect(() => {
    if (query.data) setRows(query.data.items);
  }, [query.data]);
  const items = rows;

  const openRow = useCallback(async (id: string, isRead: boolean, payloadJson: string | null) => {
    if (!isRead) {
      setRows((prev) =>
        filter === 'unread'
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, isRead: true } : r)),
      );
      await notifications.markRead(id).catch(() => undefined);
      onChanged?.();
    }
    onItemClick?.(payloadJson);
  }, [filter, onChanged, onItemClick]);
  const remove = useCallback(async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    setRows((prev) => prev.filter((r) => r.id !== id));
    await notifications.delete(id).catch(() => undefined);
    onChanged?.();
  }, [onChanged]);
  const markAllRead = async () => {
    if (busy) return;
    setBusy(true);
    setRows((prev) => (filter === 'unread' ? [] : prev.map((r) => ({ ...r, isRead: true }))));
    await notifications.markAllRead().catch(() => undefined);
    setBusy(false);
    onChanged?.();
  };

  if (controlsRef) controlsRef({ markAllRead, busy });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-full bg-muted p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {t(f === 'all' ? 'notifications.filterAll' : 'notifications.filterUnread')}
          </button>
        ))}
      </div>

      {query.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
        </div>
      ) : (
        items.map((n) => (
          <NotificationRow key={n.id} item={n} deleteLabel={t('notifications.delete')} onOpen={openRow} onRemove={remove} />
        ))
      )}
    </div>
  );
}

const NotificationRow = memo(function NotificationRow({
  item,
  deleteLabel,
  onOpen,
  onRemove,
}: {
  item: AppNotification;
  deleteLabel: string;
  onOpen: (id: string, isRead: boolean, payloadJson: string | null) => void;
  onRemove: (e: MouseEvent, id: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id, item.isRead, item.payloadJson)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item.id, item.isRead, item.payloadJson); }}
      className={cn('relative flex cursor-pointer gap-3 rounded-2xl bg-card p-4 pr-11 shadow-sm', !item.isRead ? 'ring-1 ring-primary/30' : '')}
    >
      <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
        <Bell className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-bold leading-tight">{item.title}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(item.createdAtUtc)}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
      </div>
      {!item.isRead ? <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
      <button
        type="button"
        onClick={(e) => onRemove(e, item.id)}
        aria-label={deleteLabel}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
});
