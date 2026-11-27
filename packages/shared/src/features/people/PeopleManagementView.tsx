import { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Ban, CircleCheck, Phone, Mail, Check, X } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList, ResponsiveTabs, filterControlClass, type FilterLayout } from '@shared/components/layout';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { CommonEntitySelector } from '@shared/components/form/CommonEntitySelector';
import { UserFormDialog } from '@shared/features/people/UserFormDialog';
import { residents, users, roles as rolesApi } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useListState } from '@shared/lib/hooks/useListState';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { statusTone } from '@shared/lib/statusTone';
import { EMPTY } from '@shared/lib/format';
import { tryToast } from '@shared/lib/withToast';

/** KYC status tabs. 'all' first: Manage People opens on everyone; approvals open on 'pending'. */
export const PEOPLE_STATUS_TABS = ['all', 'pending', 'verified', 'rejected', 'draft'] as const;
export type PeopleStatusTab = (typeof PEOPLE_STATUS_TABS)[number];

export interface PeopleManagementViewProps {
  /** @deprecated The host app is set once with <SurfaceProvider>; only pass this to override it. */
  mode?: 'admin' | 'mobile';
  /** Tab to open on, e.g. 'pending' for the Resident Approvals menu entry. */
  initialStatusTab?: PeopleStatusTab;
  allowedTabs?: readonly PeopleStatusTab[];
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

/**
 * The one People page for both apps: residents, staff and members, with KYC status tabs,
 * Approve / Reject for pending KYC, and add / edit / delete / login on-off.
 * Replaces the old separate Residents view and the app's Resident Approvals screen.
 */
export function PeopleManagementView(props: PeopleManagementViewProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><PeopleManagement {...props} /></SurfaceProvider>;
}

function PeopleManagement({ onBack, initialStatusTab = 'all', allowedTabs = PEOPLE_STATUS_TABS, title, subtitle }: PeopleManagementViewProps) {
  const { t } = useTranslation();
  const scope = useScope();
  const surface = useResolvedSurface();
  const compact = useIsCompact();
  const isMobile = compact;

  const [status, setStatus] = useState<PeopleStatusTab>(initialStatusTab);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Resident | null>(null);
  const list = useListState(isMobile ? 25 : 10);
  const { search, page, pageSize, reloadKey, reload } = list;
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(scope.organizationId ?? null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(scope.scopedCommunityId ?? null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resident | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});

  const effectiveOrgId = filterOrgId || (scope.organizationId ?? undefined);
  const effectiveCommunityId = filterCommunityId || (scope.scopedCommunityId ?? undefined);

  const rolesQuery = useAsync(() => rolesApi.all().catch(() => null), [reloadKey]);

  const query = useAsync(
    (signal) => {
      const rf = roleFilter === 'all' ? undefined : roleFilter;
      const isRoleResident = rf?.toLowerCase() === 'resident' || rf?.toLowerCase() === 'owner';
      const isRoleSecurity = rf?.toLowerCase() === 'security';
      return residents.list(
        { search: search.trim() || undefined, page, pageSize },
        {
          ...(isRoleResident ? { residentType: 'owner' } : isRoleSecurity ? { residentType: 'security' } : {}),
          ...(status !== 'all' ? { verificationStatus: status } : {}),
          ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        { signal },
      );
    },
    [search, roleFilter, status, effectiveCommunityId, effectiveOrgId, page, pageSize, reloadKey],
  );

  const total = query.data?.totalCount ?? 0;
  const items = useMemo(() => {
    const raw = query.data?.items ?? [];
    if (roleFilter !== 'all' && roleFilter !== 'resident' && roleFilter !== 'security') {
      return raw.filter((r) => (r.roleName ?? '').toLowerCase() === roleFilter.toLowerCase());
    }
    return raw;
  }, [query.data?.items, roleFilter]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => residents.remove(confirmDelete.id), t('users.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const toggleStatus = async (item: Resident) => {
    if (!item.userId) { toast.info(t('users.noLoginAccount')); return; }
    const current = statusMap[item.userId] ?? (item.loginStatus === 'Active' ? 'Active' : 'Suspended');
    const next: UserStatus = current === 'Active' ? 'Suspended' : 'Active';
    setTogglingId(item.userId);
    try {
      if (await tryToast(() => users.update(item.userId!, { status: next }), next === 'Active' ? t('users.userActivated') : t('users.userBanned'))) {
        setStatusMap((m) => ({ ...m, [item.userId!]: next }));
      }
    } finally { setTogglingId(null); }
  };

  const approve = async (r: Resident) => {
    setApprovingId(r.id);
    try {
      if (await tryToast(() => residents.verify(r.id), t('residents.approved', 'Resident approved successfully'))) reload();
    } finally { setApprovingId(null); }
  };

  const kycLabel = (v: string) =>
    v === 'verified' ? t('residents.verified', 'Verified')
      : v === 'rejected' ? t('residents.rejected', 'Rejected')
      : v === 'draft' ? t('residents.draft', 'Draft')
      : t('residents.pending', 'Pending');
  const kycBadge = (r: Resident) => (
    <Badge tone={statusTone(r.verificationStatus)} className="shrink-0 rounded-[3px] px-1.5 py-0 text-[10px]">
      <span className="mr-1 h-1 w-1 rounded-full bg-current opacity-70" />{kycLabel(r.verificationStatus)}
    </Badge>
  );
  /** Approve / Reject, only for people whose KYC is pending. */
  const kycActions = (r: Resident) => r.verificationStatus !== 'pending' ? null : (
    <div className="flex items-center gap-1">
      <button type="button" disabled={approvingId === r.id} onClick={() => approve(r)}
        className={cn('flex items-center gap-1 rounded-[3px] bg-emerald-600 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50',
          compact ? 'h-9 rounded-lg px-3 text-sm' : 'h-6 px-2 text-[10.5px]')}>
        <Check className={compact ? 'h-4 w-4' : 'h-3 w-3'} />{t('residents.approve', 'Approve')}
      </button>
      <button type="button" onClick={() => setRejecting(r)}
        className={cn('flex items-center gap-1 rounded-[3px] border border-rose-300 font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40',
          compact ? 'h-9 rounded-lg px-3 text-sm' : 'h-6 px-2 text-[10.5px]')}>
        <X className={compact ? 'h-4 w-4' : 'h-3 w-3'} />{t('residents.reject', 'Reject')}
      </button>
    </div>
  );

  const statusOf = (item: Resident): UserStatus => statusMap[item.userId ?? ''] ?? (item.loginStatus === 'Active' ? 'Active' : 'Suspended');
  const iconBtn = compact ? 'h-9 w-9 rounded-lg' : 'h-7 w-7 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const rowActions = (item: Resident) => {
    const login = statusOf(item);
    return (
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => toggleStatus(item)} disabled={togglingId === item.userId || !item.userId}
          aria-label={login === 'Active' ? 'Deactivate login' : 'Activate login'}
          className={cn('flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-50', iconBtn)}>
          {login === 'Active' ? <Ban className={cn(iconSize, 'text-rose-600')} /> : <CircleCheck className={cn(iconSize, 'text-emerald-600')} />}
        </button>
        <button type="button" onClick={() => setEditing(item)} aria-label="Edit person"
          className={cn('flex items-center justify-center border border-border text-muted-foreground hover:bg-muted', iconBtn)}>
          <Pencil className={iconSize} />
        </button>
        <button type="button" onClick={() => setConfirmDelete(item)} aria-label="Delete person"
          className={cn('flex items-center justify-center border border-rose-200 text-rose-600 hover:bg-rose-50', iconBtn)}>
          <Trash2 className={iconSize} />
        </button>
      </div>
    );
  };

  const addButton = surface === 'app' ? (
    <Button size="sm" onClick={() => setCreating(true)} className="h-9 gap-1 rounded-full bg-white/20 px-3 text-sm font-semibold text-primary-foreground hover:bg-white/30">
      <Plus className="h-4 w-4" />{t('users.add', 'Add')}
    </Button>
  ) : (
    <Button type="button" onClick={() => setCreating(true)} className={cn('font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
      <Plus className="mr-1 h-3.5 w-3.5" />{t('users.addPerson', 'Add Person')}
    </Button>
  );

  const renderFilters = (layout: FilterLayout) => (
    <>
      <CommonEntitySelector
        level={3}
        selectedOrgId={effectiveOrgId}
        selectedCommunityId={effectiveCommunityId}
        onOrgChange={(org) => { setFilterOrgId(org); list.resetPage(); }}
        onCommunityChange={(comm) => { setFilterCommunityId(comm); list.resetPage(); }}
        showLabels={layout === 'sheet'}
        size={layout === 'sheet' ? 'default' : 'sm'}
        className={layout === 'sheet' ? 'flex-col !items-stretch [&>div]:w-full' : ''}
      />
      <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); list.resetPage(); }}>
        <SelectTrigger className={filterControlClass(layout, 'w-32')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="resident">Resident / Owner</SelectItem>
          <SelectItem value="security">Security</SelectItem>
          {(rolesQuery.data?.items ?? []).map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <PageShell title={title ?? t('users.title', 'Manage People')} icon={<Users />} actions={addButton} onBack={onBack}
      subtitle={surface === 'admin' ? (subtitle ?? t('users.subtitle', 'Manage residents, society members, and staff.')) : undefined}>
      {allowedTabs.length > 1 ? (
        <ResponsiveTabs
          tabs={allowedTabs.map((s) => ({ key: s, label: t(`residents.tab_${s}`, s.charAt(0).toUpperCase() + s.slice(1)) }))}
          value={status}
          onChange={(s) => { setStatus(s); list.resetPage(); }}
        />
      ) : null}

      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('users.searchPlaceholder', 'Search by name, phone, email…') }}
        filters={renderFilters}
        activeCount={roleFilter !== 'all' ? 1 : 0}
        onReset={() => { setRoleFilter('all'); list.resetPage(); }}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>{t('common.total')}: <span className="font-semibold text-foreground">{total}</span></span>
            <RefreshButton onClick={reload} loading={query.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(item) => item.id}
        loading={query.loading}
        emptyIcon={<Users className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={t('users.empty', 'No people found.')}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(item) => {
          const login = statusOf(item);
          return (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">{item.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge tone="default" className="rounded-[3px] px-1.5 py-0 text-[10px]">{item.roleName || item.residentType || 'Resident'}</Badge>
                    <span className="truncate">{item.communityName || item.organizationName}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {kycBadge(item)}
                  <Badge tone={login === 'Active' ? 'success' : 'muted'} className="rounded-[3px] px-1.5 py-0 text-[10px]">{login}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.phone ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{item.phone}</span> : null}
                {item.email ? <span className="flex items-center gap-1 truncate"><Mail className="h-3.5 w-3.5" />{item.email}</span> : null}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                {kycActions(item) ?? <span />}
                {rowActions(item)}
              </div>
            </>
          );
        }}
        renderTable={() => (
          <Table>
            <THead>
              <TR>
                <TH className="px-3 py-2 text-xs">{t('users.colName', 'Person')}</TH>
                <TH className="px-3 py-2 text-xs">{t('users.colContact', 'Contact')}</TH>
                <TH className="px-3 py-2 text-xs">{t('users.colRole', 'Role')}</TH>
                <TH className="px-3 py-2 text-xs">{t('users.wingTower', 'Wing / Society')}</TH>
                <TH className="px-3 py-2 text-xs">{t('residents.colKyc', 'KYC Status')}</TH>
                <TH className="px-3 py-2 text-xs">{t('users.colStatus', 'Status')}</TH>
                <TH className="px-3 py-2 text-right text-xs">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((item) => {
                const login = statusOf(item);
                return (
                  <TR key={item.id}>
                    <TD className="px-3 py-2">
                      <div className="text-xs font-semibold text-foreground">{item.name}</div>
                      {item.residentType ? <span className="text-[10px] uppercase text-muted-foreground">{item.residentType}</span> : null}
                    </TD>
                    <TD className="px-3 py-2 text-xs text-muted-foreground">
                      {item.phone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</div> : null}
                      {item.email ? <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</div> : null}
                    </TD>
                    <TD className="px-3 py-2"><Badge tone="default" className="rounded-[3px] px-1.5 py-0 text-[10px]">{item.roleName || item.residentType || 'Resident'}</Badge></TD>
                    <TD className="px-3 py-2 text-xs text-muted-foreground">{item.communityName || item.organizationName || EMPTY}</TD>
                    <TD className="px-3 py-2">{kycBadge(item)}</TD>
                    <TD className="px-3 py-2"><Badge tone={login === 'Active' ? 'success' : 'muted'} className="rounded-[3px] px-1.5 py-0 text-[10px]">{login}</Badge></TD>
                    <TD className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">{kycActions(item)}{rowActions(item)}</div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      />

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

      {confirmDelete ? (
        <ConfirmDialog
          open={!!confirmDelete}
          title={t('users.confirmDeleteTitle', 'Delete Person')}
          description={t('users.confirmDeleteDesc', 'Are you sure you want to delete this person? This action cannot be undone.')}
          confirmLabel={t('common.delete')}
          busy={confirmBusy}
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(null)}
        />
      ) : null}

      <RejectKycDialog resident={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload(); }} />
    </PageShell>
  );
}

function RejectKycDialog({ resident, onClose, onDone }: { resident: Resident | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !resident || !reason.trim()) return;
    setBusy(true);
    try {
      if (await tryToast(() => residents.reject(resident.id, reason.trim()), t('residents.rejectedDone', 'Resident application rejected'))) {
        setReason('');
        onDone();
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!resident} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={t('residents.rejectTitle', 'Reject Resident')} description={resident?.name} />
      <div className="flex flex-col gap-2 pt-1">
        <label className="block text-xs font-medium text-foreground">{t('residents.rejectReason', 'Reason for rejection')} *</label>
        <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('residents.rejectReasonPlaceholder', 'e.g. Incomplete KYC document')}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className="h-10 rounded-md text-sm" />
      </div>
      <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-border/70 pt-3.5">
        <Button type="button" variant="outline" onClick={onClose} className="h-9 rounded-md border-border/80 px-4 text-xs font-medium">{t('common.cancel')}</Button>
        <Button type="button" onClick={submit} disabled={busy || !reason.trim()} className="h-9 rounded-md bg-rose-600 px-4 text-xs font-medium text-white hover:bg-rose-700">{t('residents.reject', 'Reject')}</Button>
      </div>
    </Dialog>
  );
}
