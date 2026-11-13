import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Search, RefreshCw, Table as TableIcon, LayoutGrid, Eye, EyeOff } from 'lucide-react';
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
import { announcements, masterData, organizations, communities } from '@shared/services';
import type { Announcement } from '@shared/api/announcements';
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AnnouncementsPage() {
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
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const categoriesQuery = useAsync((signal) => masterData.list('Announcement_Category', null, { signal }).catch(() => [] as MasterDataEntry[]), []);
  const categoryOptions = useMemo<Option[]>(() => (categoriesQuery.data ?? []).map((e) => ({ value: e.code, label: e.label })), [categoriesQuery.data]);
  const categoryLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? code;

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;

  const query = useAsync(
    (signal) => announcements.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        includeInactive: true,
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const toggleActive = async (a: Announcement) => {
    setTogglingId(a.id);
    try {
      if (a.isActive) await announcements.deactivate(a.id);
      else await announcements.activate(a.id);
      toast.success(a.isActive ? t('announcements.hidden') : t('announcements.shown'));
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
      await announcements.remove(confirmDelete.id);
      toast.success(t('announcements.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const StatusBadge = ({ a }: { a: Announcement }) => (
    <Badge tone={a.isActive ? 'success' : 'muted'}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {a.isActive ? t('announcements.active') : t('announcements.hiddenState')}
    </Badge>
  );

  const RowActions = ({ a }: { a: Announcement }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} aria-label={a.isActive ? t('announcements.hide') : t('announcements.show')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-600 disabled:opacity-50">
        {a.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => setEditing(a)} aria-label={t('announcements.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setConfirmDelete(a)} aria-label={t('announcements.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <Megaphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('announcements.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('announcements.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('announcements.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('announcements.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('announcements.filterOrg')}
            />
          ) : null}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('announcements.filterCommunity')}
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
          {query.loading ? t('common.loading') : t('announcements.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('announcements.colNotice')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('announcements.colCommunity')}</TH> : null}
                <TH className="w-32">{t('announcements.colCategory')}</TH>
                <TH className="w-28">{t('announcements.colDate')}</TH>
                <TH className="w-28">{t('announcements.colStatus')}</TH>
                <TH className="w-36 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((a, i) => (
                <TR key={a.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{a.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{a.body}</div>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{a.communityName ?? '—'}</TD> : null}
                  <TD><Badge tone="default">{categoryLabel(a.category)}</Badge></TD>
                  <TD className="text-[11px] text-muted-foreground">{formatDate(a.publishedAtUtc)}</TD>
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
                  <div className="truncate text-sm font-semibold">{a.title}</div>
                  {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{a.communityName ?? '—'}</div> : null}
                </div>
                <StatusBadge a={a} />
              </div>
              <p className="line-clamp-3 border-t border-border pt-2 text-[12px] text-muted-foreground">{a.body}</p>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge tone="default">{categoryLabel(a.category)}</Badge>
                  <span>{formatDate(a.publishedAtUtc)}</span>
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

      <AnnouncementFormDialog
        open={creating}
        categoryOptions={categoryOptions}
        {...(effectiveCommunityId ? { presetCommunityId: effectiveCommunityId } : {})}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
      />
      <AnnouncementFormDialog
        open={!!editing}
        announcement={editing}
        categoryOptions={categoryOptions}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('announcements.delete')}
        description={confirmDelete ? t('announcements.deleteConfirm', { title: confirmDelete.title }) : ''}
        confirmLabel={t('announcements.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function AnnouncementFormDialog({ open, announcement, presetCommunityId, categoryOptions, onClose, onSaved }: { open: boolean; announcement?: Announcement | null; presetCommunityId?: string; categoryOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!announcement;
  const [communityId, setCommunityId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(announcement?.communityId ?? presetCommunityId ?? '');
    setTitle(announcement?.title ?? '');
    setBody(announcement?.body ?? '');
    setCategory(announcement?.category ?? categoryOptions[0]?.value ?? '');
  }, [open, announcement, presetCommunityId, categoryOptions]);

  const submit = async () => {
    if (busy || !title.trim() || !body.trim() || !category) return;
    if (!isEdit && !communityId) { toast.error(t('announcements.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await announcements.update(announcement!.id, { title: title.trim(), body: body.trim(), category });
      } else {
        await announcements.create({ communityId, title: title.trim(), body: body.trim(), category });
      }
      toast.success(isEdit ? t('announcements.updated') : t('announcements.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={isEdit ? t('announcements.editTitle') : t('announcements.addTitle')} />
      <div className="flex flex-col gap-3">
        {!isEdit && !presetCommunityId ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('announcements.community')}</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('announcements.selectCommunity')} />
          </div>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('announcements.titleLabel')}</label>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('announcements.titlePlaceholder')} maxLength={200} />
        </div>
        <SelectField label={t('announcements.category')} value={category || null} options={categoryOptions} placeholder={t('announcements.selectCategory')} onChange={setCategory} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('announcements.bodyLabel')}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('announcements.bodyPlaceholder')} maxLength={4000} rows={5} className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !title.trim() || !body.trim() || !category} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('announcements.saveChanges') : t('announcements.publish')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
