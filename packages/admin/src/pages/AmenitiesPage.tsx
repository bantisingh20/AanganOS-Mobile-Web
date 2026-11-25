import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Plus, Pencil, Trash2, Search, RefreshCw, Eye, EyeOff, Users, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { amenities, masterData, organizations, communities } from '@shared/services';
import type { Amenity } from '@shared/api/amenities';
import type { MasterDataEntry } from '@shared/api/masterData';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

type Option = { value: string; label: string };
const ACTIVE_STATUS = 'active';
const INACTIVE_STATUS = 'inactive';

const fetchOrg = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal }).then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const fetchComm = (orgId?: string) => (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: search || undefined, page, pageSize }, orgId ? { organizationId: orgId } : {}, { signal }).then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));

export function AmenitiesPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
      { ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}) },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const rawItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => (filterType === 'all' ? rawItems : rawItems.filter((a) => a.amenityType === filterType)), [rawItems, filterType]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const toggleActive = async (a: Amenity) => {
    setTogglingId(a.id);
    try {
      const isActive = a.status === ACTIVE_STATUS;
      await amenities.update(a.id, { status: isActive ? INACTIVE_STATUS : ACTIVE_STATUS });
      toast.success(isActive ? t('amenities.deactivated') : t('amenities.activated'));
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setTogglingId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await amenities.remove(confirmDelete.id);
      toast.success(t('amenities.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const actions = (a: Amenity) => {
    const isActive = a.status === ACTIVE_STATUS;
    return (
      <div className="flex items-center justify-end gap-1 shrink-0">
        <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} title={isActive ? t('amenities.deactivate') : t('amenities.activate')}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
          {isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button type="button" onClick={() => setEditing(a)} title={t('amenities.edit')}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => setConfirmDelete(a)} title={t('amenities.delete')}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />{t('amenities.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('amenities.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('amenities.add')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('amenities.searchPlaceholder')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          {scope.showOrgFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }} fetchPage={fetchOrg}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)} placeholder={t('amenities.filterOrg')} />
          )}
          {scope.showCommunityFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }} fetchPage={fetchComm(filterOrgId ?? undefined)}
              resolveLabel={(id, sig) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null)} placeholder={t('amenities.filterCommunity')} />
          )}
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Types</SelectItem>{typeOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Dumbbell className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('amenities.empty')}</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((a) => (
                <div key={a.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-xs text-foreground truncate">{a.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{a.code}</span>
                    </div>
                    <Badge tone={a.status === ACTIVE_STATUS ? 'success' : 'muted'} className="text-[9px] px-1 py-0 rounded shrink-0">
                      {statusLabel(a.status)}
                    </Badge>
                  </div>
                  {a.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{a.description}</p>}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10.5px]">
                    <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                      <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{typeLabel(a.amenityType)}</Badge>
                      <span className="flex items-center gap-0.5"><Users className="h-3 w-3 opacity-70" />{a.defaultCapacity}</span>
                      {a.location && <span className="flex items-center gap-0.5 truncate"><MapPin className="h-3 w-3 opacity-70" />{a.location}</span>}
                    </div>
                    {actions(a)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colAmenity')}</TH>
                    {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colCommunity')}</TH>}
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colType')}</TH>
                    <TH className="w-20 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('amenities.colCapacity')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('amenities.colStatus')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
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
                      {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground truncate">{a.communityName ?? '—'}</TD>}
                      <TD className="py-1 px-2"><Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">{typeLabel(a.amenityType)}</Badge></TD>
                      <TD className="py-1 px-2 text-center text-xs text-muted-foreground font-mono">{a.defaultCapacity}</TD>
                      <TD className="py-1 px-2">
                        <Badge tone={a.status === ACTIVE_STATUS ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded">
                          {statusLabel(a.status)}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2 text-right">{actions(a)}</TD>
                    </TR>
                  ))}
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

      <AmenityFormDialog open={creating} typeOptions={typeOptions} statusOptions={statusOptions}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <AmenityFormDialog open={!!editing} amenity={editing} typeOptions={typeOptions} statusOptions={statusOptions}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('amenities.delete')} description={confirmDelete ? t('amenities.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('amenities.delete')} cancelLabel={t('orgs.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
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

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !canSubmit) return;
    if (!isEdit && !communityId) { toast.error(t('amenities.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await amenities.update(amenity!.id, { name: name.trim(), amenityType, status, location: location.trim(), description: description.trim(), defaultCapacity: capacityNum });
      } else {
        await amenities.create({ communityId, name: name.trim(), code: code.trim(), amenityType, location: location.trim() || undefined, description: description.trim() || undefined, defaultCapacity: capacityNum });
      }
      toast.success(isEdit ? t('amenities.updated') : t('amenities.created'));
      onSaved();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={isEdit ? t('amenities.editTitle') : t('amenities.addTitle')} />
      <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
        {!isEdit && !presetCommunityId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('amenities.community')} *</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={fetchComm()}
              resolveLabel={(id, sig) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null)} placeholder={t('amenities.selectCommunity')}
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
            {t('orgs.cancel')}
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
