import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building, Plus, Pencil, Trash2, Search, RefreshCw, Home, Table as TableIcon, LayoutGrid } from 'lucide-react';
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
import { communities, organizations } from '@shared/services';
import type { Community } from '@shared/api/communities';
import type { Organization } from '@shared/api/organizations';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { toFormError } from '@shared/api/errors';

const TYPE_OPTIONS = [
  { value: 'apartment_society', label: 'Apartment Society' },
  { value: 'gated_community', label: 'Gated Community' },
  { value: 'villa_bungalow', label: 'Villa / Bungalow' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'mixed', label: 'Mixed Development' },
];

function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? 'Residential';
}

function typeTone(type: string): 'success' | 'info' | 'default' | 'warning' {
  const t = (type || '').toLowerCase();
  if (t.includes('apartment')) return 'success';
  if (t.includes('gated')) return 'info';
  if (t.includes('villa') || t.includes('townhouse')) return 'default';
  return 'warning';
}

export function CommunitiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgFilter = searchParams.get('organizationId') ?? undefined;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Community | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => communities.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(orgFilter ? { organizationId: orgFilter } : {}),
        ...(typeFilter !== 'all' ? { communityType: typeFilter } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, orgFilter, typeFilter, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await communities.remove(confirmDelete.id);
      toast.success(t('communities.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const openUnits = (c: Community) => navigate(`/units?communityId=${c.id}&communityName=${encodeURIComponent(c.name)}`);
  const clearOrgFilter = () => setSearchParams({});

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Building className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('communities.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('communities.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            {t('communities.add')}
          </Button>
        </div>
      </Card>

      {orgFilter ? (
        <Card className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/60 p-2.5 text-xs">
          <span className="text-emerald-700">{t('communities.filteredByOrg')}</span>
          <button type="button" onClick={clearOrgFilter} className="font-semibold text-emerald-700 underline">{t('communities.clearFilter')}</button>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5">
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('communities.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('communities.allTypes')}</SelectItem>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
          {query.loading ? t('common.loading') : t('communities.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('communities.colName')}</TH>
                <TH className="w-44">{t('communities.colOrganization')}</TH>
                <TH className="w-40">{t('communities.colType')}</TH>
                <TH className="w-28">{t('communities.colStatus')}</TH>
                <TH className="w-32">{t('communities.colUnits')}</TH>
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((c, i) => (
                <TR key={c.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Building className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{c.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">ID: {c.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-[11px] text-muted-foreground">{c.organizationName ?? '—'}</TD>
                  <TD><Badge tone={typeTone(c.communityType)}>{typeLabel(c.communityType)}</Badge></TD>
                  <TD><Badge tone="success"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('communities.active')}</Badge></TD>
                  <TD>
                    <button type="button" onClick={() => openUnits(c)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500 hover:text-emerald-600">
                      <Home className="h-3 w-3" />
                      {t('communities.manageUnits')}
                    </button>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(c)} title={t('communities.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(c)} title={t('communities.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50">
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
          {items.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Building className="h-5 w-5" />
                </span>
                <Badge tone={typeTone(c.communityType)}>{typeLabel(c.communityType)}</Badge>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{c.organizationName ?? '—'}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">ID: {c.id.slice(0, 8)}</div>
              </div>
              <div className="flex items-center justify-between gap-1.5 border-t border-border pt-3">
                <button type="button" onClick={() => openUnits(c)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-emerald-500 hover:text-emerald-600">
                  <Home className="h-3 w-3" />
                  {t('communities.units')}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setEditing(c)} title={t('communities.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(c)} title={t('communities.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={query.data?.totalCount ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </Card>
      ) : null}

      <CommunityFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} {...(orgFilter ? { presetOrgId: orgFilter } : {})} />
      <CommunityFormDialog open={!!editing} community={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('communities.delete')}
        description={confirmDelete ? t('communities.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('communities.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function CommunityFormDialog({ open, community, presetOrgId, onClose, onSaved }: { open: boolean; community?: Community | null; presetOrgId?: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!community;
  const [name, setName] = useState('');
  const [type, setType] = useState('apartment_society');
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);

  const orgQuery = useAsync(
    (signal) => (open && !isEdit ? organizations.list({ pageSize: 200 }, { signal }).catch(() => null) : Promise.resolve(null)),
    [open, isEdit],
  );
  const orgOptions = useMemo(
    () => (orgQuery.data?.items ?? []).map((o: Organization) => ({ value: o.id, label: o.name })),
    [orgQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setName(community?.name ?? '');
    setType(community?.communityType ?? 'apartment_society');
    setOrgId(presetOrgId ?? '');
  }, [open, community, presetOrgId]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    if (!isEdit && !orgId) { toast.error(t('communities.selectOrg')); return; }
    setBusy(true);
    try {
      if (isEdit) await communities.update(community!.id, { name: name.trim(), communityType: type });
      else await communities.create({ organizationId: orgId, name: name.trim(), communityType: type });
      toast.success(isEdit ? t('communities.updated') : t('communities.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={isEdit ? t('communities.editTitle') : t('communities.addTitle')} />
      <div className="flex flex-col gap-3">
        {!isEdit ? (
          <SelectField label={t('communities.organization')} value={orgId || null} options={orgOptions} placeholder={t('communities.selectOrgPlaceholder')} onChange={setOrgId} />
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('communities.name')}</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('communities.namePlaceholder')} maxLength={256} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        <SelectField label={t('communities.type')} value={type} options={TYPE_OPTIONS} onChange={setType} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !name.trim()} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('communities.saveChanges') : t('communities.createCommunity')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
