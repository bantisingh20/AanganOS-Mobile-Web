import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/EntitySelect';
import { maintenanceBilling } from '@shared/services';
import { toFormError } from '@shared/api/errors';
import { makeCommunityFetch, resolveCommunityLabel, type Option } from './billingConstants';

export function GenerateBillsDialog({
  open,
  presetCommunityId,
  organizationId,
  onClose,
  onDone,
}: {
  open: boolean;
  presetCommunityId?: string;
  organizationId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const now = new Date();
  const [communityId, setCommunityId] = useState('');
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const monthOptions = useMemo<Option[]>(
    () => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) })),
    [t]
  );

  useEffect(() => {
    if (!open) return;
    setCommunityId(presetCommunityId ?? '');
    setPeriodYear(String(now.getFullYear()));
    setPeriodMonth(String(now.getMonth() + 1));
    setDueDate('');
  }, [open, presetCommunityId]);

  const yearNum = Number.parseInt(periodYear, 10);
  const monthNum = Number.parseInt(periodMonth, 10);
  const yearValid = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 3000;
  const monthValid = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12;
  const canSubmit = !!communityId && yearValid && monthValid;

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const result = await maintenanceBilling.generateBills({
        communityId,
        periodYear: yearNum,
        periodMonth: monthNum,
        ...(dueDate ? { dueDateUtc: new Date(dueDate).toISOString() } : {}),
      });
      toast.success(t('billing.generated', { count: result.billsCreated }));
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg rounded-lg p-5">
      <DialogHeader title={t('billing.generateTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
        {!presetCommunityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.community')} *</label>
            <EntitySelect
              value={communityId || null}
              onChange={(v) => setCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.periodYear')} *</label>
          <Input
            type="number"
            min={2000}
            max={3000}
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
            placeholder={t('billing.periodYearPlaceholder')}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.periodMonth')} *</label>
          <Select value={periodMonth} onValueChange={setPeriodMonth}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue placeholder={t('billing.selectMonth')} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.dueDate')}</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
          disabled={busy || !canSubmit}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {t('billing.generate')}
        </Button>
      </div>
    </Dialog>
  );
}
