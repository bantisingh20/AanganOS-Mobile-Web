import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Shield,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  X,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SelectField } from '@shared/components/SelectField';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { roles, menuItems, communities } from '@shared/services';
import type { Role, PermissionGrant } from '@shared/api/roles';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { toFormError } from '@shared/api/errors';
import { menuIcon } from '@shared/components/menuIcons';

const SCOPE_PLATFORM = 0;
const SCOPE_COMMUNITY = 1;
const SURFACE_APP = 0;
const SURFACE_ADMIN = 1;

const ACTION_VIEW = 0;
const ACTION_CREATE = 1;
const ACTION_EDIT = 2;
const ACTION_DELETE = 3;
const ACTION_APPROVE = 4;
const ACTION_EXPORT = 5;
const ACTION_ASSIGN = 6;
const ACTION_ACCESS = 7;

const CORE_ACTION_META = [
  { action: ACTION_VIEW, label: 'View', short: 'View' },
  { action: ACTION_CREATE, label: 'Create', short: 'Create' },
  { action: ACTION_EDIT, label: 'Edit', short: 'Edit' },
  { action: ACTION_DELETE, label: 'Delete', short: 'Delete' },
] as const;

const EXTRA_ACTION_LABELS: Record<number, string> = {
  [ACTION_APPROVE]: 'Approve',
  [ACTION_EXPORT]: 'Export',
  [ACTION_ASSIGN]: 'Assign',
  [ACTION_ACCESS]: 'Access',
};

const DEFAULT_ADMIN_ACTIONS = [ACTION_VIEW, ACTION_CREATE, ACTION_EDIT, ACTION_DELETE];
const DEFAULT_APP_ACTIONS = [ACTION_ACCESS, ACTION_VIEW];

// Case-insensitive permission key helper
export const permKey = (resourceType: string, action: number) =>
  `${resourceType.trim().toLowerCase()}:${action}`;

function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}

interface MenuPermRow {
  id: string;
  label: string;
  icon: string | null;
  depth: number;
  resource: string;
  actions: number[];
  category: string;
  surface: number;
}

function getCategoryForModule(label: string, resource: string | null): string {
  const s = `${label} ${resource ?? ''}`.toLowerCase();
  if (s.includes('bill') || s.includes('finance') || s.includes('payment') || s.includes('receipt') || s.includes('invoice') || s.includes('wallet') || s.includes('expense') || s.includes('dues')) {
    return 'Finance & Billing';
  }
  if (s.includes('user') || s.includes('resident') || s.includes('member') || s.includes('people') || s.includes('staff') || s.includes('group') || s.includes('tenant') || s.includes('owner')) {
    return 'People & Residents';
  }
  if (s.includes('notice') || s.includes('announcement') || s.includes('maintenance') || s.includes('helpdesk') || s.includes('ticket') || s.includes('visitor') || s.includes('vehicle') || s.includes('amenity') || s.includes('facility') || s.includes('package') || s.includes('parcel') || s.includes('gate') || s.includes('siren') || s.includes('sos')) {
    return 'Operations';
  }
  if (s.includes('role') || s.includes('permission') || s.includes('menu') || s.includes('setting') || s.includes('security') || s.includes('audit') || s.includes('config') || s.includes('template')) {
    return 'System & Security';
  }
  return 'General';
}

export function RolesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');

  // Roles Tab State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isSmall = useIsSmallScreen();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [cloningRole, setCloningRole] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // All roles for chip selection & lookup
  const allRolesQuery = useAsync(
    (signal) => roles.list({ pageSize: 100 }, { signal }).catch(() => null),
    [reloadKey],
  );
  const allRoles = useMemo(() => allRolesQuery.data?.items ?? [], [allRolesQuery.data]);

  // Paginated roles query for Roles tab
  const tableQuery = useAsync(
    (signal) => roles.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  const tableItems = useMemo(() => tableQuery.data?.items ?? [], [tableQuery.data]);

  const reload = () => setReloadKey((k) => k + 1);

  // Permissions Tab State
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Auto-select first role when switching to permissions or when roles load
  useEffect(() => {
    if (!selectedRoleId && allRoles.length > 0) {
      setSelectedRoleId(allRoles[0].id);
    }
  }, [selectedRoleId, allRoles]);

  const selectedRole = useMemo(() => {
    return allRoles.find((r) => r.id === selectedRoleId) ?? allRoles[0] ?? null;
  }, [allRoles, selectedRoleId]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await roles.remove(confirmDelete.id);
      toast.success(t('roles.deleted'));
      setConfirmDelete(null);
      if (selectedRoleId === confirmDelete.id) {
        setSelectedRoleId(null);
      }
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDuplicate = (r: Role) => {
    setCloningRole(r);
    setCreating(true);
  };

  const handleOpenPermissionsForRole = (r: Role) => {
    setSelectedRoleId(r.id);
    setActiveTab('permissions');
  };

  const ScopeBadge = ({ r }: { r: Role }) => (
    <Badge tone={r.scope === SCOPE_PLATFORM ? 'info' : 'default'}>
      {r.scope === SCOPE_PLATFORM ? t('roles.scopePlatform') : t('roles.scopeCommunity')}
    </Badge>
  );

  const summaryText = (r: Role) => {
    const resources = new Set(r.permissions.map((p) => p.resourceType.toLowerCase())).size;
    return t('roles.summary', { grants: r.permissions.length, resources });
  };

  const RowActions = ({ r }: { r: Role }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => handleOpenPermissionsForRole(r)}
        title="Configure Permissions"
        aria-label="Configure Permissions"
        className="flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors text-xs font-semibold"
      >
        <KeyRound className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Permissions</span>
      </button>
      <button
        type="button"
        onClick={() => handleDuplicate(r)}
        title="Duplicate role"
        aria-label="Duplicate role"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(r)}
        aria-label={t('roles.edit')}
        title={t('roles.edit')}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-700 hover:bg-muted dark:text-slate-300 transition-colors"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(r)}
        aria-label={t('roles.delete')}
        title={t('roles.delete')}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Header Card */}
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-emerald-600" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">{t('roles.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('roles.subtitle')}</p>
            </div>
          </div>

          {/* Primary View Navigation Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1 self-start sm:self-auto border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 h-8 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Roles</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'roles' ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                }`}
              >
                {allRoles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-2 h-8 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'permissions'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Permissions</span>
              {selectedRole && (
                <span
                  className={`rounded-full px-2 py-0.2 text-[10px] font-bold max-w-[120px] truncate ${
                    activeTab === 'permissions' ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                  }`}
                >
                  {selectedRole.name}
                </span>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* TAB 1: ROLES MANAGEMENT VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Filter / Search Bar */}
          <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('roles.searchPlaceholder')}
                className="h-9 max-w-sm pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reload}
                aria-label={t('roles.refresh')}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-emerald-600"
              >
                <RefreshCw className={`h-4 w-4 ${tableQuery.loading ? 'animate-spin' : ''}`} />
              </button>
              <Button
                onClick={() => {
                  setCloningRole(null);
                  setCreating(true);
                }}
                className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4" />
                {t('roles.add')}
              </Button>
            </div>
          </Card>

          {tableItems.length === 0 ? (
            <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {tableQuery.loading ? t('common.loading') : t('roles.empty')}
            </Card>
          ) : isSmall ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tableItems.map((r) => (
                <Card key={r.id} className="flex flex-col gap-3 rounded-2xl p-4 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">{r.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {t('roles.permissionCount', { count: r.permissions.length })}
                      </div>
                    </div>
                    <ScopeBadge r={r} />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">{summaryText(r)}</span>
                    <RowActions r={r} />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden rounded-2xl p-0 border border-border">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-14 text-center">#</TH>
                    <TH>{t('roles.colRole')}</TH>
                    <TH className="w-32">{t('roles.colScope')}</TH>
                    <TH>{t('roles.colSummary')}</TH>
                    <TH className="w-48 text-right">{t('orgs.colActions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {tableItems.map((r, i) => (
                    <TR key={r.id}>
                      <TD className="text-center text-[11px] text-muted-foreground">
                        {(page - 1) * pageSize + i + 1}
                      </TD>
                      <TD>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-bold text-foreground">{r.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {t('roles.permissionCount', { count: r.permissions.length })}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <ScopeBadge r={r} />
                      </TD>
                      <TD className="text-[11px] text-muted-foreground">{summaryText(r)}</TD>
                      <TD>
                        <RowActions r={r} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}

          {(tableQuery.data?.totalCount ?? 0) > 0 ? (
            <Card className="rounded-xl p-1">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={tableQuery.data?.totalCount ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </Card>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INLINE PERMISSION MATRIX VIEW (NO MODAL / NO POPUP!) */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && (
        <InlinePermissionsTab
          roles={allRoles}
          selectedRoleId={selectedRoleId}
          onSelectRole={setSelectedRoleId}
          onRoleUpdated={reload}
        />
      )}

      {/* Add / Edit Role Basic Dialog (Name, Scope, Community) */}
      <RoleBasicDialog
        open={creating}
        cloneSource={cloningRole}
        onClose={() => {
          setCreating(false);
          setCloningRole(null);
        }}
        onSaved={(newRole) => {
          setCreating(false);
          setCloningRole(null);
          reload();
          setSelectedRoleId(newRole.id);
          setActiveTab('permissions');
        }}
      />

      <RoleBasicDialog
        open={!!editing}
        role={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('roles.delete')}
        description={confirmDelete ? t('roles.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('roles.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

// -------------------------------------------------------------------------------------
// INLINE PERMISSION MATRIX TAB (EMBEDDED DIRECTLY IN PAGE - NO POPUP)
// -------------------------------------------------------------------------------------
function InlinePermissionsTab({
  roles: allRolesList,
  selectedRoleId,
  onSelectRole,
  onRoleUpdated,
}: {
  roles: Role[];
  selectedRoleId: string | null;
  onSelectRole: (id: string) => void;
  onRoleUpdated: () => void;
}) {
  const { t } = useTranslation();
  const isSmall = useIsSmallScreen();

  const currentRole = useMemo(() => {
    return allRolesList.find((r) => r.id === selectedRoleId) ?? allRolesList[0] ?? null;
  }, [allRolesList, selectedRoleId]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [currentGrants, setCurrentGrants] = useState<PermissionGrant[]>([]);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [permSurface, setPermSurface] = useState<number>(SURFACE_ADMIN);
  const [savingBusy, setSavingBusy] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    setViewMode(isSmall ? 'cards' : 'table');
  }, [isSmall]);

  // Catalog of all menu items
  const catalog = useAsync(
    (signal) => menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]),
    [],
  );

  // Canonical resource mapping
  const canonicalMap = useMemo(() => {
    const map = new Map<string, string>();
    (catalog.data ?? []).forEach((m) => {
      const res = (m.requiredPermissionResource?.trim() || m.key?.trim());
      if (res) {
        map.set(res.toLowerCase(), res);
      }
    });
    return map;
  }, [catalog.data]);

  // Fetch full details of the currently selected role
  useEffect(() => {
    if (!currentRole) return;
    let active = true;

    const initialGrants = currentRole.permissions ?? [];
    setCurrentGrants(initialGrants);
    initialGrants.forEach((p) => {
      canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim());
    });
    const initialKeys = new Set(initialGrants.map((p) => permKey(p.resourceType, p.action)));
    setSelected(initialKeys);
    setSavedKeys(initialKeys);

    // Fetch fresh grants directly from API
    roles
      .get(currentRole.id)
      .then((fresh) => {
        if (!active || !fresh) return;
        const freshGrants = fresh.permissions ?? [];
        setCurrentGrants(freshGrants);
        freshGrants.forEach((p) => {
          canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim());
        });
        const freshKeys = new Set(freshGrants.map((p) => permKey(p.resourceType, p.action)));
        setSelected(freshKeys);
        setSavedKeys(freshKeys);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [currentRole?.id, canonicalMap]);

  // Build rows for the matrix
  const allSurfaceRows = useMemo<MenuPermRow[]>(() => {
    const items = (catalog.data ?? []).filter((m) => m.surface === permSurface);
    const byParent = new Map<string | null, MenuItem[]>();
    for (const m of items) {
      const p = m.parentId ?? null;
      const list = byParent.get(p) ?? [];
      list.push(m);
      byParent.set(p, list);
    }
    const sortFn = (a: MenuItem, b: MenuItem) => a.sortOrder - b.sortOrder;
    const rows: MenuPermRow[] = [];
    const seenResources = new Set<string>();

    const walk = (parentId: string | null, depth: number) => {
      for (const m of (byParent.get(parentId) ?? []).slice().sort(sortFn)) {
        const resource = (m.requiredPermissionResource?.trim() || m.key?.trim());
        if (resource) {
          const lowerRes = resource.toLowerCase();
          canonicalMap.set(lowerRes, resource);

          // Full CRUD available on admin surface; access & view on app surface
          const defaultActions = m.surface === SURFACE_ADMIN ? DEFAULT_ADMIN_ACTIONS : DEFAULT_APP_ACTIONS;
          const mergedActions = Array.from(new Set([...defaultActions, ...(m.requiredPermissionActions ?? [])])).sort((a, b) => a - b);

          rows.push({
            id: m.id,
            label: m.label,
            icon: m.icon,
            depth,
            resource,
            actions: mergedActions,
            category: getCategoryForModule(m.label, resource),
            surface: m.surface,
          });
          seenResources.add(lowerRes);
        }
        walk(m.id, depth + 1);
      }
    };
    walk(null, 0);

    // Also include any extra resource granted on this role
    if (currentGrants.length > 0) {
      const extraResources = new Map<string, number[]>();
      for (const p of currentGrants) {
        const lowerRes = p.resourceType.trim().toLowerCase();
        if (!seenResources.has(lowerRes)) {
          const acts = extraResources.get(lowerRes) ?? [...DEFAULT_ADMIN_ACTIONS];
          if (!acts.includes(p.action)) acts.push(p.action);
          extraResources.set(lowerRes, acts);
          canonicalMap.set(lowerRes, p.resourceType.trim());
        }
      }

      extraResources.forEach((acts, lowerRes) => {
        const canonical = canonicalMap.get(lowerRes) ?? lowerRes;
        rows.push({
          id: `extra-${lowerRes}`,
          label: canonical,
          icon: null,
          depth: 0,
          resource: canonical,
          actions: acts.sort((a, b) => a - b),
          category: getCategoryForModule(canonical, canonical),
          surface: permSurface,
        });
      });
    }

    return rows;
  }, [catalog.data, permSurface, canonicalMap, currentGrants]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    allSurfaceRows.forEach((r) => set.add(r.category));
    return ['All', ...Array.from(set).sort()];
  }, [allSurfaceRows]);

  // Visible rows
  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allSurfaceRows.filter((r) => {
      const matchCat = activeCategory === 'All' || r.category === activeCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.resource.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [allSurfaceRows, activeCategory, filter]);

  // Counts per surface
  const countsPerSurface = useMemo(() => {
    const all = catalog.data ?? [];
    let adminCount = 0;
    let appCount = 0;
    for (const k of selected) {
      const res = k.slice(0, k.lastIndexOf(':'));
      const found = all.find((m) => m.requiredPermissionResource?.trim().toLowerCase() === res);
      if (found?.surface === SURFACE_APP) {
        appCount++;
      } else {
        adminCount++;
      }
    }
    return { admin: adminCount, app: appCount };
  }, [catalog.data, selected]);

  const hasUnsavedChanges = useMemo(() => {
    if (selected.size !== savedKeys.size) return true;
    for (const k of selected) {
      if (!savedKeys.has(k)) return true;
    }
    return false;
  }, [selected, savedKeys]);

  // Toggle single permission
  const togglePerm = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle all actions for a specific row
  const toggleRow = (row: MenuPermRow) => {
    const keys = row.actions.map((a) => permKey(row.resource, a));
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Toggle specific action across all currently visible rows
  const toggleColumnAction = (action: number) => {
    const relevantKeys: string[] = [];
    visibleRows.forEach((r) => {
      if (r.actions.includes(action)) {
        relevantKeys.push(permKey(r.resource, action));
      }
    });
    if (relevantKeys.length === 0) return;
    const allOn = relevantKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) {
        relevantKeys.forEach((k) => next.delete(k));
      } else {
        relevantKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Presets
  const applyPresetFull = () => {
    const allKeys: string[] = [];
    allSurfaceRows.forEach((r) => {
      r.actions.forEach((a) => {
        allKeys.push(permKey(r.resource, a));
      });
    });
    setSelected((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k) => next.add(k));
      return next;
    });
    toast.success('Granted Full Admin Access to all visible modules');
  };

  const applyPresetViewOnly = () => {
    const viewKeys: string[] = [];
    allSurfaceRows.forEach((r) => {
      if (r.actions.includes(ACTION_VIEW)) {
        viewKeys.push(permKey(r.resource, ACTION_VIEW));
      }
    });
    setSelected((prev) => {
      const next = new Set(prev);
      viewKeys.forEach((k) => next.add(k));
      return next;
    });
    toast.success('Granted View-Only access to all modules');
  };

  const applyPresetOperator = () => {
    const opKeys: string[] = [];
    const allowed = [ACTION_VIEW, ACTION_CREATE, ACTION_EDIT];
    allSurfaceRows.forEach((r) => {
      r.actions.forEach((a) => {
        if (allowed.includes(a)) {
          opKeys.push(permKey(r.resource, a));
        }
      });
    });
    setSelected((prev) => {
      const next = new Set(prev);
      opKeys.forEach((k) => next.add(k));
      return next;
    });
    toast.success('Granted Operator permissions (View, Create, Edit)');
  };

  const applyPresetClear = () => {
    const surfaceKeys = new Set(allSurfaceRows.flatMap((r) => r.actions.map((a) => permKey(r.resource, a))));
    setSelected((prev) => {
      const next = new Set(prev);
      surfaceKeys.forEach((k) => next.delete(k));
      return next;
    });
    toast.info('Cleared permissions for current surface');
  };

  const handleReset = () => {
    setSelected(new Set(savedKeys));
    toast.info('Reverted un-saved changes to last saved state');
  };

  // Save permissions
  const saveRolePermissions = async () => {
    if (!currentRole || savingBusy) return;
    setSavingBusy(true);
    try {
      const perms = Array.from(selected).map((k) => {
        const idx = k.lastIndexOf(':');
        const lowerRes = k.slice(0, idx);
        const action = Number(k.slice(idx + 1));
        const canonical = canonicalMap.get(lowerRes) ?? lowerRes;
        return { resourceType: canonical, action };
      });

      await roles.update(currentRole.id, {
        name: currentRole.name,
        scope: currentRole.scope,
        communityId: currentRole.communityId,
        permissions: perms,
      });

      setSavedKeys(new Set(selected));
      toast.success(`Permissions saved for role: ${currentRole.name}`);
      onRoleUpdated();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setSavingBusy(false);
    }
  };

  if (!currentRole) {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        No roles available. Please create a role first.
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* --------------------------------------------------------------------- */}
      {/* 1. ROLE SELECTION CHIPS / TABS (ALL EXISTING ROLES) */}
      {/* --------------------------------------------------------------------- */}
      <Card className="p-3 sm:p-4 rounded-2xl border border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Role to Configure Permissions
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {allRolesList.length} total roles available
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar flex-nowrap">
          {allRolesList.map((r) => {
            const isSelected = r.id === currentRole.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRole(r.id)}
                className={`group flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer border-2 shrink-0 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-border bg-card text-foreground hover:border-emerald-400 hover:bg-muted/40'
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-md ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                </div>
                <span className="whitespace-nowrap">{r.name}</span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                    isSelected
                      ? 'bg-emerald-200/70 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-100'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {r.scope === SCOPE_PLATFORM ? 'Platform' : 'Community'}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 2. ACTIVE ROLE HEADER & DIRECT SAVE ACTIONS */}
      {/* --------------------------------------------------------------------- */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border border-border bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {currentRole.name}
                </h2>
                <Badge tone={currentRole.scope === SCOPE_PLATFORM ? 'info' : 'default'}>
                  {currentRole.scope === SCOPE_PLATFORM ? 'Society-wide (Platform)' : 'Community-specific'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {selected.size} permissions selected
                </span>
                <span>â€¢</span>
                <span>Click chips or checkboxes below to modify rights in real-time</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Save & Reset */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto">
            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="h-9 rounded-lg text-xs gap-1.5 flex-1 sm:flex-initial border-border"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <Button
              type="button"
              onClick={saveRolePermissions}
              disabled={savingBusy}
              className={`h-9 rounded-lg px-4 text-xs font-bold gap-1.5 flex-1 sm:flex-initial transition-all text-white ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="h-4 w-4 stroke-[3]" />
              {savingBusy ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 3. TOOLBAR: SURFACE SWITCH + PRESETS + FILTERS + SEARCH */}
      {/* --------------------------------------------------------------------- */}
      <Card className="p-3 sm:p-3.5 rounded-2xl border border-border space-y-3">
        {/* Surface Tabs & 1-Click Presets */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Surface Switcher */}
          <div className="grid grid-cols-2 w-full sm:w-auto rounded-xl bg-muted p-1 gap-1 border border-border/50">
            <button
              type="button"
              onClick={() => setPermSurface(SURFACE_ADMIN)}
              className={`flex items-center justify-center gap-2 h-7 rounded-lg px-3 text-xs font-bold transition-all cursor-pointer ${
                permSurface === SURFACE_ADMIN
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('roles.surfaceAdmin')}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  permSurface === SURFACE_ADMIN ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                }`}
              >
                {countsPerSurface.admin}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPermSurface(SURFACE_APP)}
              className={`flex items-center justify-center gap-2 h-7 rounded-lg px-3 text-xs font-bold transition-all cursor-pointer ${
                permSurface === SURFACE_APP
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('roles.surfaceApp')}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  permSurface === SURFACE_APP ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                }`}
              >
                {countsPerSurface.app}
              </span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <span className="text-[11px] font-bold text-muted-foreground shrink-0 mr-0.5">Presets:</span>
            <button
              type="button"
              onClick={applyPresetFull}
              title="Grant full access to all features"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border-2 border-emerald-400 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-emerald-600" />
              Full Admin
            </button>
            <button
              type="button"
              onClick={applyPresetOperator}
              title="Grant View, Create, and Edit to features"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition-colors shadow-xs cursor-pointer"
            >
              <Shield className="h-3 w-3 text-blue-500" />
              Operator
            </button>
            <button
              type="button"
              onClick={applyPresetViewOnly}
              title="Grant View only across all features"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-amber-500 hover:text-amber-600 transition-colors shadow-xs cursor-pointer"
            >
              <Eye className="h-3 w-3 text-amber-500" />
              View Only
            </button>
            <button
              type="button"
              onClick={applyPresetClear}
              title="Clear all selections for this surface"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>

        {/* Categories + Search + View Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
          {/* Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar flex-nowrap sm:flex-wrap">
            {categories.map((cat) => {
              const count = allSurfaceRows.filter((r) => cat === 'All' || r.category === cat).length;
              const isSelected = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-foreground text-background border-foreground shadow-xs'
                      : 'bg-card border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-400 hover:text-foreground'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.1 text-[9px] ${
                      isSelected ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + View Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search modules..."
                className="h-8 pl-8 text-xs"
              />
              {filter ? (
                <button
                  type="button"
                  onClick={() => setFilter('')}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card View (Mobile Touch Optimized)"
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'cards' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table Matrix View"
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 4. PERMISSION MATRIX DIRECT EMBED (NO POPUP) */}
      {/* --------------------------------------------------------------------- */}
      <Card className="rounded-2xl border border-border overflow-hidden shadow-xs">
        {catalog.loading ? (
          <div className="p-10 text-center text-xs text-muted-foreground">Loading modules catalog...</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            No modules match your current filter.
          </div>
        ) : viewMode === 'cards' ? (
          /* MOBILE TOUCH-FRIENDLY CARD VIEW */
          <div className="p-2.5 sm:p-3.5 space-y-2.5">
            {visibleRows.map((row) => {
              const RowIcon = menuIcon(row.icon);
              const rowKeys = row.actions.map((a) => permKey(row.resource, a));
              const rowSelectedCount = rowKeys.filter((k) => selected.has(k)).length;
              const isAllRowSelected = rowKeys.length > 0 && rowSelectedCount === rowKeys.length;
              const isPartiallySelected = rowSelectedCount > 0 && !isAllRowSelected;

              return (
                <div
                  key={row.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isAllRowSelected
                      ? 'border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : isPartiallySelected
                      ? 'border-border bg-muted/30'
                      : 'border-border bg-card'
                  }`}
                >
                  {/* Module Header */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground">
                        <RowIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{row.label}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-muted-foreground">{row.resource}</span>
                          <span className="text-[9px] text-muted-foreground rounded bg-muted px-1.5 py-0.2 border border-border/50">
                            {row.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row Toggle All Button */}
                    <button
                      type="button"
                      onClick={() => toggleRow(row)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold border-2 transition-colors cursor-pointer ${
                        isAllRowSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : isPartiallySelected
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      {isAllRowSelected ? 'All' : isPartiallySelected ? `${rowSelectedCount}/${rowKeys.length}` : 'All'}
                    </button>
                  </div>

                  {/* Core Actions Grid: Large touch chips for mobile (View, Create, Edit, Delete) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2">
                    {CORE_ACTION_META.map((meta) => {
                      const hasAction = row.actions.includes(meta.action);
                      if (!hasAction) return null;
                      const k = permKey(row.resource, meta.action);
                      const isChecked = selected.has(k);

                      return (
                        <button
                          key={meta.action}
                          type="button"
                          onClick={() => togglePerm(k)}
                          className={`flex items-center justify-between h-9 px-2.5 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                          }`}
                        >
                          <span>{meta.label}</span>
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md transition-colors ${
                              isChecked ? 'bg-white/20 text-white' : 'border border-slate-400 dark:border-slate-500'
                            }`}
                          >
                            <Check
                              className={`h-3 w-3 stroke-[3] transition-transform ${
                                isChecked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Extra Actions */}
                  {row.actions.some((a) => a > ACTION_DELETE) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 mt-2">
                      <span className="text-[10px] font-semibold text-muted-foreground mr-1">Extra:</span>
                      {row.actions
                        .filter((a) => a > ACTION_DELETE)
                        .map((a) => {
                          const k = permKey(row.resource, a);
                          const isChecked = selected.has(k);
                          const actionName = EXTRA_ACTION_LABELS[a] ?? `#${a}`;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => togglePerm(k)}
                              className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border-2 transition-colors cursor-pointer flex items-center gap-1 ${
                                isChecked
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-500'
                              }`}
                            >
                              <span>{actionName}</span>
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* MATRIX TABLE VIEW WITH STICKY FIRST COLUMN */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs border-b border-border">
                <tr>
                  <th className="py-2.5 pl-4 pr-2 font-semibold text-muted-foreground min-w-[200px] sticky left-0 z-30 bg-muted border-r border-border/40">
                    Module / Feature
                  </th>
                  {CORE_ACTION_META.map((meta) => {
                    const allVisibleHave = visibleRows.every(
                      (r) => !r.actions.includes(meta.action) || selected.has(permKey(r.resource, meta.action)),
                    );
                    const someVisibleHave = visibleRows.some(
                      (r) => r.actions.includes(meta.action) && selected.has(permKey(r.resource, meta.action)),
                    );
                    return (
                      <th key={meta.action} className="py-2.5 px-2 text-center font-semibold text-muted-foreground w-20">
                        <button
                          type="button"
                          onClick={() => toggleColumnAction(meta.action)}
                          title={`Toggle ${meta.label} on all visible modules`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border-2 transition-colors cursor-pointer ${
                            allVisibleHave && someVisibleHave
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600'
                          }`}
                        >
                          <span>{meta.short}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 font-semibold text-muted-foreground min-w-[140px]">
                    Extra Permissions
                  </th>
                  <th className="py-2.5 pr-4 pl-2 text-right font-semibold text-muted-foreground w-24">
                    Module All
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleRows.map((row) => {
                  const RowIcon = menuIcon(row.icon);
                  const rowKeys = row.actions.map((a) => permKey(row.resource, a));
                  const rowSelectedCount = rowKeys.filter((k) => selected.has(k)).length;
                  const isAllRowSelected = rowKeys.length > 0 && rowSelectedCount === rowKeys.length;
                  const isPartiallySelected = rowSelectedCount > 0 && !isAllRowSelected;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isAllRowSelected
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : isPartiallySelected
                          ? 'bg-muted/40'
                          : 'hover:bg-muted/20'
                      }`}
                    >
                      {/* Module Info (STICKY FIRST COLUMN) */}
                      <td className="py-2.5 pl-4 pr-2 sticky left-0 z-10 bg-card border-r border-border/40">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground">
                            <RowIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-foreground truncate">{row.label}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-muted-foreground">{row.resource}</span>
                              <span className="text-[9px] text-muted-foreground/80 rounded bg-muted px-1 border border-border/50">
                                {row.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Core Actions: View, Create, Edit, Delete */}
                      {CORE_ACTION_META.map((meta) => {
                        const hasAction = row.actions.includes(meta.action);
                        const k = permKey(row.resource, meta.action);
                        const isChecked = selected.has(k);

                        if (!hasAction) {
                          return (
                            <td key={meta.action} className="py-2.5 px-2 text-center text-muted-foreground/30 text-xs font-bold">
                              â€”
                            </td>
                          );
                        }

                        return (
                          <td key={meta.action} className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => togglePerm(k)}
                              aria-label={`${meta.label} for ${row.label}`}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border-2 transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                                  : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 text-transparent hover:border-emerald-600 hover:bg-emerald-50/40 shadow-xs'
                              }`}
                            >
                              <Check className={`h-3.5 w-3.5 stroke-[3] transition-transform ${isChecked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
                            </button>
                          </td>
                        );
                      })}

                      {/* Extra Actions */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {row.actions
                            .filter((a) => a > ACTION_DELETE)
                            .map((a) => {
                              const k = permKey(row.resource, a);
                              const isChecked = selected.has(k);
                              const actionName = EXTRA_ACTION_LABELS[a] ?? `#${a}`;
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => togglePerm(k)}
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border-2 transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 shadow-xs'
                                  }`}
                                >
                                  {actionName}
                                </button>
                              );
                            })}
                          {!row.actions.some((a) => a > ACTION_DELETE) && (
                            <span className="text-[11px] text-muted-foreground/30 font-bold">â€”</span>
                          )}
                        </div>
                      </td>

                      {/* Row Quick Toggle */}
                      <td className="py-2.5 pr-4 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleRow(row)}
                          className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold border-2 transition-colors cursor-pointer ${
                            isAllRowSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : isPartiallySelected
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 shadow-xs'
                          }`}
                        >
                          {isAllRowSelected ? 'All' : isPartiallySelected ? `${rowSelectedCount}/${rowKeys.length}` : 'None'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Floating Save Bar on Mobile */}
      {isSmall && (
        <div className="sticky bottom-3 z-30 flex items-center justify-between gap-2 p-3 rounded-2xl bg-card border-2 border-emerald-500/60 shadow-xl">
          <div className="min-w-0">
            <div className="font-bold text-xs text-foreground truncate">{currentRole.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {selected.size} perms {hasUnsavedChanges && 'â€¢ Unsaved'}
            </div>
          </div>
          <Button
            type="button"
            onClick={saveRolePermissions}
            disabled={savingBusy}
            className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs"
          >
            <Check className="h-3.5 w-3.5 stroke-[3]" />
            {savingBusy ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------
// CLEAN, FOCUSED ROLE DIALOG (ONLY NAME & SCOPE CONFIG - NO MATRIX)
// -------------------------------------------------------------------------------------
function RoleBasicDialog({
  open,
  role,
  cloneSource,
  onClose,
  onSaved,
}: {
  open: boolean;
  role?: Role | null;
  cloneSource?: Role | null;
  onClose: () => void;
  onSaved: (savedRole: Role) => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!role;
  const isClone = !!cloneSource && !role;

  const [name, setName] = useState('');
  const [scope, setScope] = useState<number>(SCOPE_PLATFORM);
  const [communityId, setCommunityId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setName(role.name);
      setScope(role.scope);
      setCommunityId(role.communityId ?? '');
    } else if (cloneSource) {
      setName(`${cloneSource.name} (Copy)`);
      setScope(cloneSource.scope);
      setCommunityId(cloneSource.communityId ?? '');
    } else {
      setName('');
      setScope(SCOPE_PLATFORM);
      setCommunityId('');
    }
  }, [open, role, cloneSource]);

  const canSubmit = !!name.trim() && (scope === SCOPE_PLATFORM || !!communityId);

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const permissions = isClone && cloneSource ? cloneSource.permissions : role ? role.permissions : [];
      const body = {
        name: name.trim(),
        scope,
        communityId: scope === SCOPE_COMMUNITY ? communityId || null : null,
        permissions,
      };

      let result: Role;
      if (isEdit) {
        result = await roles.update(role!.id, body);
        toast.success(t('roles.updated'));
      } else {
        result = await roles.create(body);
        toast.success(isClone ? 'Role duplicated successfully' : t('roles.created'));
      }
      onSaved(result);
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="w-[96vw] max-w-lg p-0 overflow-hidden shadow-2xl">
      <div className="border-b border-border bg-card px-4 py-3 sm:px-5 sm:py-3.5 pr-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold leading-tight text-foreground truncate">
              {isEdit ? t('roles.editTitle') : isClone ? 'Duplicate Role' : t('roles.addTitle')}
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              {isEdit ? 'Update role name and community scope' : 'Create a new security role'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">{t('roles.nameLabel')}</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Society Manager, Accountant, Guard"
            maxLength={200}
            className="h-9 text-xs"
          />
        </div>

        <div>
          <SelectField
            label={t('roles.scopeLabel')}
            value={String(scope)}
            options={[
              { value: String(SCOPE_PLATFORM), label: 'Society-wide (All Communities)' },
              { value: String(SCOPE_COMMUNITY), label: 'Specific Community Only' },
            ]}
            onChange={(v) => {
              const n = Number(v);
              setScope(n);
              if (n === SCOPE_PLATFORM) setCommunityId('');
            }}
          />
        </div>

        {scope === SCOPE_COMMUNITY && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">{t('roles.community')}</label>
            <EntitySelect
              value={communityId || null}
              onChange={(v) => setCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch()}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('roles.selectCommunity')}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
          {t('orgs.cancel')}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? 'Saving...' : isEdit ? t('roles.saveChanges') : isClone ? 'Duplicate Role' : t('roles.create')}
        </Button>
      </div>
    </Dialog>
  );
}
