import { useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PanelLeftClose, PanelLeft, Search, Bell, HelpCircle,
  Home, LayoutGrid, User, ChevronLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logoUrl from '@shared/assets/logo.png';
import { notifications } from '@shared/services';
import { NotificationInbox } from '@shared/components/NotificationInbox';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { SidebarNav } from '@shared/components/SidebarNav';
import { useMenu } from '@shared/lib/useMenu';
import { useAuth } from '@shared/store/AuthContext';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { cn } from '@shared/lib/utils';

const HELP_URL = 'https://aanganos.sharcnix.com/help';

export type BottomTabKey = 'home' | 'services' | 'profile';

export interface AdaptiveShellProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  activeTab?: BottomTabKey | null;
  onTabChange?: (tab: BottomTabKey) => void;
  children: ReactNode;
  className?: string;
}

export function AdaptiveShell({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  activeTab,
  onTabChange,
  children,
  className,
}: AdaptiveShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSmall = useIsSmallScreen();
  const isNative = typeof (window as any).Capacitor !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  // Force mobile layout on small screens OR Capacitor native mobile apps
  const useMobileLayout = isSmall || isNative;

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

  // =========================================================================
  // 1. MOBILE & CAPACITOR VIEW (< 768px or native app)
  // Strict requirement: Native green gradient header, touch-friendly navigation
  // =========================================================================
  if (useMobileLayout) {
    return (
      <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-background">
        {/* Native Mobile Green Header */}
        <header className="safe-top flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-3 text-primary-foreground shadow-sm">
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

        {/* Scrollable Page Body */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
          {children}
        </div>

        {/* Mobile Bottom Tab Bar (if activeTab is supplied) */}
        {activeTab && onTabChange ? (
          <MobileBottomBar active={activeTab} onChange={onTabChange} />
        ) : null}
      </div>
    );
  }

  // =========================================================================
  // 2. DESKTOP VIEW (>= 768px Browser)
  // Expansive Society ERP Sidebar + Top Desktop Header + Wide Content
  // =========================================================================
  const go = (route: string) => {
    const norm = route.startsWith('/') ? route : `/${route}`;
    navigate(norm);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:flex dark:border-slate-800 dark:bg-slate-900',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <button
          type="button"
          onClick={() => go('/')}
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800',
            collapsed ? 'justify-center px-0' : '',
          )}
        >
          <img src={logoUrl} alt="AanganOS" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
          {!collapsed ? (
            <span className="text-left leading-none">
              <span className="block text-base font-semibold tracking-tight">
                <span className="text-slate-800 dark:text-slate-100">Aangan</span>
                <span className="text-emerald-600">OS</span>
              </span>
              <span className="mt-0.5 block text-[8.5px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Society ERP System
              </span>
            </span>
          ) : null}
        </button>

        <SidebarNav items={menuNodes} currentPath={location.pathname} onNavigate={go} collapsed={collapsed} />
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop Header */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Collapse Sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={t('admin.search', 'Search society, residents, visitors…')}
              className="h-9 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Help"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <HelpCircle className="h-5 w-5" />
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) refreshUnread(); }}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
                  <div className="absolute right-0 top-11 z-40 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <NotificationInbox />
                  </div>
                </>
              ) : null}
            </div>

            <LanguageSwitcher />
            <ThemeToggle />
            <DesktopUserPill />
          </div>
        </header>

        {/* Desktop Page Sub-Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 bg-background/50 px-6 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          {rightAction ? <div>{rightAction}</div> : null}
        </div>

        {/* Desktop Content Area */}
        <main className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)}>
          {children}
        </main>
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

function DesktopUserPill() {
  const { displayName, roles, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const name = displayName ?? 'Admin';
  const role = roles[0] ?? 'User';

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
          <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl">
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-xs font-bold text-foreground">{name}</p>
              <p className="text-[11px] text-muted-foreground">{role}</p>
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
