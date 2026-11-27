import { useMemo, useState } from 'react';
import { LifeBuoy, Plus, Building2, Calendar, Tag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { PageShell, FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { tickets, masterData } from '@shared/services';
import type { Ticket } from '@shared/api/tickets';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { cn } from '@shared/lib/utils';
import { usePermission } from '@shared/lib/hooks/usePermission';
import { useScope } from '@shared/lib/hooks/useScope';
import { useListState } from '@shared/lib/hooks/useListState';
import { statusTone, priorityDotClass } from '@shared/lib/statusTone';
import { EMPTY, formatDate } from '@shared/lib/format';
import { fetchOrgPage, makeCommunityFetch, resolveOrgLabel, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { tryToast } from '@shared/lib/withToast';

export interface StatusOption { value: string; label: string }

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'Open', label: 'Open' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export interface TicketsListPageProps {
  /** @deprecated The host app is set once with <SurfaceProvider>; only pass this to override it. */
  mode?: 'admin' | 'mobile';
  title?: string;
  submitPath?: string;
  detailsPathPrefix?: string;
  onBack?: () => void;
  onTicketClick?: (ticket: Ticket) => void;
  onSubmitClick?: () => void;
}

export function TicketsListPage(props: TicketsListPageProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><TicketsList {...props} /></SurfaceProvider>;
}

function TicketsList({ title, submitPath = '/helpdesk/new', detailsPathPrefix = '/helpdesk/', onBack, onTicketClick, onSubmitClick }: TicketsListPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const surface = useResolvedSurface();
  const compact = useIsCompact();
  // Rights come from this route's DB menu row (Help Desk -> 'tickets'); admins get all rights.
  const perm = usePermission();
  const scope = useScope();
  const access = {
    canChangeStatus: perm.canEdit,
    showOrgFilter: scope.showOrgFilter,
    showCommunityFilter: scope.showCommunityFilter,
    showCommunityColumn: !scope.scopedCommunityId && scope.canViewCommunity,
    scopedCommunityId: scope.scopedCommunityId ?? undefined,
  };

  const pageTitle = title ?? t('tickets.title', 'Help Desk');
  const handleCreate = () => onSubmitClick ? onSubmitClick() : navigate(submitPath);
  const handleOpen = (ticket: Ticket) => onTicketClick ? onTicketClick(ticket) : navigate(`${detailsPathPrefix}${ticket.id}`);

  const list = useListState();
  const { search, page, pageSize, reloadKey, reload } = list;
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const effectiveCommunityId = filterCommunityId ?? access.scopedCommunityId;
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

  const items = useMemo(
    () => (query.data?.items ?? []).map((raw) => ({ ...raw, status: localStatuses[raw.id] ?? raw.status })),
    [query.data, localStatuses],
  );
  const total = query.data?.totalCount ?? 0;

  const activeFilters = [filterOrgId, filterCommunityId].filter(Boolean).length
    + (filterStatus !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0);
  const resetFilters = () => { setFilterOrgId(null); setFilterCommunityId(null); setFilterStatus('all'); setFilterCategory('all'); list.resetPage(); };

  const changeStatus = async (ticketId: string, toStatus: string) => {
    setUpdatingId(ticketId);
    try {
      if (await tryToast(() => tickets.changeStatus(ticketId, { toStatus }), `Status updated to ${toStatus}`)) {
        setLocalStatuses((p) => ({ ...p, [ticketId]: toStatus }));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (v: string) => statusOptions.find((o) => o.value === v)?.label ?? v;

  const renderStatus = (ticket: Ticket) => {
    if (!access.canChangeStatus) {
      return (
        <Badge tone={statusTone(ticket.status)} className={cn('rounded px-1.5 py-0 font-medium', compact ? 'text-xs' : 'text-[10px]')}>
          {statusLabel(ticket.status)}
        </Badge>
      );
    }
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Select value={ticket.status} disabled={updatingId === ticket.id} onValueChange={(v) => changeStatus(ticket.id, v)}>
          <SelectTrigger className={cn('border border-border/80 bg-background font-medium',
            compact ? 'h-8 w-32 rounded-md px-2 text-xs' : 'h-6 w-24 rounded-[3px] px-1.5 py-0 text-[10px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {access.showOrgFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterOrgId}
          onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); list.resetPage(); }} fetchPage={fetchOrgPage}
          resolveLabel={resolveOrgLabel} placeholder={t('tickets.filterOrg', 'All societies')} />
      )}
      {access.showCommunityFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterCommunityId}
          onChange={(v) => { setFilterCommunityId(v); list.resetPage(); }} fetchPage={makeCommunityFetch(filterOrgId)}
          resolveLabel={resolveCommunityLabel} placeholder={t('tickets.filterCommunity', 'All communities')} />
      )}
      <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('tickets.allCategories', 'All Categories')}</SelectItem>{catOpts.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('tickets.allStatuses', 'All Statuses')}</SelectItem>{statusOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
      </Select>
    </>
  );

  const newButton = surface === 'app' ? (
    <Button size="sm" onClick={handleCreate} className="h-9 gap-1 rounded-full bg-white/20 px-3 text-sm font-semibold text-primary-foreground hover:bg-white/30">
      <Plus className="h-4 w-4" />{t('tickets.new', 'New')}
    </Button>
  ) : (
    <Button size="sm" onClick={handleCreate} className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
      <Plus className="h-3.5 w-3.5" />{t('tickets.add', 'New Ticket')}
    </Button>
  );

  return (
    <PageShell title={pageTitle} subtitle={surface === 'admin' ? t('tickets.subtitle', 'Manage resident requests, maintenance and support tickets') : undefined}
      icon={<LifeBuoy />} actions={newButton} onBack={onBack}>
      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('tickets.searchPlaceholder', 'Search tickets...') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('common.total')}: <span className="font-semibold text-foreground">{total}</span>
            </span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(s) => s.id}
        loading={query.loading}
        emptyIcon={<LifeBuoy className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('tickets.empty', 'No tickets found')}
        onItemClick={handleOpen}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(s) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{s.title}</div>
                {s.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p> : null}
              </div>
              {renderStatus(s)}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {s.priority ? (
                  <span className="flex items-center gap-1"><span className={cn('h-2 w-2 shrink-0 rounded-full', priorityDotClass(s.priority))} />{priLabel(s.priority)}</span>
                ) : null}
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5 shrink-0" />{catLabel(s.category)}</span>
                {access.showCommunityColumn && s.communityName ? <span className="flex items-center gap-1 truncate"><Building2 className="h-3.5 w-3.5 shrink-0" />{s.communityName}</span> : null}
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 shrink-0" />{formatDate(s.createdAtUtc)}</span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 px-2 py-1.5 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="px-2 py-1.5 text-[10.5px] font-semibold">{t('tickets.colTicket', 'Ticket')}</TH>
                {access.showCommunityColumn && <TH className="w-36 px-2 py-1.5 text-[10.5px] font-semibold">{t('tickets.colCommunity', 'Community')}</TH>}
                <TH className="w-28 px-2 py-1.5 text-[10.5px] font-semibold">{t('tickets.colCategory', 'Category')}</TH>
                <TH className="w-24 px-2 py-1.5 text-[10.5px] font-semibold">{t('tickets.colPriority', 'Priority')}</TH>
                <TH className="w-28 px-2 py-1.5 text-[10.5px] font-semibold">{t('tickets.colStatus', 'Status')}</TH>
                <TH className="w-24 px-2 py-1.5 text-right text-[10.5px] font-semibold">{t('tickets.colCreated', 'Created')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s, i) => (
                <TR key={s.id} onClick={() => handleOpen(s)} className="cursor-pointer transition-colors hover:bg-muted/30">
                  <TD className="px-2 py-1 text-center font-mono text-[10.5px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="px-2 py-1">
                    <div className="min-w-0 max-w-md">
                      <span className="block truncate text-xs font-semibold text-foreground">{s.title}</span>
                      <span className="block truncate text-[11px] font-normal text-muted-foreground">{s.description || EMPTY}</span>
                    </div>
                  </TD>
                  {access.showCommunityColumn && (
                    <TD className="px-2 py-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0 opacity-60" /><span className="truncate">{s.communityName ?? EMPTY}</span></span>
                    </TD>
                  )}
                  <TD className="px-2 py-1"><Badge tone="default" className="rounded px-1.5 py-0 text-[10px] capitalize">{catLabel(s.category)}</Badge></TD>
                  <TD className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', priorityDotClass(s.priority))} />
                      <Badge tone={statusTone(s.priority)} className="rounded px-1.5 py-0 text-[10px] font-medium uppercase">{priLabel(s.priority)}</Badge>
                    </div>
                  </TD>
                  <TD className="px-2 py-1">{renderStatus(s)}</TD>
                  <TD className="whitespace-nowrap px-2 py-1 text-right text-[10.5px] text-muted-foreground">{formatDate(s.createdAtUtc)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />
    </PageShell>
  );
}

export default TicketsListPage;
