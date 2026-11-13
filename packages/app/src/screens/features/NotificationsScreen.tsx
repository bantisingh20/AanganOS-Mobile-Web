import { useRef } from 'react';
import { CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationInbox, type NotificationInboxHandle } from '@shared/components/NotificationInbox';
import { PageLayout } from '@app/components/PageLayout';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const controls = useRef<NotificationInboxHandle | null>(null);

  return (
    <PageLayout
      title={t('notifications.title')}
      right={
        <button type="button" onClick={() => void controls.current?.markAllRead()} aria-label={t('notifications.markAllRead')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
          <CheckCheck className="h-5 w-5" />
        </button>
      }
    >
      <div className="px-4 py-4">
        <NotificationInbox controlsRef={(h) => { controls.current = h; }} />
      </div>
    </PageLayout>
  );
}
