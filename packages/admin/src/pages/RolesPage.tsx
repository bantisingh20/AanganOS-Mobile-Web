import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
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
import { roles, menuItems, communities } from '@shared/services';
import type { Role } from '@shared/api/roles';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { toFormError } from '@shared/api/errors';

const SCOPE_PLATFORM = 0;
const SCOPE_COMMUNITY = 1;
const SURFACE_APP = 0;
const SURFACE_ADMIN = 1;

function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}

const permKey = (resourceType: string, action: number) => `${resourceType}:${action}`;

interface MenuPermRow {
  id: string;
  label: string;
  depth: number;
  resource: string | null;
  actions: number[];
}

export function RolesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isSmall = useIsSmallScreen();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useAsync(
    (signal) => roles.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const actionLabels = useMemo<Record<number, string>>(() => ({
    0: t('roles.actionView'),
    1: t('roles.actionCreate'),
    2: t('roles.actionEdit'),
    3: t('roles.actionDelete'),
    4: t('roles.actionApprove'),
    5: t('roles.actionExport'),
    6: t('roles.actionAssign'),
    7: t('roles.actionAccess'),
  }), [t]);

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

  const ScopeBadge = ({ r }: { r: Role }) => (
    <Badge tone={r.scope === SCOPE_PLATFORM ? 'info' : 'default'}>
      {r.scope === SCOPE_PLATFORM ? t('roles.scopePlatform') : t('roles.scopeCommunity')}
    </Badge>
  );

  const summaryText = (r: Role) => {
    const resources = new Set(r.permissions.map((p) => p.resourceType)).size;
    return t('roles.summary', { grants: r.permissions.length, resources });
  };

  const RowActions = ({ r }: { r: Role }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => setEditing(r)} aria-label={t('roles.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setConfirmDelete(r)} aria-label={t('roles.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('roles.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('roles.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('roles.add')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('roles.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
        </div>
        <button type="button" onClick={reload} aria-label={t('roles.refresh')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
          <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
        </button>
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
                  <div className="truncate text-[11px] text-muted-foreground">{t('roles.permissionCount', { count: r.permissions.length })}</div>
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
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r, i) => (
                <TR key={r.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{r.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{t('roles.permissionCount', { count: r.permissions.length })}</div>
                    </div>
                  </TD>
                  <TD><ScopeBadge r={r} /></TD>
                  <TD className="text-[11px] text-muted-foreground">{summaryText(r)}</TD>
                  <TD><RowActions r={r} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      ) : null}

      <RoleFormDialog open={creating} actionLabels={actionLabels} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <RoleFormDialog open={!!editing} role={editing} actionLabels={actionLabels} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

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

function RoleFormDialog({ open, role, actionLabels, onClose, onSaved }: { open: boolean; role?: Role | null; actionLabels: Record<number, string>; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!role;
  const [name, setName] = useState('');
  const [scope, setScope] = useState<number>(SCOPE_PLATFORM);
  const [communityId, setCommunityId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [permSurface, setPermSurface] = useState<number>(SURFACE_ADMIN);
  const [busy, setBusy] = useState(false);

  const catalog = useAsync((signal) => (open ? menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]) : Promise.resolve([] as MenuItem[])), [open]);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setScope(role?.scope ?? SCOPE_PLATFORM);
    setCommunityId(role?.communityId ?? '');
    setSelected(new Set((role?.permissions ?? []).map((p) => permKey(p.resourceType, p.action))));
    setFilter('');
  }, [open, role]);

  const treeRows = useMemo<MenuPermRow[]>(() => {
    const all = (catalog.data ?? []).filter((m) => m.surface === permSurface);
    const byParent = new Map<string | null, MenuItem[]>();
    for (const m of all) {
      const p = m.parentId ?? null;
      const list = byParent.get(p) ?? [];
      list.push(m);
      byParent.set(p, list);
    }
    const sortFn = (a: MenuItem, b: MenuItem) => a.sortOrder - b.sortOrder;
    const rows: MenuPermRow[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const m of (byParent.get(parentId) ?? []).slice().sort(sortFn)) {
        const resource = m.requiredPermissionResource;
        const actions = (m.requiredPermissionActions ?? []).slice().sort((a, b) => a - b);
        rows.push({
          id: m.id,
          label: m.label,
          depth,
          resource: resource && actions.length > 0 ? resource : null,
          actions: resource && actions.length > 0 ? actions : [],
        });
        walk(m.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [catalog.data, permSurface]);

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return treeRows;
    return treeRows.filter((r) => r.label.toLowerCase().includes(q) || (r.resource ?? '').toLowerCase().includes(q));
  }, [treeRows, filter]);

  const allCatalogKeys = useMemo(
    () => treeRows.flatMap((r) => (r.resource ? r.actions.map((a) => permKey(r.resource!, a)) : [])),
    [treeRows],
  );
  const allSelected = allCatalogKeys.length > 0 && allCatalogKeys.every((k) => selected.has(k));

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (keys: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) keys.forEach((k) => next.add(k));
      else keys.forEach((k) => next.delete(k));
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(() => (allSelected ? new Set<string>() : new Set(allCatalogKeys)));
  };

  const canSubmit = !!name.trim() && selected.size > 0 && (scope === SCOPE_PLATFORM || !!communityId);

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const perms = Array.from(selected).map((k) => {
        const idx = k.lastIndexOf(':');
        return { resourceType: k.slice(0, idx), action: Number(k.slice(idx + 1)) };
      });
      const body = {
        name: name.trim(),
        scope,
        communityId: scope === SCOPE_COMMUNITY ? communityId || null : null,
        permissions: perms,
      };
      if (isEdit) await roles.update(role!.id, body);
      else await roles.create(body);
      toast.success(isEdit ? t('roles.updated') : t('roles.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader title={isEdit ? t('roles.editTitle') : t('roles.addTitle')} />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('roles.nameLabel')}</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('roles.namePlaceholder')} maxLength={200} />
          </div>
          <SelectField
            label={t('roles.scopeLabel')}
            value={String(scope)}
            options={[{ value: String(SCOPE_PLATFORM), label: t('roles.scopePlatform') }, { value: String(SCOPE_COMMUNITY), label: t('roles.scopeCommunity') }]}
            onChange={(v) => { const n = Number(v); setScope(n); if (n === SCOPE_PLATFORM) setCommunityId(''); }}
          />
          {scope === SCOPE_COMMUNITY ? (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('roles.community')}</label>
              <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={makeCommunityFetch()} resolveLabel={resolveCommunityLabel} placeholder={t('roles.selectCommunity')} />
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t('roles.permissions')}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">{t('roles.selectedCount', { count: selected.size })}</span>
              <button type="button" onClick={toggleAll} className="text-[11px] font-medium text-emerald-600 hover:underline">
                {allSelected ? t('roles.clearAll') : t('roles.selectAll')}
              </button>
            </div>
          </div>
          <div className="mb-2 flex items-center rounded-lg bg-muted p-0.5">
            <button type="button" onClick={() => setPermSurface(SURFACE_ADMIN)} className={`h-7 flex-1 rounded-md px-3 text-xs ${permSurface === SURFACE_ADMIN ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>{t('roles.surfaceAdmin')}</button>
            <button type="button" onClick={() => setPermSurface(SURFACE_APP)} className={`h-7 flex-1 rounded-md px-3 text-xs ${permSurface === SURFACE_APP ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}>{t('roles.surfaceApp')}</button>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('roles.filterPlaceholder')} className="h-9 pl-9 text-sm" />
          </div>
          {catalog.loading ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">{t('roles.noResources')}</div>
          ) : (
            <div className="max-h-[22rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {visibleRows.map((r) => {
                const keys = r.resource ? r.actions.map((a) => permKey(r.resource!, a)) : [];
                const rowAll = keys.length > 0 && keys.every((k) => selected.has(k));
                return (
                  <div key={r.id} className="px-3 py-2.5" style={{ paddingLeft: 12 + r.depth * 18 }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex items-center gap-2">
                        <span className={`truncate ${r.resource ? 'text-[13px] font-semibold' : 'text-[12px] font-bold uppercase tracking-wide text-muted-foreground'}`}>{r.label}</span>
                        {r.resource ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.resource}</span> : null}
                      </span>
                      {keys.length > 0 ? (
                        <button type="button" onClick={() => toggleGroup(keys, !rowAll)} className="shrink-0 text-[11px] font-medium text-emerald-600 hover:underline">
                          {rowAll ? t('roles.clear') : t('roles.all')}
                        </button>
                      ) : null}
                    </div>
                    {keys.length > 0 ? (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                        {r.actions.map((a) => {
                          const key = permKey(r.resource!, a);
                          const checked = selected.has(key);
                          return (
                            <label key={key} className="flex cursor-pointer items-center gap-2 text-[12px]">
                              <input type="checkbox" checked={checked} onChange={() => toggle(key)} className="h-4 w-4 rounded border-input accent-emerald-600" />
                              <span className={checked ? 'font-medium' : 'text-muted-foreground'}>{actionLabels[a] ?? `#${a}`}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('roles.saveChanges') : t('roles.create')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
