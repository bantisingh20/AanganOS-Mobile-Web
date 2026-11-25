import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/EntitySelect';
import { maintenanceBilling, units } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { makeCommunityFetch, resolveCommunityLabel, type Option } from './billingConstants';

export function SetChargeDialog({
  open,
  communityId,
  organizationId,
  onClose,
  onDone,
}: {
  open: boolean;
  communityId?: string;
  organizationId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [targetCommunityId, setTargetCommunityId] = useState(communityId ?? '');
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetCommunityId(communityId ?? '');
    setUnitId('');
    setAmount('');
    setLabel('');
    setIsActive(true);
  }, [open, communityId]);

  const unitsQuery = useAsync(
    (signal) =>
      open && targetCommunityId
        ? units.list({ pageSize: 500 }, { communityId: targetCommunityId }, { signal }).then((d) => d.items).catch(() => [])
        : Promise.resolve([]),
    [open, targetCommunityId]
  );
  const unitOptions = useMemo<Option[]>(
    () => (unitsQuery.data ?? []).map((u) => ({ value: u.id, label: u.unitNumber })),
    [unitsQuery.data]
  );

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSubmit = !!targetCommunityId && !!unitId && amountValid;

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await maintenanceBilling.setCharge({
        communityId: targetCommunityId,
        unitId,
        amount: amountNum,
        ...(label.trim() ? { label: label.trim() } : {}),
        isActive,
      });
      toast.success(t('billing.chargeSaved'));
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg rounded-lg p-5">
      <DialogHeader title={t('billing.setChargeTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
        {!communityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.community')} *</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => {
                setTargetCommunityId(v ?? '');
                setUnitId('');
              }}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.colUnit')} *</label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue placeholder={t('billing.selectUnit')} />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.monthlyAmount')} *</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billing.amountPlaceholder')}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.chargeLabel')}</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('billing.chargeLabelPlaceholder')}
            maxLength={200}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2 cursor-pointer text-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          {t('billing.active')}
        </label>
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
          disabled={busy || !canSubmit}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {t('billing.save')}
        </Button>
      </div>
    </Dialog>
  );
}
