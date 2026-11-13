import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, MessageCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tickets } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

const PAGE_SIZE = 10;

const STATUS_ACCENT: Record<string, { rail: string; pill: string; text: string }> = {
  new: { rail: 'bg-sky-500', pill: 'bg-sky-500', text: 'text-sky-600' },
  assigned: { rail: 'bg-indigo-500', pill: 'bg-indigo-500', text: 'text-indigo-600' },
  in_progress: { rail: 'bg-amber-500', pill: 'bg-amber-500', text: 'text-amber-600' },
  waiting: { rail: 'bg-orange-500', pill: 'bg-orange-500', text: 'text-orange-600' },
  resolved: { rail: 'bg-emerald-500', pill: 'bg-emerald-500', text: 'text-emerald-600' },
  closed: { rail: 'bg-slate-500', pill: 'bg-slate-500', text: 'text-slate-600' },
  reopened: { rail: 'bg-rose-500', pill: 'bg-rose-500', text: 'text-rose-600' },
};

function accentFor(status: string) {
  return STATUS_ACCENT[status] ?? STATUS_ACCENT.new!;
}

function humanize(code: string): string {
  return code
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function MyTicketsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perm = usePermission('my-tickets');
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [page, setPage] = useState(1);

  const query = useAsync(
    (signal) =>
      tickets.list(
        { page, pageSize: PAGE_SIZE, sort: 'createdAtUtc:desc' },
        filter === 'open' ? { status: 'new' } : {},
        { signal },
      ),
    [filter, page],
  );
  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const changeFilter = (f: 'all' | 'open') => {
    setFilter(f);
    setPage(1);
  };

  return (
    <PageLayout
      title={t('myTickets.title')}
      subtitle={t('myTickets.subtitle')}
      right={
        perm.canAdd ? (
          <button type="button" onClick={() => navigate('/raise-ticket')} aria-label={t('myTickets.raise')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
            <Plus className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex rounded-full bg-muted p-1">
          {(['all', 'open'] as const).map((f) => (
            <button key={f} type="button" onClick={() => changeFilter(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(f === 'all' ? 'myTickets.filterAll' : 'myTickets.filterOpen')}
            </button>
          ))}
        </div>

        {query.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('myTickets.empty')}</p>
            <button type="button" onClick={() => navigate('/raise-ticket')} className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{t('myTickets.raise')}</button>
          </div>
        ) : (
          <>
            {items.map((tk) => {
              const accent = accentFor(tk.status);
              return (
                <button
                  key={tk.id}
                  type="button"
                  onClick={() => navigate(`/my-tickets/${tk.id}`)}
                  aria-label={tk.title}
                  className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-card p-4 pl-5 text-left shadow-sm transition-transform active:scale-[0.99]"
                >
                  <span className={cn('absolute inset-y-0 left-0 w-1.5', accent.rail)} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', accent.rail)} />
                      <span className="truncate text-sm font-extrabold">{humanize(tk.category)}</span>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">· {humanize(tk.priority)}</span>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white', accent.pill)}>
                      {humanize(tk.status)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-snug">{tk.title}</p>
                  <div className="flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t('myTickets.raisedOn', { date: formatDate(tk.createdAtUtc) })}</span>
                    <span className="flex-1" />
                    <span className={cn('font-bold', accent.text)}>{t('myTickets.view')}</span>
                    <ChevronRight className={cn('h-4 w-4', accent.text)} />
                  </div>
                </button>
              );
            })}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || query.loading}
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  {t('myTickets.prev')}
                </button>
                <span className="text-sm text-muted-foreground">{t('myTickets.pageOf', { page, total: totalPages })}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || query.loading}
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-bold disabled:opacity-40"
                >
                  {t('myTickets.next')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageLayout>
  );
}
