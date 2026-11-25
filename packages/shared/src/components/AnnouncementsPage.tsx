import { useState, useMemo } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Search, RefreshCw, Eye, EyeOff, Building2, Globe, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { AnnouncementFormDialog } from './announcements/AnnouncementFormDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { HelpDeskHeader } from '@shared/help-desk/HelpDeskHeader';
import { announcements, masterData, organizations, communities } from '@shared/services';
import type { Announcement } from '@shared/api/announcements';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { usePermission } from '@shared/lib/usePermission';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

export interface AnnouncementsPageProps {
  mode?: 'admin' | 'mobile';
  title?: string;
  permKey?: string;
  onBack?: () => void;
  onSubmitClick?: () => void;
}

const CAT_META: Record<string, { label: string; tone: 'warning' | 'success' | 'info' | 'danger' | 'default' }> = {
  general: { label: 'General', tone: 'warning' }, maintenance: { label: 'Maintenance', tone: 'success' },
  event: { label: 'Event', tone: 'info' }, emergency: { label: 'Emergency', tone: 'danger' },
};

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const fetchOrg = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal }).then((d) => ({ items: d.items.map((o: any) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const fetchComm = (orgId?: string) => (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: search || undefined, page, pageSize }, orgId ? { organizationId: orgId } : {}, { signal }).then((d) => ({ items: d.items.map((c: any) => ({ value: c.id, label: c.name })), total: d.totalCount }));

export function AnnouncementsPage({ mode = 'admin', title, permKey, onBack, onSubmitClick }: AnnouncementsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const scope = useScope();
  const perm = usePermission(permKey || 'announcements');
  const isMobile = mode === 'mobile';

  const isOrgLevel = scope.isPowerUser || scope.isOrgAdmin;
  const isAdmin = perm.isAdmin || isOrgLevel || roles.some((r: any) => /admin|communityadmin|organizationadmin/i.test(r));
  const canAdd = isAdmin || perm.canAdd;
  const canEdit = isAdmin || perm.canEdit;
  const canDelete = isAdmin || perm.canDelete;

  const pageTitle = title ?? t('announcements.title', { defaultValue: 'Notice Board' });
  const handleBack = () => { if (onBack) return onBack(); (window.history.state?.idx > 0) ? navigate(-1) : navigate(isMobile ? '/home' : '/dashboard'); };

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const reload = () => setReloadKey((k) => k + 1);

  const catQuery = useAsync((sig) => masterData.list('Announcement_Category', user?.communityId ?? null, { signal: sig }).catch(() => []), [user?.communityId]);
  const categoryOptions = useMemo(() => {
    const list = (catQuery.data ?? []).map((e) => ({ value: e.code, label: e.label }));
    return list.length > 0 ? list : [{ value: 'general', label: 'General' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'event', label: 'Event' }, { value: 'emergency', label: 'Emergency' }];
  }, [catQuery.data]);
  const catLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? CAT_META[code]?.label ?? code;

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const query = useAsync(
    (signal) => announcements.list(
      { search: search.trim() || undefined, page, pageSize, sort: 'publishedAtUtc:desc' },
      { includeInactive: isAdmin, category: selectedCat !== 'all' ? selectedCat : undefined, ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}) },
      { signal },
    ).catch(() => null),
    [search, selectedCat, effectiveCommunityId, page, pageSize, reloadKey, isAdmin],
  );

  const rawItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => {
    if (filterActive === 'active') return rawItems.filter((a) => a.isActive);
    if (filterActive === 'inactive') return rawItems.filter((a) => !a.isActive);
    return rawItems;
  }, [rawItems, filterActive]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;

  const toggleActive = async (a: Announcement) => {
    setTogglingId(a.id);
    try {
      if (a.isActive) await announcements.deactivate(a.id);
      else await announcements.activate(a.id);
      toast.success(a.isActive ? t('announcements.hidden', { defaultValue: 'Notice hidden' }) : t('announcements.shown', { defaultValue: 'Notice published' }));
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setTogglingId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await announcements.remove(confirmDelete.id);
      toast.success(t('announcements.deleted', { defaultValue: 'Notice deleted' }));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const actions = (a: Announcement) => (
    <div className="flex items-center gap-1 shrink-0">
      {canEdit && (
        <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} title={a.isActive ? 'Hide' : 'Publish'}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
          {a.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      )}
      {canEdit && (
        <button type="button" onClick={() => { setEditingItem(a); setModalOpen(true); }} title="Edit"
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {canDelete && (
        <button type="button" onClick={() => setConfirmDelete(a)} title="Delete"
          className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  const content = (
    <div className="w-full space-y-2">
      {!isMobile && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5 text-primary" />{pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('announcements.subtitle', { defaultValue: 'Society & wing notices and circulars' })}</p>
          </div>
          {canAdd && (
            <Button size="sm" onClick={() => { if (onSubmitClick) return onSubmitClick(); setEditingItem(null); setModalOpen(true); }} className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
              <Plus className="h-3 w-3 stroke-[2.5]" />{t('announcements.add', { defaultValue: 'New Notice' })}
            </Button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('announcements.searchPlaceholder', { defaultValue: 'Search notices...' })} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
          {scope.showOrgFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }} fetchPage={fetchOrg}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)} placeholder={t('announcements.filterOrg', { defaultValue: 'All societies' })} />
          )}
          {scope.showCommunityFilter && (
            <EntitySelect className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-md [&>button]:text-[11px] [&>button]:px-2" value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }} fetchPage={fetchComm(filterOrgId ?? undefined)}
              resolveLabel={(id, sig) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null)} placeholder={t('announcements.filterCommunity', { defaultValue: 'All wings' })} />
          )}
          <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-32 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{categoryOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
          </Select>
          {isAdmin && (
            <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); setPage(1); }}>
              <SelectTrigger className="h-7.5 w-24 rounded-md text-[11px] bg-background px-2"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Live</SelectItem><SelectItem value="inactive">Hidden</SelectItem></SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
          {isMobile && canAdd && (
            <Button size="sm" onClick={() => { if (onSubmitClick) return onSubmitClick(); setEditingItem(null); setModalOpen(true); }} className="h-7.5 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
              <Plus className="h-3 w-3" />New
            </Button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading', { defaultValue: 'Loading…' })}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Megaphone className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('announcements.empty', { defaultValue: 'No announcements published yet' })}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((a) => (
                <div key={a.id} className="p-2.5 flex flex-col gap-1.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge tone={CAT_META[a.category]?.tone ?? 'default'} className="text-[10px] px-1.5 py-0 rounded shrink-0">{catLabel(a.category)}</Badge>
                      <span className="font-semibold text-xs text-foreground truncate">{a.title}</span>
                    </div>
                    {isAdmin && <Badge tone={a.isActive ? 'success' : 'muted'} className="text-[9px] px-1 py-0 rounded shrink-0">{a.isActive ? 'Live' : 'Hidden'}</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{a.body}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10.5px]">
                    <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3 shrink-0 opacity-70" />{fmt(a.publishedAtUtc)}</span>
                      {(!a.communityId || a.communityId === '00000000-0000-0000-0000-000000000000' || a.scope === 'Society') ? (
                        <span className="flex items-center gap-0.5 text-sky-700 dark:text-sky-400 truncate"><Globe className="h-3 w-3 shrink-0" />{a.organizationName ?? 'Society-wide'}</span>
                      ) : a.communityName ? (
                        <span className="flex items-center gap-0.5 truncate"><Building2 className="h-3 w-3 shrink-0 opacity-60" />{a.communityName}</span>
                      ) : null}
                    </div>
                    {(canEdit || canDelete) && actions(a)}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('announcements.colNotice', { defaultValue: 'Notice' })}</TH>
                    {showCommunityCol && <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('announcements.colScope', { defaultValue: 'Scope / Wing' })}</TH>}
                    <TH className="w-28 py-1.5 px-2 text-[10.5px] font-semibold">{t('announcements.colCategory', { defaultValue: 'Category' })}</TH>
                    {isAdmin && <TH className="w-20 py-1.5 px-2 text-[10.5px] font-semibold">{t('announcements.colStatus', { defaultValue: 'Status' })}</TH>}
                    <TH className="w-24 py-1.5 px-2 text-[10.5px] font-semibold">{t('announcements.colPublished', { defaultValue: 'Published' })}</TH>
                    {(canEdit || canDelete) && <TH className="w-24 py-1.5 px-2 text-right text-[10.5px] font-semibold">Actions</TH>}
                  </TR>
                </THead>
                <TBody>
                  {items.map((a, i) => (
                    <TR key={a.id} className="hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                      <TD className="py-1 px-2">
                        <div className="min-w-0 max-w-md">
                          <span className="font-semibold text-xs text-foreground block truncate">{a.title}</span>
                          <span className="font-normal text-[11px] text-muted-foreground block truncate">{a.body}</span>
                        </div>
                      </TD>
                      {showCommunityCol && (
                        <TD className="py-1 px-2 text-xs">
                          {(!a.communityId || a.communityId === '00000000-0000-0000-0000-000000000000' || a.scope === 'Society') ? (
                            <span className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300"><Globe className="h-3 w-3 shrink-0" /><span className="truncate">{a.organizationName ?? 'Society-wide'}</span></span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3 w-3 shrink-0 opacity-60" /><span className="truncate">{a.communityName ?? '—'}</span></span>
                          )}
                        </TD>
                      )}
                      <TD className="py-1 px-2"><Badge tone={CAT_META[a.category]?.tone ?? 'default'} className="text-[10px] px-1.5 py-0 rounded uppercase tracking-wide">{catLabel(a.category)}</Badge></TD>
                      {isAdmin && <TD className="py-1 px-2"><Badge tone={a.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded">{a.isActive ? 'Live' : 'Hidden'}</Badge></TD>}
                      <TD className="py-1 px-2 text-[10.5px] text-muted-foreground whitespace-nowrap">{fmt(a.publishedAtUtc)}</TD>
                      {(canEdit || canDelete) && <TD className="py-1 px-2 text-right">{actions(a)}</TD>}
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

      <AnnouncementFormDialog open={modalOpen} announcement={editingItem} categoryOptions={categoryOptions} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('announcements.delete', { defaultValue: 'Delete Announcement' })}
        description={confirmDelete ? t('announcements.deleteConfirm', { title: confirmDelete.title }) : ''} confirmLabel={t('announcements.delete', { defaultValue: 'Delete' })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );

  return isMobile ? (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <HelpDeskHeader title={pageTitle} mode="mobile" showBack onBack={handleBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{content}</div>
    </div>
  ) : content;
}

export default AnnouncementsPage;
