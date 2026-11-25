import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Check, X, Search, RefreshCw, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { Table, THead, TBody, TR, TH, TD } from './ui/table';
import { Pagination } from './ui/pagination';
import { Toaster } from './ui/sonner';
import { EntitySelect, type EntityPage } from './EntitySelect';
import { HelpDeskHeader } from '@shared/help-desk/HelpDeskHeader';
import { residents, organizations, communities } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

export const RESIDENT_STATUS_TABS = ['pending', 'draft', 'verified', 'rejected', 'all'] as const;
export type ResidentStatusTab = (typeof RESIDENT_STATUS_TABS)[number];

const fetchOrgPage = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

const makeCommunityFetch = (organizationId?: string) =>
  (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
    communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal })
      .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));

const resolveCommunityLabel = (id: string, signal: AbortSignal) => communities.get(id, { signal }).then((c) => c.name).catch(() => null);
const resolveOrgLabel = (id: string, signal: AbortSignal) => organizations.get(id, { signal }).then((o) => o.name).catch(() => null);

function kycTone(v: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (v === 'verified') return 'success';
  if (v === 'rejected') return 'danger';
  return v === 'draft' ? 'muted' : 'warning';
}

export interface ResidentsManagementViewProps {
  initialStatusTab?: ResidentStatusTab;
  allowedTabs?: readonly ResidentStatusTab[];
  title?: string;
  subtitle?: string;
  mode?: 'admin' | 'mobile';
  showHeader?: boolean;
  onBack?: () => void;
}

export function ResidentsManagementView({
  initialStatusTab = 'pending',
  allowedTabs = RESIDENT_STATUS_TABS,
  title, subtitle, mode = 'admin', showHeader = true, onBack,
}: ResidentsManagementViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const isMobile = mode === 'mobile';

  const [status, setStatus] = useState<ResidentStatusTab>(initialStatusTab);
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 20 : 10);
  const [rejecting, setRejecting] = useState<Resident | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const verificationStatus = status === 'all' ? undefined : status;
  const effectiveCommunityId = filterCommunityId ?? scope.scopedCommunityId ?? undefined;
  const effectiveOrgId = !effectiveCommunityId && scope.showOrgFilter ? filterOrgId ?? undefined : undefined;

  const query = useAsync(
    (signal) => residents.list(
      { search: search.trim() || undefined, page, pageSize },
      { ...(verificationStatus ? { verificationStatus } : {}), ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}), ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}) },
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
      toast.success(t('residents.approved', 'Resident approved successfully'));
      reload();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setActingId(null); }
  };

  const kycLabel = (v: string) =>
    v === 'verified' ? t('residents.verified', 'Verified')
      : v === 'rejected' ? t('residents.rejected', 'Rejected')
      : v === 'draft' ? t('residents.draft', 'Draft')
      : t('residents.pending', 'Pending');

  const pageTitle = title || t('residents.title', 'Residents');
  const pageSubtitle = subtitle || t('residents.subtitle', 'Manage residents and KYC approvals');

  const renderActions = (r: Resident) =>
    r.verificationStatus === 'pending' ? (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          disabled={actingId === r.id}
          onClick={() => approve(r)}
          className="flex h-6 items-center gap-1 px-2 rounded-[3px] bg-emerald-600 text-white text-[10.5px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3 stroke-[2.5]" />
          {t('residents.approve', 'Approve')}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(r)}
          className="flex h-6 items-center gap-1 px-2 rounded-[3px] border border-rose-300 text-rose-600 text-[10.5px] font-medium hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 transition-colors"
        >
          <X className="h-3 w-3 stroke-[2.5]" />
          {t('residents.reject', 'Reject')}
        </button>
      </div>
    ) : (
      <span className="text-[11px] capitalize text-muted-foreground">{r.verificationStatus}</span>
    );

  const content = (
    <div className="w-full space-y-2">
      <Toaster position="top-right" richColors />

      {!isMobile && showHeader && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />{pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">{pageSubtitle}</p>
          </div>
        </div>
      )}

      {/* Tabs & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-0.5 rounded-[4px] bg-muted/60 p-0.5">
            {allowedTabs.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn('h-6 px-2 rounded-[3px] text-[10.5px] font-medium transition-colors', status === s ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
              >
                {t(`residents.tab_${s}`, s.charAt(0).toUpperCase() + s.slice(1))}
              </button>
            ))}
          </div>

          <div className="relative min-w-[130px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('residents.searchPlaceholder', 'Search by name, phone…')}
              className="h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background"
            />
          </div>

          {scope.showOrgFilter && (
            <EntitySelect
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
              value={filterOrgId}
              onChange={(v) => { setFilterOrgId(v); setFilterCommunityId(null); setPage(1); }}
              fetchPage={fetchOrgPage}
              resolveLabel={resolveOrgLabel}
              placeholder={t('residents.filterOrg', 'All Organizations')}
            />
          )}

          {scope.showCommunityFilter && (
            <EntitySelect
              className="w-36 text-xs [&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2"
              value={filterCommunityId}
              onChange={(v) => { setFilterCommunityId(v); setPage(1); }}
              fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('residents.filterCommunity', 'All Communities')}
            />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">{t('orgs.total')}: <span className="font-semibold text-foreground">{query.data?.totalCount ?? 0}</span></span>
          <Button type="button" variant="outline" size="sm" onClick={reload} aria-label="Refresh" className="h-7.5 w-7.5 p-0 rounded-[4px] border-border/80">
            <RefreshCw className={cn('h-3 w-3', query.loading && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* Residents Container */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {query.loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />{t('common.loading', 'Loading…')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="h-6 w-6 text-muted-foreground/50 mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{t('residents.empty', 'No residents found in this category.')}</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className={cn('divide-y divide-border/60', !isMobile && 'md:hidden')}>
              {items.map((r, i) => (
                <div key={r.id} className="p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 text-primary text-xs font-bold">
                        {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-foreground truncate">{r.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">#{(page - 1) * pageSize + i + 1}</span>
                        </div>
                        {showCommunityCol && r.communityName && <span className="block truncate text-[11px] text-muted-foreground">{r.communityName}</span>}
                      </div>
                    </div>
                    <Badge tone={kycTone(r.verificationStatus)} className="text-[10px] px-1.5 py-0 rounded-[3px] shrink-0">
                      <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />{kycLabel(r.verificationStatus)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone ?? '—'}</span>
                    <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{r.email ?? t('residents.noEmail', 'No email')}</span>
                    <Badge tone={r.residentType?.toLowerCase() === 'owner' ? 'info' : 'default'} className="text-[10px] px-1.5 py-0 rounded-[3px]">{r.residentType || 'Resident'}</Badge>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-0.5 border-t border-border/50">{renderActions(r)}</div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            {!isMobile && (
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <THead>
                    <TR className="border-b border-border bg-muted/40">
                      <TH className="w-10 py-1.5 px-2 text-center text-[10.5px] font-semibold">#</TH>
                      <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('residents.colProfile', 'Profile')}</TH>
                      {showCommunityCol && <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('residents.colCommunity', 'Community')}</TH>}
                      <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('residents.colPhone', 'Phone')}</TH>
                      <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('residents.colOwnership', 'Tenancy')}</TH>
                      <TH className="py-1.5 px-2 text-[10.5px] font-semibold">{t('residents.colKyc', 'KYC Status')}</TH>
                      <TH className="w-32 py-1.5 px-2 text-right text-[10.5px] font-semibold">{t('orgs.colActions', 'Actions')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((r, i) => (
                      <TR key={r.id} className="hover:bg-muted/30 transition-colors">
                        <TD className="py-1 px-2 text-center text-[10.5px] text-muted-foreground font-mono">{(page - 1) * pageSize + i + 1}</TD>
                        <TD className="py-1 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 text-primary text-[11px] font-bold">
                              {r.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </span>
                            <div>
                              <span className="font-semibold text-xs text-foreground leading-none">{r.name}</span>
                              <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground leading-none mt-0.5"><Mail className="h-2.5 w-2.5" />{r.email ?? t('residents.noEmail', 'No email')}</span>
                            </div>
                          </div>
                        </TD>
                        {showCommunityCol && <TD className="py-1 px-2 text-xs text-muted-foreground font-medium">{r.communityName ?? '—'}</TD>}
                        <TD className="py-1 px-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone ?? '—'}</span></TD>
                        <TD className="py-1 px-2"><Badge tone={r.residentType?.toLowerCase() === 'owner' ? 'info' : 'default'} className="text-[10px] px-1.5 py-0 rounded-[3px]">{r.residentType || 'Resident'}</Badge></TD>
                        <TD className="py-1 px-2"><Badge tone={kycTone(r.verificationStatus)} className="text-[10px] px-1.5 py-0 rounded-[3px]"><span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />{kycLabel(r.verificationStatus)}</Badge></TD>
                        <TD className="py-1 px-2">{renderActions(r)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </>
        )}

        {(query.data?.totalCount ?? 0) > 0 && (
          <div className="border-t border-border px-2.5 py-1 bg-muted/20">
            <Pagination page={page} pageSize={pageSize} total={query.data?.totalCount ?? 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </div>
        )}
      </div>

      <RejectDialog resident={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload(); }} />
    </div>
  );

  if (isMobile) {
    return (
      <div className="mx-auto flex h-[100dvh] flex-col overflow-hidden bg-background">
        <HelpDeskHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          mode="mobile"
          showBack
          onBack={onBack ?? (() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home')))}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {content}
        </div>
      </div>
    );
  }

  return content;
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
      toast.success(t('residents.rejectedDone', 'Resident application rejected'));
      setReason('');
      onDone();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!resident} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={t('residents.rejectTitle', 'Reject Resident')} description={resident?.name} />
      <div className="flex flex-col gap-2 pt-1">
        <label className="block text-xs font-medium text-foreground">{t('residents.rejectReason', 'Reason for rejection')} *</label>
        <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('residents.rejectReasonPlaceholder', 'e.g. Incomplete KYC document')} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} className="h-9 text-xs rounded-[4px]" />
      </div>
      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">{t('orgs.cancel', 'Cancel')}</Button>
        <Button type="button" onClick={submit} disabled={busy || !reason.trim()} className="h-8.5 px-4 rounded-[4px] text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white">{t('residents.reject', 'Reject')}</Button>
      </div>
    </Dialog>
  );
}
