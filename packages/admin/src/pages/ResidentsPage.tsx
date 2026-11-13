import { useMemo, useState } from 'react';
import { Users, Check, X, Search, RefreshCw, Mail, Phone, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { Toaster } from '@shared/components/ui/sonner';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { residents, organizations, communities } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}
function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}
async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const c = await communities.get(id, { signal }); return c.name; } catch { return null; }
}
async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try { const o = await organizations.get(id, { signal }); return o.name; } catch { return null; }
}

const STATUS_TABS = ['pending', 'draft', 'verified', 'rejected', 'all'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function kycTone(v: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (v === 'verified') return 'success';
  if (v === 'rejected') return 'danger';
  if (v === 'draft') return 'muted';
  return 'warning';
}

export function ResidentsPage() {
  const { t } = useTranslation();
  const scope = useScope();
  const [status, setStatus] = useState<StatusTab>('pending');
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const isSmall = useIsSmallScreen();
  const effectiveView = isSmall ? 'cards' : view;
  const [rejecting, setRejecting] = useState<Resident | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const verificationStatus = status === 'all' ? undefined : status;
  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const effectiveOrgId = !effectiveCommunityId && scope.showOrgFilter ? filterOrgId ?? undefined : undefined;

  const query = useAsync(
    (signal) => residents.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(verificationStatus ? { verificationStatus } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, status, effectiveCommunityId, effectiveOrgId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const showCommunityCol = !scope.scopedCommunityId && scope.canViewCommunity;
  const reload = () => setReloadKey((k) => k + 1);

  const approve = async (r: Resident) => {
    setActingId(r.id);
    try {
      await residents.verify(r.id);
      toast.success(t('residents.approved'));
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setActingId(null);
    }
  };

  const kycLabel = (v: string) =>
    v === 'verified' ? t('residents.verified')
      : v === 'rejected' ? t('residents.rejected')
      : v === 'draft' ? t('residents.draft')
      : t('residents.pending');

  const StatusBadge = ({ v }: { v: string }) => (
    <Badge tone={kycTone(v)}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{kycLabel(v)}</Badge>
  );

  const Actions = ({ r }: { r: Resident }) =>
    r.verificationStatus === 'pending' ? (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" disabled={actingId === r.id} onClick={() => approve(r)} className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          <Check className="h-4 w-4" />{t('residents.approve')}
        </button>
        <button type="button" onClick={() => setRejecting(r)} className="flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40">
          <X className="h-4 w-4" />{t('residents.reject')}
        </button>
      </div>
    ) : (
      <span className="text-xs capitalize text-muted-foreground">{r.verificationStatus}</span>
    );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="relative overflow-hidden rounded-2xl p-0">
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
        <div className="flex items-center gap-3 py-3.5 pl-4 pr-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">{t('residents.title')}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('residents.subtitle')}</p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatus(s); setPage(1); }}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', status === s ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {t(`residents.tab_${s}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('residents.searchPlaceholder')} className="h-9 max-w-xs pl-9 text-sm" />
          </div>
          {scope.showOrgFilter ? (
            <EntitySelect
              className="w-44"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('residents.filterOrg')}
            />
          ) : null}
          {scope.showCommunityFilter ? (
            <EntitySelect
              className="w-44"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('residents.filterCommunity')}
            />
          ) : null}
          <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
            <button type="button" onClick={() => setView('table')} aria-label="Table view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <TableIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setView('cards')} aria-label="Card view" className={`flex h-7 w-7 items-center justify-center rounded-md ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={reload} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-emerald-600">
            <RefreshCw className={`h-4 w-4 ${query.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query.loading ? t('common.loading') : t('residents.empty')}
        </Card>
      ) : effectiveView === 'table' ? (
        <Card className="overflow-hidden rounded-2xl p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-14 text-center">#</TH>
                <TH>{t('residents.colProfile')}</TH>
                {showCommunityCol ? <TH className="w-44">{t('residents.colCommunity')}</TH> : null}
                <TH className="w-40">{t('residents.colPhone')}</TH>
                <TH className="w-32">{t('residents.colOwnership')}</TH>
                <TH className="w-36">{t('residents.colKyc')}</TH>
                <TH className="w-44 text-right">{t('orgs.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r, i) => (
                <TR key={r.id}>
                  <TD className="text-center text-[11px] text-muted-foreground">{(page - 1) * pageSize + i + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                        {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{r.name}</div>
                        <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <Mail className="h-3 w-3" />{r.email ?? t('residents.noEmail')}
                        </div>
                      </div>
                    </div>
                  </TD>
                  {showCommunityCol ? <TD className="text-[11px] text-muted-foreground">{r.communityName ?? '—'}</TD> : null}
                  <TD className="text-xs font-medium"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />{r.phone ?? '—'}</span></TD>
                  <TD><Badge tone={r.residentType?.toLowerCase() === 'owner' ? 'info' : 'default'}>{r.residentType || 'Resident'}</Badge></TD>
                  <TD><StatusBadge v={r.verificationStatus} /></TD>
                  <TD><Actions r={r} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
                    {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.name}</div>
                    {showCommunityCol ? <div className="truncate text-[11px] text-muted-foreground">{r.communityName ?? '—'}</div> : null}
                  </div>
                </div>
                <StatusBadge v={r.verificationStatus} />
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{r.email ?? t('residents.noEmail')}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{r.phone ?? '—'}</span>
                <Badge tone={r.residentType?.toLowerCase() === 'owner' ? 'info' : 'default'}>{r.residentType || 'Resident'}</Badge>
              </div>
              <div className="flex items-center justify-end border-t border-border pt-3"><Actions r={r} /></div>
            </Card>
          ))}
        </div>
      )}

      {(query.data?.totalCount ?? 0) > 0 ? (
        <Card className="rounded-xl p-1">
          <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      ) : null}

      <RejectDialog resident={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload(); }} />

      <Toaster position="top-center" richColors />
    </div>
  );
}

function RejectDialog({ resident, onClose, onDone }: { resident: Resident | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !resident || !reason.trim()) return;
    setBusy(true);
    try {
      await residents.reject(resident.id, reason.trim());
      toast.success(t('residents.rejectedDone'));
      setReason('');
      onDone();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!resident} onClose={onClose}>
      <DialogHeader title={t('residents.rejectTitle')} description={resident?.name} />
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('residents.rejectReason')}</label>
      <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('residents.rejectReasonPlaceholder')} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !reason.trim()} className="h-9 rounded-lg bg-rose-600 text-xs hover:bg-rose-700">{t('residents.reject')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
