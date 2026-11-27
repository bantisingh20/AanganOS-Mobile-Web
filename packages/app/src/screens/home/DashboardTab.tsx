import { freshBootstrap } from '@shared/lib/hooks/useBootstrap';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone, Wrench, AlertCircle, ChevronRight,
  CreditCard, LayoutGrid, ShieldAlert,
  ShieldCheck, Plus, Phone
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { announcements, myTasks, tickets, maintenanceBilling } from '@shared/services';
import { useDynamicTiles } from '@shared/lib/appTiles';
import { tileIcon } from '@app/lib/tileIcons';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { cn } from '@shared/lib/utils';
import { formatDate, formatMoney } from '@shared/lib/format';
import {
  type QuickActionItem,
  RECENT_NOTICE_DAYS,
  NOTICE_META,
  severityTint,
} from './dashboardHelpers';
import { DashboardHero, ReqStat } from './DashboardHero';

export function DashboardTab({
  userName, unitLabel, societyName, unreadCount, onNotifications, onOpenProfile, onOpenServices,
}: {
  userName: string;
  unitLabel: string | null;
  societyName: string;
  unreadCount: number;
  onNotifications: () => void;
  onOpenProfile: () => void;
  onOpenServices?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Role-based dynamic tiles from backend menu & permissions. Read FIRST so the widget queries below
  // only run for sections this user can actually see (guards no longer fire resident-only calls).
  const { tiles } = useDynamicTiles();
  const permittedCodes = useMemo(() => new Set(tiles.map((t) => t.code)), [tiles]);

  const canSeeMaintenance = permittedCodes.has('maintenance') || permittedCodes.has('billing');
  const canSeeHelpdesk = permittedCodes.has('helpdesk') || permittedCodes.has('raise-ticket');
  const canSeeNotices = permittedCodes.has('announcements');

  // Filter tiles allowed for home shortcuts (showInHome is true or default)
  const homeTiles = useMemo(() => {
    return tiles.filter((t) => t.showInHome !== false);
  }, [tiles]);

  // Async queries for live dashboard widgets (skipped when the section is hidden)
  // Task counts come from the startup bootstrap when it's fresh; otherwise fetched here.
  const tasksQuery = useAsync(async (signal) => {
    const boot = await freshBootstrap();
    if (boot?.tasks) return boot.tasks;
    return myTasks.summary({ signal }).catch(() => []);
  }, []);
  const noticesQuery = useAsync((signal) => {
    if (!canSeeNotices) return Promise.resolve(null);
    const fromDate = new Date(Date.now() - RECENT_NOTICE_DAYS * 86400000).toISOString();
    return announcements.list({ pageSize: 3, sort: 'publishedAtUtc:desc' }, { fromDate }, { signal }).catch(() => null);
  }, [canSeeNotices]);
  const ticketCount = (status: string) => (signal: AbortSignal) =>
    canSeeHelpdesk ? tickets.list({ pageSize: 1 }, { status }, { signal }).catch(() => null) : Promise.resolve(null);
  const openQuery = useAsync(ticketCount('new'), [canSeeHelpdesk]);
  const progressQuery = useAsync(ticketCount('in_progress'), [canSeeHelpdesk]);
  const resolvedQuery = useAsync(ticketCount('resolved'), [canSeeHelpdesk]);
  const latestTicketQuery = useAsync((signal) => (canSeeHelpdesk
    ? tickets.list({ pageSize: 1, sort: 'createdAtUtc:desc' }, {}, { signal }).catch(() => null)
    : Promise.resolve(null)), [canSeeHelpdesk]);

  // Bills & dues. Up to 50 bills so the total due is right (it used to add up only the first 3).
  const billsQuery = useAsync((signal) => (canSeeMaintenance
    ? maintenanceBilling.myBills({ pageSize: 50 }, undefined, { signal }).catch(() => null)
    : Promise.resolve(null)), [canSeeMaintenance]);

  const tasks = tasksQuery.data ?? [];
  const attentionTotal = useMemo(() => tasks.reduce((s, x) => s + x.count, 0), [tasks]);
  const notices = noticesQuery.data?.items ?? [];

  // Maintenance summary
  const unpaidBills = useMemo(() => {
    return (billsQuery.data?.items ?? []).filter((b) => b.status?.toLowerCase() !== 'paid');
  }, [billsQuery.data]);
  const totalDue = useMemo(() => {
    return unpaidBills.reduce((sum, b) => sum + (b.amountDue ?? (b.amount - (b.amountPaid ?? 0))), 0);
  }, [unpaidBills]);

  const latestTicket = latestTicketQuery.data?.items?.[0] ?? null;


  // Dynamic quick actions derived strictly from the user's role rights
  const quickActions = useMemo<QuickActionItem[]>(() => {
    if (homeTiles.length <= 8) {
      return homeTiles.map((tile) => ({
        code: tile.code,
        label: tile.label || t(tile.labelKey),
        route: tile.route,
        icon: tileIcon(tile.icon),
        tint: tile.tint || '#05b872',
      }));
    }
    const top: QuickActionItem[] = homeTiles.slice(0, 7).map((tile) => ({
      code: tile.code,
      label: tile.label || t(tile.labelKey),
      route: tile.route,
      icon: tileIcon(tile.icon),
      tint: tile.tint || '#05b872',
    }));
    top.push({
      code: 'more',
      label: t('common.more') || 'More',
      route: '',
      icon: LayoutGrid,
      tint: '#64748b',
      action: onOpenServices,
    });
    return top;
  }, [homeTiles, t, onOpenServices]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* 1. HERO HEADER */}
      <DashboardHero
        userName={userName}
        unitLabel={unitLabel}
        societyName={societyName}
        unreadCount={unreadCount}
        onNotifications={onNotifications}
        onOpenProfile={onOpenProfile}
        onSos={() => navigate('/sos')}
      />

      <div className="flex flex-col gap-4 px-4 -mt-2 pb-8">
        {/* 2. NEEDS ATTENTION BAR (IF ANY) */}
        {tasks.length > 0 ? (
          <section className="flex flex-col gap-2">
            <button type="button" onClick={() => navigate('/my-tasks')} className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('home.needsAttention')} ({attentionTotal})
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="overflow-hidden rounded-2xl bg-card shadow-sm border border-border/60">
              {tasks.map((task, i) => {
                const tint = severityTint(task.severity);
                return (
                  <button
                    key={task.type}
                    type="button"
                    onClick={() => navigate('/my-tasks')}
                    className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/50', i > 0 ? 'border-t border-border' : '')}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}1f` }}>
                      <AlertCircle className="h-5 w-5" style={{ color: tint }} />
                    </span>
                    <span className="flex-1 truncate text-sm font-bold">{task.label}</span>
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-extrabold text-white" style={{ backgroundColor: tint }}>
                      {task.count > 99 ? '99+' : task.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* 3. QUICK ACTIONS GRID (DYNAMIC SHORTCUTS BASED ON USER ROLE/PERMISSIONS) */}
        {quickActions.length > 0 ? (
          <section className="rounded-3xl bg-card p-3 shadow-sm border border-border/60">
            <div className="grid grid-cols-3 min-[400px]:grid-cols-4 gap-y-3.5 gap-x-1 sm:gap-x-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.code}
                    type="button"
                    onClick={() => {
                      if (action.action) {
                        action.action();
                      } else if (action.route) {
                        navigate(action.route);
                      }
                    }}
                    className="flex flex-col items-center gap-1.5 p-1 text-center transition-transform active:scale-95"
                  >
                    <span
                      className="flex h-13 w-13 items-center justify-center rounded-2xl shadow-xs"
                      style={{ backgroundColor: `${action.tint}18` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: action.tint }} />
                    </span>
                    <span className="line-clamp-1 text-[11.5px] font-bold text-foreground">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* 4. MAINTENANCE DUES & BILLING WIDGET (ONLY SHOWN IF USER HAS MAINTENANCE ACCESS) */}
        {canSeeMaintenance ? (
          <section className="overflow-hidden rounded-2xl bg-card p-4 shadow-sm border border-border/60">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">{t('services.maintenance')}</h3>
                  <p className="text-[11px] text-muted-foreground">Society Dues & Billing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/maintenance')}
                className="text-xs font-bold text-primary flex items-center gap-0.5"
              >
                {t('common.details')} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="pt-3 flex items-center justify-between">
              {totalDue > 0 ? (
                <>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-destructive">Payment Due</span>
                    <p className="text-2xl font-black text-foreground">{formatMoney(totalDue)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/maintenance')}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm active:scale-95 transition-transform"
                  >
                    Pay Now
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-foreground">All Dues Cleared</p>
                      <p className="text-xs text-muted-foreground">No pending society maintenance</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/maintenance')}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                  >
                    History
                  </button>
                </>
              )}
            </div>
          </section>
        ) : null}


        {/* 6. HELPDESK & REQUEST TRACKER */}
        {canSeeHelpdesk ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('home.myRequests')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/helpdesk/new')}
                className="text-xs font-bold text-primary flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> New Ticket
              </button>
            </div>

            <div
              onClick={() => navigate('/helpdesk')}
              className="flex flex-col gap-3 rounded-2xl bg-card p-4 text-left shadow-sm border border-border/60 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Wrench className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-sm font-extrabold text-foreground">Support & Maintenance Tickets</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex items-center divide-x divide-border rounded-xl bg-muted/40 py-2.5">
                <ReqStat value={openQuery.data?.totalCount ?? 0} label={t('home.open')} tint="#0ea5e9" />
                <ReqStat value={progressQuery.data?.totalCount ?? 0} label={t('home.inProgress')} tint="#d97706" />
                <ReqStat value={resolvedQuery.data?.totalCount ?? 0} label={t('home.completed')} tint="#05b872" />
              </div>

              {latestTicket ? (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="truncate text-muted-foreground font-medium">
                    Latest: <span className="font-bold text-foreground">{latestTicket.title}</span>
                  </span>
                  <span className="shrink-0 text-primary font-bold">View Ticket</span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* 7. RECENT NOTICES & ANNOUNCEMENTS */}
        {canSeeNotices ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('home.recentNotices')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/announcements')}
                className="text-xs font-bold text-primary flex items-center gap-0.5"
              >
                {t('home.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl bg-card shadow-sm border border-border/60">
              {notices.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {t('home.noNoticesDays', { days: RECENT_NOTICE_DAYS })}
                </p>
              ) : (
                notices.map((notice, i) => {
                  const meta = NOTICE_META[notice.category] ?? NOTICE_META.general!;
                  return (
                    <button
                      key={notice.id}
                      type="button"
                      onClick={() => navigate('/announcements')}
                      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left active:bg-muted/50 transition-colors', i > 0 ? 'border-t border-border' : '')}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.tint}1a` }}>
                        <Megaphone className="h-4 w-4" style={{ color: meta.tint }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="block truncate text-sm font-extrabold text-foreground">{notice.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(notice.publishedAtUtc)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{notice.body}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        ) : null}

        {/* 8. QUICK SECURITY GUARD CONTACT / EMERGENCY BAR */}
        <section className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-950/40 via-card to-card border border-border/80 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-foreground">Main Gate Security</p>
              <p className="text-xs text-muted-foreground">24x7 Security & Guard Desk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sos')}
            className="flex items-center gap-1.5 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 active:scale-95 transition-transform"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Emergency SOS
          </button>
        </section>
      </div>
    </div>
  );
}
