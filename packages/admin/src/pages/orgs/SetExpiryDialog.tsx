import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { subscriptions } from '@shared/services';
import type { Organization } from '@shared/api/organizations';
import type { SubscriptionStatus, RenewalRequest } from '@shared/api/subscriptions';
import { toFormError } from '@shared/api/errors';

export function SetExpiryDialog({
  open,
  org,
  current,
  planOptions,
  onClose,
  onSaved,
  isApprovalRequired,
  request,
}: {
  open: boolean;
  org?: Organization | null;
  current: SubscriptionStatus | null;
  planOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
  isApprovalRequired: boolean;
  request?: RenewalRequest | null;
}) {
  const { t } = useTranslation();
  const [planMonths, setPlanMonths] = useState('12');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const m = current?.planMonths && current.planMonths > 0 ? String(current.planMonths) : '12';
      setPlanMonths(m);
      if (current?.expiresAtUtc) {
        setExpiresAt(current.expiresAtUtc.slice(0, 10));
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + Number(m));
        setExpiresAt(d.toISOString().slice(0, 10));
      }
    }
  }, [open, current]);

  const submit = async () => {
    if (busy || !org || !expiresAt) return;
    setBusy(true);
    try {
      if (isApprovalRequired) {
        if (!request) {
          toast.error('No renewal request found');
          return;
        }
        await subscriptions.approveRenewal(request.id, {
          planMonths: Number(planMonths),
          startsAtUtc: new Date().toISOString(),
          expiresAtUtc: new Date(expiresAt).toISOString(),
        });
      } else {
        await subscriptions.setExpiry({
          organizationId: org.id,
          planMonths: Number(planMonths),
          startsAtUtc: new Date().toISOString(),
          expiresAtUtc: new Date(expiresAt).toISOString(),
        });
      }
      toast.success('Subscription updated');
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={t('orgs.setExpiryTitle')} description={org?.name} />
      <div className="flex flex-col gap-3 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('orgs.planDuration')} *</label>
          <Select value={planMonths} onValueChange={setPlanMonths}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {planOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('orgs.expiryDate')} *</label>
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
      </div>

      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80"
        >
          {t('orgs.cancel')}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {t('orgs.save')}
        </Button>
      </div>
    </Dialog>
  );
}
