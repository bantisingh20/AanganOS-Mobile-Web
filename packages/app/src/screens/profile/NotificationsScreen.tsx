import { useRef } from 'react';
import { CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationInbox, type NotificationInboxHandle } from '@shared/features/notifications/NotificationInbox';
import { PageShell } from '@shared/components/layout';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const controls = useRef<NotificationInboxHandle | null>(null);

  return (
    <PageShell
      title={t('notifications.title')}
      actions={
        <button type="button" onClick={() => void controls.current?.markAllRead()} aria-label={t('notifications.markAllRead')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
          <CheckCheck className="h-5 w-5" />
        </button>
      }
    >
      <NotificationInbox controlsRef={(h) => { controls.current = h; }} />
    </PageShell>
  );
}
