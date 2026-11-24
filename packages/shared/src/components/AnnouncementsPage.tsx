import { useState, useMemo, useEffect } from 'react';
import {
  Megaphone, Plus, Pencil, Trash2, Search, RefreshCw, Eye, EyeOff,
  Filter, Calendar, Building2, Globe,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';

import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { HelpDeskHeader } from '@shared/help-desk/HelpDeskHeader';

import { announcements, masterData, organizations, communities } from '@shared/services';
import type { Announcement } from '@shared/api/announcements';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
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

const CATEGORY_META: Record<string, { label: string; accent: string; tone: 'warning' | 'success' | 'info' | 'danger' | 'default' }> = {
  general: { label: 'General', accent: 'bg-amber-500', tone: 'warning' },
  maintenance: { label: 'Maintenance', accent: 'bg-emerald-500', tone: 'success' },
  event: { label: 'Event', accent: 'bg-sky-500', tone: 'info' },
  emergency: { label: 'Emergency', accent: 'bg-rose-500', tone: 'danger' },
};

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

/* ─── Entity fetch helpers (matches TicketsListPage) ─── */
async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o: any) => ({ value: o.id, label: o.name })), total: d.totalCount };
}
function makeCommunityFetch(orgId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, orgId ? { organizationId: orgId } : {}, { signal });
    return { items: d.items.map((c: any) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal) {
  try { return (await communities.get(id, { signal })).name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal) {
  try { return (await organizations.get(id, { signal })).name; } catch { return null; }
}

/* ─── Mobile / Tablet Announcement Card (matches TicketCard) ─── */
function AnnouncementCard({
  item, catLabel, isAdmin, canEdit, canDelete, togglingId, isExpanded,
  onToggleExpand, onToggleActive, onEdit, onDelete,
}: {
  item: Announcement;
  catLabel: (c: string) => string;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  togglingId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = CATEGORY_META[item.category] ?? { label: item.category, accent: 'bg-primary', tone: 'default' };
  const isSocietyWide = !item.communityId || item.communityId === '00000000-0000-0000-0000-000000000000' || item.scope === 'Society';
  const isLong = item.body.length > 180;

  return (
    <div className={cn(
      'relative flex overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-all hover:shadow-md hover:border-primary/40',
      !item.isActive && 'opacity-65',
    )}>
      {/* Left accent bar */}
      <span className={cn('w-1 shrink-0', meta.accent)} />

      <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5 gap-2">
        {/* Top header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Badge tone={meta.tone} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {catLabel(item.category)}
            </Badge>
            {isSocietyWide ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[130px]">{item.organizationName ?? 'Society-wide'}</span>
              </span>
            ) : item.communityName ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[130px]">{item.communityName}</span>
              </span>
            ) : null}
          </div>

          {isAdmin && (
            <Badge tone={item.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 shrink-0">
              {item.isActive ? 'Live' : 'Hidden'}
            </Badge>
          )}
        </div>

        {/* Content row */}
        <div>
          <h3 className="line-clamp-2 text-sm font-bold text-foreground leading-snug">{item.title}</h3>
          <p className={cn('mt-1 whitespace-pre-line text-xs text-muted-foreground leading-relaxed', !isExpanded && isLong && 'line-clamp-3')}>
            {item.body}
          </p>
          {isLong && (
            <button type="button" onClick={onToggleExpand} className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline">
              {isExpanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>Read more <ChevronDown className="h-3 w-3" /></>}
            </button>
          )}
        </div>

        {/* Bottom footer row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0 opacity-70" />
            <span>{fmt(item.publishedAtUtc)}</span>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <button type="button" disabled={togglingId === item.id} onClick={onToggleActive}
                  aria-label={item.isActive ? 'Hide notice' : 'Publish notice'}
                  className="flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 transition-colors">
                  {item.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span className="hidden xs:inline">{item.isActive ? 'Hide' : 'Publish'}</span>
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={onEdit} aria-label="Edit notice"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-primary hover:bg-muted active:scale-95 transition-all">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={onDelete} aria-label="Delete notice"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 active:scale-95 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function AnnouncementsPage({ mode = 'admin', title, permKey, onBack, onSubmitClick }: AnnouncementsPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const scope = useScope();
  const perm = usePermission(permKey || 'announcements');
  const isSmall = useIsSmallScreen();
  const isMobile = mode === 'mobile';
  const showTable = !isMobile && !isSmall;

  const isOrgLevel = scope.isPowerUser || scope.isOrgAdmin;
  const isAdmin = perm.isAdmin || isOrgLevel || roles.some((r: any) => /admin|communityadmin|organizationadmin/i.test(r));
  const canAdd = isAdmin || perm.canAdd;
  const canEdit = isAdmin || perm.canEdit;
  const canDelete = isAdmin || perm.canDelete;

  const pageTitle = title ?? t('announcements.title', { defaultValue: 'Notice Board' });
  const handleBack = () => {
    if (onBack) return onBack();
    (window.history.state?.idx > 0) ? navigate(-1) : navigate(isMobile ? '/home' : '/dashboard');
  };

  /* ── State ── */
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 20 : 10);
  const [reloadKey, setReloadKey] = useState(0);

  // Dialogs
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const reload = () => setReloadKey((k) => k + 1);

  /* ── Master Data: Categories ── */
  const catQuery = useAsync(
    (signal) => masterData.list('Announcement_Category', user?.communityId ?? null, { signal }).catch(() => []),
    [user?.communityId],
  );
  const categoryOptions: SelectOption[] = useMemo(() => {
    const list = (catQuery.data ?? []).map((e) => ({ value: e.code, label: e.label }));
    return list.length > 0 ? list : [
      { value: 'general', label: 'General' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'event', label: 'Event' },
      { value: 'emergency', label: 'Emergency' },
    ];
  }, [catQuery.data]);
  const catLabel = (code: string) => categoryOptions.find((o) => o.value === code)?.label ?? CATEGORY_META[code]?.label ?? code;

  /* ── Data Query ── */
  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const query = useAsync(
    (signal) => announcements.list(
      { search: search.trim() || undefined, page, pageSize, sort: 'publishedAtUtc:desc' },
      {
        includeInactive: isAdmin,
        category: selectedCat !== 'all' ? selectedCat : undefined,
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, selectedCat, effectiveCommunityId, page, pageSize, reloadKey, isAdmin],
  );

  const rawItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => {
    if (filterActive === 'active') return rawItems.filter(a => a.isActive);
    if (filterActive === 'inactive') return rawItems.filter(a => !a.isActive);
    return rawItems;
  }, [rawItems, filterActive]);

  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const filterCount = (selectedCat !== 'all' ? 1 : 0) + (filterOrgId ? 1 : 0) + (filterCommunityId ? 1 : 0) + (filterActive !== 'all' ? 1 : 0) + (search ? 1 : 0);

  /* ── Toggle Active / Inactive ── */
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

  /* ── Delete ── */
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

  const handleCreate = () => {
    if (onSubmitClick) return onSubmitClick();
    setEditingItem(null);
    setModalOpen(true);
  };

  /* ── Admin Toolbar (matches TicketsListPage) ── */
  const adminRight = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={reload} aria-label="Refresh"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted active:scale-95 transition-all">
        <RefreshCw className={cn('h-4 w-4 text-muted-foreground', query.loading && 'animate-spin text-primary')} />
      </button>
      {canAdd && (
        <Button type="button" onClick={handleCreate}
          className="h-9 gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 shadow-xs active:scale-95">
          <Plus className="h-4 w-4 stroke-[2.5]" />{t('announcements.add', { defaultValue: 'New Notice' })}
        </Button>
      )}
      <Button type="button" onClick={() => setShowFilters((p) => !p)}
        className={cn('h-9 gap-1.5 rounded-md px-4 text-xs font-medium text-white shadow-xs active:scale-95 relative',
          showFilters || filterCount > 0 ? 'bg-sky-600 hover:bg-sky-700' : 'bg-sky-500 hover:bg-sky-600')}>
        <Filter className="h-3.5 w-3.5" />
        {showFilters ? 'Hide' : 'Filters'}
        {filterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-sky-700">
            {filterCount}
          </span>
        )}
      </Button>
    </div>
  );

  /* ── Filter Panel (shared between mobile + admin) ── */
  const filterPanel = showFilters ? (
    <div className={cn('flex flex-wrap items-start gap-2.5 rounded-xl border border-border/70 p-3',
      isMobile ? 'bg-card shadow-xs' : 'bg-muted/30')}>
      {!isMobile && (
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('announcements.searchPlaceholder', { defaultValue: 'Search notices...' })}
            className="h-9 pl-9 text-xs rounded-xl bg-card" />
        </div>
      )}
      {scope.showOrgFilter && (
        <div className="w-44">
          <EntitySelect value={filterOrgId} onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
            fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('announcements.filterOrg', { defaultValue: 'All organizations' })} />
        </div>
      )}
      {scope.showCommunityFilter && (
        <div className="w-44">
          <EntitySelect value={filterCommunityId} onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
            fetchPage={makeCommunityFetch(filterOrgId ?? undefined)} resolveLabel={resolveCommunityLabel}
            placeholder={t('announcements.filterCommunity', { defaultValue: 'All wings' })} />
        </div>
      )}
      <div className="w-36">
        <SelectField value={selectedCat} options={[{ value: 'all', label: 'All Categories' }, ...categoryOptions]} size="sm"
          onChange={(v) => { setSelectedCat(v); setPage(1); }} />
      </div>
      {isAdmin && (
        <div className="w-32">
          <SelectField value={filterActive} options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Live only' },
            { value: 'inactive', label: 'Hidden only' },
          ]} size="sm" onChange={(v) => { setFilterActive(v); setPage(1); }} />
        </div>
      )}
      {filterCount > 0 && (
        <button type="button" onClick={() => { setSearch(''); setFilterOrgId(null); setFilterCommunityId(null); setSelectedCat('all'); setFilterActive('all'); setPage(1); }}
          className="text-xs font-semibold text-primary hover:underline self-center px-1">
          Reset
        </button>
      )}
    </div>
  ) : null;

  /* ── Render View ── */
  return (
    <div className={cn('w-full', isMobile ? 'mx-auto flex h-[100dvh] flex-col overflow-hidden bg-background' : 'space-y-4')}>
      {/* Mobile Top Header (native app bar) */}
      {isMobile && <HelpDeskHeader title={pageTitle} mode="mobile" showBack onBack={handleBack} />}

      <div className={cn(isMobile ? 'min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3' : 'w-full')}>
        <Card className={cn('w-full space-y-4',
          isMobile ? 'rounded-none border-none shadow-none p-0 bg-transparent' : 'rounded-2xl border border-border/70 p-4 sm:p-5 bg-card shadow-sm')}>

          {/* Header Toolbar */}
          {!isMobile ? (
            <HelpDeskHeader title={pageTitle} subtitle={t('announcements.subtitle', { defaultValue: 'Society & wing notices, circulars, and updates' })} mode="admin" rightActions={adminRight} />
          ) : (
            /* Mobile inline search + filter + refresh + add bar */
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('announcements.searchPlaceholder', { defaultValue: 'Search notices...' })}
                  className="h-10 w-full rounded-2xl pl-9 text-xs bg-card border-border/80" />
              </div>
              <button type="button" onClick={() => setShowFilters((p) => !p)} aria-label="Filter"
                className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all active:scale-95',
                  showFilters || filterCount > 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border/80 bg-card text-muted-foreground')}>
                <Filter className="h-4 w-4" />
                {filterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {filterCount}
                  </span>
                )}
              </button>
              <button type="button" onClick={reload} aria-label="Refresh"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card text-muted-foreground active:scale-95 transition-all">
                <RefreshCw className={cn('h-4 w-4', query.loading && 'animate-spin text-primary')} />
              </button>
              {canAdd && (
                <button type="button" onClick={handleCreate} aria-label={t('announcements.add', { defaultValue: 'New Notice' })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs active:scale-95 transition-all">
                  <Plus className="h-5 w-5 stroke-[2.5]" />
                </button>
              )}
            </div>
          )}

          {/* Filter Panel */}
          {filterPanel}

          {/* List Body */}
          {query.loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
              {t('common.loading', { defaultValue: 'Loading…' })}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/25" />
              <p className="text-sm font-semibold text-muted-foreground">{t('announcements.empty', { defaultValue: 'No announcements published yet' })}</p>
              {canAdd && (
                <Button type="button" onClick={handleCreate} className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />{t('announcements.add', { defaultValue: 'Create Notice' })}
                </Button>
              )}
            </div>
          ) : showTable ? (
            /* ── Desktop Wide Table View ── */
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <THead>
                  <TR className="bg-muted/40">
                    <TH className="w-10 text-center text-xs">#</TH>
                    <TH className="text-xs">{t('announcements.colNotice', { defaultValue: 'Notice' })}</TH>
                    {showCommunityCol && <TH className="w-44 text-xs">{t('announcements.colScope', { defaultValue: 'Scope / Wing' })}</TH>}
                    <TH className="w-32 text-xs">{t('announcements.colCategory', { defaultValue: 'Category' })}</TH>
                    {isAdmin && <TH className="w-24 text-xs">{t('announcements.colStatus', { defaultValue: 'Status' })}</TH>}
                    <TH className="w-28 text-xs">{t('announcements.colPublished', { defaultValue: 'Published' })}</TH>
                    {(canEdit || canDelete) && <TH className="w-28 text-xs text-right">Actions</TH>}
                  </TR>
                </THead>
                <TBody>
                  {items.map((a, i) => {
                    const meta = CATEGORY_META[a.category] ?? { label: a.category, accent: 'bg-primary', tone: 'default' };
                    const isSocietyWide = !a.communityId || a.communityId === '00000000-0000-0000-0000-000000000000' || a.scope === 'Society';
                    return (
                      <TR key={a.id} className="hover:bg-muted/40 transition-colors">
                        <TD className="text-center text-[11px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                        <TD>
                          <div className="min-w-0 max-w-md">
                            <div className="truncate text-sm font-bold text-foreground">{a.title}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{a.body}</div>
                          </div>
                        </TD>
                        {showCommunityCol && (
                          <TD className="text-xs">
                            {isSocietyWide ? (
                              <span className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300">
                                <Globe className="h-3 w-3 shrink-0" />
                                <span className="truncate">{a.organizationName ?? 'Society-wide'}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Building2 className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">{a.communityName ?? '—'}</span>
                              </span>
                            )}
                          </TD>
                        )}
                        <TD><Badge tone={meta.tone} className="text-[11px] uppercase tracking-wide">{catLabel(a.category)}</Badge></TD>
                        {isAdmin && (
                          <TD>
                            <Badge tone={a.isActive ? 'success' : 'muted'} className="text-[11px]">
                              {a.isActive ? 'Live' : 'Hidden'}
                            </Badge>
                          </TD>
                        )}
                        <TD className="text-[11px] text-muted-foreground whitespace-nowrap">{fmt(a.publishedAtUtc)}</TD>
                        {(canEdit || canDelete) && (
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (
                                <button type="button" disabled={togglingId === a.id} onClick={() => toggleActive(a)}
                                  title={a.isActive ? 'Hide notice' : 'Publish notice'}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 transition-colors">
                                  {a.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              {canEdit && (
                                <button type="button" onClick={() => { setEditingItem(a); setModalOpen(true); }}
                                  title="Edit"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-primary hover:bg-muted active:scale-95 transition-all">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button type="button" onClick={() => setConfirmDelete(a)}
                                  title="Delete"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 active:scale-95 transition-all">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </TD>
                        )}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          ) : (
            /* ── Cards Grid (mobile + admin tablet/small) ── */
            <div className={cn('grid gap-3', !isMobile && 'sm:grid-cols-2 xl:grid-cols-3')}>
              {items.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  item={a}
                  catLabel={catLabel}
                  isAdmin={isAdmin}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  togglingId={togglingId}
                  isExpanded={!!expandedIds[a.id]}
                  onToggleExpand={() => setExpandedIds((p) => ({ ...p, [a.id]: !p[a.id] }))}
                  onToggleActive={() => toggleActive(a)}
                  onEdit={() => { setEditingItem(a); setModalOpen(true); }}
                  onDelete={() => setConfirmDelete(a)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(query.data?.totalCount ?? 0) > pageSize && (
            <div className="pt-2">
              <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0}
                onPageChange={setPage} onPageSizeChange={(sz: any) => { setPageSize(sz); setPage(1); }} />
            </div>
          )}
        </Card>
      </div>

      {/* Unified Submit & Edit Modal */}
      <AnnouncementModal
        open={modalOpen}
        announcement={editingItem}
        categoryOptions={categoryOptions}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        onSaved={() => { setModalOpen(false); setEditingItem(null); reload(); }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('announcements.delete', { defaultValue: 'Delete Announcement' })}
        description={confirmDelete ? t('announcements.deleteConfirm', { title: confirmDelete.title }) : ''}
        confirmLabel={t('announcements.delete', { defaultValue: 'Delete' })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

/* ─── Unified Submit / Edit Modal Dialog (< 90 lines) ─── */
const ALL_WINGS = '__all_wings__';

function AnnouncementModal({
  open, announcement, categoryOptions, onClose, onSaved,
}: {
  open: boolean;
  announcement: Announcement | null;
  categoryOptions: SelectOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const scope = useScope();
  const isEdit = !!announcement;

  const [orgId, setOrgId] = useState<string>('');
  const [commId, setCommId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(announcement?.title ?? '');
    setBody(announcement?.body ?? '');
    setCategory(announcement?.category ?? 'general');
    setOrgId(announcement?.organizationId ?? scope.organizationId ?? user?.organizationId ?? '');
    setCommId(announcement?.communityId && announcement.communityId !== '00000000-0000-0000-0000-000000000000'
      ? announcement.communityId
      : (scope.scopedCommunityId ?? user?.communityId ?? ''));
  }, [open, announcement]);

  const orgsQuery = useAsync(
    (signal) => (open && scope.showOrgFilter ? organizations.list({ pageSize: 100 }, { signal }).catch(() => null) : Promise.resolve(null)),
    [open, scope.showOrgFilter],
  );
  const orgOptions: SelectOption[] = useMemo(
    () => (orgsQuery.data?.items ?? []).map((o) => ({ value: o.id, label: o.name })),
    [orgsQuery.data],
  );

  const activeOrgId = orgId || scope.organizationId || user?.organizationId;
  const commsQuery = useAsync(
    (signal) => (open && (scope.isPowerUser || scope.isOrgAdmin)
      ? communities.list({ pageSize: 100 }, activeOrgId ? { organizationId: activeOrgId } : {}, { signal }).catch(() => null)
      : Promise.resolve(null)),
    [open, scope.isPowerUser, scope.isOrgAdmin, activeOrgId],
  );
  const commOptions: SelectOption[] = useMemo(() => {
    const wings = (commsQuery.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
    return [{ value: ALL_WINGS, label: 'All Wings (Society-wide)' }, ...wings];
  }, [commsQuery.data]);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !title.trim() || !body.trim()) return;

    const finalOrgId = orgId || scope.organizationId || user?.organizationId || undefined;
    const finalCommId = (commId && commId !== ALL_WINGS) ? commId : undefined;

    if (scope.showOrgFilter && !finalOrgId) {
      toast.error('Please select a society (organization).');
      return;
    }

    setBusy(true);
    try {
      if (isEdit) {
        await announcements.update(announcement.id, { title: title.trim(), body: body.trim(), category });
        toast.success(t('announcements.updated', { defaultValue: 'Announcement updated' }));
      } else {
        await announcements.create({
          title: title.trim(),
          body: body.trim(),
          category,
          organizationId: finalOrgId,
          communityId: finalCommId,
        });
        toast.success(t('announcements.created', { defaultValue: 'Announcement published successfully' }));
      }
      onSaved();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={isEdit ? t('announcements.editTitle', { defaultValue: 'Edit Announcement' }) : t('announcements.addTitle', { defaultValue: 'New Announcement' })} />
      <form onSubmit={submit} className="space-y-3.5 py-1">
        {scope.showOrgFilter && (
          <SelectField
            label={t('announcements.organization', { defaultValue: 'Society (Organization)' })}
            value={orgId || null}
            options={orgOptions}
            placeholder="Select Society (Organization)"
            onChange={(v) => { setOrgId(v); setCommId(''); }}
            disabled={busy}
          />
        )}
        {(scope.isPowerUser || scope.isOrgAdmin) && (
          <div>
            <SelectField
              label={t('announcements.community', { defaultValue: 'Wing / Community (Optional)' })}
              value={commId || ALL_WINGS}
              options={commOptions}
              onChange={(v) => setCommId(v === ALL_WINGS ? '' : v)}
              disabled={busy}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Select a wing, or leave as "All Wings" to publish society-wide.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label={t('announcements.colCategory', { defaultValue: 'Category' })} value={category} options={categoryOptions} onChange={setCategory} disabled={busy} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('announcements.titleField', { defaultValue: 'Title' })} *</label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Water tank cleaning" maxLength={200} disabled={busy} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('announcements.bodyField', { defaultValue: 'Message' })} *</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} placeholder="Type announcement details..." disabled={busy}
            className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-9 rounded-xl text-xs">{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="submit" disabled={busy || !title.trim() || !body.trim()} className="h-9 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-700">
            {busy ? t('common.saving') : isEdit ? t('common.save', { defaultValue: 'Save Changes' }) : t('announcements.publish', { defaultValue: 'Publish Notice' })}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default AnnouncementsPage;
