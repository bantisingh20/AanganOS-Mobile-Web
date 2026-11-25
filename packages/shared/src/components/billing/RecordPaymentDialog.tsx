import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { maintenanceBilling } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import { toFormError } from '@shared/api/errors';
import type { Option } from './billingConstants';

export function RecordPaymentDialog({
  bill,
  methodOptions,
  onClose,
  onDone,
}: {
  bill: MaintenanceBill | null;
  methodOptions: Option[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const open = !!bill;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(bill?.amountDue != null ? String(bill.amountDue) : '');
    setMethod(methodOptions[0]?.value ?? 'cash');
    setReference('');
    setPaidAt('');
  }, [open, bill, methodOptions]);

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = !!bill && amountValid && !!method;

  const submit = async () => {
    if (busy || !canSubmit || !bill) return;
    setBusy(true);
    try {
      await maintenanceBilling.recordPayment({
        maintenanceBillId: bill.id,
        amount: amountNum,
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(paidAt ? { paidAtUtc: new Date(paidAt).toISOString() } : {}),
      });
      toast.success(t('billing.paymentRecorded'));
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg rounded-lg p-5">
      <DialogHeader title={t('billing.recordPaymentTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.amount')} *</label>
          <Input
            autoFocus
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
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.method')} *</label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue placeholder={t('billing.selectMethod')} />
            </SelectTrigger>
            <SelectContent>
              {methodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.reference')}</label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('billing.referencePlaceholder')}
            maxLength={200}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground">{t('billing.paidAt')}</label>
          <Input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
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
          {t('billing.recordPayment')}
        </Button>
      </div>
    </Dialog>
  );
}
