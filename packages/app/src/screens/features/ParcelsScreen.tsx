import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, parcels } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

const STATUS_META: Record<string, { key: string; className: string }> = {
  received: { key: 'parcels.statusReceived', className: 'bg-amber-500/10 text-amber-600' },
  handed_over: { key: 'parcels.statusHanded', className: 'bg-primary/10 text-primary' },
  returned: { key: 'parcels.statusReturned', className: 'bg-muted text-muted-foreground' },
  lost_damaged: { key: 'parcels.statusLost', className: 'bg-destructive/10 text-destructive' },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function ParcelsScreen() {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const unitId = me.data?.units?.[0]?.unitId ?? null;

  const list = useAsync(
    (signal) => (unitId ? parcels.list({ pageSize: 50, sort: 'receivedAtUtc:desc' }, { recipientUnitId: unitId }, { signal }) : Promise.resolve(null)),
    [unitId],
  );
  const items = list.data?.items ?? [];

  return (
    <PageLayout title={t('parcels.title')} subtitle={t('parcels.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        {me.loading || list.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('parcels.empty')}</p>
          </div>
        ) : (
          items.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.received!;
            return (
              <article key={p.id} className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <Package className="h-5 w-5 text-orange-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-[15px] font-extrabold">{p.provider}</h2>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', meta.className)}>{t(meta.key)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.trackingNumber}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{p.category}</span>
                    <span>·</span>
                    <span>{formatDate(p.receivedAtUtc)}</span>
                    {p.isPriority ? <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-bold text-destructive">{t('parcels.priority')}</span> : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </PageLayout>
  );
}
