import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Plus, Pencil, Trash2, Search, RefreshCw, Table as TableIcon, LayoutGrid, Eye, EyeOff } from 'lucide-react';
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
import { amenities, masterData, organizations, communities } from '@shared/services';
import type { Amenity } from '@shared/api/amenities';
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

const ACTIVE_STATUS = 'active';
const INACTIVE_STATUS = 'inactive';

export function AmenitiesPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Amenity | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const typesQuery = useAsync((signal) => masterData.list('Amenity_Type', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const typeOptions = useMemo<Option[]>(() => (typesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [typesQuery.data]);
  const typeLabel = (code: string) => typeOptions.find((o) => o.value === code)?.label ?? code;

  const statusesQuery = useAsync((signal) => masterData.list('Amenity_Status', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const statusOptions = useMemo<Option[]>(() => (statusesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [statusesQuery.data]);
  const statusLabel = (code: string) => statusOptions.find((o) => o.value === code)?.label ?? code;

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;

  const query = useAsync(
    (signal) => amenities.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const toggleActive = async (a: Amenity) => {
    setTogglingId(a.id);
    try {
      const isActive = a.status === ACTIVE_STATUS;
      await amenities.update(a.id, { status: isActive ? INACTIVE_STATUS : ACTIVE_STATUS });
      toast.success(isActive ? t('amenities.deactivated') : t('amenities.activated'));
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await amenities.remove(confirmDelete.id);
      toast.success(t('amenities.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const StatusBadge = ({ a }: { a: Amenity }) => {
    const isActive = a.status === ACTIVE_STATUS;
    return (
      <Badge tone={isActive ? 'success' : 'muted'}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {statusLabel(a.status)}
      </Badge>
    );
  };

  const RowActions = ({ a }: { a: Amenity }) => {
    const isActive = a.status === ACTIVE_STATUS;
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} aria-label={isActive ? t('amenities.deactivate') : t('amenities.activate')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-600 disabled:opacity-50">
          {isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setEditing(a)} aria-label={t('amenities.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setConfirmDelete(a)} aria-label={t('amenities.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <Dumbbell className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('amenities.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('amenities.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('amenities.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('amenities.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('amenities.filterOrg')}
            />
          ) : null}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('amenities.filterCommunity')}
            />
          ) : null}
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
          {query.loading ? t('common.loading') : t('amenities.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('amenities.colAmenity')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('amenities.colCommunity')}</TH> : null}
                <TH className="w-32">{t('amenities.colType')}</TH>
                <TH className="w-24 text-center">{t('amenities.colCapacity')}</TH>
                <TH className="w-28">{t('amenities.colStatus')}</TH>
                <TH className="w-36 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((a, i) => (
                <TR key={a.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{a.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{a.code}{a.location ? ` · ${a.location}` : ''}</div>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{a.communityName ?? '—'}</TD> : null}
                  <TD><Badge tone="default">{typeLabel(a.amenityType)}</Badge></TD>
                  <TD className="text-center text-[11px] text-muted-foreground">{a.defaultCapacity}</TD>
                  <TD><StatusBadge a={a} /></TD>
                  <TD><RowActions a={a} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{a.communityName ?? '—'}</div> : null}
                </div>
                <StatusBadge a={a} />
              </div>
              {a.description ? <p className="line-clamp-3 border-t border-border pt-2 text-[12px] text-muted-foreground">{a.description}</p> : null}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge tone="default">{typeLabel(a.amenityType)}</Badge>
                  <span>{t('amenities.capacityShort', { count: a.defaultCapacity })}</span>
                </div>
                <RowActions a={a} />
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

      <AmenityFormDialog
        open={creating}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
      />
      <AmenityFormDialog
        open={!!editing}
        amenity={editing}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('amenities.delete')}
        description={confirmDelete ? t('amenities.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('amenities.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function AmenityFormDialog({ open, amenity, presetCommunityId, typeOptions, statusOptions, onClose, onSaved }: { open: boolean; amenity?: Amenity | null; presetCommunityId?: string; typeOptions: Option[]; statusOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!amenity;
  const [communityId, setCommunityId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [amenityType, setAmenityType] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(amenity?.communityId ?? presetCommunityId ?? '');
    setName(amenity?.name ?? '');
    setCode(amenity?.code ?? '');
    setAmenityType(amenity?.amenityType ?? typeOptions[0]?.value ?? '');
    setStatus(amenity?.status ?? statusOptions[0]?.value ?? '');
    setLocation(amenity?.location ?? '');
    setDescription(amenity?.description ?? '');
    setCapacity(String(amenity?.defaultCapacity ?? 1));
  }, [open, amenity, presetCommunityId, typeOptions, statusOptions]);

  const capacityNum = Number.parseInt(capacity, 10);
  const capacityValid = Number.isInteger(capacityNum) && capacityNum >= 1;
  const canSubmit = !!name.trim() && !!amenityType && capacityValid && (isEdit || !!code.trim());

  const submit = async () => {
    if (busy || !canSubmit) return;
    if (!isEdit && !communityId) { toast.error(t('amenities.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await amenities.update(amenity!.id, {
          name: name.trim(),
          amenityType,
          status,
          location: location.trim(),
          description: description.trim(),
          defaultCapacity: capacityNum,
        });
      } else {
        await amenities.create({
          communityId,
          name: name.trim(),
          code: code.trim(),
          amenityType,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          defaultCapacity: capacityNum,
        });
      }
      toast.success(isEdit ? t('amenities.updated') : t('amenities.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader title={isEdit ? t('amenities.editTitle') : t('amenities.addTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!isEdit && !presetCommunityId ? (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.community')}</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('amenities.selectCommunity')} />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.nameLabel')}</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('amenities.namePlaceholder')} maxLength={200} />
        </div>
        {!isEdit ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.codeLabel')}</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('amenities.codePlaceholder')} maxLength={50} />
          </div>
        ) : null}
        <SelectField label={t('amenities.type')} value={amenityType || null} options={typeOptions} placeholder={t('amenities.selectType')} onChange={setAmenityType} />
        {isEdit ? (
          <SelectField label={t('amenities.statusLabel')} value={status || null} options={statusOptions} placeholder={t('amenities.selectStatus')} onChange={setStatus} />
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.capacityLabel')}</label>
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('amenities.capacityPlaceholder')} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.locationLabel')}</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('amenities.locationPlaceholder')} maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('amenities.descriptionLabel')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('amenities.descriptionPlaceholder')} maxLength={1000} rows={4} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('amenities.saveChanges') : t('amenities.save')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
