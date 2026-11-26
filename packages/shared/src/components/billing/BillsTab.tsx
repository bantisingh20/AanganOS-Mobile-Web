import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Wallet, Ban, ShieldCheck, Plus } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/EntitySelect';
import { maintenanceBilling, masterData } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import {
  ALL,
  PAID_STATUS,
  WAIVED_STATUS,
  FALLBACK_STATUSES,
  formatAmount,
  formatPeriod,
  formatDate,
  fetchOrgPage,
  makeCommunityFetch,
  resolveCommunityLabel,
  resolveOrgLabel,
  billTone,
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

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
  const reload = () => setReloadKey((k) => k + 1);

  const StatusBadge = ({ b }: { b: MaintenanceBill }) => (
    <Badge tone={b.pendingApproval ? 'default' : billTone(b.status)} className="text-[10px] px-1.5 py-0 rounded-[3px] shrink-0">
      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
      {b.pendingApproval ? t('billing.pendingApproval') : statusLabel(b.status)}
    </Badge>
  );

  const BillRowActions = ({ b }: { b: MaintenanceBill }) => {
    if (b.pendingApproval) {
      if (!canApprovePayment) return <div className="text-[11px] text-muted-foreground">—</div>;
      return (
        <button
          type="button"
          onClick={() => onReviewApprovals(b.communityId)}
          aria-label={t('billing.reviewApproval')}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 ml-auto"
        >
          <ShieldCheck className="h-3 w-3" />
        </button>
      );
    }
    if (b.status === PAID_STATUS || b.status === WAIVED_STATUS || (!canRecordPayment && !canEditBill)) {
      return <div className="text-[11px] text-muted-foreground">—</div>;
    }

    return (
      <div className="flex items-center justify-end gap-1">
        {canRecordPayment && (
          <button
            type="button"
            onClick={() => onPayBill(b)}
            aria-label={t('billing.recordPayment')}
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <Wallet className="h-3 w-3" />
          </button>
        )}
        {canEditBill && (
          <button
            type="button"
            onClick={() => onWaiveBill(b)}
            aria-label={t('billing.waive')}
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
          >
            <Ban className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[130px] max-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('billing.searchPlaceholder')}
              className="h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background"
            />
          </div>

          {showOrgFilter ? (
            <EntitySelect
              value={filterOrgId}
              onChange={(v) => {
                onOrgChange(v);
                setPage(1);
              }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('billing.filterOrg', { defaultValue: 'All Orgs' })}
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
            />
          ) : null}

          {showCommunityFilter ? (
            <EntitySelect
              value={filterCommunityId}
              onChange={(v) => {
                onCommunityChange(v);
                setPage(1);
              }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.allCommunities', { defaultValue: 'All Wings' })}
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
            />
          ) : null}

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7.5 w-28 rounded-[4px] text-[11px] bg-background px-2">
              <SelectValue placeholder={t('billing.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">{t('billing.allStatuses')}</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={2000}
            max={3000}
            value={periodYear}
            onChange={(e) => {
              setPeriodYear(e.target.value);
              setPage(1);
            }}
            placeholder={t('billing.periodYearPlaceholder')}
            className="h-7.5 w-18 text-[11px] rounded-[4px] bg-background px-2"
          />

          <Select
            value={periodMonth}
            onValueChange={(v) => {
              setPeriodMonth(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7.5 w-26 rounded-[4px] text-[11px] bg-background px-2">
              <SelectValue placeholder={t('billing.allMonths')} />
            </SelectTrigger>
            <SelectContent>
              {monthFilterOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canAddBill && onOpenGenerate ? (
            <Button
              type="button"
              onClick={onOpenGenerate}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('billing.generate')}
            </Button>
          ) : null}
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {billsQuery.data?.totalCount ?? 0} {t('billing.tabBills', { defaultValue: 'bills' })}
          </span>
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-[4px] border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${billsQuery.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data Container: Desktop Table + Mobile Cards */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {bills.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {billsQuery.loading ? t('common.loading') : t('billing.empty')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10 text-center py-1.5 px-2 text-[10.5px]">#</TH>
                    {showCommunityCol ? <TH className="w-36 py-1.5 px-2 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                    <TH className="w-28 py-1.5 px-2 text-[10.5px]">{t('billing.colUnit')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px]">{t('billing.colPeriod')}</TH>
                    <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colAmount')}</TH>
                    <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colPaid')}</TH>
                    <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colDue')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px]">{t('billing.colDueDate')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-[10.5px]">{t('billing.colStatus')}</TH>
                    <TH className="w-20 py-1.5 px-2 text-right text-[10.5px]">{t('orgs.colActions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {bills.map((b, i) => (
                    <TR key={b.id}>
                      <TD className="text-center text-[10.5px] text-muted-foreground py-1 px-2">{(page - 1) * pageSize + i + 1}</TD>
                      {showCommunityCol ? <TD className="text-[11px] text-muted-foreground py-1 px-2 truncate max-w-[140px]">{b.communityName || '—'}</TD> : null}
                      <TD className="text-xs font-semibold py-1 px-2">{b.unitNumber ?? b.unitId}</TD>
                      <TD className="text-[11px] text-muted-foreground font-mono py-1 px-2">{formatPeriod(b.periodYear, b.periodMonth)}</TD>
                      <TD className="text-right text-xs tabular-nums font-semibold py-1 px-2">₹{formatAmount(b.amount)}</TD>
                      <TD className="text-right text-xs tabular-nums text-emerald-600 font-semibold py-1 px-2">₹{formatAmount(b.amountPaid)}</TD>
                      <TD className="text-right text-xs tabular-nums font-semibold text-rose-600 py-1 px-2">₹{formatAmount(b.amountDue)}</TD>
                      <TD className="text-[10.5px] text-muted-foreground py-1 px-2">{formatDate(b.dueDateUtc)}</TD>
                      <TD className="py-1 px-2"><StatusBadge b={b} /></TD>
                      <TD className="py-1 px-2 text-right"><BillRowActions b={b} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border/60">
              {bills.map((b) => (
                <div key={b.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight text-foreground">{b.unitNumber ?? b.unitId}</div>
                      {showCommunityCol && b.communityName ? (
                        <div className="text-[10px] text-muted-foreground truncate">{b.communityName}</div>
                      ) : null}
                    </div>
                    <StatusBadge b={b} />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 rounded-[4px] bg-muted/40 p-1.5 text-center">
                    <div>
                      <div className="text-[9.5px] uppercase text-muted-foreground">{t('billing.colAmount')}</div>
                      <div className="text-[11px] font-semibold">₹{formatAmount(b.amount)}</div>
                    </div>
                    <div>
                      <div className="text-[9.5px] uppercase text-muted-foreground">{t('billing.colPaid')}</div>
                      <div className="text-[11px] font-semibold text-emerald-600">₹{formatAmount(b.amountPaid)}</div>
                    </div>
                    <div>
                      <div className="text-[9.5px] uppercase text-muted-foreground">{t('billing.colDue')}</div>
                      <div className="text-[11px] font-semibold text-rose-600">₹{formatAmount(b.amountDue)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] pt-0.5">
                    <span className="text-muted-foreground">Due: {formatDate(b.dueDateUtc)} · {formatPeriod(b.periodYear, b.periodMonth)}</span>
                    <BillRowActions b={b} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(billsQuery.data?.totalCount ?? 0) > 0 ? (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={billsQuery.data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
