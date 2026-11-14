import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Pencil, Trash2, Search, RefreshCw, CalendarClock, Building, CheckCircle2, LayoutGrid, Table as TableIcon } from 'lucide-react';
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
import { organizations, subscriptions } from '@shared/services';
import type { Organization } from '@shared/api/organizations';
import type { SubscriptionStatus, RenewalRequest } from '@shared/api/subscriptions';
// import type { Community } from '@shared/api/communities';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { toFormError } from '@shared/api/errors';

const PLAN_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '9', label: '9 months' },
  { value: '12', label: '12 months' },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;

  const orgQuery = useAsync(
    (signal) => organizations.list({ search: search.trim() || undefined, page, pageSize }, { signal }).catch(() => null),
    [search, page, pageSize, reloadKey],
  );
  // const commQuery = useAsync(
  //   (signal) => communities.list({ pageSize: 200 }, {}, { signal }).catch(() => null),
  //   [reloadKey],
  // );
  const renewalsQuery = useAsync(
    (signal) => subscriptions.pendingRenewals({ signal }).catch(() => [] as RenewalRequest[]),
    [reloadKey],
  );

  const items = useMemo(() => orgQuery.data?.items ?? [], [orgQuery.data]);
  const orgIds = useMemo(() => items.map((o) => o.id).join(','), [items]);

  const subsQuery = useAsync(async (signal) => {
    const ids = orgIds ? orgIds.split(',') : [];
    const results = await Promise.all(ids.map((id) => subscriptions.byOrg(id, { signal }).catch(() => null)));
    const map = new Map<string, SubscriptionStatus>();
    results.forEach((s, i) => { if (s) map.set(ids[i]!, s); });
    return map;
  }, [orgIds]);
  const subByOrg = subsQuery.data ?? new Map<string, SubscriptionStatus>();

  // const commCountByOrg = useMemo(() => {
  //   const m = new Map<string, number>();
  //   (commQuery.data?.items ?? []).forEach((c: Community) => m.set(c.organizationId, (m.get(c.organizationId) ?? 0) + 1));
  //   return m;
  // }, [commQuery.data]);

  const renewals = renewalsQuery.data ?? [];
  const reload = () => setReloadKey((k) => k + 1);

  const [confirmActivate, setConfirmActivate] = useState<Organization | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const doActivate = async () => {
    if (!confirmActivate || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await organizations.activate(confirmActivate.id);
      toast.success(t('orgs.activated'));
      setConfirmActivate(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await organizations.remove(confirmDelete.id);
      toast.success(t('orgs.deleted'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 pl-4 pr-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{t('admin.nav.organizations')}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('orgs.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setCreating(true)} className="h-9 gap-1.5 rounded-xl bg-emerald-600 text-xs hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            {t('orgs.add')}
          </Button>
        </div>
      </Card>

      {renewals.length > 0 ? (
        <Card className="overflow-hidden rounded-2xl border-amber-200 bg-amber-50 p-0">
          <div className="border-b border-amber-200/60 px-4 py-2.5 text-xs font-semibold text-amber-700">
            {t('orgs.pendingRenewals')} ({renewals.length})
          </div>
          <div className="divide-y divide-amber-100">
            {renewals.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{r.organizationName}</div>
                  <div className="text-[11px] text-muted-foreground">{t('orgs.requestedPlan', { months: r.requestedPlanMonths })} · {fmtDate(r.requestedAtUtc)}</div>
                </div>
                <Button onClick={() => setApproveReq(r)} className="h-8 rounded-lg bg-emerald-600 text-[11px] hover:bg-emerald-700">{t('orgs.reviewSetDate')}</Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('orgs.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="pr-1 text-[11px] font-medium text-muted-foreground">
            {t('orgs.total')}: <span className="text-foreground">{orgQuery.data?.totalCount ?? 0}</span>
          </span>
          <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
            <button type="button" onClick={() => setView('table')} aria-label="Table view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <TableIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setView('cards')} aria-label="Card view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={reload} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
            <RefreshCw className={`h-4 w-4 ${orgQuery.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {orgQuery.loading ? t('common.loading') : t('orgs.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('orgs.colOrganization')}</TH>
                <TH className="w-40">{t('orgs.colCommunities')}</TH>
                <TH className="w-36">{t('orgs.colStatus')}</TH>
                <TH className="w-40">{t('orgs.colSubscription')}</TH>
                <TH className="w-52 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((org, i) => {
                const sub = subByOrg.get(org.id);
                // const count = 9;
                return (
                  <TR key={org.id}>
                    <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">{org.name}</div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">ID: {org.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </TD>
                    <TD><CommunitiesPill count={org.communityCount} onClick={() => navigate(`/communities?organizationId=${org.id}`)} /></TD>
                    <TD><StatusBadge org={org} /></TD>
                    <TD><SubBadge sub={sub} /></TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1.5">
                        <OrgActions org={org} onExpiry={() => setExpiryOrg(org)} onEdit={() => setEditing(org)} onDelete={() => setConfirmDelete(org)} onActivate={() => setConfirmActivate(org)} />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((org) => {
            const sub = subByOrg.get(org.id);
            // const count =commCou ntByOrg.get(org.id) ?? 0;
            return (
              <Card key={org.id} className="flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{org.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">ID: {org.id.slice(0, 8)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge org={org} />
                  <SubBadge sub={sub} />
                  <CommunitiesPill count={org.communityCount} onClick={() => navigate(`/communities?organizationId=${org.id}`)} />
                </div>
                <div className="flex items-center justify-end gap-1.5 border-t border-border pt-3">
                  <OrgActions org={org} onExpiry={() => setExpiryOrg(org)} onEdit={() => setEditing(org)} onDelete={() => setConfirmDelete(org)} onActivate={() => setConfirmActivate(org)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(orgQuery.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={orgQuery.data?.totalCount ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </Card>
      ) : null}

      <OrgFormDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />
      <OrgFormDialog open={!!editing} org={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      <SetExpiryDialog open={!!expiryOrg} org={expiryOrg} current={expiryOrg ? subByOrg.get(expiryOrg.id) ?? null : null} onClose={() => setExpiryOrg(null)} onSaved={() => { setExpiryOrg(null); reload(); }} />
      <ApproveRenewalDialog open={!!approveReq} request={approveReq} onClose={() => setApproveReq(null)} onSaved={() => { setApproveReq(null); reload(); }} />

      <ConfirmDialog
        open={!!confirmActivate}
        title={t('orgs.activate')}
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

      <Toaster position="top-center" richColors />
    </div>
  );
}

function CommunitiesPill({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500 hover:text-emerald-600"
    >
      <Building className="h-3 w-3" />
      {t('orgs.communityCount', { count })}
    </button>
  );
}

function StatusBadge({ org }: { org: Organization }) {
  const { t } = useTranslation();
  return org.hasActiveAdmin ? (
    <Badge tone="success"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('orgs.active')}</Badge>
  ) : (
    <Badge tone="warning"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t('orgs.pendingApproval')}</Badge>
  );
}

function SubBadge({ sub }: { sub: SubscriptionStatus | undefined }) {
  const { t } = useTranslation();
  if (!sub || !sub.hasSubscription) return <Badge tone="muted">{t('orgs.notSet')}</Badge>;
  if (sub.isExpired) return <Badge tone="danger">{t('orgs.expired')}</Badge>;
  if (sub.isExpiringSoon) return <Badge tone="warning">{t('orgs.daysLeft', { days: sub.daysRemaining })}</Badge>;
  return <Badge tone="success">{t('orgs.activeDays', { days: sub.daysRemaining })}</Badge>;
}

function OrgActions({ org, onExpiry, onEdit, onDelete, onActivate }: { org: Organization; onExpiry: () => void; onEdit: () => void; onDelete: () => void; onActivate: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" onClick={onExpiry} title={t('orgs.setExpiry')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
        <CalendarClock className="h-4 w-4" />
      </button>
      {!org.hasActiveAdmin ? (
        <button type="button" onClick={onActivate} title={t('orgs.activate')} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-500/40 px-2 text-[11px] font-medium text-emerald-600 hover:border-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          {t('orgs.activate')}
        </button>
      ) : null}
      <button type="button" onClick={onEdit} title={t('orgs.edit')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:border-emerald-500">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={onDelete} title={t('orgs.delete')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50">
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );
}

function OrgFormDialog({ open, org, onClose, onSaved }: { open: boolean; org?: Organization | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!org;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(org?.name ?? '');
  }, [open, org]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      if (isEdit) await organizations.update(org!.id, name.trim());
      else await organizations.create(name.trim());
      toast.success(isEdit ? t('orgs.updated') : t('orgs.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={isEdit ? t('orgs.editTitle') : t('orgs.addTitle')} />
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('orgs.orgName')}</label>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('orgs.orgNamePlaceholder')} maxLength={256} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !name.trim()} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{isEdit ? t('orgs.saveChanges') : t('orgs.createOrg')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function defaultExpiry(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function SetExpiryDialog({ open, org, current, onClose, onSaved }: { open: boolean; org?: Organization | null; current: SubscriptionStatus | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const initialMonths = current?.planMonths && current.planMonths > 0 ? String(current.planMonths) : '12';
  const [planMonths, setPlanMonths] = useState(initialMonths);
  const [expiresAt, setExpiresAt] = useState(current?.expiresAtUtc ? current.expiresAtUtc.slice(0, 10) : defaultExpiry(Number(initialMonths)));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !org || !expiresAt) return;
    setBusy(true);
    try {
      await subscriptions.setExpiry({
        organizationId: org.id,
        planMonths: Number(planMonths),
        startsAtUtc: new Date().toISOString(),
        expiresAtUtc: new Date(expiresAt).toISOString(),
      });
      toast.success('Subscription updated');
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={t('orgs.setExpiryTitle')} description={org?.name} />
      <div className="flex flex-col gap-3">
        <SelectField label={t('orgs.planDuration')} value={planMonths} options={PLAN_OPTIONS} onChange={setPlanMonths} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('orgs.expiryDate')}</label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('orgs.save')}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function ApproveRenewalDialog({ open, request, onClose, onSaved }: { open: boolean; request?: RenewalRequest | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const initialMonths = request ? String(request.requestedPlanMonths) : '12';
  const [planMonths, setPlanMonths] = useState(initialMonths);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry(Number(initialMonths)));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !request || !expiresAt) return;
    setBusy(true);
    try {
      await subscriptions.approveRenewal(request.id, {
        planMonths: Number(planMonths),
        startsAtUtc: new Date().toISOString(),
        expiresAtUtc: new Date(expiresAt).toISOString(),
      });
      toast.success('Renewal approved');
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={t('orgs.approveTitle')} description={request?.organizationName} />
      <div className="flex flex-col gap-3">
        <SelectField label={t('orgs.planDuration')} value={planMonths} options={PLAN_OPTIONS} onChange={setPlanMonths} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('orgs.newExpiryDate')}</label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('orgs.approve')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
