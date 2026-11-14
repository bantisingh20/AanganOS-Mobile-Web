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

  const query = useAsync(
    (signal) => roles.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await roles.remove(confirmDelete.id);
      toast.success(t('roles.deleted'));
      setConfirmDelete(null);
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
        onClick={() => handleDuplicate(r)}
        title="Duplicate role permissions"
        aria-label="Duplicate role permissions"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(r)}
        aria-label={t('roles.edit')}
        title={t('roles.edit')}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
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
      {/* Header Banner */}
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('roles.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('roles.subtitle')}</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setCloningRole(null);
              setCreating(true);
            }}
            className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {t('roles.add')}
          </Button>
        </div>
      </Card>

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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-emerald-600"
          >
            <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('roles.empty')}
        </Card>
      ) : isSmall ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
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
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('roles.colRole')}</TH>
                <TH className="w-32">{t('roles.colScope')}</TH>
                <TH>{t('roles.colSummary')}</TH>
                <TH className="w-32 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r, i) => (
                <TR key={r.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">
                    {(page - 1) * pageSize + i + 1}
                  </TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{r.name}</div>
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

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={query.data?.totalCount ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </Card>
      ) : null}

      {/* Role Form Dialog for Add / Duplicate */}
      <RoleFormDialog
        open={creating}
        cloneSource={cloningRole}
        onClose={() => {
          setCreating(false);
          setCloningRole(null);
        }}
        onSaved={() => {
          setCreating(false);
          setCloningRole(null);
          reload();
        }}
      />

      {/* Role Form Dialog for Edit */}
      <RoleFormDialog
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
// REDESIGNED PERMISSION MATRIX DIALOG
// -------------------------------------------------------------------------------------
function RoleFormDialog({
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
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!role;
  const isClone = !!cloneSource && !role;

  const [name, setName] = useState('');
  const [scope, setScope] = useState<number>(SCOPE_PLATFORM);
  const [communityId, setCommunityId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentGrants, setCurrentGrants] = useState<PermissionGrant[]>([]);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [permSurface, setPermSurface] = useState<number>(SURFACE_ADMIN);
  const [busy, setBusy] = useState(false);

  const catalog = useAsync(
    (signal) => (open ? menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]) : Promise.resolve([] as MenuItem[])),
    [open],
  );

  // Maintain canonical resource name mapping for submission
  const canonicalMap = useMemo(() => {
    const map = new Map<string, string>();
    (catalog.data ?? []).forEach((m) => {
      if (m.requiredPermissionResource) {
        map.set(m.requiredPermissionResource.trim().toLowerCase(), m.requiredPermissionResource.trim());
      }
    });
    return map;
  }, [catalog.data]);

  // Fetch and populate role data cleanly with case-insensitive keys
  useEffect(() => {
    if (!open) return;
    let active = true;

    if (role) {
      setName(role.name);
      setScope(role.scope);
      setCommunityId(role.communityId ?? '');

      const initialGrants = role.permissions ?? [];
      setCurrentGrants(initialGrants);
      initialGrants.forEach((p) => {
        canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim());
      });

      const initialKeys = new Set(initialGrants.map((p) => permKey(p.resourceType, p.action)));
      setSelected(initialKeys);

      // Also fetch directly from backend API for 100% fresh, complete grants
      roles
        .get(role.id)
        .then((freshRole) => {
          if (!active || !freshRole) return;
          setName(freshRole.name);
          setScope(freshRole.scope);
          setCommunityId(freshRole.communityId ?? '');
          const freshGrants = freshRole.permissions ?? [];
          if (freshGrants.length > 0) {
            setCurrentGrants(freshGrants);
            setSelected(new Set(freshGrants.map((p) => permKey(p.resourceType, p.action))));
            freshGrants.forEach((p) => {
              canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim());
            });
          }
        })
        .catch(() => {
          // Keep prop permissions
        });
    } else if (cloneSource) {
      setName(`${cloneSource.name} (Copy)`);
      setScope(cloneSource.scope);
      setCommunityId(cloneSource.communityId ?? '');
      const cloneGrants = cloneSource.permissions ?? [];
      setCurrentGrants(cloneGrants);
      setSelected(new Set(cloneGrants.map((p) => permKey(p.resourceType, p.action))));
      cloneGrants.forEach((p) => {
        canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim());
      });
    } else {
      setName('');
      setScope(SCOPE_PLATFORM);
      setCommunityId('');
      setCurrentGrants([]);
      setSelected(new Set());
    }
    setFilter('');
    setActiveCategory('All');

    return () => {
      active = false;
    };
  }, [open, role?.id, cloneSource?.id, canonicalMap]);

  // Build clean rows for current surface with complete CRUD actions
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
        const resource = m.requiredPermissionResource?.trim();
        if (resource) {
          const lowerRes = resource.toLowerCase();
          canonicalMap.set(lowerRes, resource);

          // For admin surface, standard CRUD is available on all features
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

    // Also include any resource that the role has permissions on if not already in the menu list
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

  // Available categories with counts
  const categories = useMemo(() => {
    const set = new Set<string>();
    allSurfaceRows.forEach((r) => set.add(r.category));
    return ['All', ...Array.from(set).sort()];
  }, [allSurfaceRows]);

  // Filtered rows by search and category
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

  // Counts of selected permissions per surface
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

  // Toggle specific action across all currently visible rows (e.g. View on all rows)
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

  // Preset 1: Full Access (all permissions on all modules)
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

  // Preset 2: View Only (Read-Only)
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

  // Preset 3: Operator (View, Create, Edit)
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

  // Preset 4: Clear All for Current Surface
  const applyPresetClear = () => {
    const surfaceKeys = new Set(allSurfaceRows.flatMap((r) => r.actions.map((a) => permKey(r.resource, a))));
    setSelected((prev) => {
      const next = new Set(prev);
      surfaceKeys.forEach((k) => next.delete(k));
      return next;
    });
    toast.info('Cleared permissions for current surface');
  };

  const canSubmit = !!name.trim() && selected.size > 0 && (scope === SCOPE_PLATFORM || !!communityId);

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const perms = Array.from(selected).map((k) => {
        const idx = k.lastIndexOf(':');
        const lowerRes = k.slice(0, idx);
        const action = Number(k.slice(idx + 1));
        const canonical = canonicalMap.get(lowerRes) ?? lowerRes;
        return { resourceType: canonical, action };
      });
      const body = {
        name: name.trim(),
        scope,
        communityId: scope === SCOPE_COMMUNITY ? communityId || null : null,
        permissions: perms,
      };
      if (isEdit) {
        await roles.update(role!.id, body);
        toast.success(t('roles.updated'));
      } else {
        await roles.create(body);
        toast.success(isClone ? 'Role duplicated successfully' : t('roles.created'));
      }
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl">
      {/* Modal Top Header */}
      <div className="border-b border-border bg-card px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight text-foreground">
              {isEdit ? t('roles.editTitle') : isClone ? 'Duplicate Role' : t('roles.addTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure role scope and customize access permissions with visual matrix
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Role Name & Scope Config Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
          <div className="sm:col-span-1">
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

          <div className="sm:col-span-1">
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

          {scope === SCOPE_COMMUNITY ? (
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-foreground">{t('roles.community')}</label>
              <EntitySelect
                value={communityId || null}
                onChange={(v) => setCommunityId(v ?? '')}
                fetchPage={makeCommunityFetch()}
                resolveLabel={resolveCommunityLabel}
                placeholder={t('roles.selectCommunity')}
              />
            </div>
          ) : (
            <div className="hidden sm:flex flex-col justify-center text-xs text-muted-foreground px-1">
              <span className="font-medium text-foreground">Platform Scope</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                Applies society-wide to all present and future communities.
              </span>
            </div>
          )}
        </div>

        {/* Toolbar: Surface switch + Quick Presets + Search */}
        <div className="space-y-3">
          {/* Surface & Presets Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Surface Tabs */}
            <div className="flex items-center rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setPermSurface(SURFACE_ADMIN)}
                className={`flex items-center gap-2 h-7 rounded-lg px-3 text-xs font-medium transition-all ${
                  permSurface === SURFACE_ADMIN
                    ? 'bg-emerald-600 text-white shadow-sm'
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
                className={`flex items-center gap-2 h-7 rounded-lg px-3 text-xs font-medium transition-all ${
                  permSurface === SURFACE_APP
                    ? 'bg-emerald-600 text-white shadow-sm'
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

            {/* Quick 1-Click Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Presets:</span>
              <button
                type="button"
                onClick={applyPresetFull}
                title="Grant full access to all features"
                className="inline-flex items-center gap-1 rounded-lg border-2 border-emerald-400 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors shadow-xs"
              >
                <Sparkles className="h-3 w-3 text-emerald-600" />
                Full Admin
              </button>
              <button
                type="button"
                onClick={applyPresetOperator}
                title="Grant View, Create, and Edit to features"
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition-colors shadow-xs"
              >
                <Shield className="h-3 w-3 text-blue-500" />
                Operator
              </button>
              <button
                type="button"
                onClick={applyPresetViewOnly}
                title="Grant View only across all features"
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-amber-500 hover:text-amber-600 transition-colors shadow-xs"
              >
                <Eye className="h-3 w-3 text-amber-500" />
                View Only
              </button>
              <button
                type="button"
                onClick={applyPresetClear}
                title="Clear all selections for this surface"
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors shadow-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>

          {/* Search + Category Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => {
                const count = allSurfaceRows.filter((r) => cat === 'All' || r.category === cat).length;
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border-2 ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-400 hover:text-foreground'
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

            {/* Quick Search */}
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search modules or resource..."
                className="h-8 pl-8 text-xs"
              />
              {filter ? (
                <button
                  type="button"
                  onClick={() => setFilter('')}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Permission Matrix Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          {catalog.loading ? (
            <div className="p-10 text-center text-xs text-muted-foreground">Loading modules catalog...</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              No modules match your current filter.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[46vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border">
                  <tr>
                    <th className="py-2.5 pl-4 pr-2 font-semibold text-muted-foreground min-w-[190px]">
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
                        {/* Module Info */}
                        <td className="py-2.5 pl-4 pr-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground">
                              <RowIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate">{row.label}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground">{row.resource}</span>
                                <span className="text-[9px] text-muted-foreground/80 rounded bg-muted px-1 border border-border/50">
                                  {row.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Core Actions: View, Create, Edit, Delete with HIGH VISIBILITY BORDERS */}
                        {CORE_ACTION_META.map((meta) => {
                          const hasAction = row.actions.includes(meta.action);
                          const k = permKey(row.resource, meta.action);
                          const isChecked = selected.has(k);

                          if (!hasAction) {
                            return (
                              <td key={meta.action} className="py-2.5 px-2 text-center text-muted-foreground/30 text-xs font-bold">
                                —
                              </td>
                            );
                          }

                          return (
                            <td key={meta.action} className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => togglePerm(k)}
                                aria-label={`${meta.label} for ${row.label}`}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all cursor-pointer ${
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

                        {/* Extra Actions (Approve, Export, Access, Assign) with VISIBLE BORDERS */}
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
                              <span className="text-[11px] text-muted-foreground/30 font-bold">—</span>
                            )}
                          </div>
                        </td>

                        {/* Row Quick Toggle (All / None) with VISIBLE BORDERS */}
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
        </div>
      </div>

      {/* Fixed Modal Bottom Footer */}
      <div className="border-t border-border bg-card px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Counter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-foreground">{selected.size} permissions selected</span>
          <span className="text-muted-foreground">across all configured resources</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">
            {t('orgs.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isEdit ? t('roles.saveChanges') : isClone ? 'Save Duplicated Role' : t('roles.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
