import { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  RefreshCw,
  Table as TableIcon,
  LayoutGrid,
  Wallet,
  Ban,
  Trash2,
  Pencil,
  ShieldCheck,
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';

import { maintenanceBilling, masterData, organizations, communities, units } from '@shared/services';
import type {
  MaintenanceBill,
  MaintenanceCharge,
  MaintenanceExpense,
  PendingPayment,
} from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { usePermission } from '@shared/lib/usePermission';
import { toFormError } from '@shared/api/errors';

export interface MaintenanceBillingViewProps {
  mode?: 'admin' | 'mobile';
  permKey?: string;
  onBack?: () => void;
}

type Tab = 'bills' | 'charges' | 'expenses' | 'dashboard';
type Option = { value: string; label: string };

const ALL = '__all__';
const PAID_STATUS = 'paid';
const WAIVED_STATUS = 'waived';
const FALLBACK_STATUSES = ['unpaid', 'partially_paid', 'paid', 'waived', 'overdue'];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

function formatAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}

function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}

async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try {
    const c = await communities.get(id, { signal });
    return c.name;
  } catch {
    return null;
  }
}

async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try {
    const o = await organizations.get(id, { signal });
    return o.name;
  } catch {
    return null;
  }
}

export function MaintenanceBillingView({ mode = 'admin', permKey, onBack }: MaintenanceBillingViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const isSmall = useIsSmallScreen();
  const isMobileMode = mode === 'mobile';
  const handleBack = onBack ?? (() => navigate(-1));

  // Determine permission key: Admin ('admin.maintenance' / 'admin.maintenance-billing') vs App ('billing')
  const effectivePermKey = permKey || (isMobileMode ? 'billing' : 'admin.maintenance');
  const perm = usePermission(effectivePermKey);
  const chargePerm = usePermission('MaintenanceCharge');
  const expensePerm = usePermission('MaintenanceExpense');
  const paymentPerm = usePermission('MaintenancePayment');

  const isAdmin = perm.isAdmin || scope.isPowerUser || scope.isOrgAdmin;

  const canAddBill = isAdmin || perm.canAdd;
  const canEditBill = isAdmin || perm.canEdit;
  const canRecordPayment = isAdmin || paymentPerm.canAdd || perm.canEdit;
  const canApprovePayment = isAdmin || paymentPerm.canApprove || perm.canApprove;

  const canAddCharge = isAdmin || chargePerm.canAdd || perm.canAdd;
  const canEditCharge = isAdmin || chargePerm.canEdit || perm.canEdit;
  const canDeleteCharge = isAdmin || chargePerm.canDelete || chargePerm.canEdit || perm.canDelete;

  const canAddExpense = isAdmin || expensePerm.canAdd || perm.canAdd;
  const canEditExpense = isAdmin || expensePerm.canEdit || perm.canEdit;
  const canDeleteExpense = isAdmin || expensePerm.canDelete || perm.canDelete;

  const [tab, setTab] = useState<Tab>('bills');
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(scope.organizationId ?? null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(scope.scopedCommunityId ?? null);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobileMode ? 50 : 10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const effectiveView = isSmall ? 'cards' : view;

  // Dialog triggers
  const [generating, setGenerating] = useState(false);
  const [charging, setCharging] = useState(false);
  const [bulkCharging, setBulkCharging] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [approvalsCommunityId, setApprovalsCommunityId] = useState<string | null>(null);
  const [payingBill, setPayingBill] = useState<MaintenanceBill | null>(null);
  const [confirmWaive, setConfirmWaive] = useState<MaintenanceBill | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Status master data
  const statusesQuery = useAsync((signal) => masterData.list('Maintenance_Bill_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => {
    const data = statusesQuery.data ?? [];
    if (data.length > 0) return data.map((e) => ({ value: e.code, label: e.label }));
    return FALLBACK_STATUSES.map((s) => ({ value: s, label: t(`billing.status.${s}`) }));
  }, [statusesQuery.data, t]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;
  const filterStatusOptions = useMemo<Option[]>(() => [{ value: ALL, label: t('billing.allStatuses') }, ...statusOptions], [statusOptions, t]);
  const monthFilterOptions = useMemo<Option[]>(() => [{ value: ALL, label: t('billing.allMonths') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) }))], [t]);

  // Resolution of effective Community & Organization scopes:
  // If community is selected -> community takes precedence.
  // If only organization is selected -> passes organizationId and no communityId to view all communities of that org!
  const effectiveCommunityId = filterCommunityId || (scope.scopedCommunityId ?? undefined);
  const effectiveOrgId = filterOrgId || (scope.organizationId ?? undefined);

  const yearNum = Number.parseInt(periodYear, 10);
  const yearFilter = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 3000 ? yearNum : undefined;

  // Bills Query
  const billsQuery = useAsync(
    (signal) => maintenanceBilling.listBills(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
        ...(!effectiveCommunityId && effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        ...(statusFilter !== ALL ? { status: statusFilter } : {}),
        ...(yearFilter ? { periodYear: yearFilter } : {}),
        ...(periodMonth !== ALL ? { periodMonth: Number.parseInt(periodMonth, 10) } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, effectiveOrgId, statusFilter, yearFilter, periodMonth, page, pageSize, reloadKey],
  );

  const bills = useMemo(() => billsQuery.data?.items ?? [], [billsQuery.data]);
  const showCommunityCol = !effectiveCommunityId || scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const doWaive = async () => {
    if (!confirmWaive) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.waiveBill(confirmWaive.id);
      toast.success(t('billing.waived'));
      setConfirmWaive(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const StatusBadge = ({ b }: { b: MaintenanceBill }) => {
    if (b.pendingApproval) {
      return (
        <Badge tone="default">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {t('billing.pendingApproval')}
        </Badge>
      );
    }
    const tone = b.status === PAID_STATUS ? 'success' : b.status === WAIVED_STATUS ? 'muted' : b.status === 'overdue' ? 'danger' : 'default';
    return (
      <Badge tone={tone}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {statusLabel(b.status)}
      </Badge>
    );
  };

  const BillRowActions = ({ b }: { b: MaintenanceBill }) => {
    if (b.pendingApproval) {
      if (!canApprovePayment) return <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">—</div>;
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setApprovalsCommunityId(b.communityId)}
            aria-label={t('billing.reviewApproval')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        </div>
      );
    }
    const settled = b.status === PAID_STATUS || b.status === WAIVED_STATUS;
    if (settled) return <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">—</div>;

    if (!canRecordPayment && !canEditBill) {
      return <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">—</div>;
    }

    return (
      <div className="flex items-center justify-end gap-1.5">
        {canRecordPayment ? (
          <button
            type="button"
            onClick={() => setPayingBill(b)}
            aria-label={t('billing.recordPayment')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <Wallet className="h-4 w-4" />
          </button>
        ) : null}
        {canEditBill ? (
          <button
            type="button"
            onClick={() => setConfirmWaive(b)}
            aria-label={t('billing.waive')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
          >
            <Ban className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bills', label: t('billing.tabBills') },
    { key: 'charges', label: t('billing.tabCharges') },
    { key: 'expenses', label: t('billing.tabExpenses') },
    { key: 'dashboard', label: t('billing.tabDashboard') },
  ];

  // Common Dialogs
  const commonDialogs = (
    <>
      <GenerateBillsDialog
        open={generating}
        presetCommunityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setGenerating(false)}
        onDone={() => {
          setGenerating(false);
          reload();
        }}
      />
      <RecordPaymentDialog
        bill={payingBill}
        methodOptions={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`billing.method.${m}`) }))}
        onClose={() => setPayingBill(null)}
        onDone={() => {
          setPayingBill(null);
          reload();
        }}
      />
      <SetChargeDialog
        open={charging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setCharging(false)}
        onDone={() => {
          setCharging(false);
          reload();
        }}
      />
      <BulkSetChargeDialog
        open={bulkCharging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setBulkCharging(false)}
        onDone={() => {
          setBulkCharging(false);
          reload();
        }}
      />
      <ApprovalsDialog
        communityId={approvalsCommunityId}
        organizationId={effectiveOrgId}
        canApprove={canApprovePayment}
        onClose={() => setApprovalsCommunityId(null)}
        onDone={() => {
          setApprovalsCommunityId(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!confirmWaive}
        tone="danger"
        title={t('billing.waiveConfirmTitle')}
        description={confirmWaive ? t('billing.waiveConfirmDesc', { unit: confirmWaive.unitNumber ?? confirmWaive.unitId, amount: formatAmount(confirmWaive.amountDue) }) : ''}
        confirmLabel={t('billing.waive')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doWaive}
        onClose={() => setConfirmWaive(null)}
      />
      <Toaster position="top-center" richColors />
    </>
  );

  // MOBILE UI MODE
  if (isMobileMode) {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-background">
        <header className="safe-top flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-3 text-primary-foreground">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold leading-tight">{t('billing.title')}</div>
            <div className="truncate text-xs text-primary-foreground/80">{t('billing.subtitle')}</div>
          </div>
          {tab === 'bills' && canAddBill ? (
            <button
              type="button"
              onClick={() => setGenerating(true)}
              aria-label={t('billing.generate')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : tab === 'charges' && canAddCharge ? (
            <button
              type="button"
              onClick={() => setCharging(true)}
              aria-label={t('billing.setCharge')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : tab === 'expenses' && canAddExpense ? (
            <button
              type="button"
              onClick={() => setAddingExpense(true)}
              aria-label={t('billing.addLedger')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </header>

        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Organization & Community Selection Filters in Mobile */}
          {scope.showOrgFilter || scope.showCommunityFilter ? (
            <div className="flex flex-col gap-2">
              {scope.showOrgFilter ? (
                <EntitySelect
                  value={filterOrgId}
                  onChange={(v) => {
                    setFilterOrgId(v);
                    setFilterCommunityId(null);
                    setPage(1);
                  }}
                  fetchPage={fetchOrgPage}
                  resolveLabel={resolveOrgLabel}
                  placeholder={t('billing.filterOrg', { defaultValue: 'Select Organization' })}
                />
              ) : null}
              {scope.showCommunityFilter ? (
                <EntitySelect
                  value={filterCommunityId}
                  onChange={(v) => {
                    setFilterCommunityId(v);
                    setPage(1);
                  }}
                  fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
                  resolveLabel={resolveCommunityLabel}
                  placeholder={t('billing.allCommunities', { defaultValue: 'All Communities' })}
                />
              ) : null}
            </div>
          ) : null}

          {/* Pill Tabs */}
          <div className="flex rounded-full bg-muted p-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={`flex-1 rounded-full py-1.5 text-xs font-bold transition-colors ${
                  tab === tb.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {tab === 'bills' && (
            <div className="flex flex-col gap-3">
              {billsQuery.loading && bills.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : bills.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{t('billing.empty')}</div>
              ) : (
                bills.map((b) => (
                  <article key={b.id} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm border border-border/60">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-bold leading-tight">{b.unitNumber ?? b.unitId}</div>
                        {showCommunityCol && b.communityName ? (
                          <div className="text-xs text-muted-foreground">{b.communityName}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-0.5">{formatPeriod(b.periodYear, b.periodMonth)}</div>
                      </div>
                      <StatusBadge b={b} />
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('billing.colAmount')}: </span>
                        <span className="font-bold text-foreground">₹{formatAmount(b.amount)}</span>
                      </div>
                      {b.amountDue > 0 ? (
                        <div>
                          <span className="text-muted-foreground">{t('billing.colDue')}: </span>
                          <span className="font-bold text-rose-600">₹{formatAmount(b.amountDue)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="text-[11px] text-muted-foreground">Due: {formatDate(b.dueDateUtc)}</span>
                      <BillRowActions b={b} />
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === 'charges' && (
            <ChargesTab
              communityId={effectiveCommunityId}
              organizationId={effectiveOrgId}
              canAdd={canAddCharge}
              canEdit={canEditCharge}
              canDelete={canDeleteCharge}
              onOpenSet={() => setCharging(true)}
              onOpenBulk={() => setBulkCharging(true)}
            />
          )}

          {tab === 'expenses' && (
            <ExpensesTab
              communityId={effectiveCommunityId}
              organizationId={effectiveOrgId}
              adding={addingExpense}
              canAdd={canAddExpense}
              canEdit={canEditExpense}
              canDelete={canDeleteExpense}
              onCloseAdd={() => setAddingExpense(false)}
            />
          )}

          {tab === 'dashboard' && (
            <CollectionDashboard
              communityId={effectiveCommunityId}
              organizationId={effectiveOrgId}
              showOrg={!effectiveCommunityId}
            />
          )}
        </div>

        {commonDialogs}
      </div>
    );
  }

  // ADMIN UI MODE
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Banner Card */}
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex flex-col gap-3 py-3.5 pl-4 pr-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('billing.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('billing.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {canApprovePayment ? (
              <Button
                variant="outline"
                onClick={() => setApprovalsCommunityId(effectiveCommunityId ?? '')}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('billing.reviewApproval')}
              </Button>
            ) : null}
            {canAddCharge ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setBulkCharging(true)}
                  className="h-8 gap-1.5 rounded-lg text-xs"
                >
                  {t('billing.bulkSet')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCharging(true)}
                  className="h-8 gap-1.5 rounded-lg text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('billing.setCharge')}
                </Button>
              </>
            ) : null}
            {canAddBill ? (
              <Button
                onClick={() => setGenerating(true)}
                className="h-8 gap-1.5 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('billing.generate')}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => {
              setTab(tb.key);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === tb.key
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Filter Card */}
      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'bills' ? (
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('billing.searchPlaceholder')}
                className="h-9 max-w-xs pl-9 text-sm"
              />
            </div>
          ) : null}

          {/* Organization filter */}
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => {
                setFilterOrgId(v);
                setFilterCommunityId(null);
                setPage(1);
              }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('billing.filterOrg', { defaultValue: 'All Organizations' })}
            />
          ) : null}

          {/* Community filter */}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => {
                setFilterCommunityId(v);
                setPage(1);
              }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.allCommunities', { defaultValue: 'All Communities' })}
            />
          ) : null}

          {/* Status, Year, Month filters for Bills Tab */}
          {tab === 'bills' ? (
            <>
              <SelectField
                className="w-36"
                value={statusFilter}
                options={filterStatusOptions}
                placeholder={t('billing.allStatuses')}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
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
                className="h-9 w-24 text-sm"
              />
              <SelectField
                className="w-32"
                value={periodMonth}
                options={monthFilterOptions}
                placeholder={t('billing.allMonths')}
                onChange={(v) => {
                  setPeriodMonth(v);
                  setPage(1);
                }}
              />
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'bills' ? (
            <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
              <button
                type="button"
                onClick={() => setView('table')}
                aria-label="Table view"
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('cards')}
                aria-label="Card view"
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600"
          >
            <RefreshCw className={`h-4 w-4 ${billsQuery.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {/* Main Tab Content */}
      {tab === 'bills' && (
        <>
          {bills.length === 0 ? (
            <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {billsQuery.loading ? t('common.loading') : t('billing.empty')}
            </Card>
          ) : effectiveView === 'table' ? (
            <Card className="overflow-hidden rounded-2xl p-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-14 text-center">#</TH>
                    {showCommunityCol ? <TH className="w-40">{t('billing.colCommunity')}</TH> : null}
                    <TH className="w-32">{t('billing.colUnit')}</TH>
                    <TH className="w-28">{t('billing.colPeriod')}</TH>
                    <TH className="text-right">{t('billing.colAmount')}</TH>
                    <TH className="text-right">{t('billing.colPaid')}</TH>
                    <TH className="text-right">{t('billing.colDue')}</TH>
                    <TH className="w-28">{t('billing.colDueDate')}</TH>
                    <TH className="w-32">{t('billing.colStatus')}</TH>
                    <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {bills.map((b, i) => (
                    <TR key={b.id}>
                      <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                      {showCommunityCol ? <TD className="text-[12px] text-muted-foreground">{b.communityName || '—'}</TD> : null}
                      <TD className="text-[13px] font-medium">{b.unitNumber ?? b.unitId}</TD>
                      <TD className="text-[12px] text-muted-foreground">{formatPeriod(b.periodYear, b.periodMonth)}</TD>
                      <TD className="text-right text-[12px] tabular-nums font-semibold">₹{formatAmount(b.amount)}</TD>
                      <TD className="text-right text-[12px] tabular-nums text-emerald-600">₹{formatAmount(b.amountPaid)}</TD>
                      <TD className="text-right text-[12px] tabular-nums font-semibold text-rose-600">₹{formatAmount(b.amountDue)}</TD>
                      <TD className="text-[11px] text-muted-foreground">{formatDate(b.dueDateUtc)}</TD>
                      <TD><StatusBadge b={b} /></TD>
                      <TD><BillRowActions b={b} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {bills.map((b) => (
                <Card key={b.id} className="flex flex-col gap-3 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{b.unitNumber ?? b.unitId}</div>
                      {showCommunityCol ? <div className="text-[11px] text-muted-foreground">{b.communityName || '—'}</div> : null}
                    </div>
                    <StatusBadge b={b} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">{t('billing.colAmount')}</div>
                      <div className="text-xs font-semibold">₹{formatAmount(b.amount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">{t('billing.colPaid')}</div>
                      <div className="text-xs font-semibold text-emerald-600">₹{formatAmount(b.amountPaid)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">{t('billing.colDue')}</div>
                      <div className="text-xs font-semibold text-rose-600">₹{formatAmount(b.amountDue)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">Due: {formatDate(b.dueDateUtc)}</span>
                    <BillRowActions b={b} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {(billsQuery.data?.totalCount ?? 0) > 0 ? (
            <Card className="rounded-xl p-1">
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
            </Card>
          ) : null}
        </>
      )}

      {tab === 'charges' && (
        <ChargesTab
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          canAdd={canAddCharge}
          canEdit={canEditCharge}
          canDelete={canDeleteCharge}
          onOpenSet={() => setCharging(true)}
          onOpenBulk={() => setBulkCharging(true)}
        />
      )}

      {tab === 'expenses' && (
        <ExpensesTab
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          adding={addingExpense}
          canAdd={canAddExpense}
          canEdit={canEditExpense}
          canDelete={canDeleteExpense}
          onCloseAdd={() => setAddingExpense(false)}
        />
      )}

      {tab === 'dashboard' && (
        <CollectionDashboard
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          showOrg={!effectiveCommunityId}
        />
      )}

      {commonDialogs}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-TAB: Charges
// -------------------------------------------------------------
function ChargesTab({
  communityId,
  organizationId,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onOpenSet,
  onOpenBulk,
}: {
  communityId?: string;
  organizationId?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpenSet?: () => void;
  onOpenBulk?: () => void;
}) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceCharge | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const query = useAsync(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listCharges(communityId, organizationId, { signal }).catch(() => [] as MaintenanceCharge[])
        : Promise.resolve([] as MaintenanceCharge[]),
    [communityId, organizationId, reloadKey],
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.deactivateCharge(confirmDelete.id);
      toast.success(t('billing.chargeDeactivated'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!communityId && !organizationId) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityCharges')}</Card>;
  }

  return (
    <>
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs text-muted-foreground font-medium">
          {items.length} {t('billing.chargesFound', { defaultValue: 'charges configured' })}
        </span>
        <div className="flex items-center gap-2">
          {canAdd && onOpenBulk ? (
            <Button variant="outline" onClick={onOpenBulk} className="h-8 gap-1.5 rounded-lg text-xs">
              {t('billing.bulkSet')}
            </Button>
          ) : null}
          {canAdd && onOpenSet ? (
            <Button onClick={onOpenSet} className="h-8 gap-1.5 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" />
              {t('billing.setCharge')}
            </Button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('billing.empty')}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                {!communityId ? <TH>{t('billing.colCommunity')}</TH> : null}
                <TH>{t('billing.colUnit')}</TH>
                <TH className="text-right">{t('billing.monthlyAmount')}</TH>
                <TH>{t('billing.chargeLabel')}</TH>
                <TH className="w-28">{t('billing.colStatus')}</TH>
                {canDelete || canEdit ? <TH className="w-20 text-right">{t('orgs.colActions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  {!communityId ? <TD className="text-[12px] text-muted-foreground">{c.communityName || '—'}</TD> : null}
                  <TD className="text-[13px] font-medium">{c.unitNumber ?? c.unitId}</TD>
                  <TD className="text-right text-[12px] tabular-nums font-semibold">₹{formatAmount(c.amount)}</TD>
                  <TD className="text-[12px] text-muted-foreground">{c.label || '—'}</TD>
                  <TD>
                    <Badge tone={c.isActive ? 'success' : 'muted'}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {c.isActive ? t('billing.active') : t('billing.inactive')}
                    </Badge>
                  </TD>
                  {canDelete || canEdit ? (
                    <TD>
                      <div className="flex items-center justify-end">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(c)}
                            aria-label={t('billing.delete')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('billing.delete')}
        description={t('billing.chargeDeleteConfirm')}
        confirmLabel={t('billing.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}

// -------------------------------------------------------------
// SUB-TAB: Expenses & Ledger
// -------------------------------------------------------------
function ExpensesTab({
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
    [communityId, organizationId, reloadKey],
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
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityExpenses')}</Card>;
  }

  return (
    <div className="space-y-3">
      {/* Stat Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl p-4">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{t('billing.totalSpentStat')}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-rose-600">₹{formatAmount(totalSpent)}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{t('billing.totalReceivedStat')}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">₹{formatAmount(totalReceived)}</div>
        </Card>
        <Card className="rounded-2xl p-4 col-span-2 sm:col-span-1 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Net Ledger Cashflow</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${totalReceived - totalSpent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{formatAmount(totalReceived - totalSpent)}
            </div>
          </div>
          {canAdd ? (
            <Button onClick={() => setInternalAdding(true)} className="h-8 gap-1.5 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" />
              {t('billing.addLedger')}
            </Button>
          ) : null}
        </Card>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('billing.empty')}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                {!communityId ? <TH>{t('billing.colCommunity')}</TH> : null}
                <TH>{t('billing.colTitle')}</TH>
                <TH>{t('billing.colCategory')}</TH>
                <TH>{t('billing.direction')}</TH>
                <TH className="text-right">{t('billing.colAmount')}</TH>
                <TH>{t('billing.spentOn')}</TH>
                <TH>{t('billing.colVendor')}</TH>
                {canEdit || canDelete ? <TH className="w-24 text-right">{t('orgs.colActions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {items.map((e) => {
                const isCredit = e.direction === 'credit';
                return (
                  <TR key={e.id}>
                    {!communityId ? <TD className="text-[12px] text-muted-foreground">{e.communityName || '—'}</TD> : null}
                    <TD className="text-[13px] font-medium">{e.title}</TD>
                    <TD><Badge tone="default">{categoryLabel(e.category)}</Badge></TD>
                    <TD>
                      <Badge tone={isCredit ? 'success' : 'danger'}>
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
                    <TD className={`text-right text-[12px] tabular-nums font-semibold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? '+' : '-'}₹{formatAmount(e.amount)}
                    </TD>
                    <TD className="text-[11px] text-muted-foreground">{formatDate(e.spentOnUtc)}</TD>
                    <TD className="text-[12px] text-muted-foreground">{e.vendor || '—'}</TD>
                    {canEdit || canDelete ? (
                      <TD>
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => setEditing(e)}
                              aria-label={t('billing.edit')}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(e)}
                              aria-label={t('billing.delete')}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </Card>
      )}

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

// -------------------------------------------------------------
// SUB-TAB: Collection Dashboard
// -------------------------------------------------------------
function CollectionDashboard({
  communityId,
  organizationId,
  showOrg,
}: {
  communityId?: string;
  organizationId?: string;
  showOrg: boolean;
}) {
  const { t } = useTranslation();
  const query = useAsync(
    (signal) => maintenanceBilling.collectionSummary(communityId, organizationId, { signal }).catch(() => null),
    [communityId, organizationId],
  );
  const s = query.data;

  const totalSpent = useMemo(() => (s ? s.byCommunity.reduce((sum, c) => sum + (c.spent ?? 0), 0) : 0), [s]);
  const totalReceived = useMemo(() => (s ? (s.totalReceived ?? s.byCommunity.reduce((sum, c) => sum + (c.received ?? 0), 0)) : 0), [s]);

  if (query.loading && !s) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</Card>;
  }
  if (!s) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.empty')}</Card>;
  }

  const overallInflow = s.totalCollected + totalReceived;
  const netBalance = overallInflow - totalSpent;

  const stats = [
    { label: t('billing.totalCollected', { defaultValue: 'Bill Collection' }), value: s.totalCollected, color: 'text-emerald-600' },
    { label: t('billing.totalReceivedStat', { defaultValue: 'Other Income (Credit)' }), value: totalReceived, color: 'text-emerald-600' },
    { label: 'Total Inflow (All Collection)', value: overallInflow, color: 'text-primary font-bold' },
    { label: t('billing.totalSpentStat', { defaultValue: 'Total Spent' }), value: totalSpent, color: 'text-rose-600' },
    { label: t('billing.balanceFund', { defaultValue: 'Net Balance Fund' }), value: netBalance, color: netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600' },
    { label: t('billing.totalOutstanding', { defaultValue: 'Outstanding Dues' }), value: s.totalOutstanding, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((st) => (
          <Card key={st.label} className="rounded-2xl p-4">
            <div className="text-[11px] font-medium uppercase text-muted-foreground truncate">{st.label}</div>
            <div className={`mt-1 text-lg font-semibold tabular-nums ${st.color}`}>₹{formatAmount(st.value)}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl p-0">
        <Table>
          <THead>
            <TR>
              {showOrg ? <TH>{t('billing.colOrganization')}</TH> : null}
              <TH>{t('billing.colCommunity')}</TH>
              <TH className="text-right">{t('billing.colCollected')}</TH>
              <TH className="text-right">{t('billing.colReceived', { defaultValue: 'Credits / Other' })}</TH>
              <TH className="text-right">{t('billing.colSpent')}</TH>
              <TH className="text-right">{t('billing.colBalance')}</TH>
              <TH className="text-right">{t('billing.colOutstanding')}</TH>
            </TR>
          </THead>
          <TBody>
            {s.byCommunity.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {t('billing.empty')}
                </TD>
              </TR>
            ) : (
              s.byCommunity.map((c) => (
                <TR key={c.communityId}>
                  {showOrg ? <TD className="text-[12px] text-muted-foreground">{c.organizationName || '—'}</TD> : null}
                  <TD className="text-[13px] font-medium">{c.communityName}</TD>
                  <TD className="text-right text-[12px] tabular-nums text-emerald-600 font-semibold">₹{formatAmount(c.collected)}</TD>
                  <TD className="text-right text-[12px] tabular-nums text-emerald-600 font-semibold">₹{formatAmount(c.received ?? 0)}</TD>
                  <TD className="text-right text-[12px] tabular-nums text-rose-600 font-semibold">₹{formatAmount(c.spent ?? 0)}</TD>
                  <TD className="text-right text-[12px] tabular-nums font-bold">
                    ₹{formatAmount(c.collected + (c.received ?? 0) - (c.spent ?? 0))}
                  </TD>
                  <TD className="text-right text-[12px] tabular-nums text-amber-600 font-semibold">₹{formatAmount(c.outstanding)}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------
// DIALOGS
// -------------------------------------------------------------
function GenerateBillsDialog({
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
    [t],
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
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={t('billing.generateTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!presetCommunityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.community')}</label>
            <EntitySelect
              value={communityId || null}
              onChange={(v) => setCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.periodYear')}</label>
          <Input
            type="number"
            min={2000}
            max={3000}
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
            placeholder={t('billing.periodYearPlaceholder')}
          />
        </div>
        <SelectField
          label={t('billing.periodMonth')}
          value={periodMonth || null}
          options={monthOptions}
          placeholder={t('billing.selectMonth')}
          onChange={setPeriodMonth}
        />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.dueDate')}</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {t('billing.generate')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function RecordPaymentDialog({
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
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={t('billing.recordPaymentTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.amount')}</label>
          <Input
            autoFocus
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billing.amountPlaceholder')}
          />
        </div>
        <SelectField
          label={t('billing.method')}
          value={method || null}
          options={methodOptions}
          placeholder={t('billing.selectMethod')}
          onChange={setMethod}
        />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.reference')}</label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('billing.referencePlaceholder')}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.paidAt')}</label>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {t('billing.recordPayment')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function SetChargeDialog({
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
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetCommunityId(communityId ?? '');
    setUnitId('');
    setAmount('');
    setLabel('');
    setIsActive(true);
  }, [open, communityId]);

  const unitsQuery = useAsync(
    (signal) =>
      open && targetCommunityId
        ? units.list({ pageSize: 500 }, { communityId: targetCommunityId }, { signal }).then((d) => d.items).catch(() => [])
        : Promise.resolve([]),
    [open, targetCommunityId],
  );
  const unitOptions = useMemo<Option[]>(
    () => (unitsQuery.data ?? []).map((u) => ({ value: u.id, label: u.unitNumber })),
    [unitsQuery.data],
  );

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSubmit = !!targetCommunityId && !!unitId && amountValid;

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await maintenanceBilling.setCharge({
        communityId: targetCommunityId,
        unitId,
        amount: amountNum,
        ...(label.trim() ? { label: label.trim() } : {}),
        isActive,
      });
      toast.success(t('billing.chargeSaved'));
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={t('billing.setChargeTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!communityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.community')}</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => {
                setTargetCommunityId(v ?? '');
                setUnitId('');
              }}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
            />
          </div>
        ) : null}
        <SelectField
          label={t('billing.colUnit')}
          value={unitId || null}
          options={unitOptions}
          placeholder={t('billing.selectUnit')}
          onChange={setUnitId}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.monthlyAmount')}</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billing.amountPlaceholder')}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.chargeLabel')}</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('billing.chargeLabelPlaceholder')}
            maxLength={200}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t('billing.active')}
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {t('billing.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function BulkSetChargeDialog({
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
    [open, targetCommunityId],
  );
  const unitItems = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

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
      const result = await maintenanceBilling.bulkSetCharges({
        communityId: targetCommunityId,
        amount: amountNum,
        ...(label.trim() ? { label: label.trim() } : {}),
        isActive,
        applyToAllUnits: applyToAll,
        ...(applyToAll ? {} : { unitIds: Array.from(selected) }),
      });
      toast.success(t('billing.bulkApplied', { created: result.created, updated: result.updated }));
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={t('billing.bulkSetTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!communityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.community')}</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => {
                setTargetCommunityId(v ?? '');
                setSelected(new Set());
              }}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
            />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t('billing.applyToAll', { count: unitItems.length })}
        </label>
        {!applyToAll ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.selectUnits')}</label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2">
              {unitItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {unitsQuery.loading ? t('common.loading') : t('billing.noUnits')}
                </div>
              ) : (
                unitItems.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleUnit(u.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {u.unitNumber}
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.monthlyAmount')}</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billing.amountPlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.chargeLabel')}</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('billing.chargeLabelPlaceholder')}
            maxLength={200}
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t('billing.active')}
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {t('billing.applyToUnits')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ExpenseFormDialog({
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
      if (isEdit) await maintenanceBilling.updateExpense(expense!.id, body);
      else await maintenanceBilling.createExpense(body);
      toast.success(
        isEdit
          ? t('billing.expenseUpdated')
          : direction === 'credit'
          ? 'Credit Income Entry Added'
          : t('billing.expenseRecorded'),
      );
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={isEdit ? t('billing.editLedgerTitle') : t('billing.addLedgerTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!communityId && !isEdit ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.community')}</label>
            <EntitySelect
              value={targetCommunityId || null}
              onChange={(v) => setTargetCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch(organizationId)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('billing.selectCommunity')}
            />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.ledgerDirection')}</label>
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setDirection('debit')}
              className={`h-8 flex-1 rounded-md px-3 text-xs font-medium ${
                direction === 'debit' ? 'bg-rose-600 text-white' : 'text-muted-foreground'
              }`}
            >
              Debit (Expense)
            </button>
            <button
              type="button"
              onClick={() => setDirection('credit')}
              className={`h-8 flex-1 rounded-md px-3 text-xs font-medium ${
                direction === 'credit' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
              }`}
            >
              Credit (Income / Collection)
            </button>
          </div>
        </div>
        <SelectField
          label={t('billing.colCategory')}
          value={category || null}
          options={categoryOptions}
          placeholder={t('billing.selectCategory')}
          onChange={setCategory}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.amount')}</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('billing.amountPlaceholder')}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.colTitle')}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('billing.expenseTitlePlaceholder')}
            maxLength={200}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.spentOn')}</label>
          <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.colVendor')}</label>
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder={t('billing.vendorPlaceholder')}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('billing.notesPlaceholder')}
            maxLength={1000}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
        >
          {isEdit ? t('billing.saveChanges') : t('billing.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ApprovalsDialog({
  communityId,
  organizationId,
  canApprove = true,
  onClose,
  onDone,
}: {
  communityId: string | null;
  organizationId?: string;
  canApprove?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const open = communityId !== null;
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useAsync(
    (signal) =>
      open
        ? maintenanceBilling.listPendingPayments(communityId || undefined, organizationId, { signal }).catch(() => [] as PendingPayment[])
        : Promise.resolve([] as PendingPayment[]),
    [open, communityId, organizationId, reloadKey],
  );

  const items = query.data ?? [];
  const reload = () => setReloadKey((k) => k + 1);

  const act = async (p: PendingPayment, approve: boolean) => {
    setBusyId(p.id);
    try {
      if (approve) {
        await maintenanceBilling.approvePayment(p.id);
        toast.success(t('billing.paymentApproved'));
      } else {
        await maintenanceBilling.rejectPayment(p.id);
        toast.success(t('billing.paymentRejected'));
      }
      reload();
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader title={t('billing.reviewApproval')} />
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {query.loading ? t('common.loading') : t('billing.noPendingApprovals')}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-xs">
                <div>
                  <div className="font-semibold text-sm">₹{formatAmount(p.amount)} · {p.method}</div>
                  <div className="text-muted-foreground mt-0.5">Ref: {p.reference || '—'} · Paid: {formatDate(p.paidAtUtc)}</div>
                  <div className="text-muted-foreground">{formatPeriod(p.periodYear, p.periodMonth)}</div>
                </div>
                {canApprove ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      disabled={busyId === p.id}
                      onClick={() => act(p, false)}
                      className="h-8 rounded-lg text-rose-600 hover:bg-rose-50 border-rose-300"
                    >
                      {t('billing.reject')}
                    </Button>
                    <Button
                      disabled={busyId === p.id}
                      onClick={() => act(p, true)}
                      className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {t('billing.approve')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('common.close', { defaultValue: 'Close' })}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export { MaintenanceBillingView as MaintenanceBillingPage };
export default MaintenanceBillingView;
