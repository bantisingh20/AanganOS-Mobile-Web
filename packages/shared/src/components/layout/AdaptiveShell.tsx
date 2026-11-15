import { useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PanelLeftClose, PanelLeft, Search, Bell, HelpCircle,
  Home, LayoutGrid, User, ChevronLeft, Building2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoUrl from '@shared/assets/logo.png';
import { notifications } from '@shared/services';
import { NotificationInbox } from '@shared/components/NotificationInbox';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { SidebarNav } from '@shared/components/SidebarNav';
import { Card } from '@shared/components/ui/card';
import { useMenu } from '@shared/lib/useMenu';
import { useAuth } from '@shared/store/AuthContext';
import { cn } from '@shared/lib/utils';

const HELP_URL = 'https://aanganos.sharcnix.com/help';

export type BottomTabKey = 'home' | 'services' | 'profile';

export interface AdaptiveShellProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  bannerIcon?: ReactNode;
  activeTab?: BottomTabKey | null;
  onTabChange?: (tab: BottomTabKey) => void;
  children: ReactNode;
  className?: string;
  hideHeaderOnMobile?: boolean;
  hideDesktopSubHeader?: boolean;
  societyName?: string | null;
  unitLabel?: string | null;
}

export function AdaptiveShell({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  bannerIcon,
  activeTab,
  onTabChange,
  children,
  className,
  hideHeaderOnMobile = false,
  hideDesktopSubHeader = false,
  societyName,
  unitLabel,
}: AdaptiveShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop sidebar collapse state
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const { items: menuNodes } = useMenu([]);

  const refreshUnread = () => {
    void notifications.unreadCount().then(setUnread).catch(() => undefined);
  };

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 120000);
    return () => clearInterval(id);
  }, []);

  const handleBack = onBack ?? (() => navigate(-1));

  const go = (route: string) => {
    const norm = route.startsWith('/') ? route : `/${route}`;
    navigate(norm);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* =========================================================================
          DESKTOP SIDEBAR (Visible ONLY on >= 768px: hidden md:flex)
          Shows single permission-driven menu tree. Mobile tabs are excluded.
          ========================================================================= */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-300 md:flex',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <button
          type="button"
          onClick={() => go('/home')}
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4 transition-colors hover:bg-muted/50',
            collapsed ? 'justify-center px-0' : '',
          )}
        >
          <img src={logoUrl} alt="AanganOS" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
          {!collapsed ? (
            <span className="text-left leading-none">
              <span className="block text-base font-bold tracking-tight">
                <span className="text-foreground">Aangan</span>
                <span className="text-primary">OS</span>
              </span>
              <span className="mt-0.5 block text-[8.5px] font-semibold uppercase tracking-wider text-primary">
                Society ERP System
              </span>
            </span>
          ) : null}
        </button>

        <SidebarNav items={menuNodes} currentPath={location.pathname} onNavigate={go} collapsed={collapsed} />
      </aside>

      {/* =========================================================================
          MAIN COLUMN (Fills 100% width on Desktop and Mobile)
          ========================================================================= */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* ---------------------------------------------------------------------
            1. MOBILE TOP HEADER (Green gradient bar, visible ONLY on < 768px)
            --------------------------------------------------------------------- */}
        {!hideHeaderOnMobile && (
          <header className="safe-top flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-3 text-primary-foreground shadow-sm md:hidden">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}

            <div className="min-w-0 flex-1 pl-1">
              <h1 className="truncate text-lg font-extrabold leading-tight text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs font-medium text-white/85">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {rightAction ? (
              <div className="shrink-0">{rightAction}</div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                aria-label="Notifications"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[17px] text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </button>
            )}
          </header>
        )}

        {/* ---------------------------------------------------------------------
            2. DESKTOP TOP HEADER (Search, Bell, Language, Theme, User - >= 768px)
            --------------------------------------------------------------------- */}
        <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:flex">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle Sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t('admin.search', 'Search society, residents, visitors…')}
              className="h-9 w-full max-w-md rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Help"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) refreshUnread(); }}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </button>
              {notifOpen ? (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 z-40 w-80 sm:w-96 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                    <NotificationInbox />
                  </div>
                </>
              ) : null}
            </div>

            <LanguageSwitcher />
            <ThemeToggle />
            <DesktopUserPill societyName={societyName} unitLabel={unitLabel} />
          </div>
        </header>

        {/* ---------------------------------------------------------------------
            4. UNIFIED SCROLLABLE CONTENT BODY (Responsive spacing across all screens)
            --------------------------------------------------------------------- */}
        <main
          className={cn(
            'min-h-0 flex-1 overflow-y-auto w-full transition-all',
            hideHeaderOnMobile ? 'p-0 md:p-4' : 'p-3 sm:p-3.5 md:p-4',
            className,
          )}
        >
          <div className="mx-auto w-full max-w-[1600px] space-y-3 sm:space-y-3.5">
            {/* Desktop Page Banner (2nd UI: Visible ONLY on desktop >= 768px) */}
            {!hideDesktopSubHeader && (title || subtitle) && (
              <Card className="relative hidden overflow-hidden rounded-2xl border border-border/70 bg-card p-0 shadow-xs md:block">
                <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600" />
                <div className="flex flex-col gap-3 py-3.5 pl-4 pr-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {bannerIcon ?? <Building2 className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <h1 className="text-base font-semibold leading-tight text-foreground">{title}</h1>
                      {subtitle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                      ) : null}
                    </div>
                  </div>
                  {rightAction ? (
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {rightAction}
                    </div>
                  ) : null}
                </div>
              </Card>
            )}

            {children}
          </div>
        </main>

        {/* ---------------------------------------------------------------------
            5. MOBILE BOTTOM TAB BAR (Visible ONLY on < 768px: md:hidden)
            --------------------------------------------------------------------- */}
        {activeTab && onTabChange ? (
          <div className="md:hidden">
            <MobileBottomBar active={activeTab} onChange={onTabChange} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileBottomBar({
  active,
  onChange,
}: {
  active: BottomTabKey;
  onChange: (tab: BottomTabKey) => void;
}) {
  const { t } = useTranslation();
  const tabs: { key: BottomTabKey; icon: typeof Home; labelKey: string }[] = [
    { key: 'home', icon: Home, labelKey: 'common.tabHome' },
    { key: 'services', icon: LayoutGrid, labelKey: 'common.tabServices' },
    { key: 'profile', icon: User, labelKey: 'common.tabProfile' },
  ];

  return (
    <nav className="safe-bottom flex shrink-0 items-stretch border-t border-border bg-card shadow-sm" aria-label="Main Navigation">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2 active:scale-95 transition-all"
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-full px-3 py-0.5 transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                'text-[11px]',
                isActive ? 'font-bold text-primary' : 'font-medium text-muted-foreground',
              )}
            >
              {t(tab.labelKey)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function DesktopUserPill({
  societyName,
  unitLabel,
}: {
  societyName?: string | null;
  unitLabel?: string | null;
}) {
  const { displayName, roles, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = displayName ?? 'Admin';
  const role = roles[0] ?? 'User';

  const resolvedSociety = societyName || user?.organizationName || '';

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted transition-colors"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[120px] truncate text-xs font-semibold">{name}</span>
          <span className="block text-[10px] text-muted-foreground">{role}</span>
        </span>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl">
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-xs font-bold text-foreground">{name}</p>
              <p className="text-[11px] text-muted-foreground">{role}</p>

              {/* User requested: Show society name & flat in profile above Logout */}
              {resolvedSociety ? (
                <div className="mt-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs font-bold">{resolvedSociety}</span>
                  </div>
                  {unitLabel ? (
                    <p className="mt-0.5 pl-5 text-[10px] font-medium text-muted-foreground">
                      Flat {unitLabel}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              Log out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default AdaptiveShell;
