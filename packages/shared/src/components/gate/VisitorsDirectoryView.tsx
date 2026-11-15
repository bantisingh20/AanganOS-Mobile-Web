import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  DoorOpen, Search, RefreshCw, Table as TableIcon, LayoutGrid,
  Phone, QrCode, Clock, Camera, Car, Plus, LogOut, CheckCircle2, XCircle,
  Filter, SlidersHorizontal, ChevronDown, Building2, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { TextField } from '@shared/components/TextField';
import { SelectField } from '@shared/components/SelectField';
import { UnitSearchField } from '@shared/components/UnitSearchField';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { AdaptiveShell } from '@shared/components/layout/AdaptiveShell';
import { gate, masterData, residents, communities, organizations, files } from '@shared/services';
import type { Visitor } from '@shared/api/gate';
import type { Unit } from '@shared/api/units';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { compressImageToDataUrl } from '@shared/lib/image';
import { cn } from '@shared/lib/utils';
import { InviteVisitorForm } from '@shared/components/InviteVisitorForm';

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
  try {
    const c = await communities.get(id, { signal });
    return c.name;
  } catch {
    return null;
  }
}

async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try {
    const o = await organizations.get(id, { signal });
    return o.name;
  } catch {
    return null;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function VisitorPhotoAvatar({
  photoFileId,
  name,
  className,
}: {
  photoFileId?: string | null;
  name: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFileId) {
      setUrl(null);
      return;
    }
    let active = true;
    void files
      .objectUrl(photoFileId)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      active = false;
    };
  }, [photoFileId]);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn('h-10 w-10 rounded-xl object-cover border border-border/50 shadow-xs shrink-0', className)}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || 'V';
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm shadow-xs',
        className,
      )}
    >
      {initial}
    </span>
  );
}

function StatusBadge({ visitor }: { visitor: Visitor }) {
  const s = (visitor.status || '').toLowerCase();
  if (s === 'entered' || s === 'inside') {
    return <Badge tone="success">Inside Society</Badge>;
  }
  if (s === 'approved') {
    return <Badge tone="success">Approved</Badge>;
  }
  if (s === 'pending') {
    return <Badge tone="warning">Pending Approval</Badge>;
  }
  if (s === 'rejected') {
    return <Badge tone="danger">Rejected</Badge>;
  }
  if (s === 'exited') {
    return <Badge tone="muted">Exited</Badge>;
  }
  return <Badge tone="default">{visitor.status || 'Active'}</Badge>;
}

export interface VisitorsDirectoryViewProps {
  standalone?: boolean;
  initialTab?: 'all' | 'pending' | 'approvals';
}

export function VisitorsDirectoryView({ standalone = false, initialTab = 'all' }: VisitorsDirectoryViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isSmall = useIsSmallScreen();
  const scope = useScope();

  const [tab, setTab] = useState<'all' | 'pending'>(() => {
    if (initialTab === 'approvals' || initialTab === 'pending') return 'pending';
    return 'all';
  });
  const [search, setSearch] = useState('');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(scope.organizationId ?? null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(scope.scopedCommunityId ?? null);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [desktopView, setDesktopView] = useState<'table' | 'cards'>('table');
  const [reloadKey, setReloadKey] = useState(0);

  // Modal / Drawer states
  const [walkinDrawerOpen, setWalkinDrawerOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [passQrDataUrl, setPassQrDataUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Visitor | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const currentResidentId = me.data?.resident?.id ?? '';

  const myUnits = useMemo(() => {
    return (me.data?.units ?? []).map((u) => ({
      unitId: u.unitId,
      unitNumber: u.unitNumber,
      communityId: u.communityId ?? undefined,
    }));
  }, [me.data]);

  const query = useAsync(
    (signal) =>
      gate.listVisitors(
        { search: search.trim() || undefined, page, pageSize },
        {
          ...(tab === 'pending' ? { status: 'pending' } : {}),
          ...(filterCommunityId ? { communityId: filterCommunityId } : {}),
          ...(filterOrgId ? { organizationId: filterOrgId } : {}),
        },
        { signal },
      ).catch(() => null),
    [search, tab, page, pageSize, filterOrgId, filterCommunityId, reloadKey],
  );

  const allItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const items = useMemo(() => {
    let list = allItems;
    if (tab === 'pending') {
      list = list.filter((v) => (v.status || '').toLowerCase() === 'pending');
    }
    if (filterCommunityId) {
      list = list.filter((v) => !v.communityId || v.communityId === filterCommunityId);
    }
    return list;
  }, [allItems, tab, filterCommunityId]);

  const totalCount = query.data?.totalCount ?? 0;
  const reload = () => setReloadKey((k) => k + 1);

  // Show pass QR preview
  const showPassModal = async (v: Visitor) => {
    setSelectedVisitor(v);
    const token = v.publicToken || v.id;
    const url = `${window.location.origin}/pass/${token}`;
    try {
      const qr = await QRCode.toDataURL(url, { width: 280, margin: 2 });
      setPassQrDataUrl(qr);
    } catch {
      setPassQrDataUrl(null);
    }
  };

  const approve = async (id: string) => {
    setActingId(id);
    try {
      await gate.approveVisitor(id, { approvingResidentId: currentResidentId });
      toast.success(t('visitors.approved', 'Visitor approved'));
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setActingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setActingId(rejecting.id);
    try {
      await gate.rejectVisitor(rejecting.id, {
        rejectingResidentId: currentResidentId,
        reason: rejectReason.trim() || undefined,
      });
      toast.success(t('visitors.rejected', 'Visitor rejected'));
      setRejecting(null);
      setRejectReason('');
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setActingId(null);
    }
  };

  const recordExit = async (id: string) => {
    setActingId(id);
    try {
      await gate.recordExit({ visitorId: id });
      toast.success(t('visitors.exitDone', 'Exit recorded'));
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <AdaptiveShell
      showBack={standalone}
      title="My Visitors"
      subtitle="Invite guests, review pending visitor approvals, and track entries"
      rightAction={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setInviteDrawerOpen(true)}
            className="h-10 gap-1.5 rounded-xl bg-primary text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 px-4"
          >
            <Plus className="h-4 w-4" /> Invite Guest
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Desktop Single-Row Toolbar: 2 Tabs + Search Input + Scope Filters + View Switch + Refresh */}
        {!isSmall ? (
          <div className="flex items-center gap-3 border-b border-border/60 pb-3 flex-wrap xl:flex-nowrap">
            {/* Left: 2 Tab Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'all', label: 'All Visitors' },
                  { id: 'pending', label: 'Pending Approvals' },
                ] as const
              ).map((tTab) => (
                <button
                  key={tTab.id}
                  type="button"
                  onClick={() => {
                    setTab(tTab.id);
                    setPage(1);
                  }}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap',
                    tab === tTab.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {tTab.label}
                </button>
              ))}
            </div>

            {/* Center: Search Input in same row */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search visitor by name, phone, vehicle, or flat number…"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>

            {/* Right: Scope Dropdowns (Org & Society) + View Switch + Refresh */}
            <div className="flex items-center gap-2 shrink-0">
              {scope.showOrgFilter && (
                <EntitySelect
                  className="w-44"
                  value={filterOrgId}
                  onChange={(v) => {
                    setFilterOrgId(v);
                    setFilterCommunityId(null);
                    setPage(1);
                  }}
                  fetchPage={fetchOrgPage}
                  resolveLabel={resolveOrgLabel}
                  placeholder="All Organizations"
                />
              )}

              {scope.showCommunityFilter && (
                <EntitySelect
                  className="w-48"
                  value={filterCommunityId}
                  onChange={(v) => {
                    setFilterCommunityId(v);
                    setPage(1);
                  }}
                  fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
                  resolveLabel={resolveCommunityLabel}
                  placeholder="All Societies"
                />
              )}

              <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setDesktopView('table')}
                  className={cn(
                    'p-2 rounded-lg text-xs transition-colors',
                    desktopView === 'table' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground',
                  )}
                  title="Table view"
                >
                  <TableIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopView('cards')}
                  className={cn(
                    'p-2 rounded-lg text-xs transition-colors',
                    desktopView === 'cards' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground',
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reload}
                className="h-10 w-10 p-0 rounded-xl border-border/60"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4 text-muted-foreground', query.loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Mobile View: Search + Filter + 2 Tabs */}
        {isSmall ? (
          <div className="space-y-2.5">
            {/* Row 1: Search Input + Filter button + Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search visitor by name, phone, flat…"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              {/* Filter button if power user or community filter is available */}
              {(scope.showCommunityFilter || scope.showOrgFilter) && (
                <Button
                  type="button"
                  variant={showMobileFilter || (scope.showCommunityFilter && !!filterCommunityId) ? 'default' : 'outline'}
                  onClick={() => setShowMobileFilter((prev) => !prev)}
                  className={cn(
                    'h-10 px-3 rounded-xl gap-1.5 text-xs font-semibold shrink-0',
                    scope.showCommunityFilter && !!filterCommunityId && !showMobileFilter
                      ? 'border-primary text-primary bg-primary/10 hover:bg-primary/20'
                      : '',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filter</span>
                  {scope.showCommunityFilter && !!filterCommunityId ? (
                    <span className="flex h-2 w-2 rounded-full bg-current" />
                  ) : null}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reload}
                className="h-10 w-10 p-0 rounded-xl border-border/80 shrink-0"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4 text-muted-foreground', query.loading && 'animate-spin')} />
              </Button>
            </div>

            {/* Row 2: 2 Segmented Tabs (All Visitors | Pending Approvals) */}
            <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
              <button
                type="button"
                onClick={() => {
                  setTab('all');
                  setPage(1);
                }}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center',
                  tab === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All Visitors
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('pending');
                  setPage(1);
                }}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center',
                  tab === 'pending'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Pending Approvals
              </button>
            </div>

            {/* Expanded Filter Panel when user clicks Filter (Society / Org selection) */}
            {showMobileFilter && (
              <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm space-y-3 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-primary" /> Society Filters
                  </span>
                  {(filterCommunityId || filterOrgId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCommunityId(scope.scopedCommunityId ?? null);
                        setFilterOrgId(scope.organizationId ?? null);
                        setPage(1);
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* Organization Filter Dropdown if based on scope */}
                {scope.showOrgFilter && (
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Organization</label>
                    <EntitySelect
                      className="w-full"
                      value={filterOrgId}
                      onChange={(v) => {
                        setFilterOrgId(v);
                        setFilterCommunityId(null);
                        setPage(1);
                      }}
                      fetchPage={fetchOrgPage}
                      resolveLabel={resolveOrgLabel}
                      placeholder="All Organizations"
                    />
                  </div>
                )}

                {/* Society / Community Filter Dropdown if based on scope */}
                {scope.showCommunityFilter && (
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Society / Community</label>
                    <EntitySelect
                      className="w-full"
                      value={filterCommunityId}
                      onChange={(v) => {
                        setFilterCommunityId(v);
                        setPage(1);
                      }}
                      fetchPage={makeCommunityFetch(filterOrgId ?? undefined)}
                      resolveLabel={resolveCommunityLabel}
                      placeholder="All Societies / Communities"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Content Section */}
        {query.loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-xs font-medium">Loading gate log…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <DoorOpen className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No visitors found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {search.trim()
                ? 'Try matching a different name, phone, or unit number.'
                : 'No visitor entries recorded in this category yet.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setWalkinDrawerOpen(true)}
                className="h-9 rounded-xl bg-primary text-xs text-primary-foreground font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> New Entry
              </Button>
            </div>
          </div>
        ) : !isSmall && desktopView === 'table' ? (
          /* Desktop Data Table */
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xs">
            <Table>
              <THead className="bg-muted/40">
                <TR>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Visitor</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Category</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Flat / Unit</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Vehicle</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Status</TH>
                  <TH className="py-3 px-4 text-xs font-bold text-foreground">Entry Time</TH>
                  <TH className="py-3 px-4 text-right text-xs font-bold text-foreground">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((v) => {
                  const isPending = (v.status || '').toLowerCase() === 'pending';
                  const isInside = (v.status || '').toLowerCase() === 'entered' || (v.status || '').toLowerCase() === 'inside';

                  return (
                    <TR key={v.id} className="hover:bg-muted/20 transition-colors">
                      <TD className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <VisitorPhotoAvatar photoFileId={v.photoFileId} name={v.name} />
                          <div className="min-w-0">
                            <span className="block font-bold text-foreground text-xs truncate max-w-[180px]">
                              {v.name}
                            </span>
                            {v.phone ? (
                              <a
                                href={`tel:${v.phone}`}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary mt-0.5"
                              >
                                <Phone className="h-3 w-3" /> {v.phone}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </TD>

                      <TD className="py-3 px-4 text-xs">
                        <Badge tone="default">{v.category || 'General'}</Badge>
                      </TD>

                      <TD className="py-3 px-4 text-xs">
                        <span className="font-semibold text-foreground">
                          {v.hostUnitNumber ? `Flat ${v.hostUnitNumber}` : '—'}
                        </span>
                        {v.communityName ? (
                          <span className="block text-[11px] text-muted-foreground">{v.communityName}</span>
                        ) : null}
                      </TD>

                      <TD className="py-3 px-4 text-xs text-muted-foreground">
                        {v.vehicleNumber ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <Car className="h-3.5 w-3.5 text-primary" /> {v.vehicleNumber}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TD>

                      <TD className="py-3 px-4">
                        <StatusBadge visitor={v} />
                      </TD>

                      <TD className="py-3 px-4 text-xs text-muted-foreground">
                        {formatDateTime(v.createdAtUtc)}
                      </TD>

                      <TD className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => showPassModal(v)}
                            className="h-8 rounded-lg text-xs"
                            title="View Pass & QR"
                          >
                            <QrCode className="h-3.5 w-3.5 mr-1 text-primary" /> Pass
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={actingId === v.id}
                                onClick={() => approve(v.id)}
                                className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={actingId === v.id}
                                onClick={() => setRejecting(v)}
                                className="h-8 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 text-xs px-2.5"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}

                          {isInside && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={actingId === v.id}
                              onClick={() => recordExit(v.id)}
                              className="h-8 rounded-lg border-amber-300 text-amber-700 hover:bg-amber-50 text-xs px-2.5"
                            >
                              <LogOut className="h-3.5 w-3.5 mr-1" /> Exit
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        ) : (
          /* Mobile / Grid Card View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((v) => {
              const isPending = (v.status || '').toLowerCase() === 'pending';
              const isInside = (v.status || '').toLowerCase() === 'entered' || (v.status || '').toLowerCase() === 'inside';

              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs space-y-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <VisitorPhotoAvatar photoFileId={v.photoFileId} name={v.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-[15px] font-extrabold text-foreground">{v.name}</span>
                        {v.category ? (
                          <Badge tone="default">{v.category}</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {v.hostUnitNumber ? <span>Flat {v.hostUnitNumber}</span> : null}
                        {v.communityName ? <span>• {v.communityName}</span> : null}
                      </div>
                    </div>

                    <StatusBadge visitor={v} />
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    {v.phone ? (
                      <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{v.phone}</span>
                      </a>
                    ) : (
                      <span>No phone</span>
                    )}

                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span>{formatDateTime(v.createdAtUtc)}</span>
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => showPassModal(v)}
                      className="flex-1 h-8 rounded-xl text-xs"
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1 text-primary" /> Pass
                    </Button>

                    {isPending && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingId === v.id}
                          onClick={() => approve(v.id)}
                          className="flex-1 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actingId === v.id}
                          onClick={() => setRejecting(v)}
                          className="h-8 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 text-xs px-2.5"
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {isInside && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingId === v.id}
                        onClick={() => recordExit(v.id)}
                        className="flex-1 h-8 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 text-xs"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Mark Exit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="pt-2 flex justify-end">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* 1. Register Walk-in Entry Drawer (> 3 fields -> Drawer) */}
      <RegisterWalkinDrawer
        open={walkinDrawerOpen}
        onClose={() => setWalkinDrawerOpen(false)}
        selectedCommunityId={filterCommunityId || scope.scopedCommunityId}
        onSaved={() => {
          setWalkinDrawerOpen(false);
          reload();
        }}
      />

      {/* 2. Invite Visitor Drawer (> 3 fields -> Drawer) */}
      <SmartFormDrawer
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        title="Invite Visitor"
        fieldsCount={6}
        cancelLabel="Close"
        className="md:max-w-2xl lg:max-w-3xl"
      >
        <InviteVisitorForm
          units={myUnits}
          onDone={() => {
            setInviteDrawerOpen(false);
            reload();
          }}
        />
      </SmartFormDrawer>

      {/* 3. Pass Preview Dialog (<= 3 fields -> Dialog) */}
      <Dialog open={!!selectedVisitor} onClose={() => setSelectedVisitor(null)} className="max-w-md">
        <DialogHeader
          title={selectedVisitor?.passType === 'pass' ? 'Visitor Pass' : 'Visitor Details'}
          description={selectedVisitor?.name}
        />
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          {passQrDataUrl ? (
            <img src={passQrDataUrl} alt="Pass QR" className="h-48 w-48 rounded-xl border border-border shadow-xs" />
          ) : null}
          <div className="text-xs text-muted-foreground">
            {selectedVisitor?.hostUnitNumber ? `Flat ${selectedVisitor.hostUnitNumber}` : ''}
            {selectedVisitor?.vehicleNumber ? ` • Car: ${selectedVisitor.vehicleNumber}` : ''}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedVisitor(null)} className="h-9 rounded-xl text-xs">
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 4. Reject Reason Dialog (<= 3 fields -> Dialog) */}
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} className="max-w-md">
        <DialogHeader title="Reject Visitor" description={rejecting?.name} />
        <div className="py-2">
          <label className="mb-1 block text-xs font-bold text-foreground">Reason for Rejection</label>
          <input
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Resident not available"
            className="h-9.5 w-full rounded-xl border border-border px-3 text-xs"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejecting(null)} className="h-9 rounded-xl text-xs">
            Cancel
          </Button>
          <Button onClick={confirmReject} className="h-9 rounded-xl bg-rose-600 text-xs text-white hover:bg-rose-700">
            Reject
          </Button>
        </DialogFooter>
      </Dialog>
    </AdaptiveShell>
  );
}

function RegisterWalkinDrawer({
  open,
  onClose,
  onSaved,
  selectedCommunityId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  selectedCommunityId?: string | null;
}) {
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const commsQuery = useAsync((signal) => communities.list({ pageSize: 50 }, {}, { signal }).catch(() => null), []);

  const defaultCommunityId =
    selectedCommunityId ??
    me.data?.units?.[0]?.communityId ??
    me.data?.resident?.communityId ??
    commsQuery.data?.items?.[0]?.id ??
    null;

  const [communityId, setCommunityId] = useState<string | null>(defaultCommunityId ?? null);
  useEffect(() => {
    if (selectedCommunityId) {
      setCommunityId(selectedCommunityId);
    } else if (!communityId && defaultCommunityId) {
      setCommunityId(defaultCommunityId);
    }
  }, [selectedCommunityId, defaultCommunityId, communityId]);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [whomToMeet, setWhomToMeet] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cats = useAsync(
    (signal) => masterData.list('Visitor_Category', communityId ?? null, { signal }).catch(() => []),
    [communityId],
  );
  const catOptions = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));

  const submit = async () => {
    if (busy) return;
    if (!unit) {
      toast.error('Please select destination unit');
      return;
    }
    if (!name.trim()) {
      toast.error('Visitor name is required');
      return;
    }
    if (!category) {
      toast.error('Visitor category is required');
      return;
    }

    setBusy(true);
    try {
      let photoDataUrl: string | undefined;
      if (photoFile) {
        photoDataUrl = await compressImageToDataUrl(photoFile, 800, 800, 0.7);
      }

      await gate.registerWalkIn({
        hostUnitId: unit.id,
        name: name.trim(),
        phone: phone.trim() || undefined,
        category,
        vehicleNumber: vehicleNumber.trim() || undefined,
        whomToMeet: whomToMeet.trim() || undefined,
        photoBase64: photoDataUrl,
      });

      toast.success('Walk-in visitor recorded successfully');
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  return (
    <SmartFormDrawer
      open={open}
      onClose={onClose}
      title="Record Walk-in Entry"
      fieldsCount={7}
      onSave={submit}
      saveLabel={busy ? 'Saving…' : 'Submit Entry'}
      isSaving={busy}
      cancelLabel="Cancel"
    >
      <div className="space-y-4 py-2">
        {/* Photo capture */}
        <div className="flex items-center gap-4 p-3 rounded-2xl border border-border/80 bg-muted/20">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative flex h-20 w-20 cursor-pointer shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary bg-background overflow-hidden transition-colors"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span className="text-[10px] font-semibold mt-1">Photo</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-foreground">Visitor Photo (Optional)</h4>
            <p className="mt-1 text-[11px] text-muted-foreground">Attach visitor photo for verification</p>
          </div>
        </div>

        {/* Destination Unit */}
        <div>
          <UnitSearchField
            label="Destination Flat / Unit *"
            value={unit}
            onSelect={setUnit}
            communityId={communityId}
            placeholder="Search flat number (e.g. 101, A-202)…"
            required
          />
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Visitor Full Name *</label>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anand Verma"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Phone Number</label>
          <TextField
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Category *</label>
          <SelectField
            value={category}
            options={catOptions.length > 0 ? catOptions : [{ value: 'guest', label: 'Guest' }, { value: 'delivery', label: 'Delivery' }, { value: 'cab', label: 'Cab / Taxi' }]}
            onChange={setCategory}
            placeholder="Select category…"
          />
        </div>

        {/* Vehicle Number */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Vehicle Number (Optional)</label>
          <TextField
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="e.g. MH 02 AB 1234"
          />
        </div>

        {/* Whom to meet */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground text-xs">Whom to meet / Purpose</label>
          <TextField
            value={whomToMeet}
            onChange={(e) => setWhomToMeet(e.target.value)}
            placeholder="e.g. Personal visit, package drop"
          />
        </div>
      </div>
    </SmartFormDrawer>
  );
}

export default VisitorsDirectoryView;
