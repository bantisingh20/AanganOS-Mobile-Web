import { useNavigate } from 'react-router-dom';
import {
  Building,
  Home,
  Users,
  Clock,
  Wrench,
  IdCard,
  Megaphone,
  Bell,
  CalendarDays,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { DonutChart, BarChart } from '@shared/components/charts';
import { notifications, announcements } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import { useAsync } from '@shared/lib/useAsync';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Kpi {
  labelKey: string;
  subKey: string;
  value: number | null;
  icon: LucideIcon;
  tint: string;
  path: string;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roles } = useAuth();

  const noticesQuery = useAsync((signal) => announcements.list({ pageSize: 4, sort: '-publishedAtUtc' }, {}, { signal }).catch(() => null), []);
  const activityQuery = useAsync((signal) => notifications.list({ page: 1, pageSize: 6 }, { signal }).catch(() => null), []);

  const notices = noticesQuery.data?.items ?? [];
  const activity = activityQuery.data?.items ?? [];

  const kpis: Kpi[] = [
    { labelKey: 'admin.cards.communities', subKey: 'admin.cards.communitiesSub', value: null, icon: Building, tint: '#05b872', path: '/communities' },
    { labelKey: 'admin.cards.units', subKey: 'admin.cards.unitsSub', value: null, icon: Home, tint: '#2563eb', path: '/units' },
    { labelKey: 'admin.cards.residents', subKey: 'admin.cards.residentsSub', value: null, icon: Users, tint: '#8b5cf6', path: '/residents' },
    { labelKey: 'admin.cards.pending', subKey: 'admin.cards.pendingSub', value: null, icon: Clock, tint: '#f59e0b', path: '/residents' },
    { labelKey: 'admin.cards.tickets', subKey: 'admin.cards.ticketsSub', value: null, icon: Wrench, tint: '#f43f5e', path: '/maintenance' },
    { labelKey: 'admin.cards.passes', subKey: 'admin.cards.passesSub', value: null, icon: IdCard, tint: '#0ea5e9', path: '/visitors' },
  ];

  const occupancy = [
    { label: 'Occupied', value: 0, color: '#05b872' },
    { label: 'Available', value: 0, color: '#3b82f6' },
    { label: 'Vacant', value: 0, color: '#94a3b8' },
  ];
  const ticketBars = [
    { label: 'New', value: 0, color: '#0ea5e9' },
    { label: 'Assigned', value: 0, color: '#6366f1' },
    { label: 'In Progress', value: 0, color: '#3b82f6' },
    { label: 'Resolved', value: 0, color: '#05b872' },
  ];

  const quickActions = [
    { labelKey: 'admin.nav.residents', path: '/residents', icon: Users },
    { labelKey: 'admin.nav.announcements', path: '/announcements', icon: Megaphone },
    { labelKey: 'admin.nav.units', path: '/units', icon: Home },
    { labelKey: 'admin.nav.visitors', path: '/visitors', icon: IdCard },
    { labelKey: 'admin.nav.amenities', path: '/amenities', icon: Plus },
    { labelKey: 'admin.nav.helpdesk', path: '/maintenance', icon: Wrench },
  ];

  const greetName = roles[0] ?? 'Admin';

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">{t('admin.welcome')}, {greetName}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.welcomeSub')}</p>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <button key={k.labelKey} type="button" onClick={() => navigate(k.path)} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${k.tint}1f` }}>
              <k.icon className="h-5 w-5" style={{ color: k.tint }} />
            </span>
            <span className="text-2xl font-extrabold">{k.value ?? '—'}</span>
            <span className="text-sm font-semibold leading-tight">{t(k.labelKey)}</span>
            <span className="text-xs text-muted-foreground">{t(k.subKey)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-bold">{t('admin.occupancy')}</h2>
            <DonutChart slices={occupancy} centerLabel="units" />
          </Card>
          <Card className="rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-bold">{t('admin.ticketsChart')}</h2>
            <BarChart bars={ticketBars} />
          </Card>
          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-bold">{t('admin.recentActivity')}</h2>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activity.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 rounded-xl border border-border p-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Bell className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{n.title}</span>
                      <span className="line-clamp-1 block text-xs text-muted-foreground">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.createdAtUtc)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">{t('admin.notices')}</h2>
              <button type="button" onClick={() => navigate('/announcements')} className="text-xs font-semibold text-emerald-600">{t('admin.viewAll')}</button>
            </div>
            {notices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.noData')}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {notices.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-violet-600" />
                      <span className="truncate text-sm font-semibold">{a.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-bold">{t('admin.quickActions')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map((q) => (
                <button key={q.labelKey} type="button" onClick={() => navigate(q.path)} className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center hover:bg-slate-50">
                  <q.icon className="h-5 w-5 text-emerald-600" />
                  <span className="text-[10px] font-semibold leading-tight">{t(q.labelKey)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
