import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { FilterBar, DataList, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { CommonEntitySelector } from '@shared/components/form/CommonEntitySelector';
import { maintenanceBilling, masterData } from '@shared/services';
import type { MaintenanceExpense } from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { tryToast } from '@shared/lib/withToast';
import { useListState } from '@shared/lib/hooks/useListState';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { EMPTY, formatDate, formatMoney } from '@shared/lib/format';
import type { Option } from './billingConstants';
import { ExpenseFormDialog } from './ExpenseFormDialog';

export function ExpensesTab({
  communityId,
  organizationId,
  adding = false,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onCloseAdd,
  onCommunityChange,
  onOrgChange,
}: {
  communityId?: string;
  organizationId?: string;
  adding?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onCloseAdd?: () => void;
  onCommunityChange?: (communityId: string | null) => void;
  onOrgChange?: (orgId: string | null) => void;
}) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const scope = useScope();
  const [internalOrgId, setInternalOrgId] = useState<string | null>(organizationId ?? scope.organizationId ?? null);
  const [internalCommunityId, setInternalCommunityId] = useState<string | null>(communityId ?? scope.scopedCommunityId ?? null);
  const [internalUnitId, setInternalUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId !== undefined) setInternalOrgId(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (communityId !== undefined) setInternalCommunityId(communityId);
  }, [communityId]);

  const effectiveOrgId = internalOrgId || (scope.organizationId ?? undefined);
  const effectiveCommunityId = internalCommunityId || (scope.scopedCommunityId ?? undefined);

  const { search, setSearch, reloadKey, reload } = useListState();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [internalAdding, setInternalAdding] = useState(false);
  const [editing, setEditing] = useState<MaintenanceExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceExpense | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const categoriesQuery = useAsync((signal) => masterData.list('Maintenance_Expense_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code.replace(/_/g, ' ');

  const query = useAsync(
    (signal) =>
      effectiveCommunityId || effectiveOrgId
        ? maintenanceBilling.listExpenses(effectiveCommunityId ?? undefined, effectiveOrgId ?? undefined, { signal }).catch(() => [] as MaintenanceExpense[])
        : Promise.resolve([] as MaintenanceExpense[]),
    [effectiveCommunityId, effectiveOrgId, reloadKey]
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const filteredItems = useMemo(() => {
    let list = items;
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((e) => (e.title ?? '').toLowerCase().includes(s) || (e.vendor ?? '').toLowerCase().includes(s));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    return list;
  }, [items, search, categoryFilter]);

  const totalSpent = useMemo(() => filteredItems.filter((e) => e.direction !== 'credit').reduce((s, e) => s + e.amount, 0), [filteredItems]);
  const totalReceived = useMemo(() => filteredItems.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amount, 0), [filteredItems]);
  const netCashflow = totalReceived - totalSpent;


  const isAddingOpen = adding || internalAdding;
  const closeAdd = () => {
    setInternalAdding(false);
    onCloseAdd?.();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => maintenanceBilling.deleteExpense(confirmDelete.id), t('billing.expenseRemoved'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const iconBtn = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const rowActions = (e: MaintenanceExpense) => (
    <div className="flex items-center justify-end gap-1">
      {canEdit ? (
        <button type="button" onClick={() => setEditing(e)} aria-label={t('billing.edit')}
          className={cn('flex items-center justify-center border border-border/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', iconBtn)}>
          <Pencil className={compact ? 'h-4 w-4' : 'h-3 w-3'} />
        </button>
      ) : null}
      {canDelete ? (
        <button type="button" onClick={() => setConfirmDelete(e)} aria-label={t('billing.delete')}
          className={cn('flex items-center justify-center border border-rose-300 text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40', iconBtn)}>
          <Trash2 className={compact ? 'h-4 w-4' : 'h-3 w-3'} />
        </button>
      ) : null}
    </div>
  );

  const renderFilters = (layout: FilterLayout) => (
    <>
      <CommonEntitySelector
        level={3}
        selectedOrgId={effectiveOrgId}
        selectedCommunityId={effectiveCommunityId}
        selectedUnitId={internalUnitId}
        onOrgChange={(o) => {
          setInternalOrgId(o);
          setInternalCommunityId(null);
          setInternalUnitId(null);
          onOrgChange?.(o);
          onCommunityChange?.(null);
        }}
        onCommunityChange={(c) => {
          setInternalCommunityId(c);
          setInternalUnitId(null);
          onCommunityChange?.(c);
        }}
        onUnitChange={setInternalUnitId}
        showLabels={layout === 'sheet'}
        size={layout === 'sheet' ? 'default' : 'sm'}
        className={layout === 'sheet' ? 'flex-col !items-stretch [&>div]:w-full' : ''}
      />
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue placeholder={t('billing.allCategories', { defaultValue: 'All Categories' })} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">{t('billing.allCategories', { defaultValue: 'All Categories' })}</SelectItem>
          {categoryOptions.map((c) => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-2.5">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t('billing.searchExpenses', { defaultValue: 'Search expenses...' }) }}
        filters={renderFilters}
        activeCount={(categoryFilter !== 'all' ? 1 : 0) + (internalUnitId ? 1 : 0)}
        onReset={() => { setCategoryFilter('all'); setInternalUnitId(null); }}
        trailing={(
          <>
            <span className={cn('tabular-nums text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('billing.expensesFound', { count: filteredItems.length, defaultValue: '{{count}} expense(s) found' })}
            </span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      {/* Stat summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border/80 bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('billing.totalSpentStat')}</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-rose-600">{formatMoney(totalSpent, { decimals: true })}</div>
        </div>
        <div className="rounded-md border border-border/80 bg-card p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('billing.totalReceivedStat')}</div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-600">{formatMoney(totalReceived, { decimals: true })}</div>
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-md border border-border/80 bg-card p-2.5 sm:col-span-1">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('billing.netCashflow', { defaultValue: 'Net Cashflow' })}</div>
            <div className={cn('mt-0.5 text-base font-bold tabular-nums', netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {formatMoney(netCashflow, { decimals: true })}
            </div>
          </div>
          {canAdd ? (
            <Button type="button" onClick={() => setInternalAdding(true)}
              className={cn('font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('billing.addLedger')}
            </Button>
          ) : null}
        </div>
      </div>

      <DataList
        items={filteredItems}
        keyOf={(e) => e.id}
        loading={query.loading}
        emptyText={!effectiveOrgId && !effectiveCommunityId
          ? t('billing.selectScopeForExpenses', { defaultValue: 'Select a society and wing to view expenses' })
          : t('billing.empty')}
        renderCard={(e) => {
          const isCredit = e.direction === 'credit';
          return (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight text-foreground">{e.title}</div>
                  {!effectiveCommunityId && e.communityName ? <div className="text-xs text-muted-foreground">{e.communityName}</div> : null}
                </div>
                <Badge tone={isCredit ? 'success' : 'danger'} className="shrink-0 rounded-[3px] px-1.5 py-0 text-[10px]">
                  {isCredit ? `+ ${t('billing.income', { defaultValue: 'Income' })}` : `- ${t('billing.expense', { defaultValue: 'Expense' })}`}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{categoryLabel(e.category)} · {formatDate(e.spentOnUtc)}</span>
                <span className={cn('text-sm font-bold tabular-nums', isCredit ? 'text-emerald-600' : 'text-rose-600')}>
                  {isCredit ? '+' : '-'}{formatMoney(e.amount, { decimals: true })}
                </span>
              </div>
              {canEdit || canDelete ? (
                <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                  <span className="truncate text-muted-foreground">{e.vendor ? `${t('billing.colVendor')}: ${e.vendor}` : ''}</span>
                  {rowActions(e)}
                </div>
              ) : null}
            </>
          );
        }}
        renderTable={() => (
          <Table>
            <THead>
              <TR>
                {!effectiveCommunityId ? <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colTitle')}</TH>
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colCategory')}</TH>
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.direction')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colAmount')}</TH>
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.spentOn')}</TH>
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colVendor')}</TH>
                {canEdit || canDelete ? <TH className="w-20 px-2 py-1.5 text-right text-[10.5px]">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {filteredItems.map((e) => {
                const isCredit = e.direction === 'credit';
                return (
                  <TR key={e.id}>
                    {!effectiveCommunityId ? <TD className="px-2 py-1 text-[11px] text-muted-foreground">{e.communityName || EMPTY}</TD> : null}
                    <TD className="px-2 py-1 text-xs font-semibold">{e.title}</TD>
                    <TD className="px-2 py-1"><Badge tone="default" className="rounded-[3px] px-1.5 py-0 text-[10px]">{categoryLabel(e.category)}</Badge></TD>
                    <TD className="px-2 py-1">
                      <Badge tone={isCredit ? 'success' : 'danger'} className="rounded-[3px] px-1.5 py-0 text-[10px]">
                        <span className="flex items-center gap-1 font-semibold">
                          {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {isCredit ? t('billing.income', { defaultValue: 'Income' }) : t('billing.expense', { defaultValue: 'Expense' })}
                        </span>
                      </Badge>
                    </TD>
                    <TD className={cn('px-2 py-1 text-right text-xs font-semibold tabular-nums', isCredit ? 'text-emerald-600' : 'text-rose-600')}>
                      {isCredit ? '+' : '-'}{formatMoney(e.amount, { decimals: true })}
                    </TD>
                    <TD className="px-2 py-1 text-[10.5px] text-muted-foreground">{formatDate(e.spentOnUtc)}</TD>
                    <TD className="px-2 py-1 text-[11px] text-muted-foreground">{e.vendor || EMPTY}</TD>
                    {canEdit || canDelete ? <TD className="px-2 py-1 text-right">{rowActions(e)}</TD> : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      />

      <ExpenseFormDialog
        open={isAddingOpen || !!editing}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        expense={editing}
        categoryOptions={categoryOptions}
        onClose={() => { closeAdd(); setEditing(null); }}
        onSaved={() => {
          closeAdd();
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
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default ExpensesTab;
