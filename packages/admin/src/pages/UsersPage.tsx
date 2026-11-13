import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Search, RefreshCw, Table as TableIcon, LayoutGrid, Ban, CircleCheck, Mail, Phone } from 'lucide-react';
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
import { residents, users, organizations, communities, units, adminUsers } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';

const ROLE_RESIDENT = 'owner';
const ROLE_SECURITY = 'security';
const ROLE_COMMUNITY_ADMIN = 'CommunityAdmin';
const ROLE_ORG_ADMIN = 'OrganizationAdmin';

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

export function UsersPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | typeof ROLE_RESIDENT | typeof ROLE_SECURITY>('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resident | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const effectiveOrgId = !effectiveCommunityId && scope.showOrgFilter ? filterOrgId ?? undefined : undefined;

  const query = useAsync(
    (signal) => residents.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(roleFilter !== 'all' ? { residentType: roleFilter } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, roleFilter, effectiveCommunityId, effectiveOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const adminRolesQuery = useAsync(
    (signal) => adminUsers.list({ pageSize: 200 }, { signal }).then((d) => d.items).catch(() => []),
    [reloadKey],
  );
  const adminRoleByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of adminRolesQuery.data ?? []) {
      const adminRole = u.roles.find((r) => r === ROLE_COMMUNITY_ADMIN || r === ROLE_ORG_ADMIN);
      if (adminRole) map[u.id] = adminRole;
    }
    return map;
  }, [adminRolesQuery.data]);

  const reportStatus = useCallback((userId: string, status: UserStatus) => {
    setStatusMap((prev) => (prev[userId] === status ? prev : { ...prev, [userId]: status }));
  }, []);

  const roleLabel = (rt: string) => (rt === ROLE_SECURITY ? t('users.roleSecurity') : t('users.roleResident'));

  const toggleLogin = async (r: Resident) => {
    if (!r.userId || togglingId) return;
    const next: UserStatus = statusMap[r.userId] === 'Suspended' ? 'Active' : 'Suspended';
    setTogglingId(r.userId);
    try {
      await users.update(r.userId, { status: next });
      reportStatus(r.userId, next);
      toast.success(next === 'Suspended' ? t('users.loginSuspended') : t('users.loginReactivated'));
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
      if (confirmDelete.userId) await users.remove(confirmDelete.userId).catch(() => undefined);
      await residents.remove(confirmDelete.id);
      toast.success(t('users.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const adminRoleLabel = (role: string) => (role === ROLE_ORG_ADMIN ? t('adminUsers.roleOrg') : t('adminUsers.roleCommunity'));

  const RoleBadge = ({ r }: { r: Resident }) => {
    const adminRole = r.userId ? adminRoleByUserId[r.userId] : undefined;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={r.residentType === ROLE_SECURITY ? 'info' : 'default'}>{roleLabel(r.residentType)}</Badge>
        {adminRole ? <Badge tone="warning">{adminRoleLabel(adminRole)}</Badge> : null}
      </div>
    );
  };

  const LoginCell = ({ userId }: { userId: string | null }) => {
    const status = useAsync(
      (signal) => (userId ? users.get(userId, { signal }).then((u) => u.status).catch(() => null) : Promise.resolve(null)),
      [userId, reloadKey],
    );
    useEffect(() => { if (userId && status.data) reportStatus(userId, status.data); }, [status.data, userId]);
    if (!userId) return <span className="text-[11px] text-muted-foreground">{t('users.noLogin')}</span>;
    const resolved = statusMap[userId] ?? status.data;
    if (status.loading && !resolved) return <span className="text-[11px] text-muted-foreground">{t('common.loading')}</span>;
    if (!resolved) return <span className="text-[11px] text-muted-foreground">{t('users.noLogin')}</span>;
    return (
      <Badge tone={resolved === 'Active' ? 'success' : 'danger'}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {resolved === 'Active' ? t('users.loginActive') : t('users.loginSuspendedBadge')}
      </Badge>
    );
  };

  const RowActions = ({ r }: { r: Resident }) => {
    const status = r.userId ? statusMap[r.userId] : undefined;
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => setEditing(r)} aria-label={t('users.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
          <Pencil className="h-4 w-4" />
        </button>
        {r.userId ? (
          <button type="button" disabled={togglingId === r.userId} onClick={() => toggleLogin(r)} aria-label={status === 'Suspended' ? t('users.reactivate') : t('users.suspend')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-amber-600 hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950/40">
            {status === 'Suspended' ? <CircleCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
          </button>
        ) : null}
        <button type="button" onClick={() => setConfirmDelete(r)} aria-label={t('users.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('users.title')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('users.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 shrink-0 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />{t('users.addPerson')}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('users.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          <SelectField
            value={roleFilter}
            options={[
              { value: 'all', label: t('users.allRoles') },
              { value: ROLE_RESIDENT, label: t('users.roleResident') },
              { value: ROLE_SECURITY, label: t('users.roleSecurity') },
            ]}
            onChange={(v) => { setRoleFilter(v as 'all' | typeof ROLE_RESIDENT | typeof ROLE_SECURITY); setPage(1); }}
          />
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('users.filterOrg')}
            />
          ) : null}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('users.filterCommunity')}
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
          {query.loading ? t('common.loading') : t('users.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('users.colName')}</TH>
                <TH className="w-32">{t('users.colRole')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('users.colCommunity')}</TH> : null}
                <TH className="w-32">{t('users.colLogin')}</TH>
                <TH className="w-32 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r, i) => (
                <TR key={r.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                        {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{r.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{r.phone || r.email || t('users.noContact')}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><RoleBadge r={r} /></TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{r.communityName ?? '—'}</TD> : null}
                  <TD><LoginCell userId={r.userId} /></TD>
                  <TD><RowActions r={r} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                    {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.name}</div>
                    {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{r.communityName ?? '—'}</div> : null}
                  </div>
                </div>
                <LoginCell userId={r.userId} />
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{r.phone ?? '—'}</span>
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{r.email ?? t('users.noEmail')}</span>
                <RoleBadge r={r} />
              </div>
              <div className="flex items-center justify-end border-t border-border pt-3"><RowActions r={r} /></div>
            </Card>
          ))}
        </div>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      ) : null}

      <PersonFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <PersonFormDialog open={!!editing} person={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('users.delete')}
        description={confirmDelete ? t('users.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('users.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function PersonFormDialog({ open, person, onClose, onSaved }: { open: boolean; person?: Resident | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const scope = useScope();
  const isEdit = !!person;
  const [residentType, setResidentType] = useState<string>(ROLE_RESIDENT);
  const [adminRole, setAdminRole] = useState<string>('');
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isResident = residentType !== ROLE_SECURITY;
  const isCommunityAdmin = adminRole === ROLE_COMMUNITY_ADMIN;
  const isOrgAdmin = adminRole === ROLE_ORG_ADMIN;
  const isAdminRole = isCommunityAdmin || isOrgAdmin;
  const roleValue = isAdminRole ? adminRole : residentType;
  const presetCommunityId = scope.scopedCommunityId;
  const effectiveCommunityId = presetCommunityId ?? communityId ?? undefined;

  const typeChoices = useMemo(() => [
    { value: ROLE_RESIDENT, label: t('users.roleResident') },
    { value: ROLE_SECURITY, label: t('users.roleSecurity') },
  ], [t]);

  const roleChoices = useMemo(() => {
    const base = [
      { value: ROLE_RESIDENT, label: t('users.roleResident') },
      { value: ROLE_SECURITY, label: t('users.roleSecurity') },
    ];
    if (scope.isPowerUser) {
      base.push({ value: ROLE_ORG_ADMIN, label: t('adminUsers.roleOrg') });
      base.push({ value: ROLE_COMMUNITY_ADMIN, label: t('adminUsers.roleCommunity') });
    } else if (scope.isOrgAdmin) {
      base.push({ value: ROLE_COMMUNITY_ADMIN, label: t('adminUsers.roleCommunity') });
    }
    return base;
  }, [scope.isPowerUser, scope.isOrgAdmin, t]);

  const [originalUnitId, setOriginalUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResidentType(person?.residentType === ROLE_SECURITY ? ROLE_SECURITY : (person?.residentType ?? ROLE_RESIDENT));
    setAdminRole('');
    setCommunityId(person?.communityId ?? presetCommunityId ?? null);
    setOrganizationId(null);
    setName(person?.name ?? '');
    setPhone(person?.phone ?? '');
    setEmail(person?.email ?? '');
    setUnitId(null);
    setOriginalUnitId(null);
    setPassword('');
  }, [open, person, presetCommunityId]);

  const existingAdminRole = useAsync(
    (signal) => (open && isEdit && person?.userId
      ? adminUsers.list({ pageSize: 200 }, { signal })
          .then((d) => d.items.find((u) => u.id === person.userId)?.roles.find((r) => r === ROLE_COMMUNITY_ADMIN || r === ROLE_ORG_ADMIN) ?? '')
          .catch(() => '')
      : Promise.resolve('')),
    [open, isEdit, person?.userId],
  );
  useEffect(() => {
    if (open && existingAdminRole.data) setAdminRole(existingAdminRole.data);
  }, [open, existingAdminRole.data]);

  const orgOfCommunity = useAsync(
    (signal) => (open && person?.communityId
      ? communities.get(person.communityId, { signal }).then((c) => c.organizationId).catch(() => null)
      : Promise.resolve(null)),
    [open, person?.communityId],
  );
  useEffect(() => {
    if (open && orgOfCommunity.data) setOrganizationId(orgOfCommunity.data);
  }, [open, orgOfCommunity.data]);

  const householdQuery = useAsync(
    (signal) => (open && isEdit && person?.id
      ? residents.listHousehold(person.id, { signal }).catch(() => [])
      : Promise.resolve([])),
    [open, isEdit, person?.id],
  );
  useEffect(() => {
    if (!isEdit) return;
    const current = householdQuery.data?.[0]?.unitId ?? null;
    setUnitId(current);
    setOriginalUnitId(current);
  }, [householdQuery.data, isEdit]);

  const editCommunityId = person?.communityId ?? undefined;
  const unitListCommunityId = isEdit ? editCommunityId : effectiveCommunityId;
  const loadUnits = open && (isEdit ? isResident && !!editCommunityId : !isEdit && isResident && !!effectiveCommunityId);

  const unitQuery = useAsync(
    (signal) => (loadUnits && unitListCommunityId
      ? units.list({ pageSize: 200 }, { communityId: unitListCommunityId }, { signal }).then((d) => d.items).catch(() => [])
      : Promise.resolve([])),
    [loadUnits, unitListCommunityId],
  );
  const unitOptions = (unitQuery.data ?? []).map((u) => ({ value: u.id, label: u.floor ? `${u.unitNumber} · ${t('users.floor')} ${u.floor}` : u.unitNumber }));

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) { toast.error(t('users.needName')); return; }
    if (isEdit && !isAdminRole) {
      setBusy(true);
      try {
        const originalType = person!.residentType;
        const nextType = residentType === ROLE_SECURITY
          ? ROLE_SECURITY
          : (originalType && originalType !== ROLE_SECURITY ? originalType : ROLE_RESIDENT);
        await residents.update(person!.id, {
          name: name.trim(),
          residentType: nextType,
          phone: phone.trim() || null,
          updatePhone: true,
          email: email.trim() || null,
          updateEmail: true,
        });
        if (isResident && unitId && unitId !== originalUnitId) {
          await residents.associateHousehold(person!.id, { unitId, relationship: 'owner' });
        }
        toast.success(t('users.updated'));
        onSaved();
      } catch (err) {
        toast.error(toFormError(err).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (isEdit && isAdminRole) {
      if (!person!.userId) { toast.error(t('users.adminPromoteNote')); return; }
      if (isOrgAdmin && !organizationId) { toast.error(t('adminUsers.needOrg')); return; }
      if (isCommunityAdmin && !effectiveCommunityId) { toast.error(t('adminUsers.needCommunity')); return; }
      setBusy(true);
      try {
        const originalType = person!.residentType;
        const nextType = residentType === ROLE_SECURITY
          ? ROLE_SECURITY
          : (originalType && originalType !== ROLE_SECURITY ? originalType : ROLE_RESIDENT);
        await residents.update(person!.id, {
          name: name.trim(),
          residentType: nextType,
          phone: phone.trim() || null,
          updatePhone: true,
          email: email.trim() || null,
          updateEmail: true,
        });
        await adminUsers.update(person!.userId, {
          name: name.trim() || null,
          roleName: adminRole,
          status: 'Active',
          organizationId: isOrgAdmin ? organizationId : null,
          communityId: isCommunityAdmin ? (effectiveCommunityId ?? null) : null,
        });
        toast.success(t('users.updated'));
        onSaved();
      } catch (err) {
        toast.error(toFormError(err).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (isAdminRole) {
      const identifier = phone.trim() || email.trim();
      if (!identifier) { toast.error(t('users.needPhone')); return; }
      if (password.length < 8) { toast.error(t('adminUsers.needCredentials')); return; }
      if (isOrgAdmin && !organizationId) { toast.error(t('adminUsers.needOrg')); return; }
      if (isCommunityAdmin && !effectiveCommunityId) { toast.error(t('adminUsers.needCommunity')); return; }
      setBusy(true);
      try {
        await adminUsers.create({
          name: name.trim() || null,
          identifier,
          password,
          roleName: adminRole,
          organizationId: isOrgAdmin ? organizationId : null,
          communityId: isCommunityAdmin ? (effectiveCommunityId ?? null) : null,
        });
        toast.success(t('users.created'));
        onSaved();
      } catch (err) {
        toast.error(toFormError(err).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!effectiveCommunityId) { toast.error(t('users.needCommunity')); return; }
    if (!phone.trim()) { toast.error(t('users.needPhone')); return; }
    if (isResident && !unitId) { toast.error(t('users.needUnit')); return; }
    if (password.length < 4) { toast.error(t('users.needPassword')); return; }
    setBusy(true);
    try {
      const created = await residents.create({
        communityId: effectiveCommunityId,
        name: name.trim(),
        residentType,
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      if (isResident && unitId) {
        await residents.associateHousehold(created.id, { unitId, relationship: 'owner' });
      }
      await residents.createLogin(created.id, {
        identifier: phone.trim(),
        password,
        ...(residentType === ROLE_SECURITY ? { roleName: 'Security' } : {}),
      });
      toast.success(t('users.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader title={isEdit ? t('users.editTitle') : t('users.addTitle')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label={t('users.residentType')}
          value={residentType}
          options={typeChoices}
          onChange={(v) => { setResidentType(v); setUnitId(null); }}
        />
        <SelectField
          label={t('users.role')}
          value={roleValue}
          options={roleChoices}
          onChange={(v) => {
            if (v === ROLE_ORG_ADMIN || v === ROLE_COMMUNITY_ADMIN) {
              setAdminRole(v);
            } else {
              setAdminRole('');
              setResidentType(v);
              setUnitId(null);
            }
          }}
        />
        {scope.showOrgFilter ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.society')}</label>
            <EntitySelect value={organizationId} onChange={setOrganizationId} fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('users.selectSociety')} />
          </div>
        ) : null}
        {!presetCommunityId ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.wingTower')}</label>
            <EntitySelect value={communityId} onChange={(v) => { setCommunityId(v); setUnitId(null); }} fetchPage={makeCommunityFetch(organizationId ?? undefined)} resolveLabel={resolveCommunityLabel} placeholder={t('users.selectWingTower')} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.name')}</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('users.namePlaceholder')} maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.phone')}</label>
          <PhoneField value={phone} onChange={setPhone} placeholder={t('users.phonePlaceholder')} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.email')}</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('users.emailPlaceholder')} maxLength={256} />
        </div>
        {isResident ? (
          <SelectField
            label={isEdit ? t('users.unitWing') : t('users.unit')}
            value={unitId}
            options={unitOptions}
            placeholder={unitListCommunityId ? t('users.selectUnit') : t('users.selectCommunityFirst')}
            disabled={!unitListCommunityId}
            onChange={setUnitId}
          />
        ) : null}
        {!isEdit ? (
          <div className={isResident ? '' : 'sm:col-span-2'}>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('users.password')}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('users.passwordPlaceholder')} maxLength={128} />
          </div>
        ) : null}
        {isEdit && isAdminRole && !person?.userId ? (
          <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {t('users.adminPromoteNote')}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !name.trim()} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('users.saveChanges') : t('users.createPerson')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
