import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, Bell, Globe, HelpCircle, FileText, Building2, Award, ChevronRight, LogOut,
  Home as HomeIcon, Footprints, Sun, Moon, Monitor,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/store/AuthContext';
import { residents } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { resolvePersona } from '@shared/lib/roles';
import { cn } from '@shared/lib/utils';
import { TopBar } from '@app/components/TopBar';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { getThemeMode, setThemeMode, type ThemeMode } from '@app/lib/theme';

function initialsOf(name: string): string {
  const parts = name.replace(/@.*$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

interface NavRow { path?: string; icon: LucideIcon; labelKey: string; subKey: string; tint: string }

export function ProfileTab({
  userName, societyName, unreadCount = 0, onNotifications,
}: {
  userName: string;
  societyName: string;
  unreadCount?: number;
  onNotifications?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, roles } = useAuth();

  const persona = resolvePersona(roles);
  const roleLabel = persona === 'security' ? t('profile.roleSecurity') : persona === 'admin' ? t('profile.roleAdmin') : t('profile.roleResident');

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const accountRows: NavRow[] = [
    ...(persona !== 'admin' ? [{ path: '/my-profile', icon: UserCircle, labelKey: 'profile.myProfile', subKey: 'profile.myProfileSub', tint: '#05b872' }] : []),
    { path: '/notifications', icon: Bell, labelKey: 'profile.notifications', subKey: 'profile.notificationsSub', tint: '#d97706' },
  ];
  const supportRows: NavRow[] = [
    ...(persona === 'resident' ? [{ path: '/raise-ticket', icon: HelpCircle, labelKey: 'profile.support', subKey: 'profile.supportSub', tint: '#0ea5e9' }] : []),
    { icon: FileText, labelKey: 'profile.termsPrivacy', subKey: 'profile.termsPrivacySub', tint: '#64748b' },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <TopBar title={societyName || t('common.appName')} subtitle={userName} notificationCount={unreadCount} {...(onNotifications ? { onNotifications } : {})} />

      <div className="flex flex-col gap-4 px-4 py-4">
        <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-lg">
          <span className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-black/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-lg font-extrabold">
              {initialsOf(userName)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-extrabold">{userName}</div>
              <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="relative mt-4 flex border-t border-white/20 pt-3">
            <ProfileStat icon={Building2} value={societyName || '—'} label={t('profile.community')} />
            <span className="w-px bg-white/20" />
            <ProfileStat icon={Award} value={roleLabel} label={t('profile.role')} />
          </div>
        </section>

        <ProfileSection title={t('profile.accountManagement')}>
          {accountRows.map((row, i) => (
            <Row key={row.labelKey} row={row} first={i === 0} onNavigate={() => row.path && navigate(row.path)} />
          ))}
          {persona === 'resident' ? <PresenceRow /> : null}
          <ThemeRow />
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#0ea5e91f' }}>
              <Globe className="h-5 w-5" style={{ color: '#0ea5e9' }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{t('profile.language')}</span>
              <span className="block truncate text-xs text-muted-foreground">{t('profile.languageSub')}</span>
            </span>
            <LanguageSwitcher />
          </div>
        </ProfileSection>

        <ProfileSection title={t('profile.supportLegal')}>
          {supportRows.map((row, i) => (
            <Row key={row.labelKey} row={row} first={i === 0} onNavigate={() => row.path && navigate(row.path)} />
          ))}
        </ProfileSection>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 px-4 py-3 text-sm font-bold text-destructive transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          {t('common.logOut')}
        </button>
        <p className="pb-2 text-center text-xs text-muted-foreground">{t('profile.poweredBy')} · v0.1.0</p>
      </div>
    </div>
  );
}

function ProfileStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 px-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-sm font-bold">{value}</span>
      </div>
      <span className="truncate text-xs text-primary-foreground/70">{label}</span>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 ml-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">{children}</div>
    </section>
  );
}

function Row({ row, first, onNavigate }: { row: NavRow; first: boolean; onNavigate: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onNavigate} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${first ? '' : 'border-t border-border'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${row.tint}1f` }}>
        <row.icon className="h-5 w-5" style={{ color: row.tint }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{t(row.labelKey)}</span>
        <span className="block truncate text-xs text-muted-foreground">{t(row.subKey)}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function PresenceRow() {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const [value, setValue] = useState<'at_home' | 'outdoor'>('at_home');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = me.data?.resident?.presenceStatus;
    if (p === 'outdoor' || p === 'at_home') setValue(p);
  }, [me.data]);

  if (!me.loading && !me.data?.resident) return null;

  const choose = async (next: 'at_home' | 'outdoor') => {
    if (busy || next === value) return;
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      await residents.setPresence(next);
    } catch {
      setValue(prev);
    } finally {
      setBusy(false);
    }
  };

  const atHome = value === 'at_home';
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#05b8721f' }}>
        {atHome ? <HomeIcon className="h-5 w-5 text-primary" /> : <Footprints className="h-5 w-5 text-primary" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{t('profile.status')}</span>
        <span className="block truncate text-xs text-muted-foreground">{t('profile.statusSub')}</span>
      </span>
      <div className={cn('flex rounded-full bg-muted p-1', busy ? 'opacity-60' : '')}>
        <button type="button" onClick={() => choose('at_home')} className={cn('rounded-full px-3 py-1 text-xs font-bold transition-colors', atHome ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          {t('profile.atHome')}
        </button>
        <button type="button" onClick={() => choose('outdoor')} className={cn('rounded-full px-3 py-1 text-xs font-bold transition-colors', !atHome ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
          {t('profile.outdoor')}
        </button>
      </div>
    </div>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; icon: LucideIcon; labelKey: string }[] = [
  { mode: 'light', icon: Sun, labelKey: 'profile.themeLight' },
  { mode: 'dark', icon: Moon, labelKey: 'profile.themeDark' },
  { mode: 'system', icon: Monitor, labelKey: 'profile.themeSystem' },
];

function ThemeRow() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode());

  const choose = (next: ThemeMode) => {
    setMode(next);
    setThemeMode(next);
  };

  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#8250df1f' }}>
        <Moon className="h-5 w-5" style={{ color: '#8250df' }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{t('profile.theme')}</span>
        <span className="block truncate text-xs text-muted-foreground">{t('profile.themeSub')}</span>
      </span>
      <div className="flex rounded-full bg-muted p-1">
        {THEME_OPTIONS.map((o) => {
          const active = o.mode === mode;
          return (
            <button key={o.mode} type="button" onClick={() => choose(o.mode)} aria-label={t(o.labelKey)} className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <o.icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
