import { useMemo, useState } from 'react';
import { LifeBuoy, Search, RefreshCw, Plus, Filter, ChevronRight, Building2, Calendar, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster, toast } from 'sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { HelpDeskHeader } from './HelpDeskHeader';
import { tickets, masterData, organizations, communities } from '@shared/services';
import type { Ticket } from '@shared/api/tickets';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';

/* ─── Exported types / helpers (used by TicketDetailsPage) ─── */

export interface StatusOption { value: string; label: string }

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'Open', label: 'Open' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export function statusTone(status?: string): 'default' | 'warning' | 'success' | 'danger' | 'muted' {
  const s = (status || '').toLowerCase().replace(/[\s_-]/g, '');
  if (s.includes('open') || s.includes('new')) return 'default';
  if (s.includes('progress') || s.includes('pending') || s.includes('hold')) return 'warning';
  if (s.includes('resolved') || s.includes('completed') || s.includes('done')) return 'success';
  if (s.includes('closed')) return 'muted';
  if (s.includes('cancel') || s.includes('reject')) return 'danger';
  return 'default';
}

/* ─── Page props ─── */

export interface TicketsListPageProps {
  mode?: 'admin' | 'mobile';
  title?: string;
  submitPath?: string;
  detailsPathPrefix?: string;
  onBack?: () => void;
  onTicketClick?: (ticket: Ticket) => void;
  onSubmitClick?: () => void;
}

/* ─── Internal helpers ─── */

const ALL = '__all__';

function priorityColor(p: string) {
  const v = p.toLowerCase();
  if (v === 'high' || v === 'urgent' || v === 'critical') return 'bg-rose-500';
  if (v === 'medium' || v === 'normal') return 'bg-amber-400';
  return 'bg-slate-400';
}

function priorityTone(p: string): 'danger' | 'warning' | 'muted' | 'default' {
  const v = p.toLowerCase();
  if (v === 'high' || v === 'urgent' || v === 'critical') return 'danger';
  if (v === 'medium' || v === 'normal') return 'warning';
  return 'muted';
}

function statusAccent(status?: string) {
  const t = statusTone(status);
  if (t === 'success') return 'bg-emerald-500';
  if (t === 'warning') return 'bg-amber-400';
  if (t === 'danger') return 'bg-rose-500';
  if (t === 'muted') return 'bg-slate-400';
  return 'bg-primary';
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

/* ─── Ticket Card ─── */

function TicketCard({
  ticket, categoryLabel, priorityLabel, showCommunity, statusEl, onClick,
}: {
  ticket: Ticket;
  categoryLabel: (c: string) => string;
  priorityLabel: (c: string) => string;
  showCommunity?: boolean;
  statusEl: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="relative flex cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-all active:scale-[0.985] hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Left status accent bar */}
      <span className={cn('w-1 shrink-0', statusAccent(ticket.status))} />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold text-foreground leading-snug">{ticket.title}</p>
            {ticket.description ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{ticket.description}</p>
            ) : null}
          </div>
          {/* Status element (badge for users, select for admins) */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{statusEl}</div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {showCommunity && ticket.communityName ? (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="font-medium text-foreground/80 truncate max-w-[120px]">{ticket.communityName}</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Tag className="h-3 w-3 shrink-0" />
            <span className="capitalize">{categoryLabel(ticket.category)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{fmt(ticket.createdAtUtc)}</span>
          </span>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', priorityColor(ticket.priority))} />
            <Badge tone={priorityTone(ticket.priority)} className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0">
              {priorityLabel(ticket.priority)}
            </Badge>
          </div>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-primary">
            View <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Entity fetch helpers ─── */

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o: any) => ({ value: o.id, label: o.name })), total: d.totalCount };
}
function makeCommunityFetch(orgId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, orgId ? { organizationId: orgId } : {}, { signal });
    return { items: d.items.map((c: any) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal) {
  try { return (await communities.get(id, { signal })).name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal) {
  try { return (await organizations.get(id, { signal })).name; } catch { return null; }
}

/* ─── Main component ─── */

export function TicketsListPage({ mode, title, submitPath, detailsPathPrefix, onBack, onTicketClick, onSubmitClick }: TicketsListPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const { roles } = useAuth();
  const perm = usePermission(['helpdesk', 'Ticket', 'app.helpdesk', 'maintenance']);
  const isSmall = useIsSmallScreen();
  const effectiveMode = mode ?? (isSmall ? 'mobile' : 'admin');
  const isMobile = effectiveMode === 'mobile';
  const showTable = !isMobile && !isSmall;

  const canChangeStatus =
    scope.isPowerUser || scope.isOrgAdmin ||
    roles.some((r: any) => /admin|communityadmin|organizationadmin/i.test(r)) ||
    perm.canEdit || perm.isAdmin;

  const pageTitle = title ?? t('tickets.title', 'Help Desk');
  const resolvedSubmitPath = submitPath ?? (isMobile ? '/raise-ticket' : '/tickets/new');
  const resolvedDetailsPrefix = detailsPathPrefix ?? (isMobile ? '/my-tickets/' : '/tickets/');

  const handleBack = () => {
    if (onBack) return onBack();
    (window.history.state?.idx > 0) ? navigate(-1) : navigate(isMobile ? '/home' : '/dashboard');
  };
  const handleCreate = () => onSubmitClick ? onSubmitClick() : navigate(resolvedSubmitPath);
  const handleOpen = (ticket: Ticket) => onTicketClick ? onTicketClick(ticket) : navigate(`${resolvedDetailsPrefix}${ticket.id}`);

  /* ── State ── */
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 20 : 10);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  /* ── Master data ── */
  const statusesQ = useAsync((s: any) => masterData.list('Ticket_Status', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<StatusOption[]>(() => {
    const a = (statusesQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label }));
    return a.length > 0 ? a : DEFAULT_STATUS_OPTIONS;
  }, [statusesQ.data]);

  const catsQ = useAsync((s: any) => masterData.list('Ticket_Category', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const catOpts = useMemo<SelectOption[]>(() => (catsQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label })), [catsQ.data]);
  const catLabel = (c: string) => catOpts.find(o => o.value === c)?.label ?? c;

  const priQ = useAsync((s: any) => masterData.list('Ticket_Priority', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const priOpts = useMemo<SelectOption[]>(() => (priQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label })), [priQ.data]);
  const priLabel = (c: string) => priOpts.find(o => o.value === c)?.label ?? c;

  const statusFilterOpts = useMemo<SelectOption[]>(
    () => [{ value: ALL, label: t('tickets.allStatuses', 'All Statuses') }, ...statusOptions],
    [statusOptions, t],
  );

  /* ── Data query ── */
  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const query = useAsync(
    (s: any) => tickets.list(
      { search: search.trim() || undefined, page, pageSize, sort: 'createdAtUtc:desc' },
      { ...(filterStatus ? { status: filterStatus } : {}), ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}) },
      { signal: s },
    ).catch(() => null),
    [search, filterStatus, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const filterCount = (filterStatus ? 1 : 0) + (filterOrgId ? 1 : 0) + (filterCommunityId ? 1 : 0) + (search ? 1 : 0);

  /* ── Status renderer ── */
  const renderStatus = (ticket: Ticket) => {
    const val = localStatuses[ticket.id] ?? ticket.status;
    if (canChangeStatus) {
      return (
        <Select value={val} disabled={updatingId === ticket.id} onValueChange={async (v) => {
          setUpdatingId(ticket.id);
          try {
            await tickets.changeStatus(ticket.id, { toStatus: v });
            setLocalStatuses(p => ({ ...p, [ticket.id]: v }));
            toast.success(`Status → ${v}`);
          } catch (e: any) {
            toast.error(e?.message || 'Failed');
          } finally {
            setUpdatingId(null);
          }
        }}>
          <SelectTrigger className="h-7 w-[118px] rounded-lg border border-border bg-card px-2 py-0 text-[11px] font-semibold shadow-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Badge tone={statusTone(val)} className="capitalize text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap">
        {statusOptions.find(o => o.value === val)?.label ?? val}
      </Badge>
    );
  };

  /* ── Admin toolbar (right side) ── */
  const adminRight = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={reload} aria-label="Refresh"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted active:scale-95 transition-all">
        <RefreshCw className={cn('h-4 w-4 text-muted-foreground', query.loading && 'animate-spin text-primary')} />
      </button>
      <Button type="button" onClick={handleCreate}
        className="h-9 gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 shadow-xs active:scale-95">
        <Plus className="h-4 w-4 stroke-[2.5]" />{t('tickets.add', 'New Ticket')}
      </Button>
      <Button type="button" onClick={() => setShowFilters(p => !p)}
        className={cn('h-9 gap-1.5 rounded-md px-4 text-xs font-medium text-white shadow-xs active:scale-95 relative',
          showFilters || filterCount > 0 ? 'bg-sky-600 hover:bg-sky-700' : 'bg-sky-500 hover:bg-sky-600')}>
        <Filter className="h-3.5 w-3.5" />
        {showFilters ? 'Hide' : 'Filters'}
        {filterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-sky-700">
            {filterCount}
          </span>
        )}
      </Button>
    </div>
  );

  /* ── Filter panel (shared between mobile + admin) ── */
  const filterPanel = showFilters ? (
    <div className={cn('flex flex-wrap items-start gap-2.5 rounded-xl border border-border/70 p-3',
      isMobile ? 'bg-card shadow-xs' : 'bg-muted/30')}>
      {/* Search (admin only — mobile has it inline) */}
      {!isMobile && (
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('tickets.searchPlaceholder', 'Search tickets...')}
            className="h-9 pl-9 text-xs rounded-xl bg-card" />
        </div>
      )}
      {scope.showOrgFilter && (
        <div className="w-44">
          <EntitySelect value={filterOrgId} onChange={v => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
            fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('tickets.filterOrg', 'All organizations')} />
        </div>
      )}
      {scope.showCommunityFilter && (
        <div className="w-44">
          <EntitySelect value={filterCommunityId} onChange={v => { setFilterCommunityId(v); setPage(1); }}
            fetchPage={makeCommunityFetch(filterOrgId ?? undefined)} resolveLabel={resolveCommunityLabel}
            placeholder={t('tickets.filterCommunity', 'All communities')} />
        </div>
      )}
      <div className="w-36">
        <SelectField value={filterStatus ?? ALL} options={statusFilterOpts} size="sm"
          onChange={v => { setFilterStatus(v === ALL ? null : v); setPage(1); }} />
      </div>
      {filterCount > 0 && (
        <button type="button" onClick={() => { setSearch(''); setFilterOrgId(null); setFilterCommunityId(null); setFilterStatus(null); setPage(1); }}
          className="text-xs font-semibold text-primary hover:underline self-center px-1">
          Reset
        </button>
      )}
    </div>
  ) : null;

  /* ── Render ── */
  return (
    <div className={cn('w-full', isMobile ? 'mx-auto flex h-[100dvh] flex-col overflow-hidden bg-background' : 'space-y-4')}>

      {/* Mobile header */}
      {isMobile && <HelpDeskHeader title={pageTitle} mode="mobile" showBack onBack={handleBack} />}

      <div className={cn(isMobile ? 'min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3' : 'w-full')}>
        <Card className={cn('w-full space-y-4',
          isMobile ? 'rounded-none border-none shadow-none p-0 bg-transparent' : 'rounded-2xl border border-border/70 p-4 sm:p-5 bg-card shadow-sm')}>

          {/* Toolbar */}
          {!isMobile ? (
            <HelpDeskHeader title={pageTitle} mode="admin" rightActions={adminRight} />
          ) : (
            /* Mobile: search + filter + refresh inline */
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('tickets.searchPlaceholder', 'Search tickets...')}
                  className="h-10 w-full rounded-2xl pl-9 text-xs bg-card border-border/80" />
              </div>
              <button type="button" onClick={() => setShowFilters(p => !p)} aria-label="Filter"
                className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all active:scale-95',
                  showFilters || filterCount > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border/80 bg-card text-muted-foreground')}>
                <Filter className="h-4 w-4" />
                {filterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {filterCount}
                  </span>
                )}
              </button>
              <button type="button" onClick={reload} aria-label="Refresh"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card text-muted-foreground active:scale-95 transition-all">
                <RefreshCw className={cn('h-4 w-4', query.loading && 'animate-spin text-primary')} />
              </button>
              <button type="button" onClick={handleCreate} aria-label={t('tickets.add', 'New Ticket')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs active:scale-95 transition-all">
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>
          )}

          {/* Filter panel */}
          {filterPanel}

          {/* List body */}
          {query.loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
              {t('common.loading', 'Loading…')}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <LifeBuoy className="h-12 w-12 text-muted-foreground/25" />
              <p className="text-sm font-semibold text-muted-foreground">{t('tickets.empty', 'No tickets found')}</p>
              <Button type="button" onClick={handleCreate} className="rounded-xl text-xs font-bold">
                <Plus className="mr-1.5 h-3.5 w-3.5" />{t('tickets.add', 'Create Ticket')}
              </Button>
            </div>
          ) : showTable ? (
            /* ── Table (admin wide) ── */
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <THead>
                  <TR className="bg-muted/40">
                    <TH className="w-10 text-center text-xs">#</TH>
                    <TH className="text-xs">{t('tickets.colTicket', 'Ticket')}</TH>
                    {showCommunityCol && <TH className="w-40 text-xs">{t('tickets.colCommunity', 'Community')}</TH>}
                    <TH className="w-28 text-xs">{t('tickets.colCategory', 'Category')}</TH>
                    <TH className="w-24 text-xs">{t('tickets.colPriority', 'Priority')}</TH>
                    <TH className="w-36 text-xs">{t('tickets.colStatus', 'Status')}</TH>
                    <TH className="w-24 text-xs text-right">Created</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((raw: any, i: number) => {
                    const s = { ...raw, status: localStatuses[raw.id] ?? raw.status };
                    return (
                      <TR key={s.id} onClick={() => handleOpen(s)} className="cursor-pointer hover:bg-muted/40 transition-colors">
                        <TD className="text-center text-[11px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                        <TD>
                          <div className="min-w-0 max-w-md">
                            <div className="truncate text-sm font-bold text-foreground">{s.title}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{s.description || '—'}</div>
                          </div>
                        </TD>
                        {showCommunityCol && (
                          <TD className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 opacity-60 shrink-0" />
                              <span className="truncate">{s.communityName ?? '—'}</span>
                            </span>
                          </TD>
                        )}
                        <TD><Badge tone="default" className="text-[11px] capitalize">{catLabel(s.category)}</Badge></TD>
                        <TD>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', priorityColor(s.priority))} />
                            <Badge tone={priorityTone(s.priority)} className="text-[11px] font-bold uppercase">{priLabel(s.priority)}</Badge>
                          </div>
                        </TD>
                        <TD>{renderStatus(s)}</TD>
                        <TD className="text-right text-[11px] text-muted-foreground whitespace-nowrap">{fmt(s.createdAtUtc)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          ) : (
            /* ── Cards (mobile + admin small) ── */
            <div className={cn('grid gap-3', !isMobile && 'sm:grid-cols-2 xl:grid-cols-3')}>
              {items.map((raw: any) => {
                const s = { ...raw, status: localStatuses[raw.id] ?? raw.status };
                return (
                  <TicketCard key={s.id} ticket={s} categoryLabel={catLabel} priorityLabel={priLabel}
                    showCommunity={showCommunityCol} statusEl={renderStatus(s)} onClick={() => handleOpen(s)} />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {(query.data?.totalCount ?? 0) > pageSize && (
            <div className="pt-2">
              <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0}
                onPageChange={setPage} onPageSizeChange={(sz: any) => { setPageSize(sz); setPage(1); }} />
            </div>
          )}
        </Card>
      </div>

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default TicketsListPage;
