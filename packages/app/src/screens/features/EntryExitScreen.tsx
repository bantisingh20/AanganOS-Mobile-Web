import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, LogOut, Clock } from 'lucide-react';
import { gate } from '@shared/services';
import type { EntryExitEvent } from '@shared/api/gate';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

function parseUtc(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = parseUtc(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function humanize(code: string): string {
  return code.split(/[_\s]+/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
}

export function EntryExitScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'inside' | 'all'>('inside');

  const query = useAsync(
    (signal) => gate.listEntryExitEvents({ pageSize: 50, sort: 'entryTsUtc:desc' }, filter === 'inside' ? { open: true } : {}, { signal }),
    [filter],
  );
  const items = query.data?.items ?? [];

  const exit = useAsyncAction(async (ev: EntryExitEvent) => {
    await gate.recordExit({
      ...(ev.visitorId ? { visitorId: ev.visitorId } : {}),
      ...(ev.visitPassId ? { visitPassId: ev.visitPassId } : {}),
      ...(ev.recurringVisitorId ? { recurringVisitorId: ev.recurringVisitorId } : {}),
    });
    query.reload();
  });

  return (
    <PageLayout title={t('entryExit.title')} subtitle={t('entryExit.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex rounded-full bg-muted p-1">
          {(['inside', 'all'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(f === 'inside' ? 'entryExit.filterInside' : 'entryExit.filterAll')}
            </button>
          ))}
        </div>

        {query.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ArrowLeftRight className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('entryExit.empty')}</p>
          </div>
        ) : (
          items.map((ev) => {
            const inside = !ev.exitTsUtc;
            return (
              <article key={ev.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-extrabold">{ev.visitorName}</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {humanize(ev.category)}
                      {ev.hostUnitNumber ? ` · ${t('entryExit.unit')} ${ev.hostUnitNumber}` : ''}
                      {ev.vehicleNumber ? ` · ${ev.vehicleNumber}` : ''}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', inside ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    {inside ? t('entryExit.inside') : t('entryExit.left')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t('entryExit.in')}: {formatTime(ev.entryTsUtc)}</span>
                  {ev.exitTsUtc ? <span className="flex items-center gap-1"><LogOut className="h-3 w-3" />{t('entryExit.out')}: {formatTime(ev.exitTsUtc)}</span> : null}
                </div>
                {inside ? (
                  <button type="button" onClick={() => exit.run(ev)} disabled={exit.running} className="flex items-center justify-center gap-1.5 self-end rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    <LogOut className="h-4 w-4" />
                    {t('entryExit.recordExit')}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </PageLayout>
  );
}
