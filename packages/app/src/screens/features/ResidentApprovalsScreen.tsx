import { useCallback, useMemo, useState } from 'react';
import { Check, X, Search, Phone, Mail, Home, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageLayout } from '@app/components/PageLayout';
import { Badge } from '@shared/components/ui/badge';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { residents } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

type ApprovalTab = 'pending' | 'verified' | 'rejected' | 'all';

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function ResidentApprovalsScreen() {
  const { t } = useTranslation();
  const scope = useScope();
  const [tab, setTab] = useState<ApprovalTab>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [actingId, setActingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Resident | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingBusy, setRejectingBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveCommunityId = scope.scopedCommunityId ?? undefined;
  const verificationStatus = tab === 'all' ? undefined : tab;

  const query = useAsync(
    (signal) => residents.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(verificationStatus ? { verificationStatus } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, tab, effectiveCommunityId, page, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const approve = async (r: Resident) => {
    setActingId(r.id);
    try {
      await residents.verify(r.id);
      toast.success(t('residents.approved', 'Resident verified successfully'));
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setActingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting || !rejectReason.trim() || rejectingBusy) return;
    setRejectingBusy(true);
    try {
      await residents.reject(rejecting.id, rejectReason.trim());
      toast.success(t('residents.rejectedDone', 'Resident rejected'));
      setRejecting(null);
      setRejectReason('');
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setRejectingBusy(false);
    }
  };

  return (
    <PageLayout
      title={t('residentApprovals.title', 'Resident Approvals')}
      subtitle={t('residentApprovals.subtitle', 'Review and verify pending resident KYC')}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Status Filter Tabs */}
        <div className="flex rounded-full bg-muted p-1">
          {[
            { id: 'pending', label: 'Pending' },
            { id: 'verified', label: 'Verified' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'all', label: 'All' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setTab(item.id as ApprovalTab); setPage(1); }}
              className={cn(
                'flex-1 rounded-full py-1.5 text-xs font-bold transition-all',
                tab === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by resident name or phone…"
            className="h-10 w-full rounded-2xl bg-card border border-border/60 pl-9 pr-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        {/* Residents List */}
        {query.loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('common.loading', 'Loading approvals…')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <UserCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">
              {tab === 'pending' ? 'No pending approvals' : 'No records found'}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {tab === 'pending'
                ? 'All resident KYC requests have been reviewed.'
                : 'Try selecting a different status filter above.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((r) => {
              const isPending = r.verificationStatus === 'pending';
              const isVerified = r.verificationStatus === 'verified';
              const isRejected = r.verificationStatus === 'rejected';

              return (
                <article
                  key={r.id}
                  className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm border border-border/60 hover:border-primary/40 transition-all"
                >
                  {/* Top: Avatar + Name + Status */}
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-sm',
                        isPending ? 'bg-amber-500/10 text-amber-600' : isVerified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials(r.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-[15px] font-extrabold text-foreground">{r.name}</span>
                        <Badge tone={r.residentType?.toLowerCase() === 'owner' ? 'info' : 'default'}>
                          {r.residentType || 'Resident'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {r.communityName ? (
                          <span className="inline-flex items-center gap-1">
                            <Home className="h-3 w-3 text-primary" /> {r.communityName}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0',
                        isPending && 'bg-amber-500/10 text-amber-600',
                        isVerified && 'bg-emerald-500/10 text-emerald-600',
                        isRejected && 'bg-rose-500/10 text-rose-600',
                        !isPending && !isVerified && !isRejected && 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isPending && 'bg-amber-500',
                          isVerified && 'bg-emerald-500',
                          isRejected && 'bg-rose-500',
                          !isPending && !isVerified && !isRejected && 'bg-muted-foreground',
                        )}
                      />
                      {r.verificationStatus ? r.verificationStatus.charAt(0).toUpperCase() + r.verificationStatus.slice(1) : 'Unknown'}
                    </span>
                  </div>

                  {/* Contact Row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-foreground hover:text-primary transition-colors">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{r.phone}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">No phone</span>
                    )}

                    {r.email ? (
                      <span className="flex items-center gap-1 truncate text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="truncate">{r.email}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Actions Row (Approve / Reject for Pending) */}
                  {isPending ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => { setRejecting(r); setRejectReason(''); }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-rose-300 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 active:scale-95 transition-all dark:border-rose-800 dark:hover:bg-rose-950/40"
                      >
                        <X className="h-4 w-4" /> {t('residents.reject', 'Reject')}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === r.id}
                        onClick={() => approve(r)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {t('residents.approve', 'Approve KYC')}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)}>
        <DialogHeader
          title={t('residents.rejectTitle', 'Reject Resident KYC')}
          description={rejecting?.name}
        />
        <div className="py-2">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            {t('residents.rejectReason', 'Reason for rejection *')}
          </label>
          <Input
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Identity document unreadable or mismatched"
            className="h-9 text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') confirmReject(); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejecting(null)} className="h-9 rounded-xl text-xs">
            {t('orgs.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={confirmReject}
            disabled={rejectingBusy || !rejectReason.trim()}
            className="h-9 rounded-xl bg-rose-600 text-xs hover:bg-rose-700"
          >
            {rejectingBusy ? 'Rejecting…' : t('residents.reject', 'Reject')}
          </Button>
        </DialogFooter>
      </Dialog>
    </PageLayout>
  );
}

export default ResidentApprovalsScreen;
