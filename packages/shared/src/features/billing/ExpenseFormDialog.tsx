import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { maintenanceBilling } from '@shared/services';
import type { MaintenanceExpense } from '@shared/api/maintenanceBilling';
import { tryToast } from '@shared/lib/withToast';
import { makeCommunityFetch, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import type { Option } from './billingConstants';

export function ExpenseFormDialog({
  open,
  communityId,
  organizationId,
  expense,
  categoryOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  communityId?: string;
  organizationId?: string;
  expense: MaintenanceExpense | null;
  categoryOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!expense;
  const [targetCommunityId, setTargetCommunityId] = useState(expense?.communityId ?? communityId ?? '');
  const [direction, setDirection] = useState('debit');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetCommunityId(expense?.communityId ?? communityId ?? '');
    setDirection(expense?.direction ?? 'debit');
    setCategory(expense?.category ?? categoryOptions[0]?.value ?? '');
    setTitle(expense?.title ?? '');
    setAmount(expense?.amount != null ? String(expense.amount) : '');
    setSpentOn(expense?.spentOnUtc ? expense.spentOnUtc.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setVendor(expense?.vendor ?? '');
    setNotes(expense?.notes ?? '');
  }, [open, expense, communityId, categoryOptions]);

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = !!targetCommunityId && !!category && !!title.trim() && amountValid && !!spentOn;

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body = {
        communityId: targetCommunityId,
        direction,
        category,
        title: title.trim(),
        amount: amountNum,
        spentOnUtc: new Date(spentOn).toISOString(),
        ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const ok = await tryToast(
        () => (isEdit ? maintenanceBilling.updateExpense(expense!.id, body) : maintenanceBilling.createExpense(body)),
        isEdit
          ? t('billing.expenseUpdated')
          : direction === 'credit'
          ? 'Credit Income Entry Added'
          : t('billing.expenseRecorded')
      );
      if (ok) onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg rounded-lg p-5">
      <DialogHeader title={isEdit ? t('billing.editLedgerTitle') : t('billing.addLedgerTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
        {!communityId && !isEdit ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.community')} *</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => setTargetCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.ledgerDirection')} *</label>
          <div className="flex items-center rounded-[4px] bg-muted/60 p-0.5 border border-border/70">
            <button
              type="button"
              onClick={() => setDirection('debit')}
              className={`h-7.5 flex-1 rounded-[3px] px-3 text-xs font-medium transition-colors ${
                direction === 'debit' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Debit (Expense)
            </button>
            <button
              type="button"
              onClick={() => setDirection('credit')}
              className={`h-7.5 flex-1 rounded-[3px] px-3 text-xs font-medium transition-colors ${
                direction === 'credit' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Credit (Income / Collection)
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.colCategory')} *</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue placeholder={t('billing.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.amount')} *</label>
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
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.colTitle')} *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('billing.expenseTitlePlaceholder')}
            maxLength={200}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.spentOn')} *</label>
          <Input
            type="date"
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.colVendor')}</label>
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder={t('billing.vendorPlaceholder')}
            maxLength={200}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('billing.notesPlaceholder')}
            maxLength={1000}
            rows={3}
            className="w-full resize-none rounded-[4px] border border-input bg-transparent px-3 py-2 text-xs leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {isEdit ? t('billing.saveChanges') : t('billing.save')}
        </Button>
      </div>
    </Dialog>
  );
}
