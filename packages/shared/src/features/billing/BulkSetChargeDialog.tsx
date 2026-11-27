import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { maintenanceBilling, units } from '@shared/services';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { withToast } from '@shared/lib/withToast';
import { makeCommunityFetch, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { unitLabel } from '@shared/lib/unitLabel';

export function BulkSetChargeDialog({
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
  const [applyToAll, setApplyToAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetCommunityId(communityId ?? '');
    setApplyToAll(false);
    setSelected(new Set());
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
  const unitItems = useMemo(
    () =>
      [...(unitsQuery.data ?? [])].sort((a, b) =>
        unitLabel(a).localeCompare(unitLabel(b), undefined, { numeric: true, sensitivity: 'base' })
      ),
    [unitsQuery.data]
  );

  const toggleUnit = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSubmit = !!targetCommunityId && amountValid && (applyToAll || selected.size > 0);

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const result = await withToast(() => maintenanceBilling.bulkSetCharges({
        communityId: targetCommunityId,
        amount: amountNum,
        ...(label.trim() ? { label: label.trim() } : {}),
        isActive,
        applyToAllUnits: applyToAll,
        ...(applyToAll ? {} : { unitIds: Array.from(selected) }),
      }));
      if (result) {
        toast.success(t('billing.bulkApplied', { created: result.created, updated: result.updated }));
        onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg rounded-lg p-5">
      <DialogHeader title={t('billing.bulkSetTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
        {!communityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.community')} *</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => {
                setTargetCommunityId(v ?? '');
                setSelected(new Set());
              }}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2 cursor-pointer text-foreground">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input accent-primary"
          />
          {t('billing.applyToAll', { count: unitItems.length })}
        </label>
        {!applyToAll ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.selectUnits')} *</label>
            <div className="max-h-44 overflow-y-auto rounded-[4px] border border-border p-2 space-y-1">
              {unitItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {unitsQuery.loading ? t('common.loading') : t('billing.noUnits')}
                </div>
              ) : (
                unitItems.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded-[3px] px-1.5 py-1 text-xs hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleUnit(u.id)}
                      className="h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    {unitLabel(u)}
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}
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
        <div>
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
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {t('billing.applyToUnits')}
        </Button>
      </div>
    </Dialog>
  );
}
