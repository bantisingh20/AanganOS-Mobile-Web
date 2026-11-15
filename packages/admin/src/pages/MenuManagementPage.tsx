import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu as MenuIcon, Plus, Pencil, Trash2, Search, RefreshCw, ArrowUp, ArrowDown, ArrowUpNarrowWide, ArrowDownWideNarrow, ChevronRight, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Drawer } from '@shared/components/ui/drawer';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Toaster } from '@shared/components/ui/sonner';
import { menuItems } from '@shared/services';
import type { MenuItem, MenuItemBody } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { menuIcon } from '@shared/components/menuIcons';
import { MenuIconPicker } from '@shared/components/MenuIconPicker';
import { cn } from '@shared/lib/utils';

type Option = { value: string; label: string };

const SURFACE_APP = 0; // Mobile
const SURFACE_ADMIN = 1; // Web
const SURFACE_COMMON = 2; // Common (both Web and Mobile)

const ACTIONS: Option[] = [
  { value: '0', label: 'View' },
  { value: '1', label: 'Create' },
  { value: '2', label: 'Edit' },
  { value: '3', label: 'Delete' },
  { value: '4', label: 'Approve' },
  { value: '5', label: 'Export' },
  { value: '6', label: 'Assign' },
  { value: '7', label: 'Access' },
];

const DEFAULT_ACTIONS = [0, 1, 2, 3, 7];

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

  const query = useAsync(
    (signal) => menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]),
    [reloadKey],
  );

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
    parentId: m.parentId,
    label: m.label,
    icon: m.icon,
    route: m.route,
    surface: m.surface,
    requiredPermissionActions: m.requiredPermissionActions ?? [],
    requiredPermissionResource: m.requiredPermissionResource ?? null,
    sortOrder,
    isActive: m.isActive,
    showInSidebar: m.showInSidebar,
  });

  const siblingsOf = (m: MenuItem) =>
    items
      .filter((x) => (x.parentId ?? null) === (m.parentId ?? null) && x.surface === m.surface)
      .sort((a, b) => a.sortOrder - b.sortOrder);

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
      await Promise.all([
        menuItems.update(m.id, toBody(m, target.sortOrder)),
        menuItems.update(target.id, toBody(target, m.sortOrder)),
      ]);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setMovingId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await menuItems.remove(confirmDelete.id);
      toast.success(t('menuMgmt.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const SurfaceBadge = ({ v }: { v: number }) => {
    if (v === SURFACE_COMMON) {
      return <Badge tone="success">Common</Badge>;
    }
    if (v === SURFACE_ADMIN) {
      return <Badge tone="default">Web</Badge>;
    }
    return <Badge tone="muted">Mobile</Badge>;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              <MenuIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('menuMgmt.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('menuMgmt.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('menuMgmt.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            {(['all', 'Common', 'Web', 'Mobile'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSurface(s)}
                className={`h-7 rounded-md px-3 text-xs font-semibold ${surface === s ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {s === 'all' ? t('menuMgmt.surfaceAll', 'All') : s}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('menuMgmt.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSortAsc((s) => !s)} className="h-9 gap-1.5 rounded-lg text-xs">
            {sortAsc ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
            {sortAsc ? t('menuMgmt.orderAsc') : t('menuMgmt.orderDesc')}
          </Button>
          <button type="button" onClick={reload} aria-label={t('menuMgmt.refresh')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
            <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('menuMgmt.empty')}
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH>{t('menuMgmt.colLabel')}</TH>
                <TH className="w-24">{t('menuMgmt.colSurface')}</TH>
                <TH className="w-40">{t('menuMgmt.colRoute')}</TH>
                <TH className="w-40">{t('menuMgmt.colIcon')}</TH>
                <TH className="w-52">{t('menuMgmt.colPermission')}</TH>
                <TH className="w-16 text-center">{t('menuMgmt.colSort')}</TH>
                <TH className="w-24">{t('menuMgmt.colActive')}</TH>
                <TH className="w-28">{t('menuMgmt.colSidebar')}</TH>
                <TH className="w-24 text-center">{t('menuMgmt.colOrder')}</TH>
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ item: m, depth, hasChildren }) => {
                const LabelIcon = menuIcon(m.icon);
                const isCollapsed = collapsed.has(m.id);
                const searching = search.trim().length > 0;
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
                        {hasChildren && !searching ? (
                          <button type="button" onClick={() => toggleCollapse(m.id)} aria-label={isCollapsed ? t('menuMgmt.expand') : t('menuMgmt.collapse')} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                            <ChevronRight className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                          </button>
                        ) : (
                          <span className="h-5 w-5 shrink-0" />
                        )}
                        <LabelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">{m.label}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{m.key}</div>
                        </div>
                      </div>
                    </TD>
                    <TD><SurfaceBadge v={m.surface} /></TD>
                    <TD className="text-[11px] text-muted-foreground">{m.route ?? '—'}</TD>
                    <TD>
                      {m.icon ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <LabelIcon className="h-4 w-4" />{m.icon}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD>
                      {m.requiredPermissionActions && m.requiredPermissionActions.length > 0 ? (
                        <span className="flex flex-col gap-1">
                          {m.requiredPermissionResource ? <span className="text-[11px] font-semibold">{m.requiredPermissionResource}</span> : null}
                          <span className="flex flex-wrap gap-1">
                            {m.requiredPermissionActions.map((a) => (
                              <Badge key={a} tone="default">{actionLabel(a)}</Badge>
                            ))}
                          </span>
                        </span>
                      ) : (
                        <Badge tone="success">{t('menuMgmt.everyone')}</Badge>
                      )}
                    </TD>
                    <TD className="text-center text-[11px] text-muted-foreground">{m.sortOrder}</TD>
                    <TD><Badge tone={m.isActive ? 'success' : 'muted'}>{m.isActive ? t('menuMgmt.active') : t('menuMgmt.inactive')}</Badge></TD>
                    <TD><Badge tone={m.showInSidebar ? 'default' : 'muted'}>{m.showInSidebar ? t('menuMgmt.shown') : t('menuMgmt.hidden')}</Badge></TD>
                    <TD>
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" disabled={movingId === m.id || !canMove(m, -1)} onClick={() => move(m, -1)} aria-label={t('menuMgmt.moveUp')} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-emerald-600 disabled:opacity-40">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" disabled={movingId === m.id || !canMove(m, 1)} onClick={() => move(m, 1)} aria-label={t('menuMgmt.moveDown')} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-emerald-600 disabled:opacity-40">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => setEditing(m)} aria-label={t('menuMgmt.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(m)} aria-label={t('menuMgmt.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <MenuItemFormDrawer
        open={creating}
        parentOptions={parentOptions}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reload(); }}
      />
      <MenuItemFormDrawer
        open={!!editing}
        item={editing}
        parentOptions={parentOptions.filter((o) => o.value !== editing?.id)}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('menuMgmt.delete')}
        description={confirmDelete ? t('menuMgmt.deleteConfirm', { label: confirmDelete.label }) : ''}
        confirmLabel={t('menuMgmt.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

interface SearchableSelectProps {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search parent menu...',
  emptyText = 'No matching parent menu found',
  onChange,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-10 sm:h-9 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-xs transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'ring-2 ring-ring border-transparent',
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn('ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[240px] rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-50 zoom-in-95">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg bg-muted/60 pl-8 pr-7 text-xs outline-none placeholder:text-muted-foreground focus:bg-background focus:ring-1 focus:ring-ring"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-0.5 overscroll-contain">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted',
                      isSelected ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-foreground',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItemFormDrawer({
  open,
  item,
  parentOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  item?: MenuItem | null;
  parentOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!item;
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [surface, setSurface] = useState(String(SURFACE_COMMON));
  const [parentId, setParentId] = useState('');
  const [route, setRoute] = useState('');
  const [icon, setIcon] = useState('');
  const [requiresPermission, setRequiresPermission] = useState(false);
  const [actions, setActions] = useState<number[]>([]);
  const [resource, setResource] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [showInSidebar, setShowInSidebar] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKey(item?.key ?? '');
    setLabel(item?.label ?? '');
    setSurface(String(item?.surface ?? SURFACE_COMMON));
    setParentId(item?.parentId ?? '');
    setRoute(item?.route ?? '');
    setIcon(item?.icon ?? '');
    const isNew = !item;
    setRequiresPermission(isNew ? true : (item?.requiredPermissionActions?.length ?? 0) > 0);
    setActions(isNew ? DEFAULT_ACTIONS : (item?.requiredPermissionActions ?? []));
    setResource(item?.requiredPermissionResource ?? '');
    setSortOrder(String(item?.sortOrder ?? 0));
    setIsActive(item?.isActive ?? true);
    setShowInSidebar(item?.showInSidebar ?? true);
  }, [open, item]);

  const sortNum = Number.parseInt(sortOrder, 10);
  const sortValid = Number.isInteger(sortNum) && sortNum >= 0;
  const canSubmit = !!label.trim() && sortValid && (isEdit || !!key.trim()) && (!requiresPermission || (actions.length > 0 && !!resource.trim()));

  const toggleAction = (v: number) => {
    setActions((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body: MenuItemBody = {
        parentId: parentId || null,
        label: label.trim(),
        icon: icon.trim() || null,
        route: route.trim() || null,
        surface: Number.parseInt(surface, 10),
        requiredPermissionActions: requiresPermission ? actions : [],
        requiredPermissionResource: requiresPermission ? resource.trim() : null,
        sortOrder: sortNum,
        isActive,
        showInSidebar,
      };
      if (isEdit) await menuItems.update(item!.id, body);
      else await menuItems.create({ ...body, key: key.trim() });
      toast.success(isEdit ? t('menuMgmt.updated') : t('menuMgmt.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const surfaceOptions: Option[] = [
    { value: String(SURFACE_COMMON), label: 'Common (Web & Mobile)' },
    { value: String(SURFACE_ADMIN), label: 'Web (Admin)' },
    { value: String(SURFACE_APP), label: 'Mobile (App)' },
  ];
  const parentSelectOptions: Option[] = [{ value: '', label: t('menuMgmt.topLevel') }, ...parentOptions];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      className="w-full sm:max-w-xl md:max-w-2xl"
      title={
        <div className="flex flex-col">
          <span className="text-sm sm:text-base font-bold text-foreground">
            {isEdit ? t('menuMgmt.editTitle') : t('menuMgmt.addTitle')}
          </span>
          <span className="text-[11px] sm:text-xs font-normal text-muted-foreground truncate">
            {isEdit ? (item?.label || item?.key) : 'Create a new navigation item'}
          </span>
        </div>
      }
      extra={
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8.5 rounded-xl px-3 text-xs font-semibold">
            {t('orgs.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={busy || !canSubmit}
            className="h-8.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5 stroke-[2.5]" />}
            {isEdit ? t('menuMgmt.saveChanges') : t('menuMgmt.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col min-h-full justify-between">
        <div className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t('menuMgmt.keyLabel')} <span className="text-rose-500">*</span>
              </label>
              <Input
                value={key}
                disabled={isEdit}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t('menuMgmt.keyPlaceholder')}
                maxLength={100}
                className="h-10 sm:h-9 rounded-xl text-xs font-mono"
              />
            </div>
            <div className="col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t('menuMgmt.labelLabel')} <span className="text-rose-500">*</span>
              </label>
              <Input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('menuMgmt.labelPlaceholder')}
                maxLength={200}
                className="h-10 sm:h-9 rounded-xl text-xs"
              />
            </div>
            <div className="col-span-1">
              <SelectField
                label={t('menuMgmt.colSurface')}
                value={surface}
                options={surfaceOptions}
                onChange={setSurface}
              />
            </div>
            <div className="col-span-1">
              <SearchableSelect
                label={t('menuMgmt.parentLabel')}
                value={parentId}
                options={parentSelectOptions}
                placeholder={t('menuMgmt.topLevel')}
                searchPlaceholder="Search parent menu..."
                emptyText="No matching parent menu found"
                onChange={setParentId}
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t('menuMgmt.colRoute')}
              </label>
              <Input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder={t('menuMgmt.routePlaceholder')}
                maxLength={200}
                className="h-10 sm:h-9 rounded-xl text-xs font-mono"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <MenuIconPicker
                value={icon}
                onChange={setIcon}
                label={t('menuMgmt.colIcon')}
                placeholder={t('menuMgmt.iconPlaceholder')}
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t('menuMgmt.requiresPermission')}
              </label>
              <div className="flex items-center rounded-xl bg-muted/80 p-1">
                <button
                  type="button"
                  onClick={() => setRequiresPermission(false)}
                  className={cn(
                    'h-8.5 flex-1 rounded-lg text-xs font-semibold transition-all',
                    !requiresPermission ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('menuMgmt.permEveryone')}
                </button>
                <button
                  type="button"
                  onClick={() => setRequiresPermission(true)}
                  className={cn(
                    'h-8.5 flex-1 rounded-lg text-xs font-semibold transition-all',
                    requiresPermission ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('menuMgmt.permRestricted')}
                </button>
              </div>
            </div>
            {requiresPermission ? (
              <>
                <div className="col-span-1 sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {t('menuMgmt.resourceLabel')} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                    placeholder={t('menuMgmt.resourcePlaceholder')}
                    maxLength={128}
                    className="h-10 sm:h-9 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {t('menuMgmt.requiredActions')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS.map((a) => {
                      const on = actions.includes(Number(a.value));
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => toggleAction(Number(a.value))}
                          className={cn(
                            'h-8 rounded-lg border px-3 text-xs font-semibold transition-all active:scale-95',
                            on
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-border text-muted-foreground hover:border-input hover:text-foreground'
                          )}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
            <div className="col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t('menuMgmt.sortOrderLabel')}
              </label>
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-10 sm:h-9 rounded-xl text-xs"
              />
            </div>
            <div className="col-span-1 flex flex-col justify-end gap-2.5">
              <label className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-emerald-600"
                />
                <div className="flex flex-col">
                  <span className="font-semibold">{t('menuMgmt.activeLabel')}</span>
                  <span className="text-[11px] text-muted-foreground">Enable this menu item</span>
                </div>
              </label>
              <label className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInSidebar}
                  onChange={(e) => setShowInSidebar(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-emerald-600"
                />
                <div className="flex flex-col">
                  <span className="font-semibold">{t('menuMgmt.sidebarLabel')}</span>
                  <span className="text-[11px] text-muted-foreground">Show in navigation menu</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:-mb-6 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-xl px-4 text-xs font-semibold"
          >
            {t('orgs.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={busy || !canSubmit}
            className="h-9 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isEdit ? t('menuMgmt.saveChanges') : t('menuMgmt.save')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
