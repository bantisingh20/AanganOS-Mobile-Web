import { useCallback, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Search, RefreshCw, Ban, CircleCheck, Phone, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { CommonEntitySelector } from '@shared/components/CommonEntitySelector';
import { UserFormDialog } from '@shared/components/users/UserFormDialog';
import { residents, users, roles as rolesApi } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';

export interface PeopleManagementViewProps {
  mode?: 'admin' | 'mobile';
  onBack?: () => void;
}

export function PeopleManagementView({ mode = 'admin' }: PeopleManagementViewProps) {
  const { t } = useTranslation();
  const scope = useScope();
  const isMobile = mode === 'mobile';

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(scope.organizationId ?? null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(scope.scopedCommunityId ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 25 : 10);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resident | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveOrgId = filterOrgId || (scope.organizationId ?? undefined);
  const effectiveCommunityId = filterCommunityId || (scope.scopedCommunityId ?? undefined);

  const rolesQuery = useAsync((signal) => rolesApi.list({ pageSize: 100 }, { signal }).catch(() => null), [reloadKey]);

  const query = useAsync(
    (signal) => {
      const rf = roleFilter === 'all' ? undefined : roleFilter;
      const isRoleResident = rf?.toLowerCase() === 'resident' || rf?.toLowerCase() === 'owner';
      const isRoleSecurity = rf?.toLowerCase() === 'security';
      return residents.list(
        { search: search.trim() || undefined, page, pageSize },
        {
          ...(isRoleResident ? { residentType: 'owner' } : isRoleSecurity ? { residentType: 'security' } : {}),
          ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        { signal },
      );
    },
    [search, roleFilter, effectiveCommunityId, effectiveOrgId, page, pageSize, reloadKey],
  );

  const total = query.data?.totalCount ?? 0;
  const items = useMemo(() => {
    const raw = query.data?.items ?? [];
    if (roleFilter !== 'all' && roleFilter !== 'resident' && roleFilter !== 'security') {
      return raw.filter((r) => (r.roleName ?? '').toLowerCase() === roleFilter.toLowerCase());
    }
    return raw;
  }, [query.data?.items, roleFilter]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await residents.remove(confirmDelete.id);
      toast.success(t('users.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const toggleStatus = async (item: Resident) => {
    if (!item.userId) { toast.info(t('users.noLoginAccount')); return; }
    const current = statusMap[item.userId] ?? (item.loginStatus === 'Active' ? 'Active' : 'Suspended');
    const next: UserStatus = current === 'Active' ? 'Suspended' : 'Active';
    setTogglingId(item.userId);
    try {
      await users.update(item.userId, { status: next });
      setStatusMap((m) => ({ ...m, [item.userId!]: next }));
      toast.success(next === 'Active' ? t('users.userActivated') : t('users.userBanned'));
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setTogglingId(null); }
  };

  return (
    <div className="space-y-3">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>{t('users.title', 'Manage People')}</span>
          </h1>
          <p className="text-xs text-muted-foreground">{t('users.subtitle', 'Manage residents, society members, and staff.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setCreating(true)} className="h-8 rounded-[4px] px-3 text-xs font-semibold shadow-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            <span>{t('users.addPerson', 'Add Person')}</span>
          </Button>
          <Button type="button" variant="outline" onClick={reload} className="h-8 w-8 p-0 rounded-[4px] border-border/80">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Entity Selector (Society + Wing/Community) & Search / Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-card p-2.5 shadow-xs">
        <CommonEntitySelector
          level={2}
          selectedOrgId={effectiveOrgId}
          selectedCommunityId={effectiveCommunityId}
          onOrgChange={(org) => { setFilterOrgId(org); setPage(1); }}
          onCommunityChange={(comm) => { setFilterCommunityId(comm); setPage(1); }}
        />

        <div className="flex flex-wrap items-center gap-2 ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('users.searchPlaceholder', 'Search by name, phone, email…')}
              className="h-8 pl-8 text-xs rounded-[4px]"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-32 rounded-[4px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="resident">Resident / Owner</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              {(rolesQuery.data?.items ?? []).map((r) => (
                <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content: Table on Desktop/Admin mode, Cards on Mobile mode */}
      <div className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-xs">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {query.loading ? t('common.loading') : t('users.empty', 'No people found.')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={isMobile ? 'hidden' : 'overflow-x-auto'}>
              <Table>
                <THead>
                  <TR>
                    <TH className="py-2 px-3 text-xs">{t('users.colName', 'Person')}</TH>
                    <TH className="py-2 px-3 text-xs">{t('users.colContact', 'Contact')}</TH>
                    <TH className="py-2 px-3 text-xs">{t('users.colRole', 'Role')}</TH>
                    <TH className="py-2 px-3 text-xs">{t('users.wingTower', 'Wing / Society')}</TH>
                    <TH className="py-2 px-3 text-xs">{t('users.colStatus', 'Status')}</TH>
                    <TH className="py-2 px-3 text-right text-xs">{t('orgs.colActions', 'Actions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((item) => {
                    const status = statusMap[item.userId ?? ''] ?? (item.loginStatus === 'Active' ? 'Active' : 'Suspended');
                    return (
                      <TR key={item.id}>
                        <TD className="py-2 px-3">
                          <div className="font-semibold text-xs text-foreground">{item.name}</div>
                          {item.residentType ? <span className="text-[10px] text-muted-foreground uppercase">{item.residentType}</span> : null}
                        </TD>
                        <TD className="py-2 px-3 text-xs text-muted-foreground">
                          {item.phone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</div> : null}
                          {item.email ? <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</div> : null}
                        </TD>
                        <TD className="py-2 px-3">
                          <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                            {item.roleName || item.residentType || 'Resident'}
                          </Badge>
                        </TD>
                        <TD className="py-2 px-3 text-xs text-muted-foreground">
                          {item.communityName || item.organizationName || '—'}
                        </TD>
                        <TD className="py-2 px-3">
                          <Badge tone={status === 'Active' ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                            {status}
                          </Badge>
                        </TD>
                        <TD className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleStatus(item)}
                              disabled={togglingId === item.userId || !item.userId}
                              aria-label="Toggle user login status"
                              className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:bg-muted"
                            >
                              {status === 'Active' ? <Ban className="h-3.5 w-3.5 text-rose-600" /> : <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(item)}
                              aria-label="Edit person"
                              className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-border text-muted-foreground hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(item)}
                              aria-label="Delete person"
                              className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className={isMobile ? 'divide-y divide-border/60' : 'hidden'}>
              {items.map((item) => {
                const status = statusMap[item.userId ?? ''] ?? (item.loginStatus === 'Active' ? 'Active' : 'Suspended');
                return (
                  <div key={item.id} className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-foreground">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Badge tone="default" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                            {item.roleName || item.residentType || 'Resident'}
                          </Badge>
                          <span>{item.communityName || item.organizationName}</span>
                        </div>
                      </div>
                      <Badge tone={status === 'Active' ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                        {status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {item.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {item.phone}</span> : null}
                      {item.email ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {item.email}</span> : null}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => toggleStatus(item)}
                        disabled={togglingId === item.userId || !item.userId}
                        className="h-7 px-2.5 rounded-[4px] border border-border text-[11px] font-medium flex items-center gap-1"
                      >
                        {status === 'Active' ? <Ban className="h-3 w-3 text-rose-600" /> : <CircleCheck className="h-3 w-3 text-emerald-600" />}
                        <span>{status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="h-7 px-2.5 rounded-[4px] border border-border text-[11px] font-medium flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
                        className="h-7 px-2.5 rounded-[4px] border border-rose-200 text-rose-600 text-[11px] font-medium flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {total > pageSize ? (
          <div className="border-t border-border/80 p-2.5 flex items-center justify-between">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        ) : null}
      </div>

      {/* Add / Edit Dialog */}
      {creating || editing ? (
        <UserFormDialog
          open={creating || !!editing}
          person={editing}
          presetCommunityId={effectiveCommunityId}
          dbRoles={rolesQuery.data?.items ?? []}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      ) : null}

      {/* Delete Confirmation */}
      {confirmDelete ? (
        <ConfirmDialog
          open={!!confirmDelete}
          title={t('users.confirmDeleteTitle', 'Delete Person')}
          description={t('users.confirmDeleteDesc', 'Are you sure you want to delete this person? This action cannot be undone.')}
          confirmLabel={t('common.delete', 'Delete')}
          busy={confirmBusy}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
