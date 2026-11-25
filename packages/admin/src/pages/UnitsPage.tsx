import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, Plus, Pencil, Trash2, Search, RefreshCw, Layers, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { UnitFormDialog, type Option } from './units/UnitFormDialog';
import { BulkUnitsDialog } from './units/BulkUnitsDialog';
import { units, masterData, organizations, communities } from '@shared/services';
import type { Unit } from '@shared/api/units';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

const fetchOrgPage = (s: string, p: number, ps: number, sig: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: s || undefined, page: p, pageSize: ps }, { signal: sig })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const makeCommunityFetch = (orgId?: string) => (s: string, p: number, ps: number, sig: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: s || undefined, page: p, pageSize: ps }, orgId ? { organizationId: orgId } : {}, { signal: sig })
    .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));

const resolveCommunityLabel = (id: string, sig: AbortSignal) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null);
const resolveOrgLabel = (id: string, sig: AbortSignal) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null);

function statusTone(code: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (code === 'occupied' || code === 'available') return 'success';
  if (code === 'under_maintenance') return 'warning';
  if (code === 'blocked') return 'danger';
  return 'muted';
}

export function UnitsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const communityId = searchParams.get('communityId') ?? undefined;
  const communityName = searchParams.get('communityName') ?? undefined;

  const scope = useScope();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Unit | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const typeQuery = useAsync((signal) => masterData.list('Unit_Type', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusQuery = useAsync((signal) => masterData.list('Unit_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const typeOptions: Option[] = useMemo(() => (typeQuery.data ?? []).map((m) => ({ value: m.code, label: m.label })), [typeQuery.data]);
  const statusOptions: Option[] = useMemo(() => (statusQuery.data ?? []).map((m) => ({ value: m.code, label: m.label })), [statusQuery.data]);
  const labelOf = (opts: Option[], code: string | null | undefined) => opts.find((o) => o.value === code)?.label ?? code ?? '—';

  const effectiveCommunityId = communityId ?? filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const effectiveOrgId = !effectiveCommunityId && scope.showOrgFilter ? filterOrgId ?? undefined : undefined;

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
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await units.remove(confirmDelete.id);
      toast.success(t('units.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  return (
    <div className="w-full space-y-2">
      {/* Page Header: Compact Title & Action Buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5 text-primary" />
            {t('units.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {communityName ? t('units.inCommunity', { name: communityName }) : t('units.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulk(true)}
            className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium border-border/80"
          >
            <Layers className="h-3 w-3" />
            {t('units.bulkAdd')}
          </Button>

          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            {t('units.add')}
          </Button>
        </div>
      </div>

      {/* Scoped Community Filter Alert if active */}
      {communityId && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px]">
          <span className="font-medium text-foreground">{t('units.scopedTo', { name: communityName ?? '' })}</span>
          <button
            type="button"
            onClick={() => { setSearchParams({}); setFilterCommunityId(null); }}
            className="flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
          >
            <X className="h-3 w-3" />
            {t('units.viewAll')}
          </button>
        </div>
      )}

      {/* Filter Bar: Clean Alignment & Compact Sizing */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('units.searchPlaceholder')}
              className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background"
            />
          </div>

          {!communityId && scope.showOrgFilter && (
            <EntitySelect
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('units.filterOrg')}
            />
          )}

          {!communityId && scope.showCommunityFilter && (
            <EntitySelect
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('units.filterCommunity')}
            />
          )}

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-md text-[11px] bg-background px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('units.allStatuses')}</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('orgs.total')}: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reload}
            aria-label="Refresh"
            className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80"
          >
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Units Container: Table on Desktop/Tablet, Clean Compact Cards on Mobile */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Home className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('units.empty')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Add individual units or use Bulk Add to generate a tower.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards (hidden on md and up) */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((u, i) => (
                <div key={u.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Home className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground truncate">{u.unitNumber}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                        </div>
                        {showCommunityCol && u.communityName && <span className="block truncate text-[11px] text-muted-foreground">{u.communityName}</span>}
                      </div>
                    </div>
                    <Badge tone={statusTone(u.unitStatus)} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                      {labelOf(statusOptions, u.unitStatus)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{labelOf(typeOptions, u.unitType)}</Badge>
                      <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</Badge>
                      <span className="text-[11px] text-muted-foreground font-medium">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setEditing(u)} title={t('units.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(u)} title={t('units.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Compact Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
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
                    <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
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
                            <span className="font-semibold text-xs text-foreground leading-none">{u.unitNumber}</span>
                            <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {u.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </TD>
                      {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground font-medium">{u.communityName ?? '—'}</TD>}
                      <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{labelOf(typeOptions, u.unitType)}</Badge></TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</TD>
                      <TD className="py-1 px-2"><Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</Badge></TD>
                      <TD className="py-1 px-2">
                        <Badge tone={statusTone(u.unitStatus)} className="text-[10px] px-1.5 py-0 rounded">
                          <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                          {labelOf(statusOptions, u.unitStatus)}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditing(u)} title={t('units.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(u)} title={t('units.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}

        {/* Integrated Pagination Bar */}
        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={query.data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

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
        onClose={() => setBulk(false)}
        onSaved={() => { setBulk(false); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('units.delete')}
        description={confirmDelete ? t('units.deleteConfirm', { name: confirmDelete.unitNumber }) : ''}
        confirmLabel={t('units.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
