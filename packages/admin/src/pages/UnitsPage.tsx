import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, Plus, Pencil, Trash2, Search, RefreshCw, Table as TableIcon, LayoutGrid, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField } from '@shared/components/SelectField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { units, masterData, organizations, communities } from '@shared/services';
import type { Unit } from '@shared/api/units';
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
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
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
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const clearScope = () => { setSearchParams({}); setPage(1); };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
              <Home className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('units.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {communityName ? t('units.inCommunity', { name: communityName }) : t('units.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulk(true)} className="h-9 gap-1.5 rounded-xl text-xs">
              <Layers className="h-4 w-4" />
              {t('units.bulkAdd')}
            </Button>
            <Button onClick={() => setCreating(true)} className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              {t('units.add')}
            </Button>
          </div>
        </div>
      </Card>

      {communityId ? (
        <Card className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/60 p-2.5 text-xs dark:bg-emerald-950/30">
          <span className="text-emerald-700 dark:text-emerald-300">{t('units.scopedTo', { name: communityName ?? '' })}</span>
          <button type="button" onClick={clearScope} className="font-semibold text-emerald-700 underline dark:text-emerald-300">{t('units.viewAll')}</button>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('units.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!communityId && scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('units.filterOrg')}
            />
          ) : null}
          {!communityId && scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('units.filterCommunity')}
            />
          ) : null}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('units.allStatuses')}</SelectItem>
              {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="pr-1 text-[11px] font-medium text-muted-foreground">
            {t('orgs.total')}: <span className="text-foreground">{query.data?.totalCount ?? 0}</span>
          </span>
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
          {query.loading ? t('common.loading') : t('units.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('units.colUnit')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('units.colCommunity')}</TH> : null}
                <TH className="w-32">{t('units.colCategory')}</TH>
                <TH className="w-28">{t('units.colFloor')}</TH>
                <TH className="w-28">{t('units.colConfig')}</TH>
                <TH className="w-32">{t('units.colStatus')}</TH>
                <TH className="w-24 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((u, i) => (
                <TR key={u.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                        <Home className="h-4 w-4" />
                      </span>
                      <span className="truncate text-[13px] font-semibold">{u.unitNumber}</span>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{u.communityName ?? '—'}</TD> : null}
                  <TD><Badge tone="default">{labelOf(typeOptions, u.unitType)}</Badge></TD>
                  <TD className="text-[11px] font-medium text-muted-foreground">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</TD>
                  <TD><Badge tone="success">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</Badge></TD>
                  <TD><Badge tone={statusTone(u.unitStatus)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{labelOf(statusOptions, u.unitStatus)}</Badge></TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(u)} title={t('units.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(u)} title={t('units.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((u) => (
            <Card key={u.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                  <Home className="h-5 w-5" />
                </span>
                <Badge tone={statusTone(u.unitStatus)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{labelOf(statusOptions, u.unitStatus)}</Badge>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{u.unitNumber}</div>
                {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{u.communityName ?? '—'}</div> : null}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
                <div><div className="text-[9.5px] uppercase text-muted-foreground">{t('units.colCategory')}</div><div className="font-medium">{labelOf(typeOptions, u.unitType)}</div></div>
                <div><div className="text-[9.5px] uppercase text-muted-foreground">{t('units.colFloor')}</div><div className="font-medium">{u.floor ? t('units.floorN', { n: u.floor }) : t('units.ground')}</div></div>
                <div><div className="text-[9.5px] uppercase text-muted-foreground">{t('units.colConfig')}</div><div className="font-medium">{u.bedrooms ? t('units.bhk', { n: u.bedrooms }) : t('units.studio')}</div></div>
              </div>
              <div className="flex items-center justify-end gap-1.5 border-t border-border pt-3">
                <button type="button" onClick={() => setEditing(u)} title={t('units.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setConfirmDelete(u)} title={t('units.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                  <Trash2 className="h-4 w-4" />
                </button>
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

      <UnitFormDialog open={creating} typeOptions={typeOptions} statusOptions={statusOptions} {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <UnitFormDialog open={!!editing} unit={editing} typeOptions={typeOptions} statusOptions={statusOptions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <BulkUnitsDialog open={bulk} typeOptions={typeOptions} statusOptions={statusOptions} {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})} onClose={() => setBulk(false)} onSaved={() => { setBulk(false); reload(); }} />

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

      <Toaster position="top-center" richColors />
    </div>
  );
}

function UnitFormDialog({ open, unit, presetCommunityId, typeOptions, statusOptions, onClose, onSaved }: { open: boolean; unit?: Unit | null; presetCommunityId?: string; typeOptions: Option[]; statusOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!unit;
  const [communityId, setCommunityId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitType, setUnitType] = useState('');
  const [unitStatus, setUnitStatus] = useState('vacant');
  const [floor, setFloor] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(presetCommunityId ?? '');
    setUnitNumber(unit?.unitNumber ?? '');
    setUnitType(unit?.unitType ?? typeOptions[0]?.value ?? '');
    setUnitStatus(unit?.unitStatus ?? 'vacant');
    setFloor(unit?.floor ?? '');
    setBedrooms(unit?.bedrooms != null ? String(unit.bedrooms) : '');
  }, [open, unit, presetCommunityId, typeOptions]);

  const submit = async () => {
    if (busy || !unitNumber.trim() || !unitType) return;
    if (!isEdit && !communityId) { toast.error(t('units.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await units.update(unit!.id, {
          unitNumber: unitNumber.trim(),
          unitType,
          unitStatus,
          floor: floor.trim() ? floor.trim() : null,
          updateFloor: true,
          bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
          updateBedrooms: true,
        });
      } else {
        await units.create({
          communityId,
          unitNumber: unitNumber.trim(),
          unitType,
          unitStatus,
          floor: floor.trim() ? floor.trim() : null,
          bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
        });
      }
      toast.success(isEdit ? t('units.updated') : t('units.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={isEdit ? t('units.editTitle') : t('units.addTitle')} />
      <div className="flex flex-col gap-3">
        {!isEdit && !presetCommunityId ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.community')}</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('units.selectCommunity')} />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.unitNumber')}</label>
          <Input autoFocus value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder={t('units.unitNumberPlaceholder')} maxLength={100} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('units.type')} value={unitType || null} options={typeOptions} placeholder={t('units.selectType')} onChange={setUnitType} />
          <SelectField label={t('units.status')} value={unitStatus} options={statusOptions} onChange={setUnitStatus} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.floorLabel')}</label>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 4" maxLength={100} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.bedrooms')}</label>
            <Input type="number" min={0} max={20} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="e.g. 2" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !unitNumber.trim()} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('units.saveChanges') : t('units.createUnit')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function BulkUnitsDialog({ open, presetCommunityId, typeOptions, statusOptions, onClose, onSaved }: { open: boolean; presetCommunityId?: string; typeOptions: Option[]; statusOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [communityId, setCommunityId] = useState('');
  const [towers, setTowers] = useState('A, B');
  const [floors, setFloors] = useState('5');
  const [rooms, setRooms] = useState('4');
  const [startFloor, setStartFloor] = useState('1');
  const [unitType, setUnitType] = useState('');
  const [unitStatus, setUnitStatus] = useState('vacant');
  const [bedrooms, setBedrooms] = useState('2');
  const [separator, setSeparator] = useState('-');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(presetCommunityId ?? '');
    setUnitType(typeOptions[0]?.value ?? '');
  }, [open, presetCommunityId, typeOptions]);

  const generated = useMemo(() => {
    const towerList = towers.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const nFloors = Math.max(1, Number(floors) || 0);
    const nRooms = Math.max(1, Number(rooms) || 0);
    const start = Math.max(0, Number(startFloor) || 0);
    const pad = nRooms >= 100 ? 3 : 2;
    const out: string[] = [];
    for (const tw of towerList) {
      for (let f = start; f < start + nFloors; f++) {
        for (let r = 1; r <= nRooms; r++) {
          out.push(`${tw}${separator}${f}${String(r).padStart(pad, '0')}`);
        }
      }
    }
    return out;
  }, [towers, floors, rooms, startFloor, separator]);

  const run = async () => {
    if (busy || !communityId || !unitType || generated.length === 0) {
      if (!communityId) toast.error(t('units.needCommunity'));
      return;
    }
    setBusy(true);
    let done = 0;
    let failed = 0;
    for (const unitNumber of generated) {
      try {
        await units.create({ communityId, unitNumber, unitType, unitStatus, bedrooms: bedrooms.trim() ? Number(bedrooms) : null });
        done++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    toast.success(t('units.bulkDone', { done, failed }));
    onSaved();
  };

  const SEP_OPTIONS = [
    { value: '-', label: 'A-101' },
    { value: '', label: 'A101' },
    { value: '/', label: 'A/101' },
  ];

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={t('units.bulkTitle')} description={t('units.bulkSubtitle')} />
      <div className="flex flex-col gap-3">
        {!presetCommunityId ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.community')}</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('units.selectCommunity')} />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.towers')}</label>
          <Input value={towers} onChange={(e) => setTowers(e.target.value)} placeholder="A, B, C" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.floors')}</label><Input type="number" min={1} value={floors} onChange={(e) => setFloors(e.target.value)} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.roomsPerFloor')}</label><Input type="number" min={1} value={rooms} onChange={(e) => setRooms(e.target.value)} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.startFloor')}</label><Input type="number" min={0} value={startFloor} onChange={(e) => setStartFloor(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('units.type')} value={unitType || null} options={typeOptions} onChange={setUnitType} />
          <SelectField label={t('units.status')} value={unitStatus} options={statusOptions} onChange={setUnitStatus} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('units.bedrooms')}</label><Input type="number" min={0} max={20} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} /></div>
          <SelectField label={t('units.separator')} value={separator} options={SEP_OPTIONS} onChange={setSeparator} />
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          {t('units.bulkPreview', { count: generated.length })}: <span className="font-mono text-foreground">{generated.slice(0, 6).join(', ')}{generated.length > 6 ? '…' : ''}</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={run} disabled={busy || generated.length === 0} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{busy ? t('units.creating') : t('units.createN', { count: generated.length })}</Button>
      </DialogFooter>
    </Dialog>
  );
}
