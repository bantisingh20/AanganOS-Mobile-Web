import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Ban, Trash2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { units, communities } from '@shared/services';
import type { MaintenanceBill, MaintenanceExpense } from '@shared/api/maintenanceBilling';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { usePermission } from '@shared/lib/usePermission';
import { useBills, useCharges, useExpenses, useCollectionSummary, ledgerTotals, useBillingActions } from '@shared/lib/useBilling';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';
import { BottomSheet } from '@shared/components/ui/bottom-sheet';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';

type Tab = 'bills' | 'charges' | 'ledger' | 'dashboard';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAYMENT_METHODS = ['upi', 'cash', 'card', 'bank_transfer', 'cheque'] as const;

function money(n: number): string {
  return `₹${(n ?? 0).toLocaleString('en-IN')}`;
}
function period(y: number, m: number): string {
  return `${MONTHS[m] ?? ''} ${y}`;
}

export function BillingScreen() {
  const { t } = useTranslation();
  const scope = useScope();
  const perm = usePermission('billing');
  const [tab, setTab] = useState<Tab>('bills');
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);

  const effectiveCommunityId = communityFilter ?? scope.scopedCommunityId ?? undefined;

  const communityOptions = useAsync(
    (signal) => (scope.showCommunityFilter
      ? communities.list({ pageSize: 200 }, scope.organizationId ? { organizationId: scope.organizationId } : {}, { signal })
          .then((d) => d.items.map((c) => ({ value: c.id, label: c.name }))).catch(() => [])
      : Promise.resolve([])),
    [scope.showCommunityFilter, scope.organizationId],
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bills', label: t('billing.tabBills') },
    { key: 'charges', label: t('billing.tabCharges') },
    { key: 'ledger', label: t('billing.tabExpenses') },
    { key: 'dashboard', label: t('billing.tabDashboard') },
  ];

  return (
    <PageLayout title={t('billing.title')} subtitle={t('billing.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        {scope.showCommunityFilter ? (
          <SelectField
            label={t('billing.filterCommunity')}
            value={communityFilter}
            options={[{ value: '', label: t('billing.allCommunities') }, ...(communityOptions.data ?? [])]}
            onChange={(v) => setCommunityFilter(v || null)}
          />
        ) : null}

        <div className="flex rounded-full bg-muted p-1">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={cn('flex-1 rounded-full py-1.5 text-xs font-bold transition-colors', tab === tb.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'bills' ? <BillsTab communityId={effectiveCommunityId} perm={perm} /> : null}
        {tab === 'charges' ? <ChargesTab communityId={effectiveCommunityId} perm={perm} /> : null}
        {tab === 'ledger' ? <LedgerTab communityId={effectiveCommunityId} perm={perm} /> : null}
        {tab === 'dashboard' ? <DashboardTab communityId={effectiveCommunityId} /> : null}
      </div>
    </PageLayout>
  );
}

type Perm = ReturnType<typeof usePermission>;

function BillsTab({ communityId, perm }: { communityId?: string; perm: Perm }) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [paying, setPaying] = useState<MaintenanceBill | null>(null);
  const [generating, setGenerating] = useState(false);
  const actions = useBillingActions();

  const query = useBills(
    { pageSize: 100, sort: 'issuedAtUtc:desc' },
    communityId ? { communityId } : {},
    reloadKey,
  );
  const items = query.data?.items ?? [];
  const reload = () => setReloadKey((k) => k + 1);

  const waive = useAsyncAction(async (id: string) => { await actions.waiveBill(id); reload(); });

  if (!communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityExpenses')}</p>;
  }

  return (
    <>
      {perm.canAdd ? (
        <button type="button" onClick={() => setGenerating(true)} className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" />{t('billing.generate')}
        </button>
      ) : null}

      {query.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.empty')}</p>
      ) : (
        items.map((b) => {
          const settled = b.status === 'paid' || b.status === 'waived';
          return (
            <article key={b.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold">{b.unitNumber ?? b.label}</div>
                  <div className="text-xs text-muted-foreground">{period(b.periodYear, b.periodMonth)}</div>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', b.pendingApproval ? 'bg-amber-500/10 text-amber-600' : settled ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>
                  {b.pendingApproval ? t('billing.pendingApproval') : t(`billing.status.${b.status}`, b.status)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 border-t border-border pt-2 text-[11px]">
                <div><span className="block uppercase text-muted-foreground">{t('billing.colAmount')}</span><b className="tabular-nums">{money(b.amount)}</b></div>
                <div><span className="block uppercase text-muted-foreground">{t('billing.colPaid')}</span><b className="tabular-nums text-primary">{money(b.amountPaid)}</b></div>
                <div><span className="block uppercase text-muted-foreground">{t('billing.colDue2')}</span><b className="tabular-nums">{money(b.amountDue)}</b></div>
              </div>
              {!settled && !b.pendingApproval ? (
                <div className="flex items-center gap-2 border-t border-border pt-2">
                  {perm.canAdd ? (
                    <button type="button" onClick={() => setPaying(b)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                      <Wallet className="h-4 w-4" />{t('billing.recordPayment')}
                    </button>
                  ) : null}
                  {perm.canEdit ? (
                    <button type="button" onClick={() => waive.run(b.id)} disabled={waive.running} className="flex items-center justify-center gap-1.5 rounded-full border border-destructive px-3 py-2 text-xs font-bold text-destructive">
                      <Ban className="h-4 w-4" />{t('billing.waive')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })
      )}

      <RecordPaymentSheet bill={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload(); }} />
      <GenerateSheet open={generating} communityId={communityId} onClose={() => setGenerating(false)} onDone={() => { setGenerating(false); reload(); }} />
    </>
  );
}

function ChargesTab({ communityId, perm }: { communityId?: string; perm: Perm }) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [setting, setSetting] = useState(false);
  const actions = useBillingActions();
  const query = useCharges(communityId, reloadKey);
  const items = (query.data ?? []).filter((c) => c.isActive);
  const reload = () => setReloadKey((k) => k + 1);
  const remove = useAsyncAction(async (id: string) => { await actions.deactivateCharge(id); reload(); });

  if (!communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityCharges')}</p>;
  }

  return (
    <>
      {perm.canAdd ? (
        <button type="button" onClick={() => setSetting(true)} className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" />{t('billing.setCharge')}
        </button>
      ) : null}
      {query.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.noCharges')}</p>
      ) : (
        items.map((c) => (
          <article key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-card p-4 shadow-sm">
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold">{c.unitNumber ?? c.unitId}</div>
              <div className="text-xs text-muted-foreground">{c.label || '—'}</div>
            </div>
            <div className="flex items-center gap-3">
              <b className="tabular-nums">{money(c.amount)}</b>
              {perm.canDelete || perm.canEdit ? (
                <button type="button" onClick={() => remove.run(c.id)} disabled={remove.running} aria-label={t('billing.delete')} className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </article>
        ))
      )}
      <SetChargeSheet open={setting} communityId={communityId} onClose={() => setSetting(false)} onDone={() => { setSetting(false); reload(); }} />
    </>
  );
}

function LedgerTab({ communityId, perm }: { communityId?: string; perm: Perm }) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<MaintenanceExpense | null>(null);
  const [adding, setAdding] = useState(false);
  const actions = useBillingActions();
  const query = useExpenses(communityId, reloadKey);
  const items = query.data ?? [];
  const totals = useMemo(() => ledgerTotals(items), [items]);
  const reload = () => setReloadKey((k) => k + 1);
  const del = useAsyncAction(async (id: string) => { await actions.deleteExpense(id); reload(); });

  if (!communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityExpenses')}</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl bg-card p-3 text-xs shadow-sm">
        <span>{t('billing.totalReceivedLedger')}: <b className="tabular-nums text-primary">{money(totals.received)}</b></span>
        <span>{t('billing.totalSpent')}: <b className="tabular-nums text-destructive">{money(totals.spent)}</b></span>
      </div>
      {perm.canAdd ? (
        <button type="button" onClick={() => { setEditing(null); setAdding(true); }} className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" />{t('billing.addLedger')}
        </button>
      ) : null}
      {query.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.noExpenses')}</p>
      ) : (
        items.map((e) => {
          const credit = e.direction === 'credit';
          return (
            <article key={e.id} className="flex items-center justify-between gap-2 rounded-2xl bg-card p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', credit ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>{credit ? t('billing.directionCredit') : t('billing.directionDebit')}</span>
                  <span className="text-[14px] font-extrabold">{e.title}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(e.spentOnUtc).toLocaleDateString()} · {e.vendor || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <b className={cn('tabular-nums', credit ? 'text-primary' : 'text-destructive')}>{credit ? '+' : '−'}{money(e.amount)}</b>
                {perm.canEdit ? (
                  <button type="button" onClick={() => { setEditing(e); setAdding(true); }} aria-label={t('billing.edit')} className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"><Pencil className="h-4 w-4" /></button>
                ) : null}
                {perm.canDelete ? (
                  <button type="button" onClick={() => del.run(e.id)} disabled={del.running} aria-label={t('billing.delete')} className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive text-destructive"><Trash2 className="h-4 w-4" /></button>
                ) : null}
              </div>
            </article>
          );
        })
      )}
      <LedgerSheet open={adding} communityId={communityId} expense={editing} onClose={() => { setAdding(false); setEditing(null); }} onDone={() => { setAdding(false); setEditing(null); reload(); }} />
    </>
  );
}

function DashboardTab({ communityId }: { communityId?: string }) {
  const { t } = useTranslation();
  const query = useCollectionSummary(communityId, 0);
  const s = query.data;
  const received = useMemo(() => (s ? s.byCommunity.reduce((a, c) => a + (c.received ?? 0), 0) : 0), [s]);
  const spent = useMemo(() => (s ? s.byCommunity.reduce((a, c) => a + (c.spent ?? 0), 0) : 0), [s]);

  if (query.loading && !s) return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!s) return <p className="py-10 text-center text-sm text-muted-foreground">{t('billing.empty')}</p>;

  const stats = [
    { label: t('billing.totalCollected'), value: s.totalCollected },
    { label: t('billing.totalReceivedStat'), value: received },
    { label: t('billing.totalSpentStat'), value: spent },
    { label: t('billing.balanceFund'), value: s.totalCollected + received - spent },
    { label: t('billing.totalOutstanding'), value: s.totalOutstanding },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((st) => (
        <div key={st.label} className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{st.label}</div>
          <div className="mt-1 text-lg font-extrabold tabular-nums">{money(st.value)}</div>
        </div>
      ))}
    </div>
  );
}

function RecordPaymentSheet({ bill, onClose, onDone }: { bill: MaintenanceBill | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const actions = useBillingActions();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const open = bill !== null;
  const methodOptions: SelectOption[] = PAYMENT_METHODS.map((m) => ({ value: m, label: t(`maintenance.method_${m}`) }));

  const submit = useAsyncAction(async () => {
    if (!bill) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await actions.recordPayment({ maintenanceBillId: bill.id, amount: amt, method, ...(reference.trim() ? { reference: reference.trim() } : {}) });
    setAmount(''); setReference(''); setMethod('upi');
    onDone();
  });

  if (!open) return null;
  const amt = Number(amount);
  const canSubmit = Number.isFinite(amt) && amt > 0;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('billing.recordPaymentTitle')}
      footer={<PrimaryButton label={t('billing.recordPayment')} arrow={false} loading={submit.running} disabled={!canSubmit} onClick={() => submit.run()} />}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm"><span className="text-muted-foreground">{t('billing.colDue2')}</span><span className="font-extrabold">{money(bill!.amountDue)}</span></div>
        <TextField label={t('billing.amount')} requiredMark type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(bill!.amountDue)} />
        <SelectField label={t('billing.method')} required value={method} options={methodOptions} onChange={setMethod} />
        <TextField label={t('billing.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
      </div>
    </BottomSheet>
  );
}

function GenerateSheet({ open, communityId, onClose, onDone }: { open: boolean; communityId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const actions = useBillingActions();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState('');
  const monthOptions: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) }));

  const submit = useAsyncAction(async () => {
    const y = Number(year); const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m)) return;
    await actions.generateBills({ communityId, periodYear: y, periodMonth: m, ...(dueDate ? { dueDateUtc: new Date(dueDate).toISOString() } : {}) });
    onDone();
  });

  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('billing.generateTitle')}
      footer={<PrimaryButton label={t('billing.generate')} arrow={false} loading={submit.running} onClick={() => submit.run()} />}>
      <div className="flex flex-col gap-3">
        <TextField label={t('billing.periodYear')} type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        <SelectField label={t('billing.periodMonth')} value={month} options={monthOptions} onChange={setMonth} />
        <TextField label={t('billing.dueDate')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
      </div>
    </BottomSheet>
  );
}

function SetChargeSheet({ open, communityId, onClose, onDone }: { open: boolean; communityId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const actions = useBillingActions();
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');

  const unitsQuery = useAsync(
    (signal) => (open ? units.list({ pageSize: 500 }, { communityId }, { signal }).then((d) => d.items.map((u) => ({ value: u.id, label: u.unitNumber }))).catch(() => []) : Promise.resolve([])),
    [open, communityId],
  );

  const submit = useAsyncAction(async () => {
    const amt = Number(amount);
    if (!unitId || !Number.isFinite(amt) || amt < 0) return;
    await actions.setCharge({ communityId, unitId, amount: amt, ...(label.trim() ? { label: label.trim() } : {}), isActive: true });
    setUnitId(''); setAmount(''); setLabel('');
    onDone();
  });

  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('billing.setChargeTitle')}
      footer={<PrimaryButton label={t('billing.save')} arrow={false} loading={submit.running} onClick={() => submit.run()} />}>
      <div className="flex flex-col gap-3">
        <SelectField label={t('billing.colUnit')} value={unitId || null} options={unitsQuery.data ?? []} onChange={setUnitId} />
        <TextField label={t('billing.monthlyAmount')} requiredMark type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label={t('billing.chargeLabel')} value={label} onChange={(e) => setLabel(e.target.value)} />
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
      </div>
    </BottomSheet>
  );
}

function LedgerSheet({ open, communityId, expense, onClose, onDone }: { open: boolean; communityId: string; expense: MaintenanceExpense | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const actions = useBillingActions();
  const isEdit = !!expense;
  const [direction, setDirection] = useState('debit');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState('');
  const [vendor, setVendor] = useState('');

  useEffect(() => {
    if (!open) return;
    setDirection(expense?.direction ?? 'debit');
    setTitle(expense?.title ?? '');
    setAmount(expense?.amount != null ? String(expense.amount) : '');
    setSpentOn(expense?.spentOnUtc ? expense.spentOnUtc.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setVendor(expense?.vendor ?? '');
  }, [open, expense]);

  const submit = useAsyncAction(async () => {
    const amt = Number(amount);
    if (!title.trim() || !Number.isFinite(amt) || amt <= 0 || !spentOn) return;
    await actions.saveExpense({
      communityId,
      direction,
      category: 'other',
      title: title.trim(),
      amount: amt,
      spentOnUtc: new Date(spentOn).toISOString(),
      ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
    }, expense?.id);
    onDone();
  });

  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? t('billing.editLedgerTitle') : t('billing.addLedgerTitle')}
      footer={<PrimaryButton label={isEdit ? t('billing.saveChanges') : t('billing.save')} arrow={false} loading={submit.running} onClick={() => submit.run()} />}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('billing.ledgerDirection')}</div>
          <div className="flex rounded-full bg-muted p-1">
            <button type="button" onClick={() => setDirection('debit')} className={cn('flex-1 rounded-full py-1.5 text-xs font-bold', direction === 'debit' ? 'bg-destructive text-white' : 'text-muted-foreground')}>{t('billing.directionDebit')}</button>
            <button type="button" onClick={() => setDirection('credit')} className={cn('flex-1 rounded-full py-1.5 text-xs font-bold', direction === 'credit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{t('billing.directionCredit')}</button>
          </div>
        </div>
        <TextField label={t('billing.colTitle')} requiredMark value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label={t('billing.amount')} requiredMark type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label={t('billing.spentOn')} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        <TextField label={t('billing.colVendor')} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
      </div>
    </BottomSheet>
  );
}
