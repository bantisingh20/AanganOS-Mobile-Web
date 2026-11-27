import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Plus, Pencil, Trash2, Eye, EyeOff, Users, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { amenities, masterData } from '@shared/services';
import type { Amenity } from '@shared/api/amenities';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { statusTone } from '@shared/lib/statusTone';
import { fetchOrgPage, makeCommunityFetch, fetchCommunityPage, resolveOrgLabel, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { cn } from '@shared/lib/utils';

type Option = { value: string; label: string };
const ACTIVE_STATUS = 'active';
const INACTIVE_STATUS = 'inactive';

export function AmenitiesPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const scope = useScope();
  const list = useListState();
  const { search, page, pageSize, reloadKey, reload, resetPage } = list;
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Amenity | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      { ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}) },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const rawItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => (filterType === 'all' ? rawItems : rawItems.filter((a) => a.amenityType === filterType)), [rawItems, filterType]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;

  const toggleActive = async (a: Amenity) => {
    setTogglingId(a.id);
    try {
      const isActive = a.status === ACTIVE_STATUS;
      const ok = await tryToast(
        () => amenities.update(a.id, { status: isActive ? INACTIVE_STATUS : ACTIVE_STATUS }),
        isActive ? t('amenities.deactivated') : t('amenities.activated'),
      );
      if (ok) reload();
    } finally { setTogglingId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => amenities.remove(confirmDelete.id), t('amenities.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const total = query.data?.totalCount ?? 0;
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3 w-3';

  const activeFilters = (scope.showOrgFilter && filterOrgId ? 1 : 0)
    + (scope.showCommunityFilter && filterCommunityId ? 1 : 0)
    + (filterType !== 'all' ? 1 : 0);
  const resetFilters = () => { setFilterOrgId(null); setFilterCommunityId(null); setFilterType('all'); resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {scope.showOrgFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterOrgId}
          onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); resetPage(); }} fetchPage={fetchOrgPage}
          resolveLabel={resolveOrgLabel} placeholder={t('amenities.filterOrg')} />
      )}
      {scope.showCommunityFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterCommunityId}
          onChange={(v) => { setFilterCommunityId(v); resetPage(); }} fetchPage={makeCommunityFetch(filterOrgId)}
          resolveLabel={resolveCommunityLabel} placeholder={t('amenities.filterCommunity')} />
      )}
      <Select value={filterType} onValueChange={(v) => { setFilterType(v); resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{typeOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
      </Select>
    </>
  );

  const actions = (a: Amenity) => {
    const isActive = a.status === ACTIVE_STATUS;
    return (
      <div className="flex items-center justify-end gap-1 shrink-0">
        <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} title={isActive ? t('amenities.deactivate') : t('amenities.activate')}
          className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50', actionSize)}>
          {isActive ? <EyeOff className={iconSize} /> : <Eye className={iconSize} />}
        </button>
        <button type="button" onClick={() => setEditing(a)} title={t('amenities.edit')}
          className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors', actionSize)}>
          <Pencil className={iconSize} />
        </button>
        <button type="button" onClick={() => setConfirmDelete(a)} title={t('amenities.delete')}
          className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}>
          <Trash2 className={iconSize} />
        </button>
      </div>
    );
  };

  return (
    <PageShell
      className="w-full"
      title={t('amenities.title')}
      subtitle={t('amenities.subtitle')}
      icon={<Dumbbell />}
      actions={(
        <Button size="sm" onClick={() => setCreating(true)} className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}>
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('amenities.add')}
        </Button>
      )}
    >
      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('amenities.searchPlaceholder') }}
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
        keyOf={(a) => a.id}
        loading={query.loading}
        emptyIcon={<Dumbbell className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('amenities.empty')}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(a) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-sm font-semibold text-foreground">{a.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{a.code}</span>
                </div>
                {showCommunityCol && a.communityName ? <span className="block truncate text-xs text-muted-foreground">{a.communityName}</span> : null}
              </div>
              <Badge tone={statusTone(a.status)} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                {statusLabel(a.status)}
              </Badge>
            </div>
            {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{typeLabel(a.amenityType)}</Badge>
                <span className="flex items-center gap-0.5"><Users className="h-3.5 w-3.5 opacity-70" />{a.defaultCapacity}</span>
                {a.location && <span className="flex min-w-0 items-center gap-0.5"><MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" /><span className="truncate">{a.location}</span></span>}
              </div>
              {actions(a)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colAmenity')}</TH>
                {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colCommunity')}</TH>}
                <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colType')}</TH>
                <TH className="w-20 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('amenities.colCapacity')}</TH>
                <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colStatus')}</TH>
                <TH className="w-24 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((a, i) => (
                <TR key={a.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="py-1 px-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-foreground block truncate">{a.name}</span>
                      <span className="text-[10px] text-muted-foreground block truncate">{a.code}{a.location ? ` · ${a.location}` : ''}</span>
                    </div>
                  </TD>
                  {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{a.communityName ?? EMPTY}</TD>}
                  <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{typeLabel(a.amenityType)}</Badge></TD>
                  <TD className="py-1 px-2 text-center text-xs text-muted-foreground font-mono">{a.defaultCapacity}</TD>
                  <TD className="py-1 px-2">
                    <Badge tone={statusTone(a.status)} className="text-[10px] px-1.5 py-0 rounded">
                      {statusLabel(a.status)}
                    </Badge>
                  </TD>
                  <TD className="py-1 px-2 text-right">{actions(a)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <AmenityFormDialog open={creating} typeOptions={typeOptions} statusOptions={statusOptions}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <AmenityFormDialog open={!!editing} amenity={editing} typeOptions={typeOptions} statusOptions={statusOptions}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('amenities.delete')} description={confirmDelete ? t('amenities.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('amenities.delete')} cancelLabel={t('common.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </PageShell>
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

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !canSubmit) return;
    if (!isEdit && !communityId) { toast.error(t('amenities.needCommunity')); return; }
    setBusy(true);
    try {
      const ok = await tryToast(() => (isEdit
        ? amenities.update(amenity!.id, { name: name.trim(), amenityType, status, location: location.trim(), description: description.trim(), defaultCapacity: capacityNum })
        : amenities.create({ communityId, name: name.trim(), code: code.trim(), amenityType, location: location.trim() || undefined, description: description.trim() || undefined, defaultCapacity: capacityNum })),
      isEdit ? t('amenities.updated') : t('amenities.created'));
      if (ok) onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={isEdit ? t('amenities.editTitle') : t('amenities.addTitle')} />
      <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
        {!isEdit && !presetCommunityId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.community')} *</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={fetchCommunityPage}
              resolveLabel={resolveCommunityLabel} placeholder={t('amenities.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.nameLabel')} *</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('amenities.namePlaceholder')} maxLength={200} className="h-9 text-xs rounded-[4px]" />
          </div>
          {!isEdit ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.codeLabel')} *</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('amenities.codePlaceholder')} maxLength={50} className="h-9 text-xs rounded-[4px]" />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.statusLabel')} *</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.type')} *</label>
            <Select value={amenityType} onValueChange={setAmenityType}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background"><SelectValue placeholder={t('amenities.selectType')} /></SelectTrigger>
              <SelectContent>{typeOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.capacityLabel')} *</label>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t('amenities.capacityPlaceholder')} className="h-9 text-xs rounded-[4px]" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.locationLabel')}</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('amenities.locationPlaceholder')} maxLength={200} className="h-9 text-xs rounded-[4px]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.descriptionLabel')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('amenities.descriptionPlaceholder')} maxLength={1000} rows={3}
            className="w-full rounded-[4px] border border-input bg-background p-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
        </div>
        <div className="mt-2 pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy || !canSubmit} className="h-8.5 px-4 rounded-[4px] text-xs font-medium">
            {busy ? t('common.saving') : isEdit ? t('amenities.saveChanges') : t('amenities.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default AmenitiesPage;
