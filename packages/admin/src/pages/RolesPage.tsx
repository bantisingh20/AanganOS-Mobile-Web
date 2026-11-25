import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Plus, Pencil, Trash2, Search, RefreshCw,
  Copy, Shield, ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { roles } from '@shared/services';
import type { Role } from '@shared/api/roles';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';
import { SCOPE_PLATFORM } from './roles/roleConstants';
import { RoleBasicDialog } from './roles/RoleBasicDialog';
import { InlinePermissionsTab } from './roles/InlinePermissionsTab';

export function RolesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [cloningRole, setCloningRole] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const allRolesQuery = useAsync((signal) => roles.list({ pageSize: 100 }, { signal }).catch(() => null), [reloadKey]);
  const allRoles = useMemo(() => allRolesQuery.data?.items ?? [], [allRolesQuery.data]);

  const tableQuery = useAsync(
    (signal) => roles.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  const tableItems = useMemo(() => tableQuery.data?.items ?? [], [tableQuery.data]);

  const reload = () => setReloadKey((k) => k + 1);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedRoleId && allRoles.length > 0) setSelectedRoleId(allRoles[0].id);
  }, [selectedRoleId, allRoles]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await roles.remove(confirmDelete.id);
      toast.success(t('roles.deleted'));
      setConfirmDelete(null);
      if (selectedRoleId === confirmDelete.id) setSelectedRoleId(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  return (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {/* Enterprise Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {t('roles.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('roles.subtitle')}</p>
        </div>

        {/* View Switcher: Roles vs Permissions */}
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-1 h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                activeTab === 'roles' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="h-3 w-3" />
              <span>{t('roles.rolesTab')}</span>
              <span className="font-mono text-[9px] opacity-70">({allRoles.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-1 h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                activeTab === 'permissions' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="h-3 w-3" />
              <span>{t('roles.permissionsTab')}</span>
            </button>
          </div>

          {activeTab === 'roles' && (
            <Button
              size="sm"
              onClick={() => { setCloningRole(null); setCreating(true); }}
              className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
            >
              <Plus className="h-3 w-3 stroke-[2.5]" />
              {t('roles.add')}
            </Button>
          )}
        </div>
      </div>

      {/* TAB 1: ROLES TABLE */}
      {activeTab === 'roles' ? (
        <div className="space-y-2">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
            <div className="relative min-w-[140px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('roles.searchPlaceholder')}
                className="h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground">
                {t('orgs.total')}: <span className="font-semibold text-foreground">{tableQuery.data?.totalCount ?? 0}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reload}
                aria-label="Refresh"
                className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80"
              >
                <RefreshCw className={cn('h-3 w-3', tableQuery.loading && 'animate-spin text-primary')} />
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-md border border-border/80 bg-card overflow-hidden">
            {tableQuery.loading && tableItems.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
                {t('common.loading')}
              </div>
            ) : tableItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Shield className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
                <p className="text-xs font-semibold text-foreground">{t('roles.empty')}</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="divide-y divide-border/60 md:hidden">
                  {tableItems.map((r, i) => (
                    <div key={r.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                            <ShieldCheck className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground truncate">{r.name}</span>
                            <span className="block font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                          </div>
                        </div>
                        <Badge tone={r.scope === SCOPE_PLATFORM ? 'info' : 'default'} className="text-[10px] px-1.5 py-0 rounded shrink-0">
                          {r.scope === SCOPE_PLATFORM ? t('roles.scopePlatform') : t('roles.scopeCommunity')}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {t('roles.summary', { grants: r.permissions.length, resources: new Set(r.permissions.map((p) => p.resourceType.toLowerCase())).size })}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setSelectedRoleId(r.id); setActiveTab('permissions'); }}
                            title={t('roles.permissionsTab')}
                            className="flex h-6 px-1.5 items-center gap-1 rounded-[3px] border border-primary/40 bg-primary/5 text-primary text-[10px] font-medium hover:bg-primary/10 transition-colors"
                          >
                            <KeyRound className="h-2.5 w-2.5" />
                            <span>Perms</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setCloningRole(r); setCreating(true); }}
                            title={t('roles.duplicate')}
                            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            title={t('roles.edit')}
                            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            title={t('roles.delete')}
                            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
                          >
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
                        <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colRole')}</TH>
                        <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colScope')}</TH>
                        <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colPermissions')}</TH>
                        <TH className="w-28 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {tableItems.map((r, i) => (
                        <TR key={r.id} className="hover:bg-muted/30 transition-colors">
                          <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                          <TD className="py-1 px-2">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                                <ShieldCheck className="h-3 w-3" />
                              </span>
                              <div>
                                <span className="font-semibold text-xs text-foreground leading-none">{r.name}</span>
                                <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {r.id.slice(0, 8)}</span>
                              </div>
                            </div>
                          </TD>
                          <TD className="py-1 px-2">
                            <Badge tone={r.scope === SCOPE_PLATFORM ? 'info' : 'default'} className="text-[10px] px-1.5 py-0 rounded">
                              {r.scope === SCOPE_PLATFORM ? t('roles.scopePlatform') : t('roles.scopeCommunity')}
                            </Badge>
                          </TD>
                          <TD className="py-1 px-2 text-xs text-muted-foreground">
                            {t('roles.summary', { grants: r.permissions.length, resources: new Set(r.permissions.map((p) => p.resourceType.toLowerCase())).size })}
                          </TD>
                          <TD className="py-1 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => { setSelectedRoleId(r.id); setActiveTab('permissions'); }}
                                title={t('roles.permissionsTab')}
                                className="flex h-6 px-1.5 items-center gap-1 rounded-[3px] border border-primary/40 bg-primary/5 text-primary text-[10px] font-medium hover:bg-primary/10 transition-colors"
                              >
                                <KeyRound className="h-2.5 w-2.5" />
                                <span>Perms</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => { setCloningRole(r); setCreating(true); }}
                                title={t('roles.duplicate')}
                                className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(r)}
                                title={t('roles.edit')}
                                className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(r)}
                                title={t('roles.delete')}
                                className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
                              >
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

            {(tableQuery.data?.totalCount ?? 0) > 0 && (
              <div className="border-t border-border px-2.5 py-1 bg-muted/20">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={tableQuery.data?.totalCount ?? 0}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: INLINE PERMISSIONS MATRIX */
        <InlinePermissionsTab
          allRolesList={allRoles}
          selectedRoleId={selectedRoleId}
          onSelectRole={(id) => setSelectedRoleId(id)}
          onRoleUpdated={reload}
        />
      )}

      {/* Basic Create / Edit Dialog */}
      <RoleBasicDialog
        open={creating || !!editing}
        role={editing}
        cloneSource={cloningRole}
        onClose={() => { setCreating(false); setEditing(null); setCloningRole(null); }}
        onSaved={() => { setCreating(false); setEditing(null); setCloningRole(null); reload(); }}
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
    </div>
  );
}
