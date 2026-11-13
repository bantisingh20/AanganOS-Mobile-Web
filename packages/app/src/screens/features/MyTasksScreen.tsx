import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, myTasks, gate } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import type { MyTaskCard } from '@shared/api/myTasks';
import { PageLayout } from '@app/components/PageLayout';

const ROUTE_FOR: Record<string, string> = {
  walkin_approval: '/approvals',
  approved_walkin_checkin: '/approvals',
  parcel_pickup: '/parcels',
  maintenance_due: '/maintenance',
  overdue_bill: '/maintenance',
  pending_payment_approval: '/maintenance',
  kyc_pending: '/my-profile',
  open_ticket: '/my-tickets',
};

function tint(sev: string): string {
  if (sev === 'urgent' || sev === 'high') return '#cf222e';
  if (sev === 'warning' || sev === 'medium') return '#d97706';
  return '#05b872';
}

export function MyTasksScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const residentId = me.data?.resident?.id ?? null;

  const [type, setType] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const summary = useAsync((signal) => myTasks.summary({ signal }).catch(() => []), []);
  const cards = useAsync((signal) => myTasks.cards(type, { signal }).catch(() => []), [type]);

  const summaryItems = summary.data ?? [];
  const total = useMemo(() => summaryItems.reduce((s, i) => s + i.count, 0), [summaryItems]);
  const cardItems = cards.data ?? [];
  const filters = ['all', ...summaryItems.map((i) => i.type)];
  const labelFor = (ty: string) => summaryItems.find((i) => i.type === ty)?.label ?? ty;

  const reload = () => { cards.reload(); summary.reload(); };

  const approve = async (c: MyTaskCard) => {
    if (!residentId || busyId) return;
    setBusyId(c.id);
    try { await gate.approveVisitor(c.id, { approvingResidentId: residentId }); reload(); } catch { void 0; } finally { setBusyId(null); }
  };
  const reject = async (c: MyTaskCard) => {
    if (!residentId || busyId) return;
    setBusyId(c.id);
    try { await gate.rejectVisitor(c.id, { rejectingResidentId: residentId }); reload(); } catch { void 0; } finally { setBusyId(null); }
  };

  const primaryAction = (c: MyTaskCard) => {
    switch (c.type) {
      case 'walkin_approval':
        return (
          <div className="flex gap-2">
            <button type="button" disabled={busyId === c.id} onClick={() => reject(c)} className="flex-1 rounded-xl border-2 border-destructive/30 py-2 text-sm font-bold text-destructive disabled:opacity-50">{t('myTasks.reject')}</button>
            <button type="button" disabled={busyId === c.id} onClick={() => approve(c)} className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{t('myTasks.approve')}</button>
          </div>
        );
      case 'maintenance_due':
      case 'overdue_bill':
        return <button type="button" onClick={() => navigate('/maintenance')} className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">{t('myTasks.payNow')}</button>;
      case 'kyc_pending':
        return <button type="button" onClick={() => navigate('/my-profile')} className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">{t('myTasks.completeVerification')}</button>;
      default: {
        const route = ROUTE_FOR[c.type];
        return route ? <button type="button" onClick={() => navigate(route)} className="w-full rounded-xl border-2 border-primary py-2 text-sm font-bold text-primary">{t('myTasks.viewDetails')}</button> : null;
      }
    }
  };

  return (
    <PageLayout
      title={t('myTasks.title')}
      subtitle={total > 0 ? t(total === 1 ? 'myTasks.itemsOne' : 'myTasks.itemsOther', { count: total }) : t('myTasks.subtitleEmpty')}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {summaryItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filters.map((ft) => (
              <button key={ft} type="button" onClick={() => setType(ft)} className={cn('rounded-full px-3 py-1.5 text-xs font-bold', type === ft ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {ft === 'all' ? t('myTasks.all') : labelFor(ft)}
              </button>
            ))}
          </div>
        ) : null}

        {cards.loading || me.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : cardItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('myTasks.empty')}</p>
          </div>
        ) : (
          cardItems.map((c) => (
            <article key={`${c.type}-${c.id}`} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tint(c.status ?? '') }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-extrabold leading-tight">{c.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.subtitle}</div>
                  {c.meta ? <div className="truncate text-xs text-muted-foreground">{c.meta}</div> : null}
                </div>
                {c.amount != null ? <span className="shrink-0 text-base font-extrabold">₹{c.amount.toLocaleString('en-IN')}</span> : null}
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              {primaryAction(c)}
            </article>
          ))
        )}
      </div>
    </PageLayout>
  );
}
