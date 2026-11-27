import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, Plus, Pencil, Trash2, Layers, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { UnitFormDialog, type Option } from './UnitFormDialog';
import { BulkUnitsDialog } from './BulkUnitsDialog';
import { units, masterData } from '@shared/services';
import type { Unit } from '@shared/api/units';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { statusTone } from '@shared/lib/statusTone';
import { fetchOrgPage, makeCommunityFetch, resolveCommunityLabel, resolveOrgLabel } from '@shared/lib/entityFetchers';
import { cn } from '@shared/lib/utils';
import { unitLabel } from '@shared/lib/unitLabel';

export function UnitsPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const [searchParams, setSearchParams] = useSearchParams();
  const communityId = searchParams.get('communityId') ?? undefined;
  const communityName = searchParams.get('communityName') ?? undefined;

  const scope = useScope();
  const list = useListState();
  const { search, page, pageSize, reloadKey, reload, resetPage } = list;
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Unit | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const typeQuery = useAsync((signal) => masterData.list('Unit_Type', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusQuery = useAsync((signal) => masterData.list('Unit_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const typeOptions: Option[] = useMemo(() => (typeQuery.data ?? []).map((m) => ({ value: m.code, label: m.label })), [typeQuery.data]);
  const statusOptions: Option[] = useMemo(() => (statusQuery.data ?? []).map((m) => ({ value: m.code, label: m.label })), [statusQuery.data]);
  const labelOf = (opts: Option[], code: string | null | undefined) => opts.find((o) => o.value === code)?.label ?? code ?? EMPTY;

  const effectiveCommunityId = communityId ?? filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const effectiveOrgId = !effectiveCommunityId
    ? (scope.showOrgFilter ? filterOrgId ?? undefined : scope.organizationId ?? undefined)
    : undefined;

  const query = useAsync(
    (signal) => units.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        ...(statusFilter !== 'all' ? { unitStatus: statusFilter } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, statusFilter, effectiveCommunityId, effectiveOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !communityId && !scope.scopedCommunityId && scope.canViewCommunity;

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => units.remove(confirmDelete.id), t('units.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const total = query.data?.totalCount ?? 0;
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3 w-3';

  const showOrgFilter = !communityId && scope.showOrgFilter;
  const showCommunityFilter = !communityId && scope.showCommunityFilter;
  const activeFilters = (showOrgFilter && filterOrgId ? 1 : 0)
    + (showCommunityFilter && filterCommunityId ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0);
  const resetFilters = () => { setFilterOrgId(null); setFilterCommunityId(null); setStatusFilter('all'); resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {showOrgFilter && (
        <EntitySelect
          className={filterEntityClass(layout, 'w-36')}
          value={filterOrgId}
          onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); resetPage(); }}
          fetchPage={fetchOrgPage}
          resolveLabel={resolveOrgLabel}
          placeholder={t('units.filterOrg')}
        />
      )}

      {showCommunityFilter && (
        <EntitySelect
          className={filterEntityClass(layout, 'w-36')}
          value={filterCommunityId}
          onChange={(v) => { setFilterCommunityId(v); resetPage(); }}
          fetchPage={makeCommunityFetch(filterOrgId ?? scope.organizationId ?? undefined)}
          resolveLabel={resolveCommunityLabel}
          placeholder={t('units.filterCommunity')}
        />
      )}

      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-28')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('units.allStatuses')}</SelectItem>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  const renderActions = (u: Unit) => (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button type="button" onClick={() => setEditing(u)} title={t('units.edit')} className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors', actionSize)}>
        <Pencil className={iconSize} />
      </button>
      <button type="button" onClick={() => setConfirmDelete(u)} title={t('units.delete')} className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}>
        <Trash2 className={iconSize} />
      </button>
    </div>
  );

  const statusBadge = (u: Unit) => (
    <Badge tone={statusTone(u.unitStatus)} className="text-[10px] px-1.5 py-0 rounded shrink-0">
      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
      {labelOf(statusOptions, u.unitStatus)}
    </Badge>
  );

  const headerButton = compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]';

  return (
    <PageShell
      className="w-full"
      title={t('units.title')}
      subtitle={communityName ? t('units.inCommunity', { name: communityName }) : t('units.subtitle')}
      icon={<Home />}
      actions={(
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulk(true)}
            className={cn('gap-1 font-medium border-border/80', headerButton)}
          >
            <Layers className="h-3 w-3" />
            {t('units.bulkAdd')}
          </Button>

          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className={cn('gap-1 font-medium', headerButton)}
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            {t('units.add')}
          </Button>
        </>
      )}
    >
      {/* Scoped Community Filter Alert if active */}
      {communityId && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px]">
          <span className="font-medium text-foreground">{t('units.scopedTo', { name: communityName ?? '' })}</span>
          <button
            type="button"
            onClick={() => { setSearchParams({}); setFilterCommunityId(null); }}
            className={cn('flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]', compact && 'min-h-9')}
          >
            <X className="h-3 w-3" />
            {t('units.viewAll')}
          </button>
        </div>
      )}

      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('units.searchPlaceholder') }}
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
        keyOf={(u) => u.id}
        loading={query.loading}
        emptyIcon={<Home className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={(
          <>
            {t('units.empty')}
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              Add individual units or use Bulk Add to generate a tower.
            </span>
          </>
        )}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(u, i) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{unitLabel(u)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                  </div>
                  {showCommunityCol && u.communityName && <span className="block truncate text-xs text-muted-foreground">{u.communityName}</span>}
                </div>
              </div>
              {statusBadge(u)}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{labelOf(typeOptions, u.unitType)}</Badge>
                <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</Badge>
                <span className="text-xs text-muted-foreground font-medium">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</span>
              </div>
              {renderActions(u)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colUnit')}</TH>
                {showCommunityCol && <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colCommunity')}</TH>}
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colCategory')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colFloor')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colConfig')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('units.colStatus')}</TH>
                <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((u, i) => (
                <TR key={u.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="py-1 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Home className="h-3 w-3" />
                      </span>
                      <div>
                        <span className="font-semibold text-xs text-foreground leading-none">{unitLabel(u)}</span>
                        <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {u.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </TD>
                  {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground font-medium">{u.communityName ?? EMPTY}</TD>}
                  <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{labelOf(typeOptions, u.unitType)}</Badge></TD>
                  <TD className="py-1 px-2 text-xs text-muted-foreground">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</TD>
                  <TD className="py-1 px-2"><Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</Badge></TD>
                  <TD className="py-1 px-2">{statusBadge(u)}</TD>
                  <TD className="py-1 px-2">{renderActions(u)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <UnitFormDialog
        open={creating || !!editing}
        unit={editing}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        {...(!editing && effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

      <BulkUnitsDialog
        open={bulk}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})}
        {...(filterOrgId ? { presetOrgId: filterOrgId } : {})}
        onClose={() => setBulk(false)}
        onSaved={() => { setBulk(false); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('units.delete')}
        description={confirmDelete ? t('units.deleteConfirm', { name: unitLabel(confirmDelete) }) : ''}
        confirmLabel={t('units.delete')}
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}
