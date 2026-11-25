import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { maintenanceBilling, masterData } from '@shared/services';
import type { MaintenanceExpense } from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { formatAmount, formatDate, type Option } from './billingConstants';
import { ExpenseFormDialog } from './ExpenseFormDialog';

export function ExpensesTab({
  communityId,
  organizationId,
  adding = false,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onCloseAdd,
}: {
  communityId?: string;
  organizationId?: string;
  adding?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onCloseAdd?: () => void;
}) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [internalAdding, setInternalAdding] = useState(false);
  const [editing, setEditing] = useState<MaintenanceExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceExpense | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const categoriesQuery = useAsync((signal) => masterData.list('Maintenance_Expense_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code.replace(/_/g, ' ');

  const query = useAsync(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listExpenses(communityId, organizationId, { signal }).catch(() => [] as MaintenanceExpense[])
        : Promise.resolve([] as MaintenanceExpense[]),
    [communityId, organizationId, reloadKey]
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const totalSpent = useMemo(() => items.filter((e) => e.direction !== 'credit').reduce((s, e) => s + e.amount, 0), [items]);
  const totalReceived = useMemo(() => items.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amount, 0), [items]);
  const reload = () => setReloadKey((k) => k + 1);

  const isAddingOpen = adding || internalAdding;
  const closeAdd = () => {
    setInternalAdding(false);
    onCloseAdd?.();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.deleteExpense(confirmDelete.id);
      toast.success(t('billing.expenseRemoved'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!communityId && !organizationId) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-8 text-center text-xs text-muted-foreground">
        {t('billing.selectCommunityExpenses')}
      </div>
    );
  }

  const netCashflow = totalReceived - totalSpent;

  return (
    <div className="space-y-2.5">
      {/* Stat Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border/80 bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('billing.totalSpentStat')}</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-rose-600">₹{formatAmount(totalSpent)}</div>
        </div>
        <div className="rounded-md border border-border/80 bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('billing.totalReceivedStat')}</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-600">₹{formatAmount(totalReceived)}</div>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-md border border-border/80 bg-card p-2.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net Cashflow</div>
            <div className={`mt-0.5 text-base font-bold tabular-nums ${netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{formatAmount(netCashflow)}
            </div>
          </div>
          {canAdd ? (
            <Button
              type="button"
              onClick={() => setInternalAdding(true)}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('billing.addLedger')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Container: Desktop Table + Mobile Cards */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {query.loading ? t('common.loading') : t('billing.empty')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    {!communityId ? <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colTitle')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colCategory')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.direction')}</TH>
                    <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colAmount')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.spentOn')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colVendor')}</TH>
                    {canEdit || canDelete ? <TH className="w-20 py-1.5 px-2 text-right text-[10.5px]">{t('orgs.colActions')}</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {items.map((e) => {
                    const isCredit = e.direction === 'credit';
                    return (
                      <TR key={e.id}>
                        {!communityId ? (
                          <TD className="text-[11px] text-muted-foreground py-1 px-2">{e.communityName || '—'}</TD>
                        ) : null}
                        <TD className="text-xs font-semibold py-1 px-2">{e.title}</TD>
                        <TD className="py-1 px-2">
                          <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                            {categoryLabel(e.category)}
                          </Badge>
                        </TD>
                        <TD className="py-1 px-2">
                          <Badge tone={isCredit ? 'success' : 'danger'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                            {isCredit ? (
                              <span className="flex items-center gap-1 font-semibold">
                                <ArrowDownLeft className="h-3 w-3" /> Income
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold">
                                <ArrowUpRight className="h-3 w-3" /> Expense
                              </span>
                            )}
                          </Badge>
                        </TD>
                        <TD className={`text-right text-xs tabular-nums font-semibold py-1 px-2 ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}₹{formatAmount(e.amount)}
                        </TD>
                        <TD className="text-[10.5px] text-muted-foreground py-1 px-2">{formatDate(e.spentOnUtc)}</TD>
                        <TD className="text-[11px] text-muted-foreground py-1 px-2">{e.vendor || '—'}</TD>
                        {canEdit || canDelete ? (
                          <TD className="py-1 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => setEditing(e)}
                                  aria-label={t('billing.edit')}
                                  className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(e)}
                                  aria-label={t('billing.delete')}
                                  className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              ) : null}
                            </div>
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border/60">
              {items.map((e) => {
                const isCredit = e.direction === 'credit';
                return (
                  <div key={e.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground leading-tight">{e.title}</div>
                        {!communityId && e.communityName ? (
                          <div className="text-[10px] text-muted-foreground">{e.communityName}</div>
                        ) : null}
                      </div>
                      <Badge tone={isCredit ? 'success' : 'danger'} className="text-[9.5px] px-1 py-0 rounded-[3px] shrink-0">
                        {isCredit ? '+ Income' : '- Expense'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10.5px] text-muted-foreground">{categoryLabel(e.category)} · {formatDate(e.spentOnUtc)}</span>
                      <span className={`font-bold tabular-nums ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}₹{formatAmount(e.amount)}
                      </span>
                    </div>

                    {canEdit || canDelete ? (
                      <div className="flex items-center justify-between border-t border-border/50 pt-1 text-[10px]">
                        <span className="text-muted-foreground">{e.vendor ? `Vendor: ${e.vendor}` : ''}</span>
                        <div className="flex items-center gap-1">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => setEditing(e)}
                              aria-label={t('billing.edit')}
                              className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(e)}
                              aria-label={t('billing.delete')}
                              className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ExpenseFormDialog
        open={isAddingOpen}
        communityId={communityId}
        organizationId={organizationId}
        expense={null}
        categoryOptions={categoryOptions}
        onClose={closeAdd}
        onSaved={() => {
          closeAdd();
          reload();
        }}
      />

      <ExpenseFormDialog
        open={!!editing}
        communityId={communityId}
        organizationId={organizationId}
        expense={editing}
        categoryOptions={categoryOptions}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('billing.delete')}
        description={t('billing.expenseDeleteConfirm')}
        confirmLabel={t('billing.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
