import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { residents, myTasks, gate } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import type { MyTaskCard } from '@shared/api/myTasks';
import { PageLayout } from '@app/components/PageLayout';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';

const ROUTE_FOR: Record<string, string> = {
  walkin_approval: '/approvals',
  approved_walkin_checkin: '/approvals',
  parcel_pickup: '/parcels',
  maintenance_due: '/maintenance',
  overdue_bill: '/maintenance',
  pending_payment_approval: '/billing',
  kyc_pending: '/my-profile',
  resident_verify: '/resident-approvals',
  active_sos: '/sos',
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
  const [rejectingResident, setRejectingResident] = useState<MyTaskCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingBusy, setRejectingBusy] = useState(false);

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
    try {
      await gate.approveVisitor(c.id, { approvingResidentId: residentId });
      toast.success(t('myVisitors.visitorApproved', 'Visitor approved'));
      reload();
    } catch {
      toast.error('Failed to approve visitor');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (c: MyTaskCard) => {
    if (!residentId || busyId) return;
    setBusyId(c.id);
    try {
      await gate.rejectVisitor(c.id, { rejectingResidentId: residentId });
      toast.success(t('myVisitors.visitorRejected', 'Visitor rejected'));
      reload();
    } catch {
      toast.error('Failed to reject visitor');
    } finally {
      setBusyId(null);
    }
  };

  const approveResident = async (c: MyTaskCard) => {
    if (busyId) return;
    setBusyId(c.id);
    try {
      await residents.verify(c.id);
      toast.success(t('residents.approved', 'Resident verified'));
      reload();
    } catch {
      toast.error('Failed to verify resident');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRejectResident = async () => {
    if (!rejectingResident || !rejectReason.trim() || rejectingBusy) return;
    setRejectingBusy(true);
    try {
      await residents.reject(rejectingResident.id, rejectReason.trim());
      toast.success(t('residents.rejectedDone', 'Resident rejected'));
      setRejectingResident(null);
      setRejectReason('');
      reload();
    } catch {
      toast.error('Failed to reject resident');
    } finally {
      setRejectingBusy(false);
    }
  };

  const primaryAction = (c: MyTaskCard) => {
    switch (c.type) {
      case 'walkin_approval':
        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => reject(c)}
              className="flex-1 rounded-xl border-2 border-destructive/30 py-2 text-sm font-bold text-destructive disabled:opacity-50"
            >
              {t('myTasks.reject')}
            </button>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => approve(c)}
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {t('myTasks.approve')}
            </button>
          </div>
        );
      case 'resident_verify':
        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => { setRejectingResident(c); setRejectReason(''); }}
              className="flex-1 rounded-xl border-2 border-rose-300 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
            >
              {t('residents.reject', 'Reject')}
            </button>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => approveResident(c)}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {t('residents.approve', 'Verify')}
            </button>
          </div>
        );
      case 'active_sos':
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate('/sos'); }}
            className="w-full rounded-xl bg-rose-600 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors"
          >
            {t('myTasks.viewAlert', 'View Emergency Alert')}
          </button>
        );
      case 'pending_payment_approval':
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate('/billing'); }}
            className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('myTasks.reviewPayment', 'Review Payment')}
          </button>
        );
      case 'maintenance_due':
      case 'overdue_bill':
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate('/maintenance'); }}
            className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
          >
            {t('myTasks.payNow')}
          </button>
        );
      case 'kyc_pending':
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate('/my-profile'); }}
            className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
          >
            {t('myTasks.completeVerification')}
          </button>
        );
      default: {
        const route = ROUTE_FOR[c.type];
        return route ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(route); }}
            className="w-full rounded-xl border-2 border-primary py-2 text-sm font-bold text-primary"
          >
            {t('myTasks.viewDetails')}
          </button>
        ) : null;
      }
    }
  };

  return (
    <PageLayout
      title={t('myTasks.title')}
      subtitle={total > 0 ? t(total === 1 ? 'myTasks.itemsOne' : 'myTasks.itemsOther', { count: total }) : t('myTasks.subtitleEmpty')}
    >
      <div className="flex flex-col gap-3">
        {summaryItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filters.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setType(ft)}
                className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition-colors', type === ft ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
              >
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
            <article
              key={`${c.type}-${c.id}`}
              onClick={() => {
                const route = ROUTE_FOR[c.type];
                if (route) navigate(route);
              }}
              className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm cursor-pointer border border-border/50 hover:border-primary/40 transition-colors"
            >
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

      <Dialog open={!!rejectingResident} onClose={() => setRejectingResident(null)}>
        <DialogHeader title={t('residents.rejectTitle', 'Reject Resident KYC')} description={rejectingResident?.title} />
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('residents.rejectReason', 'Reason for rejection')}</label>
        <Input
          autoFocus
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('residents.rejectReasonPlaceholder', 'e.g. Incomplete or mismatched documents')}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmRejectResident(); }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectingResident(null)} className="h-9 rounded-lg text-xs">{t('orgs.cancel', 'Cancel')}</Button>
          <Button onClick={confirmRejectResident} disabled={rejectingBusy || !rejectReason.trim()} className="h-9 rounded-lg bg-rose-600 text-xs hover:bg-rose-700">{t('residents.reject', 'Reject')}</Button>
        </DialogFooter>
      </Dialog>
    </PageLayout>
  );
}

export default MyTasksScreen;
