import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Plus, Pencil, Trash2,
  Copy, Shield, ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList, ResponsiveTabs } from '@shared/components/layout';
import { roles } from '@shared/services';
import type { Role } from '@shared/api/roles';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { cn } from '@shared/lib/utils';
import { SCOPE_PLATFORM } from './roleConstants';
import { RoleBasicDialog } from './RoleBasicDialog';
import { InlinePermissionsTab } from './InlinePermissionsTab';

type RolesTab = 'roles' | 'permissions';

export function RolesPage() {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const [activeTab, setActiveTab] = useState<RolesTab>('roles');
  const list = useListState();
  const { search, page, pageSize, reloadKey, reload } = list;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [cloningRole, setCloningRole] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const allRolesQuery = useAsync(() => roles.all().catch(() => null), [reloadKey]);
  const allRoles = useMemo(() => allRolesQuery.data?.items ?? [], [allRolesQuery.data]);

  const tableQuery = useAsync(
    (signal) => roles.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  const tableItems = useMemo(() => tableQuery.data?.items ?? [], [tableQuery.data]);
  const total = tableQuery.data?.totalCount ?? 0;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedRoleId && allRoles.length > 0) setSelectedRoleId(allRoles[0].id);
  }, [selectedRoleId, allRoles]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => roles.remove(confirmDelete.id), t('roles.deleted'))) {
        setConfirmDelete(null);
        if (selectedRoleId === confirmDelete.id) setSelectedRoleId(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const actionIcon = compact ? 'h-4 w-4' : 'h-3 w-3';

  const scopeBadge = (r: Role, extra?: string) => (
    <Badge tone={r.scope === SCOPE_PLATFORM ? 'info' : 'default'} className={cn('text-[10px] px-1.5 py-0 rounded', extra)}>
      {r.scope === SCOPE_PLATFORM ? t('roles.scopePlatform') : t('roles.scopeCommunity')}
    </Badge>
  );

  const summary = (r: Role) =>
    t('roles.summary', { grants: r.permissions.length, resources: new Set(r.permissions.map((p) => p.resourceType.toLowerCase())).size });

  const rowActions = (r: Role) => (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button
        type="button"
        onClick={() => { setSelectedRoleId(r.id); setActiveTab('permissions'); }}
        title={t('roles.permissionsTab')}
        className={cn('flex items-center gap-1 border border-primary/40 bg-primary/5 text-primary font-medium hover:bg-primary/10 transition-colors',
          compact ? 'h-9 px-2.5 rounded-lg text-xs' : 'h-6 px-1.5 rounded-[3px] text-[10px]')}
      >
        <KeyRound className={compact ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
        <span>Perms</span>
      </button>
      <button
        type="button"
        onClick={() => { setCloningRole(r); setCreating(true); }}
        title={t('roles.duplicate')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors', actionSize)}
      >
        <Copy className={actionIcon} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(r)}
        title={t('roles.edit')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary transition-colors', actionSize)}
      >
        <Pencil className={actionIcon} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(r)}
        title={t('roles.delete')}
        className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}
      >
        <Trash2 className={actionIcon} />
      </button>
    </div>
  );

  const addButton = activeTab === 'roles' ? (
    <Button
      size="sm"
      onClick={() => { setCloningRole(null); setCreating(true); }}
      className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}
    >
      <Plus className="h-3 w-3 stroke-[2.5]" />
      {t('roles.add')}
    </Button>
  ) : null;

  // Desktop keeps the original segmented switcher (with icons/count) in the header;
  // compact uses ResponsiveTabs below the header.
  const desktopSwitcher = (
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
  );

  return (
    <PageShell
      title={t('roles.title')}
      subtitle={t('roles.subtitle')}
      icon={<ShieldCheck />}
      className="w-full"
      actions={compact ? addButton ?? undefined : (
        <div className="flex items-center gap-1">
          {desktopSwitcher}
          {addButton}
        </div>
      )}
    >
      {compact && (
        <ResponsiveTabs<RolesTab>
          tabs={[
            { key: 'roles', label: `${t('roles.rolesTab')} (${allRoles.length})` },
            { key: 'permissions', label: t('roles.permissionsTab') },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      )}

      {/* TAB 1: ROLES TABLE */}
      {activeTab === 'roles' ? (
        <div className="space-y-2">
          <FilterBar
            search={{ value: search, onChange: list.setSearch, placeholder: t('roles.searchPlaceholder') }}
            trailing={(
              <>
                <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
                  {t('common.total')}: <span className="font-semibold text-foreground">{total}</span>
                </span>
                <RefreshButton onClick={() => { roles.invalidate(); reload(); }} loading={tableQuery.loading} />
              </>
            )}
          />

          <DataList
            items={tableItems}
            keyOf={(r) => r.id}
            loading={tableQuery.loading}
            emptyIcon={<Shield className="h-6 w-6 text-muted-foreground/50" />}
            emptyText={t('roles.empty')}
            pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
            renderCard={(r, i) => (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{r.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">#{(page - 1) * pageSize + i + 1}</div>
                    </div>
                  </div>
                  {scopeBadge(r, 'shrink-0')}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{summary(r)}</span>
                  {rowActions(r)}
                </div>
              </>
            )}
            renderTable={() => (
              <Table>
                <THead>
                  <TR className="border-b border-border bg-muted/40">
                    <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colRole')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colScope')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('roles.colPermissions')}</TH>
                    <TH className="w-28 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('common.actions')}</TH>
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
                      <TD className="py-1 px-2">{scopeBadge(r)}</TD>
                      <TD className="py-1 px-2 text-xs text-muted-foreground">{summary(r)}</TD>
                      <TD className="py-1 px-2">{rowActions(r)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          />
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
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}
