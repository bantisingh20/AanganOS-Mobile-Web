import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Search, RefreshCw, Table as TableIcon, LayoutGrid } from 'lucide-react';
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
import { PhoneField } from '@shared/components/PhoneField';
import { adminUsers, organizations, communities } from '@shared/services';
import type { AdminUser } from '@shared/api/adminUsers';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { cn } from '@shared/lib/utils';
import { toFormError } from '@shared/api/errors';

const ROLE_POWER = 'PowerUser';
const ROLE_ORG = 'OrganizationAdmin';
const ROLE_COMMUNITY = 'CommunityAdmin';

function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  return organizations.list({ search: search || undefined, page, pageSize }, { signal })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));
}
function makeCommunityFetch(organizationId?: string) {
  return (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
    communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal })
      .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));
}
async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const o = await organizations.get(id, { signal }); return o.name; } catch { return null; }
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const creatableRoles = useMemo(() => {
    if (scope.isPowerUser) return [ROLE_POWER, ROLE_ORG, ROLE_COMMUNITY];
    if (scope.isOrgAdmin) return [ROLE_COMMUNITY];
    return [] as string[];
  }, [scope.isPowerUser, scope.isOrgAdmin]);

  const roleLabel = (name: string) =>
    name === ROLE_POWER ? t('adminUsers.rolePower')
      : name === ROLE_ORG ? t('adminUsers.roleOrg')
      : name === ROLE_COMMUNITY ? t('adminUsers.roleCommunity')
      : name;
  const roleTone = (name: string): 'info' | 'warning' | 'default' =>
    name === ROLE_POWER ? 'warning' : name === ROLE_ORG ? 'info' : 'default';

  const query = useAsync(
    (signal) => adminUsers.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    return statusFilter === 'all' ? all : all.filter((u) => u.status === statusFilter);
  }, [query.data, statusFilter]);
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await adminUsers.remove(confirmDelete.id);
      toast.success(t('adminUsers.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const scopeSummary = (u: AdminUser) => {
    const scoped = u.assignments.filter((a) => a.communityId);
    const platform = u.assignments.some((a) => !a.communityId);
    if (platform) return t('adminUsers.scopePlatform');
    if (scoped.length > 0) return t('adminUsers.scopeCommunities', { count: scoped.length });
    return '—';
  };

  const RowActions = ({ u }: { u: AdminUser }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => setEditing(u)} aria-label={t('adminUsers.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setConfirmDelete(u)} aria-label={t('adminUsers.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const StatusBadge = ({ s }: { s: string }) => (
    <Badge tone={s === 'Active' ? 'success' : 'muted'}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s === 'Active' ? t('adminUsers.statusActive') : t('adminUsers.statusSuspended')}
    </Badge>
  );

  const Roles = ({ u }: { u: AdminUser }) => (
    <span className="flex flex-wrap gap-1">
      {u.roles.length === 0 ? <span className="text-muted-foreground">—</span> : u.roles.map((r) => <Badge key={r} tone={roleTone(r)}>{roleLabel(r)}</Badge>)}
    </span>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-blue-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('adminUsers.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('adminUsers.subtitle')}</p>
            </div>
          </div>
          {creatableRoles.length > 0 ? (
            <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
              <Plus className="h-4 w-4" />{t('adminUsers.add')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('adminUsers.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          <SelectField
            value={statusFilter}
            options={[
              { value: 'all', label: t('adminUsers.allStatuses') },
              { value: 'Active', label: t('adminUsers.statusActive') },
              { value: 'Suspended', label: t('adminUsers.statusSuspended') },
            ]}
            onChange={(v) => { setStatusFilter(v as 'all' | 'Active' | 'Suspended'); setPage(1); }}
          />
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
          {query.loading ? t('common.loading') : t('adminUsers.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('adminUsers.colName')}</TH>
                <TH className="w-56">{t('adminUsers.colIdentifier')}</TH>
                <TH className="w-48">{t('adminUsers.colRoles')}</TH>
                <TH className="w-40">{t('adminUsers.colScope')}</TH>
                <TH className="w-28">{t('adminUsers.colStatus')}</TH>
                <TH className="w-28 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((u, i) => (
                <TR key={u.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD><span className="text-[13px] font-semibold">{u.name || '—'}</span></TD>
                  <TD className="text-[11px] text-muted-foreground">{u.email || u.phone || '—'}</TD>
                  <TD><Roles u={u} /></TD>
                  <TD className="text-[11px] text-muted-foreground">{scopeSummary(u)}</TD>
                  <TD><StatusBadge s={u.status} /></TD>
                  <TD><RowActions u={u} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((u) => (
            <Card key={u.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{u.name || '—'}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{u.email || u.phone || '—'}</div>
                  </div>
                </div>
                <StatusBadge s={u.status} />
              </div>
              <div className="border-t border-border pt-2"><Roles u={u} /></div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">{scopeSummary(u)}</span>
                <RowActions u={u} />
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

      <AdminUserFormDialog open={creating} creatableRoles={creatableRoles} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <AdminUserFormDialog open={!!editing} admin={editing} creatableRoles={creatableRoles} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('adminUsers.delete')}
        description={confirmDelete ? t('adminUsers.deleteConfirm', { name: confirmDelete.name || confirmDelete.email || confirmDelete.phone || '' }) : ''}
        confirmLabel={t('adminUsers.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function AdminUserFormDialog({ open, admin, creatableRoles, onClose, onSaved }: { open: boolean; admin?: AdminUser | null; creatableRoles: string[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!admin;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('');
  const [active, setActive] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roleLabel = (n: string) =>
    n === ROLE_POWER ? t('adminUsers.rolePower')
      : n === ROLE_ORG ? t('adminUsers.roleOrg')
      : n === ROLE_COMMUNITY ? t('adminUsers.roleCommunity')
      : n;

  const roleChoices = useMemo(() => {
    const base = [...creatableRoles];
    if (admin) for (const r of admin.roles) if (!base.includes(r)) base.push(r);
    return base;
  }, [creatableRoles, admin]);

  const needsOrg = roleName === ROLE_ORG || roleName === ROLE_COMMUNITY;
  const needsCommunity = roleName === ROLE_COMMUNITY;

  useEffect(() => {
    if (!open) return;
    setName(admin?.name ?? '');
    setPhone('');
    setEmail('');
    setPassword('');
    setRoleName(admin?.roles[0] ?? creatableRoles[0] ?? '');
    setActive(admin?.status !== 'Suspended');
    const scopedCommunity = admin?.assignments.find((a) => a.communityId)?.communityId ?? null;
    setCommunityId(scopedCommunity);
    setOrganizationId(null);
  }, [open, admin, creatableRoles]);

  const submit = async () => {
    if (busy || !roleName) return;
    const loginIdentifier = phone.trim() || email.trim();
    if (!isEdit && (!loginIdentifier || password.length < 8)) { toast.error(t('adminUsers.needCredentials')); return; }
    if (isEdit && password && password.length < 8) { toast.error(t('adminUsers.needCredentials')); return; }
    if (needsOrg && !organizationId && !(isEdit && needsCommunity && communityId)) { toast.error(t('adminUsers.needOrg')); return; }
    if (needsCommunity && !communityId) { toast.error(t('adminUsers.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await adminUsers.update(admin!.id, {
          name: name.trim() || null,
          password: password ? password : null,
          roleName,
          status: active ? 'Active' : 'Suspended',
          organizationId: needsOrg ? organizationId : null,
          communityId: needsCommunity ? communityId : null,
        });
      } else {
        await adminUsers.create({
          name: name.trim() || null,
          identifier: loginIdentifier,
          password,
          roleName,
          organizationId: needsOrg ? organizationId : null,
          communityId: needsCommunity ? communityId : null,
        });
      }
      toast.success(isEdit ? t('adminUsers.updated') : t('adminUsers.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const roleOptions = roleChoices.map((r) => ({ value: r, label: roleLabel(r) }));

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={isEdit ? t('adminUsers.editTitle') : t('adminUsers.addTitle')} />
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.name')}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('adminUsers.namePlaceholder')} maxLength={200} />
        </div>

        <SelectField
          label={t('adminUsers.role')}
          value={roleName || null}
          options={roleOptions}
          placeholder={t('adminUsers.selectRole')}
          onChange={(v) => { setRoleName(v); setOrganizationId(null); setCommunityId(null); }}
        />

        {isEdit ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.activeLabel')}</label>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button type="button" onClick={() => setActive(true)} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', active ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground')}>{t('adminUsers.statusActive')}</button>
              <button type="button" onClick={() => setActive(false)} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', !active ? 'bg-card text-rose-600 shadow-sm' : 'text-muted-foreground')}>{t('adminUsers.statusSuspended')}</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.phone')}</label>
              <PhoneField value={phone} onChange={setPhone} placeholder={t('adminUsers.phonePlaceholder')} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.email')}</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('adminUsers.emailPlaceholder')} maxLength={256} />
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{isEdit ? t('adminUsers.newPassword') : t('adminUsers.password')}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? t('adminUsers.newPasswordPlaceholder') : t('adminUsers.passwordPlaceholder')} maxLength={256} />
        </div>

        {needsOrg ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.organization')}</label>
            <EntitySelect value={organizationId} onChange={(v) => { setOrganizationId(v); setCommunityId(null); }} fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('adminUsers.selectOrg')} />
          </div>
        ) : null}

        {needsCommunity ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('adminUsers.community')}</label>
            <EntitySelect value={communityId} onChange={setCommunityId} fetchPage={makeCommunityFetch(organizationId ?? undefined)} resolveLabel={resolveCommunityLabel} placeholder={t('adminUsers.selectCommunity')} />
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !roleName} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('adminUsers.saveChanges') : t('adminUsers.createUser')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
