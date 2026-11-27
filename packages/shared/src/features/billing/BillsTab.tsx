import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Ban, ShieldCheck, Plus } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { maintenanceBilling, masterData } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useListState } from '@shared/lib/hooks/useListState';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { statusTone } from '@shared/lib/statusTone';
import { EMPTY, formatDate, formatMoney } from '@shared/lib/format';
import { fetchOrgPage, makeCommunityFetch, resolveCommunityLabel, resolveOrgLabel } from '@shared/lib/entityFetchers';
import {
  ALL,
  PAID_STATUS,
  WAIVED_STATUS,
  FALLBACK_STATUSES,
  formatPeriod,
  type Option,
} from './billingConstants';

export function BillsTab({
  effectiveCommunityId,
  effectiveOrgId,
  showCommunityCol,
  showOrgFilter,
  showCommunityFilter,
  filterOrgId,
  filterCommunityId,
  onOrgChange,
  onCommunityChange,
  canRecordPayment,
  canEditBill,
  canApprovePayment,
  canAddBill,
  onPayBill,
  onWaiveBill,
  onReviewApprovals,
  onOpenGenerate,
}: {
  effectiveCommunityId?: string;
  effectiveOrgId?: string;
  showCommunityCol: boolean;
  showOrgFilter: boolean;
  showCommunityFilter: boolean;
  filterOrgId: string | null;
  filterCommunityId: string | null;
  onOrgChange: (orgId: string | null) => void;
  onCommunityChange: (commId: string | null) => void;
  canRecordPayment: boolean;
  canEditBill: boolean;
  canApprovePayment: boolean;
  canAddBill?: boolean;
  onPayBill: (bill: MaintenanceBill) => void;
  onWaiveBill: (bill: MaintenanceBill) => void;
  onReviewApprovals: (communityId: string) => void;
  onOpenGenerate?: () => void;
}) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const list = useListState();
  const { search, page, pageSize, reloadKey, reload } = list;
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState<string>(ALL);

  // Status master data
  const statusesQuery = useAsync((signal) => masterData.list('Maintenance_Bill_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => {
    const data = statusesQuery.data ?? [];
    if (data.length > 0) return data.map((e) => ({ value: e.code, label: e.label }));
    return FALLBACK_STATUSES.map((s) => ({ value: s, label: t(`billing.status.${s}`) }));
  }, [statusesQuery.data, t]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const monthFilterOptions = useMemo<Option[]>(
    () => [
      { value: ALL, label: t('billing.allMonths') },
      ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) })),
    ],
    [t]
  );

  const yearNum = Number.parseInt(periodYear, 10);
  const yearFilter = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 3000 ? yearNum : undefined;

  const billsQuery = useAsync(
    (signal) =>
      maintenanceBilling.listBills(
        { search: search.trim() || undefined, page, pageSize },
        {
          ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
          ...(!effectiveCommunityId && effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
          ...(statusFilter !== ALL ? { status: statusFilter } : {}),
          ...(yearFilter ? { periodYear: yearFilter } : {}),
          ...(periodMonth !== ALL ? { periodMonth: Number.parseInt(periodMonth, 10) } : {}),
        },
        { signal }
      ).catch(() => null),
    [search, effectiveCommunityId, effectiveOrgId, statusFilter, yearFilter, periodMonth, page, pageSize, reloadKey]
  );

  const bills = useMemo(() => billsQuery.data?.items ?? [], [billsQuery.data]);

  const StatusBadge = ({ b }: { b: MaintenanceBill }) => (
    <Badge tone={b.pendingApproval ? 'default' : statusTone(b.status)} className="text-[10px] px-1.5 py-0 rounded-[3px] shrink-0">
      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
      {b.pendingApproval ? t('billing.pendingApproval') : statusLabel(b.status)}
    </Badge>
  );

  const BillRowActions = ({ b }: { b: MaintenanceBill }) => {
    if (b.pendingApproval) {
      if (!canApprovePayment) return <div className="text-[11px] text-muted-foreground">{EMPTY}</div>;
      return (
        <button
          type="button"
          onClick={() => onReviewApprovals(b.communityId)}
          aria-label={t('billing.reviewApproval')}
          className={`flex ${actionSize} items-center justify-center border border-border/80 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 ml-auto`}
        >
          <ShieldCheck className="h-3 w-3" />
        </button>
      );
    }
    if (b.status === PAID_STATUS || b.status === WAIVED_STATUS || (!canRecordPayment && !canEditBill)) {
      return <div className="text-[11px] text-muted-foreground">{EMPTY}</div>;
    }

    return (
      <div className="flex items-center justify-end gap-1">
        {canRecordPayment && (
          <button
            type="button"
            onClick={() => onPayBill(b)}
            aria-label={t('billing.recordPayment')}
            className={`flex ${actionSize} items-center justify-center border border-border/80 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}
          >
            <Wallet className="h-3 w-3" />
          </button>
        )}
        {canEditBill && (
          <button
            type="button"
            onClick={() => onWaiveBill(b)}
            aria-label={t('billing.waive')}
            className={`flex ${actionSize} items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40`}
          >
            <Ban className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  const activeFilters = (statusFilter !== ALL ? 1 : 0) + (periodMonth !== ALL ? 1 : 0) + (yearFilter ? 1 : 0)
    + (showOrgFilter && filterOrgId ? 1 : 0) + (showCommunityFilter && filterCommunityId ? 1 : 0);
  const resetFilters = () => { setStatusFilter(ALL); setPeriodMonth(ALL); setPeriodYear(''); list.resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {showOrgFilter ? (
        <EntitySelect value={filterOrgId} onChange={(v) => { onOrgChange(v); list.resetPage(); }}
          fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel}
          placeholder={t('billing.filterOrg', { defaultValue: 'All Orgs' })} className={filterEntityClass(layout, 'w-36')} />
      ) : null}
      {showCommunityFilter ? (
        <EntitySelect value={filterCommunityId} onChange={(v) => { onCommunityChange(v); list.resetPage(); }}
          fetchPage={makeCommunityFetch(filterOrgId)} resolveLabel={resolveCommunityLabel}
          placeholder={t('billing.allCommunities', { defaultValue: 'All Wings' })} className={filterEntityClass(layout, 'w-36')} />
      ) : null}
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue placeholder={t('billing.allStatuses')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">{t('billing.allStatuses')}</SelectItem>
          {statusOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="number" inputMode="numeric" min={2000} max={3000} value={periodYear}
        onChange={(e) => { setPeriodYear(e.target.value); list.resetPage(); }}
        placeholder={t('billing.periodYearPlaceholder')} className={filterControlClass(layout, 'w-20')} />
      <Select value={periodMonth} onValueChange={(v) => { setPeriodMonth(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue placeholder={t('billing.allMonths')} /></SelectTrigger>
        <SelectContent>
          {monthFilterOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-2.5">
      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('billing.searchPlaceholder') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={(
          <>
            <span className={cn('tabular-nums text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {billsQuery.data?.totalCount ?? 0} {t('billing.tabBills', { defaultValue: 'bills' })}
            </span>
            <div className="flex items-center gap-2">
              {canAddBill && onOpenGenerate ? (
                <Button type="button" onClick={onOpenGenerate}
                  className={cn('font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('billing.generate')}
                </Button>
              ) : null}
              <RefreshButton onClick={reload} loading={billsQuery.loading} />
            </div>
          </>
        )}
      />

      <DataList
        items={bills}
        keyOf={(b) => b.id}
        loading={billsQuery.loading}
        emptyText={t('billing.empty')}
        pagination={{
          page, pageSize, total: billsQuery.data?.totalCount ?? 0, onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
        }}
        renderCard={(b) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight text-foreground">{b.unitNumber ?? b.unitId}</div>
                {showCommunityCol && b.communityName ? <div className="truncate text-xs text-muted-foreground">{b.communityName}</div> : null}
              </div>
              <StatusBadge b={b} />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{t('billing.colAmount')}</div>
                <div className="text-sm font-semibold">{formatMoney(b.amount, { decimals: true })}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{t('billing.colPaid')}</div>
                <div className="text-sm font-semibold text-emerald-600">{formatMoney(b.amountPaid, { decimals: true })}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{t('billing.colDue')}</div>
                <div className="text-sm font-semibold text-rose-600">{formatMoney(b.amountDue, { decimals: true })}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{t('billing.colDueDate')}: {formatDate(b.dueDateUtc)} · {formatPeriod(b.periodYear, b.periodMonth)}</span>
              <BillRowActions b={b} />
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR>
                <TH className="w-10 px-2 py-1.5 text-center text-[10.5px]">#</TH>
                {showCommunityCol ? <TH className="w-36 px-2 py-1.5 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                <TH className="w-28 px-2 py-1.5 text-[10.5px]">{t('billing.colUnit')}</TH>
                <TH className="w-24 px-2 py-1.5 text-[10.5px]">{t('billing.colPeriod')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colAmount')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colPaid')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colDue')}</TH>
                <TH className="w-24 px-2 py-1.5 text-[10.5px]">{t('billing.colDueDate')}</TH>
                <TH className="w-28 px-2 py-1.5 text-[10.5px]">{t('billing.colStatus')}</TH>
                <TH className="w-20 px-2 py-1.5 text-right text-[10.5px]">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {bills.map((b, i) => (
                <TR key={b.id}>
                  <TD className="px-2 py-1 text-center text-[10.5px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  {showCommunityCol ? <TD className="max-w-[140px] truncate px-2 py-1 text-[11px] text-muted-foreground">{b.communityName || EMPTY}</TD> : null}
                  <TD className="px-2 py-1 text-xs font-semibold">{b.unitNumber ?? b.unitId}</TD>
                  <TD className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{formatPeriod(b.periodYear, b.periodMonth)}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums">{formatMoney(b.amount, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-emerald-600">{formatMoney(b.amountPaid, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-rose-600">{formatMoney(b.amountDue, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-[10.5px] text-muted-foreground">{formatDate(b.dueDateUtc)}</TD>
                  <TD className="px-2 py-1"><StatusBadge b={b} /></TD>
                  <TD className="px-2 py-1 text-right"><BillRowActions b={b} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />
    </div>
  );
}
