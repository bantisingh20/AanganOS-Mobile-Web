import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Siren, Check, ShieldCheck } from 'lucide-react';
import { securityOps } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import type { SosAlert } from '@shared/api/securityOps';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

function parseUtc(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

function formatWhen(iso: string): string {
  const d = parseUtc(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function humanize(code: string): string {
  return code.split(/[_\s]+/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
}

const STATUS_META: Record<string, string> = {
  active: 'bg-destructive/10 text-destructive',
  acknowledged: 'bg-amber-500/10 text-amber-600',
  resolved: 'bg-emerald-500/10 text-emerald-600',
};

export function SosScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perm = usePermission('sos');
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const query = useAsync(
    (signal) => securityOps.listSosAlerts({ pageSize: 50, sort: 'raisedAtUtc:desc' }, filter === 'open' ? 'active' : undefined, { signal }),
    [filter],
  );
  const items = query.data?.items ?? [];

  const acknowledge = useAsyncAction(async (id: string) => {
    if (!user?.id) return;
    await securityOps.acknowledgeSos(id, user.id);
    query.reload();
  });
  const resolve = useAsyncAction(async (id: string) => {
    if (!user?.id) return;
    await securityOps.resolveSos(id, user.id);
    query.reload();
  });

  return (
    <PageLayout title={t('sos.title')} subtitle={t('sos.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex rounded-full bg-muted p-1">
          {(['open', 'all'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(f === 'open' ? 'sos.filterActive' : 'sos.filterAll')}
            </button>
          ))}
        </div>

        {query.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-500/60" />
            <p className="text-sm text-muted-foreground">{t('sos.empty')}</p>
          </div>
        ) : (
          items.map((a: SosAlert) => {
            const active = a.status === 'active';
            return (
              <article key={a.id} className={cn('flex flex-col gap-2 rounded-2xl p-4 shadow-sm', active ? 'border-2 border-destructive/30 bg-destructive/5' : 'bg-card')}>
                <div className="flex items-start gap-3">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', active ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}>
                    <Siren className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-[15px] font-extrabold">{t('sos.alert')}</h2>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_META[a.status] ?? 'bg-muted text-muted-foreground')}>{humanize(a.status)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.location || t('sos.noLocation')} · {formatWhen(a.raisedAtUtc)}</p>
                  </div>
                </div>
                {perm.canEdit && a.status !== 'resolved' ? (
                  <div className="flex justify-end gap-2">
                    {a.status === 'active' ? (
                      <button type="button" onClick={() => acknowledge.run(a.id)} disabled={acknowledge.running} className="flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-bold disabled:opacity-50">
                        <Check className="h-4 w-4" />
                        {t('sos.acknowledge')}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => resolve.run(a.id)} disabled={resolve.running} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                      <ShieldCheck className="h-4 w-4" />
                      {t('sos.resolve')}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </PageLayout>
  );
}
