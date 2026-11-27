import { useState, useMemo } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Building2, Globe, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { AnnouncementFormDialog } from './AnnouncementFormDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { PageShell, FilterBar, DataList, filterControlClass, filterEntityClass, type FilterLayout } from '@shared/components/layout';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { announcements, masterData } from '@shared/services';
import type { Announcement } from '@shared/api/announcements';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { usePermission } from '@shared/lib/hooks/usePermission';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY, formatDate } from '@shared/lib/format';
import { fetchOrgPage, makeCommunityFetch, resolveOrgLabel, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { cn } from '@shared/lib/utils';

export interface AnnouncementsPageProps {
  /** @deprecated The host app is set once with <SurfaceProvider>; only pass this to override it. */
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

export function AnnouncementsPage(props: AnnouncementsPageProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><Announcements {...props} /></SurfaceProvider>;
}

function Announcements({ title, permKey, onBack, onSubmitClick }: AnnouncementsPageProps) {
  const { t } = useTranslation();
  const surface = useResolvedSurface();
  const compact = useIsCompact();
  const { user } = useAuth();
  const scope = useScope();
  // Rights from this route's DB menu row unless a caller passes an explicit resource.
  const perm = usePermission(permKey);

  const isAdmin = perm.isAdmin;
  const canAdd = isAdmin || perm.canAdd;
  const canEdit = isAdmin || perm.canEdit;
  const canDelete = isAdmin || perm.canDelete;

  const pageTitle = title ?? t('announcements.title', { defaultValue: 'Notice Board' });

  const list = useListState();
  const { search, page, pageSize, reloadKey, reload } = list;
  const [selectedCat, setSelectedCat] = useState('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      const ok = await tryToast(() => (a.isActive ? announcements.deactivate(a.id) : announcements.activate(a.id)),
        a.isActive ? t('announcements.hidden', { defaultValue: 'Notice hidden' }) : t('announcements.shown', { defaultValue: 'Notice published' }));
      if (ok) reload();
    } finally { setTogglingId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => announcements.remove(confirmDelete.id), t('announcements.deleted', { defaultValue: 'Notice deleted' }))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const iconBtn = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3 w-3';
  const actions = (a: Announcement) => (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {canEdit && (
        <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)} title={a.isActive ? 'Hide' : 'Publish'}
          className={cn('flex items-center justify-center border border-border/80 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50', iconBtn)}>
          {a.isActive ? <EyeOff className={iconSize} /> : <Eye className={iconSize} />}
        </button>
      )}
      {canEdit && (
        <button type="button" onClick={() => { setEditingItem(a); setModalOpen(true); }} title={t('common.edit')}
          className={cn('flex items-center justify-center border border-border/80 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary', iconBtn)}>
          <Pencil className={iconSize} />
        </button>
      )}
      {canDelete && (
        <button type="button" onClick={() => setConfirmDelete(a)} title={t('common.delete')}
          className={cn('flex items-center justify-center border border-rose-300 text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40', iconBtn)}>
          <Trash2 className={iconSize} />
        </button>
      )}
    </div>
  );

  const isSocietyWide = (a: Announcement) => !a.communityId || a.communityId === '00000000-0000-0000-0000-000000000000' || a.scope === 'Society';
  const openNew = () => { if (onSubmitClick) return onSubmitClick(); setEditingItem(null); setModalOpen(true); };

  const newButton = !canAdd ? undefined : surface === 'app' ? (
    <Button size="sm" onClick={openNew} className="h-9 gap-1 rounded-full bg-white/20 px-3 text-sm font-semibold text-primary-foreground hover:bg-white/30">
      <Plus className="h-4 w-4" />{t('announcements.new', { defaultValue: 'New' })}
    </Button>
  ) : (
    <Button size="sm" onClick={openNew} className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
      <Plus className="h-3.5 w-3.5" />{t('announcements.add', { defaultValue: 'New Notice' })}
    </Button>
  );

  const activeFilters = [filterOrgId, filterCommunityId].filter(Boolean).length + (selectedCat !== 'all' ? 1 : 0) + (filterActive !== 'all' ? 1 : 0);
  const resetFilters = () => { setFilterOrgId(null); setFilterCommunityId(null); setSelectedCat('all'); setFilterActive('all'); list.resetPage(); };

  const renderFilters = (layout: FilterLayout) => (
    <>
      {scope.showOrgFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterOrgId}
          onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); list.resetPage(); }} fetchPage={fetchOrgPage}
          resolveLabel={resolveOrgLabel} placeholder={t('announcements.filterOrg', { defaultValue: 'All societies' })} />
      )}
      {scope.showCommunityFilter && (
        <EntitySelect className={filterEntityClass(layout, 'w-36')} value={filterCommunityId}
          onChange={(v) => { setFilterCommunityId(v); list.resetPage(); }} fetchPage={makeCommunityFetch(filterOrgId)}
          resolveLabel={resolveCommunityLabel} placeholder={t('announcements.filterCommunity', { defaultValue: 'All wings' })} />
      )}
      <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('announcements.allCategories', { defaultValue: 'All Categories' })}</SelectItem>{categoryOptions.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}</SelectContent>
      </Select>
      {isAdmin && (
        <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); list.resetPage(); }}>
          <SelectTrigger className={filterControlClass(layout, 'w-28')}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Live</SelectItem><SelectItem value="inactive">Hidden</SelectItem></SelectContent>
        </Select>
      )}
    </>
  );

  return (
    <PageShell title={pageTitle} icon={<Megaphone />} onBack={onBack} actions={newButton}
      subtitle={surface === 'admin' ? t('announcements.subtitle', { defaultValue: 'Society & wing notices and circulars' }) : undefined}>
      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('announcements.searchPlaceholder', { defaultValue: 'Search notices...' }) }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(a) => a.id}
        loading={query.loading}
        emptyIcon={<Megaphone className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('announcements.empty', { defaultValue: 'No announcements published yet' })}
        pagination={{ page, pageSize, total: query.data?.totalCount ?? 0, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(a) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Badge tone={CAT_META[a.category]?.tone ?? 'default'} className="shrink-0 rounded px-1.5 py-0 text-[10px]">{catLabel(a.category)}</Badge>
                <span className="truncate text-sm font-semibold text-foreground">{a.title}</span>
              </div>
              {isAdmin && <Badge tone={a.isActive ? 'success' : 'muted'} className="shrink-0 rounded px-1.5 py-0 text-[10px]">{a.isActive ? 'Live' : 'Hidden'}</Badge>}
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />{formatDate(a.publishedAtUtc)}</span>
                {isSocietyWide(a) ? (
                  <span className="flex items-center gap-0.5 truncate text-sky-700 dark:text-sky-400"><Globe className="h-3.5 w-3.5 shrink-0" />{a.organizationName ?? 'Society-wide'}</span>
                ) : a.communityName ? (
                  <span className="flex items-center gap-0.5 truncate"><Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />{a.communityName}</span>
                ) : null}
              </div>
              {(canEdit || canDelete) && actions(a)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 px-2 py-1.5 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="px-2 py-1.5 text-[10.5px] font-semibold">{t('announcements.colNotice', { defaultValue: 'Notice' })}</TH>
                {showCommunityCol && <TH className="w-36 px-2 py-1.5 text-[10.5px] font-semibold">{t('announcements.colScope', { defaultValue: 'Scope / Wing' })}</TH>}
                <TH className="w-28 px-2 py-1.5 text-[10.5px] font-semibold">{t('announcements.colCategory', { defaultValue: 'Category' })}</TH>
                {isAdmin && <TH className="w-20 px-2 py-1.5 text-[10.5px] font-semibold">{t('announcements.colStatus', { defaultValue: 'Status' })}</TH>}
                <TH className="w-24 px-2 py-1.5 text-[10.5px] font-semibold">{t('announcements.colPublished', { defaultValue: 'Published' })}</TH>
                {(canEdit || canDelete) && <TH className="w-24 px-2 py-1.5 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>}
              </TR>
            </THead>
            <TBody>
              {items.map((a, i) => (
                <TR key={a.id} className="transition-colors hover:bg-muted/30">
                  <TD className="px-2 py-1 text-center font-mono text-[10.5px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="px-2 py-1">
                    <div className="min-w-0 max-w-md">
                      <span className="block truncate text-xs font-semibold text-foreground">{a.title}</span>
                      <span className="block truncate text-[11px] font-normal text-muted-foreground">{a.body}</span>
                    </div>
                  </TD>
                  {showCommunityCol && (
                    <TD className="px-2 py-1 text-xs">
                      {isSocietyWide(a) ? (
                        <span className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300"><Globe className="h-3 w-3 shrink-0" /><span className="truncate">{a.organizationName ?? 'Society-wide'}</span></span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3 w-3 shrink-0 opacity-60" /><span className="truncate">{a.communityName ?? EMPTY}</span></span>
                      )}
                    </TD>
                  )}
                  <TD className="px-2 py-1"><Badge tone={CAT_META[a.category]?.tone ?? 'default'} className="rounded px-1.5 py-0 text-[10px] uppercase tracking-wide">{catLabel(a.category)}</Badge></TD>
                  {isAdmin && <TD className="px-2 py-1"><Badge tone={a.isActive ? 'success' : 'muted'} className="rounded px-1.5 py-0 text-[10px]">{a.isActive ? 'Live' : 'Hidden'}</Badge></TD>}
                  <TD className="whitespace-nowrap px-2 py-1 text-[10.5px] text-muted-foreground">{formatDate(a.publishedAtUtc)}</TD>
                  {(canEdit || canDelete) && <TD className="px-2 py-1 text-right">{actions(a)}</TD>}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <AnnouncementFormDialog open={modalOpen} announcement={editingItem} categoryOptions={categoryOptions} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('announcements.delete', { defaultValue: 'Delete Announcement' })}
        description={confirmDelete ? t('announcements.deleteConfirm', { title: confirmDelete.title }) : ''} confirmLabel={t('announcements.delete', { defaultValue: 'Delete' })}
        cancelLabel={t('common.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </PageShell>
  );
}

export default AnnouncementsPage;
