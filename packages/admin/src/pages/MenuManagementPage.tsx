import { useMemo, useState } from 'react';
import { Menu as MenuIcon, Plus, Pencil, Trash2, Search, RefreshCw, ArrowUp, ArrowDown, ArrowUpNarrowWide, ArrowDownWideNarrow, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Toaster } from '@shared/components/ui/sonner';
import { menuItems } from '@shared/services';
import type { MenuItem, MenuItemBody } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { menuIcon } from '@shared/components/menuIcons';
import { cn } from '@shared/lib/utils';
import { MenuItemFormDrawer, type Option } from '../components/MenuItemFormDrawer';

const SURFACE_APP = 0;
const SURFACE_ADMIN = 1;
const SURFACE_COMMON = 2;

const ACTIONS: Option[] = [
  { value: '0', label: 'View' }, { value: '1', label: 'Create' }, { value: '2', label: 'Edit' },
  { value: '3', label: 'Delete' }, { value: '4', label: 'Approve' }, { value: '5', label: 'Export' },
  { value: '6', label: 'Assign' }, { value: '7', label: 'Access' },
];

function actionLabel(v: number): string {
  return ACTIONS.find((a) => a.value === String(v))?.label ?? String(v);
}

function matches(m: MenuItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return m.label.toLowerCase().includes(s) || m.key.toLowerCase().includes(s) || (m.route ?? '').toLowerCase().includes(s);
}

type FlatRow = { item: MenuItem; depth: number; hasChildren: boolean };

function flatten(items: MenuItem[], q: string, asc: boolean, collapsed: Set<string>): FlatRow[] {
  const byParent = new Map<string | null, MenuItem[]>();
  for (const m of items) {
    const key = m.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(m);
    byParent.set(key, list);
  }
  const searching = q.trim().length > 0;
  const sortFn = (a: MenuItem, b: MenuItem) => (asc ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder);
  const out: FlatRow[] = [];
  const build = (parentId: string | null, depth: number): boolean => {
    const children = (byParent.get(parentId) ?? []).slice().sort(sortFn);
    let anyShown = false;
    for (const m of children) {
      const hasChildren = (byParent.get(m.id) ?? []).length > 0;
      const snapshot = out.length;
      out.push({ item: m, depth, hasChildren });
      const isCollapsed = !searching && collapsed.has(m.id);
      const kidsShown = isCollapsed ? false : build(m.id, depth + 1);
      if (searching && !matches(m, q) && !kidsShown) {
        out.length = snapshot;
      } else {
        anyShown = true;
      }
    }
    return anyShown;
  };
  build(null, 0);
  return out;
}

export function MenuManagementPage() {
  const { t } = useTranslation();
  const [surface, setSurface] = useState<'all' | 'Common' | 'Web' | 'Mobile'>('all');
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync((signal) => menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]), [reloadKey]);
  const rawItems = useMemo(() => query.data ?? [], [query.data]);
  const items = useMemo(() => {
    if (surface === 'all') return rawItems;
    if (surface === 'Common') return rawItems.filter((m) => m.surface === SURFACE_COMMON);
    if (surface === 'Web') return rawItems.filter((m) => m.surface === SURFACE_ADMIN || m.surface === SURFACE_COMMON);
    if (surface === 'Mobile') return rawItems.filter((m) => m.surface === SURFACE_APP || m.surface === SURFACE_COMMON);
    return rawItems;
  }, [rawItems, surface]);

  const rows = useMemo(() => flatten(items, search, sortAsc, collapsed), [items, search, sortAsc, collapsed]);
  const toggleCollapse = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const parentOptions = useMemo<Option[]>(() => items.map((m) => ({ value: m.id, label: `${m.label} (${m.key})` })), [items]);
  const reload = () => setReloadKey((k) => k + 1);

  const toBody = (m: MenuItem, sortOrder: number): MenuItemBody => ({
    parentId: m.parentId, label: m.label, icon: m.icon, route: m.route, surface: m.surface,
    requiredPermissionActions: m.requiredPermissionActions ?? [], requiredPermissionResource: m.requiredPermissionResource ?? null,
    sortOrder, isActive: m.isActive, showInSidebar: m.showInSidebar,
  });

  const siblingsOf = (m: MenuItem) => items.filter((x) => (x.parentId ?? null) === (m.parentId ?? null) && x.surface === m.surface).sort((a, b) => a.sortOrder - b.sortOrder);
  const canMove = (m: MenuItem, dir: -1 | 1): boolean => {
    const sibs = siblingsOf(m);
    const idx = sibs.findIndex((x) => x.id === m.id);
    return idx + dir >= 0 && idx + dir < sibs.length;
  };

  const move = async (m: MenuItem, dir: -1 | 1) => {
    const sibs = siblingsOf(m);
    const idx = sibs.findIndex((x) => x.id === m.id);
    const target = sibs[idx + dir];
    if (!target) return;
    setMovingId(m.id);
    try {
      await Promise.all([menuItems.update(m.id, toBody(m, target.sortOrder)), menuItems.update(target.id, toBody(target, m.sortOrder))]);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setMovingId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await menuItems.remove(confirmDelete.id);
      toast.success(t('menuMgmt.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const SurfaceBadge = ({ v }: { v: number }) => {
    if (v === SURFACE_COMMON) return <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">Common</Badge>;
    if (v === SURFACE_ADMIN) return <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded">Web</Badge>;
    return <Badge tone="muted" className="text-[10px] px-1.5 py-0 rounded">Mobile</Badge>;
  };

  return (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <MenuIcon className="h-3.5 w-3.5 text-primary" />{t('menuMgmt.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('menuMgmt.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium">
          <Plus className="h-3 w-3 stroke-[2.5]" />{t('menuMgmt.add')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-center rounded-[4px] bg-muted/60 p-0.5 border border-border/70">
            {(['all', 'Common', 'Web', 'Mobile'] as const).map((s) => (
              <button
                key={s} type="button" onClick={() => setSurface(s)}
                className={cn('h-6.5 rounded-[3px] px-2 text-[11px] font-medium transition-colors', surface === s ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
              >
                {s === 'all' ? t('menuMgmt.surfaceAll', 'All') : s}
              </button>
            ))}
          </div>
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('menuMgmt.searchPlaceholder')} className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setSortAsc((s) => !s)} className="h-7.5 px-2 gap-1 rounded-[4px] text-[11px] border-border/80">
            {sortAsc ? <ArrowUpNarrowWide className="h-3 w-3" /> : <ArrowDownWideNarrow className="h-3 w-3" />}
            {sortAsc ? t('menuMgmt.orderAsc') : t('menuMgmt.orderDesc')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label={t('menuMgmt.refresh')} className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <MenuIcon className="h-6 w-6 text-muted-foreground/50 mb-1.5" />{t('menuMgmt.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="border-b border-border bg-muted/40">
                  <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('menuMgmt.colLabel')}</TH>
                  <TH className="w-20 py-1.5 px-2 text-[10.5px] font-semibold">{t('menuMgmt.colSurface')}</TH>
                  <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('menuMgmt.colRoute')}</TH>
                  <TH className="w-36 py-1.5 px-2 text-[10.5px] font-semibold">{t('menuMgmt.colPermission')}</TH>
                  <TH className="w-14 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('menuMgmt.colSort')}</TH>
                  <TH className="w-20 py-1.5 px-2 text-[10.5px] font-semibold">{t('menuMgmt.colActive')}</TH>
                  <TH className="w-18 py-1.5 px-2 text-center text-[10.5px] font-semibold">{t('menuMgmt.colOrder')}</TH>
                  <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ item: m, depth, hasChildren }) => {
                  const LabelIcon = menuIcon(m.icon);
                  const isCollapsed = collapsed.has(m.id);
                  const searching = search.trim().length > 0;
                  return (
                    <TR key={m.id} className="hover:bg-muted/30 transition-colors">
                      <TD className="py-1 px-2">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 16 }}>
                          {hasChildren && !searching ? (
                            <button type="button" onClick={() => toggleCollapse(m.id)} aria-label={isCollapsed ? t('menuMgmt.expand') : t('menuMgmt.collapse')} className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', !isCollapsed && 'rotate-90')} />
                            </button>
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          <LabelIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">{m.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono block truncate">{m.key}</span>
                          </div>
                        </div>
                      </TD>
                      <TD className="py-1 px-2"><SurfaceBadge v={m.surface} /></TD>
                      <TD className="py-1 px-2 font-mono text-[11px] text-muted-foreground truncate">{m.route ?? '—'}</TD>
                      <TD className="py-1 px-2">
                        {m.requiredPermissionActions && m.requiredPermissionActions.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {m.requiredPermissionResource && <span className="text-[10px] font-mono text-foreground font-semibold mr-1">{m.requiredPermissionResource}:</span>}
                            {m.requiredPermissionActions.map((a) => (<Badge key={a} tone="default" className="text-[9px] px-1 py-0 rounded">{actionLabel(a)}</Badge>))}
                          </div>
                        ) : (
                          <Badge tone="success" className="text-[9px] px-1 py-0 rounded">{t('menuMgmt.everyone')}</Badge>
                        )}
                      </TD>
                      <TD className="py-1 px-2 text-center text-xs text-muted-foreground font-mono">{m.sortOrder}</TD>
                      <TD className="py-1 px-2">
                        <Badge tone={m.isActive ? 'success' : 'muted'} className="text-[9px] px-1 py-0 rounded">
                          {m.isActive ? t('menuMgmt.active') : t('menuMgmt.inactive')}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button type="button" disabled={movingId === m.id || !canMove(m, -1)} onClick={() => move(m, -1)} aria-label={t('menuMgmt.moveUp')} className="flex h-5.5 w-5.5 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary disabled:opacity-30">
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button type="button" disabled={movingId === m.id || !canMove(m, 1)} onClick={() => move(m, 1)} aria-label={t('menuMgmt.moveDown')} className="flex h-5.5 w-5.5 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary disabled:opacity-30">
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </TD>
                      <TD className="py-1 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditing(m)} title={t('menuMgmt.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(m)} title={t('menuMgmt.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      <MenuItemFormDrawer open={creating} parentOptions={parentOptions} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <MenuItemFormDrawer open={!!editing} item={editing} parentOptions={parentOptions.filter((o) => o.value !== editing?.id)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <ConfirmDialog open={!!confirmDelete} tone="danger" title={t('menuMgmt.delete')} description={confirmDelete ? t('menuMgmt.deleteConfirm', { label: confirmDelete.label }) : ''} confirmLabel={t('menuMgmt.delete')} cancelLabel={t('orgs.cancel')} busy={confirmBusy} onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}

export default MenuManagementPage;
