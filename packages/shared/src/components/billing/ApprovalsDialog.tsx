import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { maintenanceBilling } from '@shared/services';
import type { PendingPayment } from '@shared/api/maintenanceBilling';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { formatAmount, formatDate, formatPeriod } from './billingConstants';

export function ApprovalsDialog({
  communityId,
  organizationId,
  canApprove = true,
  onClose,
  onDone,
}: {
  communityId: string | null;
  organizationId?: string;
  canApprove?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const open = communityId !== null;
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useAsync(
    (signal) =>
      open
        ? maintenanceBilling.listPendingPayments(communityId || undefined, organizationId, { signal }).catch(() => [] as PendingPayment[])
        : Promise.resolve([] as PendingPayment[]),
    [open, communityId, organizationId, reloadKey]
  );

  const items = query.data ?? [];
  const reload = () => setReloadKey((k) => k + 1);

  const act = async (p: PendingPayment, approve: boolean) => {
    setBusyId(p.id);
    try {
      if (approve) {
        await maintenanceBilling.approvePayment(p.id);
        toast.success(t('billing.paymentApproved'));
      } else {
        await maintenanceBilling.rejectPayment(p.id);
        toast.success(t('billing.paymentRejected'));
      }
      reload();
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl rounded-lg p-5">
      <DialogHeader title={t('billing.reviewApproval')} />
      <div className="space-y-3 pt-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {query.loading ? t('common.loading') : t('billing.noPendingApprovals')}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-[4px] border border-border/80 bg-card/60 p-2.5 text-xs">
                <div>
                  <div className="font-semibold text-xs text-foreground">
                    ₹{formatAmount(p.amount)} · <span className="capitalize">{p.method}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Ref: {p.reference || '—'} · Paid: {formatDate(p.paidAtUtc)}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {formatPeriod(p.periodYear, p.periodMonth)}
                  </div>
                </div>
                {canApprove ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === p.id}
                      onClick={() => act(p, false)}
                      className="h-7 px-2.5 rounded-[4px] text-xs text-rose-600 hover:bg-rose-50 border-rose-300 dark:border-rose-800 dark:hover:bg-rose-950/40"
                    >
                      {t('billing.reject')}
                    </Button>
                    <Button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => act(p, true)}
                      className="h-7 px-2.5 rounded-[4px] text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {t('billing.approve')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80"
        >
          {t('common.close', { defaultValue: 'Close' })}
        </Button>
      </div>
    </Dialog>
  );
}
