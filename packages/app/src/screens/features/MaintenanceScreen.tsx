import { useState } from 'react';
import { CreditCard, Receipt, Wallet, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { maintenanceBilling } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';
import { BottomSheet } from '@shared/components/ui/bottom-sheet';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';

const STATUS_META: Record<string, { key: string; className: string }> = {
  paid: { key: 'maintenance.statusPaid', className: 'bg-primary/10 text-primary' },
  partially_paid: { key: 'maintenance.statusPartial', className: 'bg-amber-500/10 text-amber-600' },
  partial: { key: 'maintenance.statusPartial', className: 'bg-amber-500/10 text-amber-600' },
  unpaid: { key: 'maintenance.statusUnpaid', className: 'bg-destructive/10 text-destructive' },
  overdue: { key: 'maintenance.statusOverdue', className: 'bg-destructive/10 text-destructive' },
  waived: { key: 'maintenance.statusWaived', className: 'bg-muted text-muted-foreground' },
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAYMENT_METHODS = ['upi', 'cash', 'card', 'bank_transfer', 'cheque'] as const;

function money(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function MaintenanceScreen() {
  const { t } = useTranslation();

  const bills = useAsync(
    (signal) => maintenanceBilling.myBills({ pageSize: 50, sort: 'issuedAtUtc:desc' }, undefined, { signal }).catch(() => null),
    [],
  );
  const items = bills.data?.items ?? [];
  const totalDue = items.reduce((s, b) => s + (b.amountDue ?? 0), 0);

  const [payBill, setPayBill] = useState<MaintenanceBill | null>(null);

  return (
    <PageLayout title={t('maintenance.title')} subtitle={t('maintenance.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        {items.length > 0 ? (
          <div className="flex items-center justify-between rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm">
            <span className="text-sm font-semibold">{t('maintenance.totalDue')}</span>
            <span className="text-2xl font-extrabold">{money(totalDue)}</span>
          </div>
        ) : null}

        {bills.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('maintenance.empty')}</p>
          </div>
        ) : (
          items.map((b) => {
            const meta = STATUS_META[b.status] ?? STATUS_META.unpaid!;
            const payable = b.amountDue > 0 && b.status !== 'waived' && !b.pendingApproval;
            return (
              <article key={b.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></span>
                    <div>
                      <div className="text-[15px] font-extrabold">{b.label || t('maintenance.title')}</div>
                      <div className="text-xs text-muted-foreground">
                        {MONTHS[b.periodMonth] ?? ''} {b.periodYear}
                        {b.unitNumber ? ` · ${b.unitNumber}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', meta.className)}>{t(meta.key)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('maintenance.amount')}</div>
                    <div className="text-base font-extrabold">{money(b.amount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{t('maintenance.due')}</div>
                    <div className={cn('text-base font-extrabold', b.amountDue > 0 ? 'text-destructive' : 'text-primary')}>{money(b.amountDue)}</div>
                  </div>
                </div>
                {b.pendingApproval ? (
                  <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600">
                    <Clock className="h-4 w-4" />
                    {t('maintenance.paymentPending')}
                  </div>
                ) : payable ? (
                  <button
                    type="button"
                    onClick={() => setPayBill(b)}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    <Wallet className="h-4 w-4" />
                    {t('maintenance.payNow')}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <PaySheet bill={payBill} onClose={() => setPayBill(null)} onPaid={() => { setPayBill(null); bills.reload(); }} />
    </PageLayout>
  );
}

function PaySheet({ bill, onClose, onPaid }: { bill: MaintenanceBill | null; onClose: () => void; onPaid: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');

  const open = bill !== null;

  const methodOptions: SelectOption[] = PAYMENT_METHODS.map((m) => ({ value: m, label: t(`maintenance.method_${m}`) }));

  const submit = useAsyncAction(async () => {
    if (!bill) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await maintenanceBilling.submitPayment({
      maintenanceBillId: bill.id,
      amount: amt,
      method,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    });
    setAmount(''); setReference(''); setMethod('upi');
    onPaid();
  });

  if (!open) return null;

  const amt = Number(amount);
  const canSubmit = Number.isFinite(amt) && amt > 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('maintenance.payTitle')}
      footer={<PrimaryButton label={t('maintenance.submitPayment')} arrow={false} loading={submit.running} disabled={!canSubmit} onClick={() => submit.run()} />}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('maintenance.due')}</span>
          <span className="font-extrabold">{money(bill!.amountDue)}</span>
        </div>
        <TextField
          label={t('maintenance.amount')}
          requiredMark
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(bill!.amountDue)}
        />
        <SelectField label={t('maintenance.method')} required value={method} options={methodOptions} onChange={setMethod} />
        <TextField label={t('maintenance.reference')} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('maintenance.referencePlaceholder')} />
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
        <p className="text-xs text-muted-foreground">{t('maintenance.submitHint')}</p>
      </div>
    </BottomSheet>
  );
}
