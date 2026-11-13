import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Megaphone, Wrench, AlertCircle, ChevronRight,
  Calendar, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { announcements, myTasks, tickets } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { useHomeTiles } from '@shared/lib/appTiles';
import { cn } from '@shared/lib/utils';
import { tileIcon } from '@app/lib/tileIcons';

const HERO = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=70';
const RECENT_NOTICE_DAYS = 15;

const NOTICE_META: Record<string, { icon: LucideIcon; tint: string }> = {
  maintenance: { icon: Wrench, tint: '#05b872' },
  event: { icon: Calendar, tint: '#0ea5e9' },
  emergency: { icon: AlertTriangle, tint: '#dc2626' },
  general: { icon: Megaphone, tint: '#0ea5e9' },
};

function noticeDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function greetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

function initialsOf(name: string): string {
  const parts = name.replace(/@.*$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function severityTint(sev: string): string {
  if (sev === 'urgent' || sev === 'high') return '#cf222e';
  if (sev === 'warning' || sev === 'medium') return '#bf8700';
  return '#0969da';
}

export function DashboardTab({
  userName, unitLabel, societyName, unreadCount, onNotifications, onOpenProfile,
}: {
  userName: string;
  unitLabel: string | null;
  societyName: string;
  unreadCount: number;
  onNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { persona, tiles } = useHomeTiles();

  const tasksQuery = useAsync((signal) => myTasks.summary({ signal }).catch(() => []), []);
  const noticesQuery = useAsync((signal) => {
    const fromDate = new Date(Date.now() - RECENT_NOTICE_DAYS * 86400000).toISOString();
    return announcements.list({ pageSize: 3, sort: 'publishedAtUtc:desc' }, { fromDate }, { signal }).catch(() => null);
  }, []);
  const openQuery = useAsync((signal) => tickets.list({ pageSize: 1 }, { status: 'new' }, { signal }).catch(() => null), []);
  const progressQuery = useAsync((signal) => tickets.list({ pageSize: 1 }, { status: 'in_progress' }, { signal }).catch(() => null), []);
  const resolvedQuery = useAsync((signal) => tickets.list({ pageSize: 1 }, { status: 'resolved' }, { signal }).catch(() => null), []);

  const tasks = tasksQuery.data ?? [];
  const attentionTotal = useMemo(() => tasks.reduce((s, x) => s + x.count, 0), [tasks]);
  const notices = noticesQuery.data?.items ?? [];
  const showMyRequests = persona === 'resident' && tiles.some((x) => x.code === 'raise-ticket');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="safe-top relative min-h-[220px] overflow-hidden">
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[rgba(8,24,18,0.52)]" />
        <div className="relative flex flex-col gap-3 px-5 pb-5 pt-6">
          <div className="flex items-center justify-between">
            <div className="text-xl font-extrabold tracking-tight text-white">
              <span>Aangan</span><span className="text-[#8ef0c0]">OS</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onNotifications} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                <Bell className="h-5 w-5 text-[#0b261d]" />
                {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-destructive" /> : null}
              </button>
              <button type="button" onClick={onOpenProfile} aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-extrabold text-primary">
                {initialsOf(userName)}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white/90">{t(greetingKey())},</p>
            <h1 className="text-2xl font-extrabold text-white">{userName}</h1>
            <p className="truncate text-sm font-medium text-white/85">{unitLabel ? `${unitLabel}, ` : ''}{societyName}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {tasks.length > 0 ? (
          <section className="flex flex-col gap-2">
            <button type="button" onClick={() => navigate('/my-tasks')} className="flex items-center justify-between">
              <span className="text-sm font-extrabold uppercase tracking-wide text-foreground">{t('home.needsAttention')} ({attentionTotal})</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
              {tasks.map((task, i) => {
                const tint = severityTint(task.severity);
                return (
                  <button key={task.type} type="button" onClick={() => navigate('/my-tasks')} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', i > 0 ? 'border-t border-border' : '')}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}1f` }}>
                      <AlertCircle className="h-5 w-5" style={{ color: tint }} />
                    </span>
                    <span className="flex-1 truncate text-[15px] font-bold">{task.label}</span>
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold text-white" style={{ backgroundColor: tint }}>
                      {task.count > 99 ? '99+' : task.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-4 gap-y-4 rounded-3xl bg-card px-2 py-4 shadow-sm">
          {tiles.map((tile) => {
            const Icon = tileIcon(tile.icon);
            return (
              <button key={tile.code} type="button" onClick={() => navigate(tile.route)} className="flex flex-col items-center gap-1.5 px-0.5">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl" style={{ backgroundColor: `${tile.tint}1a` }}>
                  <Icon className="h-[26px] w-[26px]" style={{ color: tile.tint }} />
                </span>
                <span className="text-center text-[12px] font-semibold leading-tight">{t(tile.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {showMyRequests ? (
          <button type="button" onClick={() => navigate('/my-tickets')} className="flex flex-col gap-3 rounded-2xl bg-card p-4 text-left shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><Wrench className="h-4 w-4 text-primary" /></span>
                <span className="text-base font-extrabold">{t('home.myRequests')}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center">
              <ReqStat value={openQuery.data?.totalCount ?? 0} label={t('home.open')} tint="#0ea5e9" />
              <span className="h-8 w-px bg-border" />
              <ReqStat value={progressQuery.data?.totalCount ?? 0} label={t('home.inProgress')} tint="#d97706" />
              <span className="h-8 w-px bg-border" />
              <ReqStat value={resolvedQuery.data?.totalCount ?? 0} label={t('home.completed')} tint="#05b872" />
            </div>
          </button>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-extrabold">{t('home.recentNotices')}</h2>
            <button type="button" onClick={() => navigate('/announcements')} className="text-sm font-bold text-primary">{t('home.viewAll')}</button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {notices.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('home.noNoticesDays', { days: RECENT_NOTICE_DAYS })}</p>
            ) : (
              notices.map((notice, i) => {
                const meta = NOTICE_META[notice.category] ?? NOTICE_META.general!;
                return (
                  <button key={notice.id} type="button" onClick={() => navigate('/announcements')} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left', i > 0 ? 'border-t border-border' : '')}>
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.tint}1a` }}>
                      <meta.icon className="h-5 w-5" style={{ color: meta.tint }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="block truncate text-sm font-extrabold">{notice.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{noticeDate(notice.publishedAtUtc)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{notice.body}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ReqStat({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span className="text-xl font-extrabold" style={{ color: tint }}>{value}</span>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}
