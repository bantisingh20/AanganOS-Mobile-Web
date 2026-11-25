import { useMemo, useState } from 'react';
import { LifeBuoy, Search, RefreshCw, Plus, Building2, Calendar, Tag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster, toast } from 'sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { HelpDeskHeader } from './HelpDeskHeader';
import { tickets, masterData, organizations, communities } from '@shared/services';
import type { Ticket } from '@shared/api/tickets';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';

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

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export interface TicketsListPageProps {
  mode?: 'admin' | 'mobile';
  title?: string;
  submitPath?: string;
  detailsPathPrefix?: string;
  onBack?: () => void;
  onTicketClick?: (ticket: Ticket) => void;
  onSubmitClick?: () => void;
}

const fetchOrg = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal }).then((d) => ({ items: d.items.map((o: any) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const fetchComm = (orgId?: string) => (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: search || undefined, page, pageSize }, orgId ? { organizationId: orgId } : {}, { signal }).then((d) => ({ items: d.items.map((c: any) => ({ value: c.id, label: c.name })), total: d.totalCount }));

export function TicketsListPage({ mode = 'admin', title, submitPath, detailsPathPrefix, onBack, onTicketClick, onSubmitClick }: TicketsListPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const { roles } = useAuth();
  const perm = usePermission(['helpdesk', 'Ticket', 'app.helpdesk', 'maintenance']);
  const isMobile = mode === 'mobile';

  const canChangeStatus = scope.isPowerUser || scope.isOrgAdmin || roles.some((r: any) => /admin|communityadmin|organizationadmin/i.test(r)) || perm.canEdit || perm.isAdmin;
  const pageTitle = title ?? t('tickets.title', 'Help Desk');
  const resolvedSubmitPath = submitPath ?? (isMobile ? '/raise-ticket' : '/tickets/new');
  const resolvedDetailsPrefix = detailsPathPrefix ?? (isMobile ? '/my-tickets/' : '/tickets/');

  const handleBack = () => { if (onBack) return onBack(); (window.history.state?.idx > 0) ? navigate(-1) : navigate(isMobile ? '/home' : '/dashboard'); };
  const handleCreate = () => onSubmitClick ? onSubmitClick() : navigate(resolvedSubmitPath);
  const handleOpen = (ticket: Ticket) => onTicketClick ? onTicketClick(ticket) : navigate(`${resolvedDetailsPrefix}${ticket.id}`);

  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const statusesQ = useAsync((s: any) => masterData.list('Ticket_Status', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<StatusOption[]>(() => {
    const a = (statusesQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label }));
    return a.length > 0 ? a : DEFAULT_STATUS_OPTIONS;
  }, [statusesQ.data]);

  const catsQ = useAsync((s: any) => masterData.list('Ticket_Category', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const catOpts = useMemo(() => (catsQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label })), [catsQ.data]);
  const catLabel = (c: string) => catOpts.find((o) => o.value === c)?.label ?? c;

  const priQ = useAsync((s: any) => masterData.list('Ticket_Priority', null, { signal: s }).catch(() => [] as MasterDataEntry[]), []);
  const priOpts = useMemo(() => (priQ.data ?? []).map((e: any) => ({ value: e.code, label: e.label })), [priQ.data]);
  const priLabel = (c: string) => priOpts.find((o) => o.value === c)?.label ?? c;

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const query = useAsync(
    (s: any) => tickets.list(
      { search: search.trim() || undefined, page, pageSize, sort: 'createdAtUtc:desc' },
      {
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterCategory !== 'all' ? { category: filterCategory } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal: s },
    ).catch(() => null),
    [search, filterStatus, filterCategory, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;

  const changeStatus = async (ticketId: string, toStatus: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUpdatingId(ticketId);
    try {
      await tickets.changeStatus(ticketId, { toStatus });
      setLocalStatuses((p) => ({ ...p, [ticketId]: toStatus }));
      toast.success(`Status updated to ${toStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatus = (ticket: Ticket) => {
    const val = localStatuses[ticket.id] ?? ticket.status;
    if (canChangeStatus) {
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={val} disabled={updatingId === ticket.id} onValueChange={(v) => changeStatus(ticket.id, v)}>
            <SelectTrigger className="h-6 w-24 rounded-[3px] border border-border/80 bg-background px-1.5 py-0 text-[10px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <Badge tone={statusTone(val)} className="text-[10px] px-1.5 py-0 rounded font-medium">
        {statusOptions.find((o) => o.value === val)?.label ?? val}
      </Badge>
    );
  };

  const content = (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />
      {!isMobile && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5 text-primary" />{pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('tickets.subtitle', 'Manage resident requests, maintenance and support tickets')}</p>
          </div>
          <Button size="sm" onClick={handleCreate} className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
            <Plus className="h-3 w-3 stroke-[2.5]" />{t('tickets.add', 'New Ticket')}
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('tickets.searchPlaceholder', 'Search tickets...')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          {scope.showOrgFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }} fetchPage={fetchOrg}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)} placeholder={t('tickets.filterOrg', 'All societies')} />
          )}
          {scope.showCommunityFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }} fetchPage={fetchComm(filterOrgId ?? undefined)}
              resolveLabel={(id, sig) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null)} placeholder={t('tickets.filterCommunity', 'All communities')} />
          )}
          <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{catOpts.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('tickets.allStatuses', 'All Statuses')}</SelectItem>{statusOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
          {isMobile && (
            <Button size="sm" onClick={handleCreate} className="h-7.5 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
              <Plus className="h-3 w-3" />New
            </Button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading', 'Loading…')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <LifeBuoy className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('tickets.empty', 'No tickets found')}</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((raw) => {
                const s = { ...raw, status: localStatuses[raw.id] ?? raw.status };
                return (
                  <div key={s.id} onClick={() => handleOpen(s)} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', priorityColor(s.priority))} />
                        <span className="font-semibold text-xs text-foreground truncate">{s.title}</span>
                      </div>
                      {renderStatus(s)}
                    </div>
                    {s.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{s.description}</p>}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10.5px] text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="flex items-center gap-0.5"><Tag className="h-3 w-3 shrink-0" />{catLabel(s.category)}</span>
                        {showCommunityCol && s.communityName && <span className="flex items-center gap-0.5 truncate"><Building2 className="h-3 w-3 shrink-0" />{s.communityName}</span>}
                        <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3 shrink-0" />{fmt(s.createdAtUtc)}</span>
                      </div>
                      <span className="flex items-center text-primary font-medium shrink-0">View <ChevronRight className="h-3 w-3" /></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('tickets.colTicket', 'Ticket')}</TH>
                    {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('tickets.colCommunity', 'Community')}</TH>}
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('tickets.colCategory', 'Category')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('tickets.colPriority', 'Priority')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('tickets.colStatus', 'Status')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-right text-[10.5px] font-semibold">Created</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((raw: any, i: number) => {
                    const s = { ...raw, status: localStatuses[raw.id] ?? raw.status };
                    return (
                      <TR key={s.id} onClick={() => handleOpen(s)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                        <TD className="py-1 px-2">
                          <div className="min-w-0 max-w-md">
                            <span className="font-semibold text-xs text-foreground block truncate">{s.title}</span>
                            <span className="font-normal text-[11px] text-muted-foreground block truncate">{s.description || '—'}</span>
                          </div>
                        </TD>
                        {showCommunityCol && (
                          <TD className="py-1 px-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3 opacity-60 shrink-0" /><span className="truncate">{s.communityName ?? '—'}</span></span>
                          </TD>
                        )}
                        <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded capitalize">{catLabel(s.category)}</Badge></TD>
                        <TD className="py-1 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('h-1.5 w-1.5 rounded-full', priorityColor(s.priority))} />
                            <Badge tone={priorityTone(s.priority)} className="text-[10px] px-1.5 py-0 rounded font-medium uppercase">{priLabel(s.priority)}</Badge>
                          </div>
                        </TD>
                        <TD className="py-1 px-2">{renderStatus(s)}</TD>
                        <TD className="py-1 px-2 text-right text-[10.5px] text-muted-foreground whitespace-nowrap">{fmt(s.createdAtUtc)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </>
        )}

        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </div>
        )}
      </div>
    </div>
  );

  return isMobile ? (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <HelpDeskHeader title={pageTitle} mode="mobile" showBack onBack={handleBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{content}</div>
    </div>
  ) : content;
}

export default TicketsListPage;
