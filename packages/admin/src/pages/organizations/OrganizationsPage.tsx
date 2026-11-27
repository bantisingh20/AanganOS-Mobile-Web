import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Pencil, Trash2, CalendarClock, Building, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { PageShell, FilterBar, DataList } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { organizations, subscriptions } from '@shared/services';
import { cacheInvalidate } from '@shared/lib/cache';
import type { Organization } from '@shared/api/organizations';
import type { RenewalRequest } from '@shared/api/subscriptions';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useListState } from '@shared/lib/hooks/useListState';
import { tryToast } from '@shared/lib/withToast';
import { formatDate } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { OrgFormDialog } from './OrgFormDialog';
import { SetExpiryDialog } from './SetExpiryDialog';
import { PLAN_OPTIONS, TYPE_OPTIONS, typeLabel, typeTone, SubBadge } from './orgConstants';

export function OrganizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const compact = useIsCompact();
  const list = useListState();
  const { search, page, pageSize, reloadKey } = list;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [expiryOrg, setExpiryOrg] = useState<Organization | null>(null);
  const [approveReq, setApproveReq] = useState<RenewalRequest | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<Organization | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const orgQuery = useAsync(
    (signal) => organizations.list({ search: search.trim() || undefined, page, pageSize }, { signal, forceRefresh: true }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  const renewalsQuery = useAsync(
    (signal) => subscriptions.pendingRenewals({ signal }).catch(() => [] as RenewalRequest[]),
    [reloadKey],
  );

  const items = useMemo(() => orgQuery.data?.items ?? [], [orgQuery.data]);
  const renewals = renewalsQuery.data ?? [];
  const reload = () => {
    cacheInvalidate('org');
    list.reload();
  };

  const doActivate = async () => {
    if (!confirmActivate || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => organizations.activate(confirmActivate.id), t('orgs.activated'))) {
        setConfirmActivate(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => organizations.remove(confirmDelete.id), t('orgs.deleted'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally { setConfirmBusy(false); }
  };

  const total = orgQuery.data?.totalCount ?? 0;
  const actionSize = compact ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded-[3px]';
  const iconSize = compact ? 'h-4 w-4' : 'h-3 w-3';

  const renderActions = (org: Organization) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setExpiryOrg(org)}
        title={t('orgs.setExpiry')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors', actionSize)}
      >
        <CalendarClock className={iconSize} />
      </button>
      {!org.hasActiveAdmin && (
        <button
          type="button"
          onClick={() => setConfirmActivate(org)}
          title={t('orgs.activate')}
          className={cn('flex items-center gap-1 border border-emerald-500/40 font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors',
            compact ? 'h-9 rounded-lg px-2.5 text-xs' : 'h-6 rounded-[3px] px-1.5 text-[10.5px]')}
        >
          <CheckCircle2 className={iconSize} />
          {t('orgs.activate')}
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(org)}
        title={t('orgs.edit')}
        className={cn('flex items-center justify-center border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors', actionSize)}
      >
        <Pencil className={iconSize} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(org)}
        title={t('orgs.delete')}
        className={cn('flex items-center justify-center border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors', actionSize)}
      >
        <Trash2 className={iconSize} />
      </button>
    </div>
  );

  const statusBadge = (org: Organization) => (org.hasActiveAdmin ? (
    <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">
      <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
      {t('orgs.active')}
    </Badge>
  ) : (
    <Badge tone="warning" className="text-[10px] px-1.5 py-0 rounded">
      <span className="h-1 w-1 rounded-full bg-amber-500 mr-1" />
      {t('orgs.pendingApproval')}
    </Badge>
  ));

  const communitiesButton = (org: Organization) => (
    <button
      type="button"
      onClick={() => navigate(`/communities?organizationId=${org.id}`)}
      className={cn('inline-flex items-center gap-1 border border-border/80 bg-muted/50 font-medium text-foreground hover:bg-accent',
        compact ? 'h-9 rounded-lg px-2.5 text-xs' : 'rounded-[3px] px-2 py-0.5 text-[10.5px]')}
    >
      <Building className={cn(iconSize, 'text-primary')} />
      {t('orgs.communityCount', { count: org.communityCount })}
    </button>
  );

  return (
    <PageShell
      className="w-full"
      title={t('admin.nav.organizations')}
      subtitle={t('orgs.subtitle')}
      icon={<Building2 />}
      actions={(
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className={cn('gap-1 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 rounded-[4px] text-[11px]')}
        >
          <Plus className="h-3 w-3 stroke-[2.5]" />
          {t('orgs.add')}
        </Button>
      )}
    >
      {/* Pending Renewals Alert Banner */}
      {renewals.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-500/10 p-2 space-y-1.5">
          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            {t('orgs.pendingRenewals')} ({renewals.length})
          </div>
          {renewals.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-background/80 px-2 py-1 text-xs">
              <div>
                <span className="font-semibold text-xs text-foreground">{r.organizationName}</span>
                <span className="text-muted-foreground ml-2 text-[11px]">({r.requestedPlanMonths} mos) · {formatDate(r.requestedAtUtc)}</span>
              </div>
              <Button size="sm" onClick={() => setApproveReq(r)} className={cn('px-2 rounded-md', compact ? 'h-9 text-xs' : 'h-6.5 text-[11px]')}>
                {t('orgs.reviewSetDate')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <FilterBar
        search={{ value: search, onChange: list.setSearch, placeholder: t('orgs.searchPlaceholder') }}
        trailing={(
          <>
            <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('orgs.total')}: <span className="font-semibold text-foreground">{total}</span>
            </span>
            <RefreshButton onClick={reload} loading={orgQuery.loading} />
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(org) => org.id}
        loading={orgQuery.loading}
        emptyIcon={<Building2 className="h-6 w-6 text-muted-foreground/50" />}
        emptyText={(
          <>
            {t('orgs.empty')}
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              Add your first organization to begin managing societies.
            </span>
          </>
        )}
        pagination={{ page, pageSize, total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        renderCard={(org, i) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{org.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                  </div>
                  <span className="block font-mono text-xs text-muted-foreground">ID: {org.id.slice(0, 8)}</span>
                </div>
              </div>
              <div className="shrink-0">{statusBadge(org)}</div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={typeTone(org.propertyType)} className="text-[10px] px-1.5 py-0 rounded">
                {typeLabel(org.propertyType)}
              </Badge>
              <SubBadge sub={org.expiryData} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {communitiesButton(org)}
              {renderActions(org)}
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR className="border-b border-border bg-muted/40">
                <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('orgs.colOrganization')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('orgs.colType')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('orgs.colCommunities')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('orgs.colStatus')}</TH>
                <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('orgs.colSubscription')}</TH>
                <TH className="w-28 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((org, i) => (
                <TR key={org.id} className="hover:bg-muted/30 transition-colors">
                  <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">
                    {(page - 1) * pageSize + i + 1}
                  </TD>
                  <TD className="py-1 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building2 className="h-3 w-3" />
                      </span>
                      <div>
                        <span className="font-semibold text-xs text-foreground leading-none">{org.name}</span>
                        <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">ID: {org.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </TD>
                  <TD className="py-1 px-2">
                    <Badge tone={typeTone(org.propertyType)} className="text-[10px] px-1.5 py-0 rounded">
                      {typeLabel(org.propertyType)}
                    </Badge>
                  </TD>
                  <TD className="py-1 px-2">{communitiesButton(org)}</TD>
                  <TD className="py-1 px-2">{statusBadge(org)}</TD>
                  <TD className="py-1 px-2">
                    <SubBadge sub={org.expiryData} />
                  </TD>
                  <TD className="py-1 px-2">
                    {renderActions(org)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <OrgFormDialog open={creating} typeOptions={TYPE_OPTIONS} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <OrgFormDialog open={!!editing} org={editing} typeOptions={TYPE_OPTIONS} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />

      <SetExpiryDialog
        open={!!expiryOrg || !!approveReq}
        org={expiryOrg ?? (approveReq ? { id: approveReq.organizationId, name: approveReq.organizationName, hasActiveAdmin: true, communityCount: 0 } as Organization : null)}
        current={expiryOrg?.expiryData ?? null}
        planOptions={PLAN_OPTIONS}
        isApprovalRequired={!!approveReq}
        request={approveReq}
        onClose={() => { setExpiryOrg(null); setApproveReq(null); }}
        onSaved={() => { setExpiryOrg(null); setApproveReq(null); reload(); }}
      />

      <ConfirmDialog
        open={!!confirmActivate}
        title={t('orgs.activateTitle')}
        description={confirmActivate ? t('orgs.activateConfirm', { name: confirmActivate.name }) : ''}
        confirmLabel={t('orgs.activate')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doActivate}
        onClose={() => setConfirmActivate(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('orgs.deleteTitle')}
        description={confirmDelete ? t('orgs.deleteConfirm', { name: confirmDelete.name }) : ''}
        confirmLabel={t('orgs.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </PageShell>
  );
}
