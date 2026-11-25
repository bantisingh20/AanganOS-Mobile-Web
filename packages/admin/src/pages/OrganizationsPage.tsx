import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Pencil, Trash2, Search, RefreshCw, CalendarClock, Building, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { organizations, subscriptions } from '@shared/services';
import type { Organization } from '@shared/api/organizations';
import type { RenewalRequest } from '@shared/api/subscriptions';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';
import { OrgFormDialog } from './orgs/OrgFormDialog';
import { SetExpiryDialog } from './orgs/SetExpiryDialog';
import { PLAN_OPTIONS, TYPE_OPTIONS, typeLabel, typeTone, fmtDate, SubBadge } from './orgs/orgConstants';

export function OrganizationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [expiryOrg, setExpiryOrg] = useState<Organization | null>(null);
  const [approveReq, setApproveReq] = useState<RenewalRequest | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<Organization | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const orgQuery = useAsync(
    (signal) => organizations.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  const renewalsQuery = useAsync(
    (signal) => subscriptions.pendingRenewals({ signal }).catch(() => [] as RenewalRequest[]),
    [reloadKey],
  );

  const items = useMemo(() => orgQuery.data?.items ?? [], [orgQuery.data]);
  const renewals = renewalsQuery.data ?? [];
  const reload = () => setReloadKey((k) => k + 1);

  const doActivate = async () => {
    if (!confirmActivate || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await organizations.activate(confirmActivate.id);
      toast.success(t('orgs.activated'));
      setConfirmActivate(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await organizations.remove(confirmDelete.id);
      toast.success(t('orgs.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setConfirmBusy(false); }
  };

  const renderActions = (org: Organization) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setExpiryOrg(org)}
        title={t('orgs.setExpiry')}
        className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
      >
        <CalendarClock className="h-3 w-3" />
      </button>
      {!org.hasActiveAdmin && (
        <button
          type="button"
          onClick={() => setConfirmActivate(org)}
          title={t('orgs.activate')}
          className="flex h-6 items-center gap-1 px-1.5 rounded-[3px] border border-emerald-500/40 text-[10.5px] font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3" />
          {t('orgs.activate')}
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(org)}
        title={t('orgs.edit')}
        className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(org)}
        title={t('orgs.delete')}
        className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {/* Page Header: Compact Title & Action Button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            {t('admin.nav.organizations')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {t('orgs.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-7 px-2.5 gap-1 rounded-[4px] text-[11px] font-medium"
          >
            <Plus className="h-3 w-3 stroke-[2.5]" />
            {t('orgs.add')}
          </Button>
        </div>
      </div>

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
                <span className="text-muted-foreground ml-2 text-[11px]">({r.requestedPlanMonths} mos) · {fmtDate(r.requestedAtUtc)}</span>
              </div>
              <Button size="sm" onClick={() => setApproveReq(r)} className="h-6.5 text-[11px] px-2 rounded-md">
                {t('orgs.reviewSetDate')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar: Clean Alignment & Compact Sizing */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="relative min-w-[140px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('orgs.searchPlaceholder')}
              className="h-7.5 w-full rounded-md pl-7 pr-2 text-[11px] bg-background"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('orgs.total')}: <span className="font-semibold text-foreground">{orgQuery.data?.totalCount ?? 0}</span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reload}
            aria-label="Refresh"
            className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80"
          >
            <RefreshCw className={cn('h-3 w-3', orgQuery.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Organizations Container: Table on Desktop/Tablet, Clean Compact Cards on Mobile */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {orgQuery.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Building2 className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('orgs.empty')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Add your first organization to begin managing societies.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Compact Cards (hidden on md and up) */}
            <div className="divide-y divide-border/60 md:hidden">
              {items.map((org, i) => (
                <div key={org.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building2 className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground truncate">{org.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                        </div>
                        <span className="block font-mono text-[9px] text-muted-foreground leading-tight">ID: {org.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {org.hasActiveAdmin ? (
                        <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">
                          <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
                          {t('orgs.active')}
                        </Badge>
                      ) : (
                        <Badge tone="warning" className="text-[10px] px-1.5 py-0 rounded">
                          <span className="h-1 w-1 rounded-full bg-amber-500 mr-1" />
                          {t('orgs.pendingApproval')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={typeTone(org.propertyType)} className="text-[10px] px-1.5 py-0 rounded">
                      {typeLabel(org.propertyType)}
                    </Badge>
                    <SubBadge sub={org.expiryData} />
                    <button
                      type="button"
                      onClick={() => navigate(`/communities?organizationId=${org.id}`)}
                      className="inline-flex items-center gap-1 rounded-[3px] border border-border/80 bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:bg-accent"
                    >
                      <Building className="h-3 w-3 text-primary" />
                      {t('orgs.communityCount', { count: org.communityCount })}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/50 mt-0.5">
                    <span className="text-[10.5px] text-muted-foreground">
                      {org.communityCount} {t('communities.title')}
                    </span>
                    {renderActions(org)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Compact Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
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
                      <TD className="py-1 px-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/communities?organizationId=${org.id}`)}
                          className="inline-flex items-center gap-1 rounded-[3px] border border-border/80 bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:bg-accent"
                        >
                          <Building className="h-3 w-3 text-primary" />
                          {t('orgs.communityCount', { count: org.communityCount })}
                        </button>
                      </TD>
                      <TD className="py-1 px-2">
                        {org.hasActiveAdmin ? (
                          <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 mr-1" />
                            {t('orgs.active')}
                          </Badge>
                        ) : (
                          <Badge tone="warning" className="text-[10px] px-1.5 py-0 rounded">
                            <span className="h-1 w-1 rounded-full bg-amber-500 mr-1" />
                            {t('orgs.pendingApproval')}
                          </Badge>
                        )}
                      </TD>
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
            </div>
          </>
        )}

        {/* Integrated Pagination Bar */}
        {(orgQuery.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={orgQuery.data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

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
    </div>
  );
}
