import { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { adminUsers, roles } from '@shared/services';
import type { AdminUser } from '@shared/api/adminUsers';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { statusTone } from '@shared/lib/statusTone';
import {
  AdminUserFormDialog, ROLE_POWER, ROLE_ORG, ROLE_COMMUNITY,
} from './AdminUserFormDialog';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const compact = useIsCompact();
  const list = useListState();
  const { search, page, pageSize, reloadKey, reload, resetPage } = list;
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const rolesQuery = useAsync(
    () => roles.all().catch(() => null),
    [reloadKey],
  );
  const dbRoles = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data]);

  const creatableRoles = useMemo(() => {
    if (dbRoles.length > 0) {
      if (scope.isPowerUser) return dbRoles.map((r) => r.name);
      if (scope.isOrgAdmin) return dbRoles.filter((r) => r.scope !== 0).map((r) => r.name);
      return [];
    }
    if (scope.isPowerUser) return [ROLE_POWER, ROLE_ORG, ROLE_COMMUNITY, 'Superadmin'];
    if (scope.isOrgAdmin) return [ROLE_COMMUNITY];
    return [] as string[];
  }, [dbRoles, scope.isPowerUser, scope.isOrgAdmin]);

  const roleLabel = (name: string) => {
    if (name === ROLE_POWER) return t('adminUsers.rolePower');
    if (name === ROLE_ORG) return t('adminUsers.roleOrg');
    if (name === ROLE_COMMUNITY) return t('adminUsers.roleCommunity');
    const matched = dbRoles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    return matched ? matched.name : name;
  };

  const roleTone = (name: string): 'info' | 'warning' | 'default' => {
    const matched = dbRoles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (matched) return matched.scope === 0 ? 'warning' : 'default';
    return name === ROLE_POWER ? 'warning' : name === ROLE_ORG ? 'info' : 'default';
  };

  const query = useAsync(
    (signal) => adminUsers.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    return statusFilter === 'all' ? all : all.filter((u) => u.status === statusFilter);
  }, [query.data, statusFilter]);
  const total = query.data?.totalCount ?? 0;

  const activeFilters = statusFilter !== 'all' ? 1 : 0;
  const resetFilters = () => { setStatusFilter('all'); resetPage(); };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => adminUsers.remove(confirmDelete.id), t('adminUsers.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const scopeSummary = (u: AdminUser) => {
    const scoped = u.assignments.filter((a) => a.communityId);
    if (u.assignments.some((a) => !a.communityId)) return t('adminUsers.scopePlatform');
    if (scoped.length > 0) return t('adminUsers.scopeCommunities', { count: scoped.length });
    return EMPTY;
  };

  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const actionIcon = compact ? 'h-4 w-4' : 'h-3 w-3';

  const statusBadge = (u: AdminUser, extra?: string) => (
    <Badge tone={statusTone(u.status)} className={cn('text-[10px] px-1.5 py-0 rounded', extra)}>
      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
      {u.status === 'Active' ? t('adminUsers.statusActive') : t('adminUsers.statusSuspended')}
    </Badge>
  );

  const rowActions = (u: AdminUser) => (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button type="button" onClick={() => setEditing(u)} title={t('adminUsers.edit')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors', actionSize)}>
        <Pencil className={actionIcon} />
      </button>
      <button type="button" onClick={() => setConfirmDelete(u)} title={t('adminUsers.delete')}
        className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}>
        <Trash2 className={actionIcon} />
      </button>
    </div>
  );

  const renderFilters = (layout: FilterLayout) => (
    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | 'Active' | 'Suspended'); resetPage(); }}>
      <SelectTrigger className={filterControlClass(layout, 'w-28')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">{t('adminUsers.allStatuses')}</SelectItem>
        <SelectItem value="Active" className="text-xs">{t('adminUsers.statusActive')}</SelectItem>
        <SelectItem value="Suspended" className="text-xs">{t('adminUsers.statusSuspended')}</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <PageShell
      title={t('adminUsers.title')}
      subtitle={t('adminUsers.subtitle')}
      icon={<ShieldCheck />}
      className="w-full"
      actions={creatableRoles.length > 0 ? (
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}
        >
          <Plus className="h-3 w-3 stroke-[2.5]" />
          {t('adminUsers.add')}
        </Button>
      ) : undefined}
    >
      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('adminUsers.searchPlaceholder') }}
        filters={renderFilters}
        activeCount={activeFilters}
        onReset={resetFilters}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('common.total')}: <span className="font-semibold text-foreground">{total}</span>
            </span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(u) => u.id}
        loading={query.loading}
        emptyIcon={<ShieldCheck className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('adminUsers.empty')}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(u, i) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{u.name || EMPTY}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">#{(page - 1) * pageSize + i + 1} • {u.email || u.phone || EMPTY}</div>
                </div>
              </div>
              {statusBadge(u, 'shrink-0')}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} tone={roleTone(r)} className="text-[10px] px-1.5 py-0 rounded">{roleLabel(r)}</Badge>
                ))}
                <span className="text-xs text-muted-foreground">{scopeSummary(u)}</span>
              </div>
              {rowActions(u)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colName')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colIdentifier')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colRoles')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colScope')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colStatus')}</TH>
                <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((u, i) => (
                <TR key={u.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                  <TD className="py-1 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                      <span className="font-semibold text-xs text-foreground">{u.name || EMPTY}</span>
                    </div>
                  </TD>
                  <TD className="py-1 px-2 text-xs text-muted-foreground font-mono">{u.email || u.phone || EMPTY}</TD>
                  <TD className="py-1 px-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r} tone={roleTone(r)} className="text-[10px] px-1.5 py-0 rounded">{roleLabel(r)}</Badge>)}
                    </div>
                  </TD>
                  <TD className="py-1 px-2 text-xs text-muted-foreground">{scopeSummary(u)}</TD>
                  <TD className="py-1 px-2">{statusBadge(u)}</TD>
                  <TD className="py-1 px-2">{rowActions(u)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <AdminUserFormDialog
        open={creating || !!editing}
        admin={editing}
        creatableRoles={creatableRoles}
        dbRoles={dbRoles}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('adminUsers.delete')}
        description={confirmDelete ? t('adminUsers.deleteConfirm', { name: confirmDelete.name || confirmDelete.email || confirmDelete.phone || '' }) : ''}
        confirmLabel={t('adminUsers.delete')}
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}
