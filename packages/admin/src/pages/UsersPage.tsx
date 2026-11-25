import { useCallback, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Search, RefreshCw, Ban, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { residents, users, organizations, communities, roles } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';
import {
  UserFormDialog, ROLE_RESIDENT, ROLE_SECURITY, ROLE_COMMUNITY_ADMIN, ROLE_ORG_ADMIN,
} from './users/UserFormDialog';

const fetchOrgPage = (s: string, p: number, ps: number, sig: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: s || undefined, page: p, pageSize: ps }, { signal: sig })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const makeCommunityFetch = (orgId?: string) => (s: string, p: number, ps: number, sig: AbortSignal): Promise<EntityPage> =>
  communities.list({ search: s || undefined, page: p, pageSize: ps }, orgId ? { organizationId: orgId } : {}, { signal: sig })
    .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));

const resolveCommunityLabel = (id: string, sig: AbortSignal) => communities.get(id, { signal: sig }).then((c) => c.name).catch(() => null);
const resolveOrgLabel = (id: string, sig: AbortSignal) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null);

export function UsersPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resident | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const rolesQuery = useAsync(
    (signal) => roles.list({ pageSize: 100 }, { signal }).catch(() => null),
    [reloadKey],
  );
  const dbRoles = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data]);

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

  const reportStatus = useCallback((userId: string, status: UserStatus) => {
    setStatusMap((prev) => (prev[userId] === status ? prev : { ...prev, [userId]: status }));
  }, []);

  const toggleLogin = async (r: Resident) => {
    if (!r.userId || togglingId) return;
    const currentStatus = statusMap[r.userId] ?? (r.loginStatus as UserStatus) ?? 'Active';
    const next: UserStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    setTogglingId(r.userId);
    try {
      await users.update(r.userId, { status: next });
      reportStatus(r.userId, next);
      toast.success(next === 'Suspended' ? t('users.loginSuspended') : t('users.loginReactivated'));
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setTogglingId(null); }
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
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const adminRoleLabel = (role: string) => (role === ROLE_ORG_ADMIN ? t('adminUsers.roleOrg') : t('adminUsers.roleCommunity'));

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            {t('users.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('users.subtitle')}</p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
        >
          <Plus className="h-3 w-3 stroke-[2.5]" />
          {t('users.add')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('users.searchPlaceholder')}
              className="h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as any); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-[4px] text-[11px] bg-background px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('users.allRoles')}</SelectItem>
              <SelectItem value={ROLE_RESIDENT} className="text-xs">{t('users.roleResident')}</SelectItem>
              <SelectItem value={ROLE_SECURITY} className="text-xs">{t('users.roleSecurity')}</SelectItem>
              {dbRoles.map((r) => (
                <SelectItem key={r.id} value={r.name} className="text-xs">{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {scope.showOrgFilter && (
            <EntitySelect
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('users.filterOrg')}
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
            />
          )}

          {scope.showCommunityFilter && (
            <EntitySelect
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('users.filterCommunity')}
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
            />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('orgs.total')}: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reload}
            aria-label="Refresh"
            className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80"
          >
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('users.empty')}</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((r, i) => {
                const status = r.userId ? (statusMap[r.userId] ?? r.loginStatus) : undefined;
                const roleName = r.roleName ?? r.roles?.[0];
                const isSpecialAdmin = roleName === ROLE_COMMUNITY_ADMIN || roleName === ROLE_ORG_ADMIN;

                return (
                  <div key={r.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <Users className="h-3 w-3" />
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-foreground truncate">{r.name}</span>
                          <span className="block font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1} • {r.phone || r.email || '—'}</span>
                        </div>
                      </div>
                      {roleName && (
                        <Badge tone={isSpecialAdmin ? 'warning' : 'default'} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                          {roleName === ROLE_ORG_ADMIN ? adminRoleLabel(ROLE_ORG_ADMIN) : roleName === ROLE_COMMUNITY_ADMIN ? adminRoleLabel(ROLE_COMMUNITY_ADMIN) : roleName}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {showCommunityCol && r.communityName && <span className="text-[11px] text-muted-foreground font-medium">{r.communityName}</span>}
                        {r.userId && status && (
                          <Badge tone={status === 'Active' ? 'success' : 'danger'} className="text-[10px] px-1.5 py-0 rounded">
                            <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                            {status === 'Active' ? t('users.loginActive') : t('users.loginSuspendedBadge')}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setEditing(r)} title={t('users.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                          <Pencil className="h-3 w-3" />
                        </button>
                        {r.userId && (
                          <button type="button" disabled={togglingId === r.userId} onClick={() => toggleLogin(r)} title={status === 'Suspended' ? t('users.reactivate') : t('users.suspend')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors">
                            {status === 'Suspended' ? <CircleCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                          </button>
                        )}
                        <button type="button" onClick={() => setConfirmDelete(r)} title={t('users.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('users.colPerson')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('users.colContact')}</TH>
                    {showCommunityCol && <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('users.colCommunity')}</TH>}
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('users.colRoles')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('users.colLogin')}</TH>
                    <TH className="w-20 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((r, i) => {
                    const status = r.userId ? (statusMap[r.userId] ?? r.loginStatus) : undefined;
                    const roleName = r.roleName ?? r.roles?.[0];
                    const isSpecialAdmin = roleName === ROLE_COMMUNITY_ADMIN || roleName === ROLE_ORG_ADMIN;

                    return (
                      <TR key={r.id} className="hover:bg-muted/30 transition-colors">
                        <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                        <TD className="py-1 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                              <Users className="h-3 w-3" />
                            </span>
                            <div>
                              <span className="font-semibold text-xs text-foreground leading-none">{r.name}</span>
                              <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {r.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </TD>
                        <TD className="py-1 px-2 text-xs text-muted-foreground font-mono">{r.phone || r.email || '—'}</TD>
                        {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground font-medium">{r.communityName ?? '—'}</TD>}
                        <TD className="py-1 px-2">
                          {roleName ? (
                            <Badge tone={isSpecialAdmin ? 'warning' : 'default'} className="text-[10px] px-1.5 py-0 rounded">
                              {roleName === ROLE_ORG_ADMIN ? adminRoleLabel(ROLE_ORG_ADMIN) : roleName === ROLE_COMMUNITY_ADMIN ? adminRoleLabel(ROLE_COMMUNITY_ADMIN) : roleName}
                            </Badge>
                          ) : '—'}
                        </TD>
                        <TD className="py-1 px-2">
                          {!r.userId ? (
                            <span className="text-[11px] text-muted-foreground">{t('users.noLogin')}</span>
                          ) : (
                            <Badge tone={status === 'Active' ? 'success' : 'danger'} className="text-[10px] px-1.5 py-0 rounded">
                              <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                              {status === 'Active' ? t('users.loginActive') : t('users.loginSuspendedBadge')}
                            </Badge>
                          )}
                        </TD>
                        <TD className="py-1 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setEditing(r)} title={t('users.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                              <Pencil className="h-3 w-3" />
                            </button>
                            {r.userId && (
                              <button type="button" disabled={togglingId === r.userId} onClick={() => toggleLogin(r)} title={status === 'Suspended' ? t('users.reactivate') : t('users.suspend')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors">
                                {status === 'Suspended' ? <CircleCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                              </button>
                            )}
                            <button type="button" onClick={() => setConfirmDelete(r)} title={t('users.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
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
          </>
        )}

        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={query.data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

      <UserFormDialog
        open={creating || !!editing}
        person={editing}
        presetCommunityId={effectiveCommunityId}
        dbRoles={dbRoles}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('users.delete')}
        description={confirmDelete ? t('users.deleteConfirm', { name: confirmDelete.name || confirmDelete.phone || confirmDelete.email || '' }) : ''}
        confirmLabel={t('users.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
