import { useEffect, useMemo, useState } from 'react';
import { Receipt, Plus, Search, RefreshCw, Table as TableIcon, LayoutGrid, Wallet, Ban, CheckCircle2, Layers, Trash2, Pencil, ShieldCheck } from 'lucide-react';
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
import type { MaintenanceBill, MaintenanceCharge, MaintenanceExpense, PendingPayment } from '@shared/api/maintenanceBilling';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';

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
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const o = await organizations.get(id, { signal }); return o.name; } catch { return null; }
}

type Option = { value: string; label: string };
type Tab = 'bills' | 'charges' | 'expenses' | 'dashboard';

const ALL = '__all__';
const PAID_STATUS = 'paid';
const WAIVED_STATUS = 'waived';
const FALLBACK_STATUSES = ['unpaid', 'partially_paid', 'paid', 'waived', 'overdue'];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

function formatAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
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

export function MaintenanceBillingPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [tab, setTab] = useState<Tab>('bills');
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [generating, setGenerating] = useState(false);
  const [charging, setCharging] = useState(false);
  const [bulkCharging, setBulkCharging] = useState(false);
  const [approvals, setApprovals] = useState<string | null>(null);
  const [paying, setPaying] = useState<MaintenanceBill | null>(null);
  const [confirmWaive, setConfirmWaive] = useState<MaintenanceBill | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const statusesQuery = useAsync((signal) => masterData.list('Maintenance_Bill_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => {
    const data = statusesQuery.data ?? [];
    if (data.length > 0) return data.map((e) => ({ value: e.code, label: e.label }));
    return FALLBACK_STATUSES.map((s) => ({ value: s, label: t(`billing.status.${s}`) }));
  }, [statusesQuery.data, t]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;
  const filterStatusOptions = useMemo<Option[]>(() => [{ value: ALL, label: t('billing.allStatuses') }, ...statusOptions], [statusOptions, t]);
  const monthFilterOptions = useMemo<Option[]>(() => [{ value: ALL, label: t('billing.allMonths') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) }))], [t]);

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;

  const yearNum = Number.parseInt(periodYear, 10);
  const yearFilter = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 3000 ? yearNum : undefined;

  const query = useAsync(
    (signal) => maintenanceBilling.listBills(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
        ...(statusFilter !== ALL ? { status: statusFilter } : {}),
        ...(yearFilter ? { periodYear: yearFilter } : {}),
        ...(periodMonth !== ALL ? { periodMonth: Number.parseInt(periodMonth, 10) } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, statusFilter, yearFilter, periodMonth, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);
  const canAct = !!effectiveCommunityId;

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

  const RowActions = ({ b }: { b: MaintenanceBill }) => {
    if (b.pendingApproval) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => setApprovals(b.communityId)} aria-label={t('billing.reviewApproval')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
            <ShieldCheck className="h-4 w-4" />
          </button>
        </div>
      );
    }
    const settled = b.status === PAID_STATUS || b.status === WAIVED_STATUS;
    if (settled) return <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">—</div>;
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => setPaying(b)} aria-label={t('billing.recordPayment')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
          <Wallet className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setConfirmWaive(b)} aria-label={t('billing.waive')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
          <Ban className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bills', label: t('billing.tabBills') },
    { key: 'charges', label: t('billing.tabCharges') },
    { key: 'expenses', label: t('billing.tabExpenses') },
    { key: 'dashboard', label: t('billing.tabDashboard') },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('billing.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('billing.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!canAct} onClick={() => setCharging(true)} className="h-9 gap-1.5 rounded-lg px-3 text-xs">
              <Plus className="h-4 w-4" />{t('billing.setCharge')}
            </Button>
            <Button variant="outline" disabled={!canAct} onClick={() => setBulkCharging(true)} className="h-9 gap-1.5 rounded-lg px-3 text-xs">
              <Layers className="h-4 w-4" />{t('billing.bulkSet')}
            </Button>
            <Button variant="outline" disabled={!canAct} onClick={() => setApprovals(effectiveCommunityId ?? null)} className="h-9 gap-1.5 rounded-lg px-3 text-xs">
              <CheckCircle2 className="h-4 w-4" />{t('billing.approvals')}
            </Button>
            <Button disabled={!canAct} onClick={() => setGenerating(true)} className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
              <Plus className="h-4 w-4" />{t('billing.generate')}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          {tabs.map((tb) => (
            <button key={tb.key} type="button" onClick={() => setTab(tb.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === tb.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {tb.label}
            </button>
          ))}
        </div>
        {scope.showOrgFilter || scope.showCommunityFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            {scope.showOrgFilter ? (
              <EntitySelect
                className="w-44"
                value={filterOrgId}
                onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
                fetchPage={fetchOrgPage}
                resolveLabel={resolveOrgLabel}
                placeholder={t('billing.filterOrg')}
              />
            ) : null}
            {scope.showCommunityFilter ? (
              <EntitySelect
                className="w-44"
                value={filterCommunityId}
                onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
                fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
                resolveLabel={resolveCommunityLabel}
                placeholder={t('billing.filterCommunity')}
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      {tab === 'bills' ? (
        <>
          <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('billing.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
              </div>
              <div className="w-40">
                <SelectField value={statusFilter} options={filterStatusOptions} placeholder={t('billing.filterStatus')} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </div>
              <Input type="number" min={2000} max={3000} value={periodYear} onChange={(e) => { setPeriodYear(e.target.value); setPage(1); }} placeholder={t('billing.periodYear')} className="h-9 w-28 text-sm" />
              <div className="w-36">
                <SelectField value={periodMonth} options={monthFilterOptions} placeholder={t('billing.periodMonth')} onChange={(v) => { setPeriodMonth(v); setPage(1); }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
                <button type="button" onClick={() => setView('table')} aria-label="Table view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
                  <TableIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView('cards')} aria-label="Card view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={reload} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
                <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </Card>

          {items.length === 0 ? (
            <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {query.loading ? t('common.loading') : t('billing.empty')}
            </Card>
          ) : effectiveView === 'table' ? (
            <Card className="overflow-hidden rounded-2xl p-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-14 text-center">#</TH>
                    <TH>{t('billing.colBill')}</TH>
                    {showCommunityCol ? <TH className="w-44">{t('billing.colCommunity')}</TH> : null}
                    <TH className="w-28 text-right">{t('billing.colAmount')}</TH>
                    <TH className="w-24 text-right">{t('billing.colPaid')}</TH>
                    <TH className="w-24 text-right">{t('billing.colDue2')}</TH>
                    <TH className="w-28">{t('billing.colStatus')}</TH>
                    <TH className="w-28">{t('billing.colDue')}</TH>
                    <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((b, i) => (
                    <TR key={b.id}>
                      <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                      <TD>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">{b.unitNumber ?? b.label}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{formatPeriod(b.periodYear, b.periodMonth)}</div>
                        </div>
                      </TD>
                      {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{b.communityName ?? '—'}</TD> : null}
                      <TD className="text-right text-[12px] font-medium tabular-nums">{formatAmount(b.amount)}</TD>
                      <TD className="text-right text-[12px] tabular-nums text-emerald-600">{formatAmount(b.amountPaid)}</TD>
                      <TD className="text-right text-[12px] tabular-nums">{formatAmount(b.amountDue)}</TD>
                      <TD><StatusBadge b={b} /></TD>
                      <TD className="text-[11px] text-muted-foreground">{formatDate(b.dueDateUtc)}</TD>
                      <TD><RowActions b={b} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <Card key={b.id} className="flex flex-col gap-3 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{b.unitNumber ?? b.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{formatPeriod(b.periodYear, b.periodMonth)}</div>
                      {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{b.communityName ?? '—'}</div> : null}
                    </div>
                    <StatusBadge b={b} />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 border-t border-border pt-2 text-[11px]">
                    <div className="rounded-lg bg-muted/60 p-1.5">
                      <span className="block text-[9.5px] font-semibold uppercase text-muted-foreground">{t('billing.colAmount')}</span>
                      <span className="tabular-nums">{formatAmount(b.amount)}</span>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-1.5">
                      <span className="block text-[9.5px] font-semibold uppercase text-muted-foreground">{t('billing.colPaid')}</span>
                      <span className="tabular-nums text-emerald-600">{formatAmount(b.amountPaid)}</span>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-1.5">
                      <span className="block text-[9.5px] font-semibold uppercase text-muted-foreground">{t('billing.colDue2')}</span>
                      <span className="tabular-nums">{formatAmount(b.amountDue)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{t('billing.colDue')}: {formatDate(b.dueDateUtc)}</span>
                    </div>
                    <RowActions b={b} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {(query.data?.totalCount ?? 0) > 0 ? (
            <Card className="rounded-xl p-1">
              <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'charges' ? <ChargesTab communityId={effectiveCommunityId} /> : null}
      {tab === 'expenses' ? <ExpensesTab communityId={effectiveCommunityId} /> : null}
      {tab === 'dashboard' ? <CollectionDashboard communityId={effectiveCommunityId} showOrg={scope.showOrgFilter} /> : null}

      <GenerateBillsDialog
        open={generating}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})}
        onClose={() => setGenerating(false)}
        onDone={() => { setGenerating(false); reload(); }}
      />

      <SetChargeDialog
        open={charging}
        {...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {})}
        onClose={() => setCharging(false)}
        onDone={() => { setCharging(false); reload(); }}
      />

      <BulkSetChargeDialog
        open={bulkCharging}
        {...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {})}
        onClose={() => setBulkCharging(false)}
        onDone={() => { setBulkCharging(false); reload(); }}
      />

      <ApprovalsDialog
        communityId={approvals}
        onClose={() => setApprovals(null)}
        onChanged={reload}
      />

      <RecordPaymentDialog
        bill={paying}
        methodOptions={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`billing.methodName.${m}`) }))}
        onClose={() => setPaying(null)}
        onDone={() => { setPaying(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmWaive}
        tone="danger"
        title={t('billing.waive')}
        description={confirmWaive ? t('billing.waiveConfirm', { bill: confirmWaive.unitNumber ?? confirmWaive.label }) : ''}
        confirmLabel={t('billing.waive')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doWaive}
        onClose={() => setConfirmWaive(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function ChargesTab({ communityId }: { communityId?: string }) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceCharge | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const query = useAsync(
    (signal) => (communityId ? maintenanceBilling.listCharges(communityId, { signal }).catch(() => [] as MaintenanceCharge[]) : Promise.resolve([] as MaintenanceCharge[])),
    [communityId, reloadKey],
  );
  const items = useMemo(() => (query.data ?? []).filter((c) => c.isActive), [query.data]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.deactivateCharge(confirmDelete.id);
      toast.success(t('billing.chargeRemoved'));
      setConfirmDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!communityId) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityCharges')}</Card>;
  }

  return (
    <>
      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{query.loading ? t('common.loading') : t('billing.noCharges')}</Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH>{t('billing.colUnit')}</TH>
                <TH className="w-32 text-right">{t('billing.colAmount')}</TH>
                <TH>{t('billing.colLabel')}</TH>
                <TH className="w-28">{t('billing.colStatus')}</TH>
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  <TD className="text-[13px] font-medium">{c.unitNumber ?? c.unitId}</TD>
                  <TD className="text-right text-[12px] tabular-nums">{formatAmount(c.amount)}</TD>
                  <TD className="text-[12px] text-muted-foreground">{c.label || '—'}</TD>
                  <TD>
                    <Badge tone={c.isActive ? 'success' : 'muted'}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {c.isActive ? t('billing.active') : t('billing.inactive')}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end">
                      <button type="button" onClick={() => setConfirmDelete(c)} aria-label={t('billing.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
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

function ExpensesTab({ communityId }: { communityId?: string }) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MaintenanceExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceExpense | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const categoriesQuery = useAsync((signal) => masterData.list('Maintenance_Expense_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code.replace(/_/g, ' ');

  const query = useAsync(
    (signal) => (communityId ? maintenanceBilling.listExpenses(communityId, { signal }).catch(() => [] as MaintenanceExpense[]) : Promise.resolve([] as MaintenanceExpense[])),
    [communityId, reloadKey],
  );
  const items = useMemo(() => query.data ?? [], [query.data]);
  const totalSpent = useMemo(() => items.filter((e) => e.direction !== 'credit').reduce((s, e) => s + e.amount, 0), [items]);
  const totalReceived = useMemo(() => items.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amount, 0), [items]);
  const reload = () => setReloadKey((k) => k + 1);

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

  if (!communityId) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.selectCommunityExpenses')}</Card>;
  }

  return (
    <>
      <Card className="flex items-center justify-between gap-3 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>{t('billing.totalReceivedLedger')}: <b className="tabular-nums text-emerald-600">{formatAmount(totalReceived)}</b></span>
          <span>{t('billing.totalSpent')}: <b className="tabular-nums text-rose-600">{formatAmount(totalSpent)}</b></span>
        </div>
        <Button onClick={() => setAdding(true)} className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
          <Plus className="h-4 w-4" />{t('billing.addLedger')}
        </Button>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{query.loading ? t('common.loading') : t('billing.noExpenses')}</Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-28">{t('billing.colDate')}</TH>
                <TH className="w-24">{t('billing.colType')}</TH>
                <TH className="w-36">{t('billing.colCategory')}</TH>
                <TH>{t('billing.colTitle')}</TH>
                <TH className="w-36">{t('billing.colVendor')}</TH>
                <TH className="w-28 text-right">{t('billing.colAmount')}</TH>
                <TH className="w-32 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((e) => (
                <TR key={e.id}>
                  <TD className="text-[11px] text-muted-foreground">{formatDate(e.spentOnUtc)}</TD>
                  <TD><Badge tone={e.direction === 'credit' ? 'success' : 'danger'}>{e.direction === 'credit' ? t('billing.directionCredit') : t('billing.directionDebit')}</Badge></TD>
                  <TD><Badge tone="default">{categoryLabel(e.category)}</Badge></TD>
                  <TD className="text-[13px] font-medium">{e.title}</TD>
                  <TD className="text-[12px] text-muted-foreground">{e.vendor || '—'}</TD>
                  <TD className={`text-right text-[12px] tabular-nums ${e.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.direction === 'credit' ? '+' : '−'}{formatAmount(e.amount)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(e)} aria-label={t('billing.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(e)} aria-label={t('billing.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ExpenseFormDialog
        open={adding || !!editing}
        communityId={communityId}
        expense={editing}
        categoryOptions={categoryOptions}
        onClose={() => { setAdding(false); setEditing(null); }}
        onSaved={() => { setAdding(false); setEditing(null); reload(); }}
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
    </>
  );
}

function CollectionDashboard({ communityId, showOrg }: { communityId?: string; showOrg: boolean }) {
  const { t } = useTranslation();
  const query = useAsync((signal) => maintenanceBilling.collectionSummary(communityId, { signal }).catch(() => null), [communityId]);
  const s = query.data;

  const totalSpent = useMemo(() => (s ? s.byCommunity.reduce((sum, c) => sum + (c.spent ?? 0), 0) : 0), [s]);
  const totalReceived = useMemo(() => (s ? s.byCommunity.reduce((sum, c) => sum + (c.received ?? 0), 0) : 0), [s]);

  if (query.loading && !s) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('common.loading')}</Card>;
  }
  if (!s) {
    return <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">{t('billing.empty')}</Card>;
  }

  const stats = [
    { label: t('billing.totalCollected'), value: s.totalCollected },
    { label: t('billing.totalReceivedStat'), value: totalReceived },
    { label: t('billing.totalSpentStat'), value: totalSpent },
    { label: t('billing.balanceFund'), value: s.totalCollected + totalReceived - totalSpent },
    { label: t('billing.totalOutstanding'), value: s.totalOutstanding },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((st) => (
          <Card key={st.label} className="rounded-2xl p-4">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{st.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{formatAmount(st.value)}</div>
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
              <TH className="text-right">{t('billing.colReceived')}</TH>
              <TH className="text-right">{t('billing.colSpent')}</TH>
              <TH className="text-right">{t('billing.colBalance')}</TH>
              <TH className="text-right">{t('billing.colOutstanding')}</TH>
            </TR>
          </THead>
          <TBody>
            {s.byCommunity.length === 0 ? (
              <TR><TD className="py-8 text-center text-sm text-muted-foreground">{t('billing.empty')}</TD></TR>
            ) : s.byCommunity.map((c) => (
              <TR key={c.communityId}>
                {showOrg ? <TD className="text-[12px] text-muted-foreground">{c.organizationName || '—'}</TD> : null}
                <TD className="text-[13px] font-medium">{c.communityName}</TD>
                <TD className="text-right text-[12px] tabular-nums text-emerald-600">{formatAmount(c.collected)}</TD>
                <TD className="text-right text-[12px] tabular-nums text-emerald-600">{formatAmount(c.received ?? 0)}</TD>
                <TD className="text-right text-[12px] tabular-nums text-rose-600">{formatAmount(c.spent ?? 0)}</TD>
                <TD className="text-right text-[12px] tabular-nums">{formatAmount(c.collected + (c.received ?? 0) - (c.spent ?? 0))}</TD>
                <TD className="text-right text-[12px] tabular-nums">{formatAmount(c.outstanding)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function GenerateBillsDialog({ open, presetCommunityId, onClose, onDone }: { open: boolean; presetCommunityId?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const now = new Date();
  const [communityId, setCommunityId] = useState('');
  const [periodYear, setPeriodYear] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const monthOptions = useMemo<Option[]>(() => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`billing.month.${i + 1}`) })), [t]);

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
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('billing.selectCommunity')} />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.periodYear')}</label>
          <Input type="number" min={2000} max={3000} value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} placeholder={t('billing.periodYearPlaceholder')} />
        </div>
        <SelectField label={t('billing.periodMonth')} value={periodMonth || null} options={monthOptions} placeholder={t('billing.selectMonth')} onChange={setPeriodMonth} />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.dueDate')}</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('billing.generate')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function RecordPaymentDialog({ bill, methodOptions, onClose, onDone }: { bill: MaintenanceBill | null; methodOptions: Option[]; onClose: () => void; onDone: () => void }) {
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
    setMethod(methodOptions[0]?.value ?? '');
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
          <Input autoFocus type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('billing.amountPlaceholder')} />
        </div>
        <SelectField label={t('billing.method')} value={method || null} options={methodOptions} placeholder={t('billing.selectMethod')} onChange={setMethod} />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.reference')}</label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('billing.referencePlaceholder')} maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.paidAt')}</label>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('billing.recordPayment')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function SetChargeDialog({ open, communityId, onClose, onDone }: { open: boolean; communityId?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const unitsQuery = useAsync(
    (signal) => (open && communityId ? units.list({ pageSize: 500 }, { communityId }, { signal }).then((d) => d.items).catch(() => []) : Promise.resolve([])),
    [open, communityId],
  );
  const unitOptions = useMemo<Option[]>(() => (unitsQuery.data ?? []).map((u) => ({ value: u.id, label: u.unitNumber })), [unitsQuery.data]);

  useEffect(() => {
    if (!open) return;
    setUnitId('');
    setAmount('');
    setLabel('');
    setIsActive(true);
  }, [open]);

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSubmit = !!communityId && !!unitId && amountValid;

  const submit = async () => {
    if (busy || !canSubmit || !communityId) return;
    setBusy(true);
    try {
      await maintenanceBilling.setCharge({
        communityId,
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
        <SelectField label={t('billing.colUnit')} value={unitId || null} options={unitOptions} placeholder={t('billing.selectUnit')} onChange={setUnitId} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.monthlyAmount')}</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('billing.amountPlaceholder')} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.chargeLabel')}</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('billing.chargeLabelPlaceholder')} maxLength={200} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
          {t('billing.active')}
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('billing.save')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function BulkSetChargeDialog({ open, communityId, onClose, onDone }: { open: boolean; communityId?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [applyToAll, setApplyToAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const unitsQuery = useAsync(
    (signal) => (open && communityId ? units.list({ pageSize: 500 }, { communityId }, { signal }).then((d) => d.items).catch(() => []) : Promise.resolve([])),
    [open, communityId],
  );
  const unitItems = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  useEffect(() => {
    if (!open) return;
    setApplyToAll(false);
    setSelected(new Set());
    setAmount('');
    setLabel('');
    setIsActive(true);
  }, [open]);

  const toggleUnit = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 0;
  const canSubmit = !!communityId && amountValid && (applyToAll || selected.size > 0);

  const submit = async () => {
    if (busy || !canSubmit || !communityId) return;
    setBusy(true);
    try {
      const result = await maintenanceBilling.bulkSetCharges({
        communityId,
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
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="h-4 w-4 rounded border-input" />
          {t('billing.applyToAll', { count: unitItems.length })}
        </label>
        {!applyToAll ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.selectUnits')}</label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2">
              {unitItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">{unitsQuery.loading ? t('common.loading') : t('billing.noUnits')}</div>
              ) : unitItems.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleUnit(u.id)} className="h-4 w-4 rounded border-input" />
                  {u.unitNumber}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.monthlyAmount')}</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('billing.amountPlaceholder')} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.chargeLabel')}</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('billing.chargeLabelPlaceholder')} maxLength={200} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-input" />
          {t('billing.active')}
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('billing.applyToUnits')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function ExpenseFormDialog({ open, communityId, expense, categoryOptions, onClose, onSaved }: { open: boolean; communityId: string; expense: MaintenanceExpense | null; categoryOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!expense;
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
    setDirection(expense?.direction ?? 'debit');
    setCategory(expense?.category ?? categoryOptions[0]?.value ?? '');
    setTitle(expense?.title ?? '');
    setAmount(expense?.amount != null ? String(expense.amount) : '');
    setSpentOn(expense?.spentOnUtc ? expense.spentOnUtc.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setVendor(expense?.vendor ?? '');
    setNotes(expense?.notes ?? '');
  }, [open, expense, categoryOptions]);

  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const canSubmit = !!category && !!title.trim() && amountValid && !!spentOn;

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body = {
        communityId,
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
      toast.success(isEdit ? t('billing.expenseUpdated') : t('billing.expenseRecorded'));
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
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.ledgerDirection')}</label>
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <button type="button" onClick={() => setDirection('debit')} className={`h-8 flex-1 rounded-md px-3 text-xs font-medium ${direction === 'debit' ? 'bg-rose-600 text-white' : 'text-muted-foreground'}`}>{t('billing.directionDebit')}</button>
            <button type="button" onClick={() => setDirection('credit')} className={`h-8 flex-1 rounded-md px-3 text-xs font-medium ${direction === 'credit' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>{t('billing.directionCredit')}</button>
          </div>
        </div>
        <SelectField label={t('billing.colCategory')} value={category || null} options={categoryOptions} placeholder={t('billing.selectCategory')} onChange={setCategory} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.amount')}</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('billing.amountPlaceholder')} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.colTitle')}</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('billing.expenseTitlePlaceholder')} maxLength={200} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.spentOn')}</label>
          <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.colVendor')}</label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={t('billing.vendorPlaceholder')} maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('billing.notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('billing.notesPlaceholder')} maxLength={1000} rows={3} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('billing.saveChanges') : t('billing.save')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function ApprovalsDialog({ communityId, onClose, onChanged }: { communityId: string | null; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const open = !!communityId;
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useAsync(
    (signal) => (open && communityId ? maintenanceBilling.listPendingPayments(communityId, { signal }).catch(() => [] as PendingPayment[]) : Promise.resolve([] as PendingPayment[])),
    [open, communityId, reloadKey],
  );
  const items = useMemo(() => query.data ?? [], [query.data]);

  const act = async (id: string, kind: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      if (kind === 'approve') await maintenanceBilling.approvePayment(id);
      else await maintenanceBilling.rejectPayment(id);
      toast.success(kind === 'approve' ? t('billing.paymentApproved') : t('billing.paymentRejected'));
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader title={t('billing.approvalsTitle')} />
      {query.loading && items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('billing.noPending')}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold tabular-nums">{formatAmount(p.amount)} · {t(`billing.methodName.${p.method}`, p.method.replace(/_/g, ' '))}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatPeriod(p.periodYear, p.periodMonth)}
                  {p.reference ? ` · ${p.reference}` : ''}
                  {p.submittedByResident ? ` · ${t('billing.submittedByResident')}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button onClick={() => act(p.id, 'approve')} disabled={busyId === p.id} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700">{t('billing.approve')}</Button>
                <Button variant="outline" onClick={() => act(p.id, 'reject')} disabled={busyId === p.id} className="h-8 rounded-lg border-rose-300 px-3 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">{t('billing.reject')}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('billing.close')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
