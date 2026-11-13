import { useMemo, useState } from 'react';
import { LifeBuoy, Search, RefreshCw, Table as TableIcon, LayoutGrid, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { tickets, masterData, organizations, communities } from '@shared/services';
import type { Ticket } from '@shared/api/tickets';
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

const ALL_STATUSES = '__all__';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'default' | 'muted' {
  const s = status.toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'success';
  if (s === 'in_progress' || s === 'assigned') return 'warning';
  if (s === 'new' || s === 'open') return 'default';
  return 'muted';
}

function priorityTone(priority: string): 'success' | 'warning' | 'danger' | 'default' | 'muted' {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'urgent' || p === 'critical') return 'danger';
  if (p === 'medium' || p === 'normal') return 'warning';
  if (p === 'low') return 'muted';
  return 'default';
}

export function TicketsPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [changing, setChanging] = useState<Ticket | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const statusesQuery = useAsync((signal) => masterData.list('Ticket_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => (statusesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [statusesQuery.data]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const categoriesQuery = useAsync((signal) => masterData.list('Ticket_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code;

  const prioritiesQuery = useAsync((signal) => masterData.list('Ticket_Priority', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const priorityOptions = useMemo<Option[]>(() => (prioritiesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [prioritiesQuery.data]);
  const priorityLabel = (code: string) => priorityOptions.find((o) => o.value === code)?.label ?? code;

  const statusFilterOptions = useMemo<Option[]>(() => [{ value: ALL_STATUSES, label: t('tickets.allStatuses') }, ...statusOptions], [statusOptions, t]);

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;

  const query = useAsync(
    (signal) => tickets.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, filterStatus, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const StatusBadge = ({ s }: { s: Ticket }) => (
    <Badge tone={statusTone(s.status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabel(s.status)}
    </Badge>
  );

  const RowActions = ({ s }: { s: Ticket }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => setChanging(s)} aria-label={t('tickets.changeStatus')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('tickets.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('tickets.subtitle')}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('tickets.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('tickets.filterOrg')}
            />
          ) : null}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('tickets.filterCommunity')}
            />
          ) : null}
          <div className="w-40">
            <SelectField value={filterStatus ?? ALL_STATUSES} options={statusFilterOptions} placeholder={t('tickets.filterStatus')} onChange={(v) => { setFilterStatus(v === ALL_STATUSES ? null : v); setPage(1); }} />
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
          {query.loading ? t('common.loading') : t('tickets.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('tickets.colTicket')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('tickets.colCommunity')}</TH> : null}
                <TH className="w-32">{t('tickets.colCategory')}</TH>
                <TH className="w-28">{t('tickets.colPriority')}</TH>
                <TH className="w-28">{t('tickets.colStatus')}</TH>
                <TH className="w-24 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s, i) => (
                <TR key={s.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{s.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{s.description}</div>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{s.communityName ?? '—'}</TD> : null}
                  <TD><Badge tone="default">{categoryLabel(s.category)}</Badge></TD>
                  <TD><Badge tone={priorityTone(s.priority)}>{priorityLabel(s.priority)}</Badge></TD>
                  <TD><StatusBadge s={s} /></TD>
                  <TD><RowActions s={s} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.title}</div>
                  {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{s.communityName ?? '—'}</div> : null}
                </div>
                <StatusBadge s={s} />
              </div>
              <p className="line-clamp-3 border-t border-border pt-2 text-[12px] text-muted-foreground">{s.description}</p>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge tone="default">{categoryLabel(s.category)}</Badge>
                  <Badge tone={priorityTone(s.priority)}>{priorityLabel(s.priority)}</Badge>
                </div>
                <RowActions s={s} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }} />
        </Card>
      ) : null}

      <ChangeStatusDialog
        ticket={changing}
        statusOptions={statusOptions}
        onClose={() => setChanging(null)}
        onSaved={() => { setChanging(null); reload(); }}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function ChangeStatusDialog({ ticket, statusOptions, onClose, onSaved }: { ticket: Ticket | null; statusOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [toStatus, setToStatus] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = !!ticket;

  const targetOptions = useMemo<Option[]>(() => statusOptions.filter((o) => o.value !== ticket?.status), [statusOptions, ticket]);

  const submit = async () => {
    if (!ticket || busy || !toStatus) return;
    setBusy(true);
    try {
      await tickets.changeStatus(ticket.id, { toStatus, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      toast.success(t('tickets.statusChanged'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setToStatus('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} className="max-w-md">
      <DialogHeader title={t('tickets.changeStatusTitle')} />
      <div className="flex flex-col gap-3">
        <SelectField label={t('tickets.targetStatus')} value={toStatus || null} options={targetOptions} placeholder={t('tickets.selectStatus')} onChange={setToStatus} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('tickets.reasonLabel')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('tickets.reasonPlaceholder')} maxLength={1000} rows={3} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={close} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !toStatus} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('tickets.applyStatus')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
