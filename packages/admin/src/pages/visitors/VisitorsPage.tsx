import { useMemo, useState } from 'react';
import { DoorOpen, Phone, UserCheck, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { PageShell, FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { gate, masterData } from '@shared/services';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { EMPTY } from '@shared/lib/format';
import { fetchOrgPage, resolveOrgLabel } from '@shared/lib/entityFetchers';
import { statusTone } from '@shared/lib/statusTone';
import { useListState } from '@shared/lib/hooks/useListState';

export function VisitorsPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const compact = useIsCompact();
  const { search, setSearch, page, setPage, pageSize, setPageSize, reloadKey, reload, resetPage } = useListState();
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const statusesQuery = useAsync((signal) => masterData.list('Visitor_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo(() => (statusesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [statusesQuery.data]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const categoriesQuery = useAsync((signal) => masterData.list('Visitor_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code;

  const query = useAsync(
    (signal) => gate.listVisitors(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterOrgId ? { organizationId: filterOrgId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, filterStatus, filterOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.totalCount ?? 0;
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;

  const activeFilters = (filterOrgId ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);
  const resetFilters = () => { setFilterOrgId(null); setFilterStatus('all'); resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {scope.showOrgFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterOrgId}
          onChange={(v) => { setFilterOrgId(v); resetPage(); }} fetchPage={fetchOrgPage}
          resolveLabel={resolveOrgLabel} placeholder={t('visitors.filterOrg')} />
      )}
      <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('visitors.allStatuses')}</SelectItem>
          {statusOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <PageShell title={t('visitors.title')} subtitle={t('visitors.subtitle')} icon={<DoorOpen />} className="w-full">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t('visitors.searchPlaceholder') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{total}</span></span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(s) => s.id}
        loading={query.loading}
        emptyIcon={<DoorOpen className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('visitors.empty')}
        pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: setPageSize }}
        renderCard={(s) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{s.name}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {s.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 opacity-60" />{s.phone}</span>}
                  {s.hostUnitNumber && <span>Unit: {s.hostUnitNumber}</span>}
                </div>
              </div>
              <Badge tone={statusTone(s.status)} className="text-xs px-1.5 py-0 rounded shrink-0">
                {statusLabel(s.status)}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{categoryLabel(s.category)}</Badge>
                {showCommunityCol && (s.communityName ?? s.organizationName) ? (
                  <span className="flex items-center gap-1 truncate"><Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />{s.communityName ?? s.organizationName}</span>
                ) : null}
              </div>
              {s.whomToMeet && <span className="flex min-w-0 items-center gap-1 truncate"><UserCheck className="h-3.5 w-3.5 shrink-0 opacity-60" />{s.whomToMeet}</span>}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colVisitor')}</TH>
                {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colCommunity')}</TH>}
                <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colCategory')}</TH>
                <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('visitors.colStatus')}</TH>
                <TH className="w-36 py-1.5 px-2 text-right text-[10.5px] font-semibold">Whom to Meet</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((s, i) => (
                <TR key={s.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="py-1 px-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-foreground block truncate">{s.name}</span>
                      <span className="text-[10.5px] text-muted-foreground block truncate">{s.phone ?? (s.hostUnitNumber ? `Unit: ${s.hostUnitNumber}` : EMPTY)}</span>
                    </div>
                  </TD>
                  {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{s.communityName ?? s.organizationName ?? EMPTY}</TD>}
                  <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{categoryLabel(s.category)}</Badge></TD>
                  <TD className="py-1 px-2">
                    <Badge tone={statusTone(s.status)} className="text-[10px] px-1.5 py-0 rounded">
                      {statusLabel(s.status)}
                    </Badge>
                  </TD>
                  <TD className="py-1 px-2 text-right text-[11px] text-muted-foreground truncate">{s.whomToMeet ?? EMPTY}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />
    </PageShell>
  );
}

export default VisitorsPage;
