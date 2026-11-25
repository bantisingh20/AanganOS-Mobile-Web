import { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { adminUsers } from '@shared/services';
import type { AdminUser } from '@shared/api/adminUsers';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { cn } from '@shared/lib/utils';
import { toFormError } from '@shared/api/errors';
import {
  AdminUserFormDialog, ROLE_POWER, ROLE_ORG, ROLE_COMMUNITY,
} from './admin-users/AdminUserFormDialog';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await adminUsers.remove(confirmDelete.id);
      toast.success(t('adminUsers.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const scopeSummary = (u: AdminUser) => {
    const scoped = u.assignments.filter((a) => a.communityId);
    if (u.assignments.some((a) => !a.communityId)) return t('adminUsers.scopePlatform');
    if (scoped.length > 0) return t('adminUsers.scopeCommunities', { count: scoped.length });
    return '—';
  };

  return (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {t('adminUsers.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('adminUsers.subtitle')}</p>
        </div>

        {creatableRoles.length > 0 && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            {t('adminUsers.add')}
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('adminUsers.searchPlaceholder')}
              className="h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | 'Active' | 'Suspended'); setPage(1); }}>
            <SelectTrigger className="h-7.5 w-28 rounded-[4px] text-[11px] bg-background px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('adminUsers.allStatuses')}</SelectItem>
              <SelectItem value="Active" className="text-xs">{t('adminUsers.statusActive')}</SelectItem>
              <SelectItem value="Suspended" className="text-xs">{t('adminUsers.statusSuspended')}</SelectItem>
            </SelectContent>
          </Select>
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
            <ShieldCheck className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('adminUsers.empty')}</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((u, i) => (
                <div key={u.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-foreground truncate">{u.name || '—'}</span>
                        <span className="block font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1} • {u.email || u.phone || '—'}</span>
                      </div>
                    </div>
                    <Badge tone={u.status === 'Active' ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                      {u.status === 'Active' ? t('adminUsers.statusActive') : t('adminUsers.statusSuspended')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} tone={roleTone(r)} className="text-[10px] px-1.5 py-0 rounded">{roleLabel(r)}</Badge>
                      ))}
                      <span className="text-[11px] text-muted-foreground">{scopeSummary(u)}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setEditing(u)} title={t('adminUsers.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(u)} title={t('adminUsers.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colName')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colIdentifier')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colRoles')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colScope')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('adminUsers.colStatus')}</TH>
                    <TH className="w-16 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
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
                          <span className="font-semibold text-xs text-foreground">{u.name || '—'}</span>
                        </div>
                      </TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground font-mono">{u.email || u.phone || '—'}</TD>
                      <TD className="py-1 px-2">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => <Badge key={r} tone={roleTone(r)} className="text-[10px] px-1.5 py-0 rounded">{roleLabel(r)}</Badge>)}
                        </div>
                      </TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground">{scopeSummary(u)}</TD>
                      <TD className="py-1 px-2">
                        <Badge tone={u.status === 'Active' ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded">
                          <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                          {u.status === 'Active' ? t('adminUsers.statusActive') : t('adminUsers.statusSuspended')}
                        </Badge>
                      </TD>
                      <TD className="py-1 px-2">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditing(u)} title={t('adminUsers.edit')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(u)} title={t('adminUsers.delete')} className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))}
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

      <AdminUserFormDialog
        open={creating || !!editing}
        admin={editing}
        creatableRoles={creatableRoles}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

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
    </div>
  );
}
