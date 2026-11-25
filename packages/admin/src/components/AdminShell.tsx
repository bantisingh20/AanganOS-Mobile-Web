import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeft, Bell, LogOut, X, HelpCircle, KeyRound, CheckCheck, Moon, Sun, Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MenuNode } from '@shared/api/menu';
import logoUrl from '@shared/assets/logo.png';
import { toast } from 'sonner';
import { notifications } from '@shared/services';
import { NotificationInbox, type NotificationInboxHandle } from '@shared/components/NotificationInbox';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { useAppTheme } from '@shared/lib/useTheme';
import { Toaster } from '@shared/components/ui/sonner';
import { SidebarNav } from '@shared/components/SidebarNav';
import { menuIcon } from '@shared/components/menuIcons';
import { useMenu } from '@shared/lib/useMenu';
import { useAuth } from '@shared/store/AuthContext';
import { cn } from '@shared/lib/utils';
import { ADMIN_FALLBACK_MENU } from './nav';
import { ChangePasswordDialog } from './ChangePasswordDialog';

const HELP_URL = 'https://aanganos.sharcnix.com/help';

function leafItems(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    if (n.route) out.push(n);
    if (n.children.length > 0) out.push(...leafItems(n.children));
  }
  return out;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const inboxControls = useRef<NotificationInboxHandle | null>(null);

  const refreshUnread = () => { void notifications.unreadCount().then(setUnread).catch(() => undefined); };
  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 120000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:flex dark:border-slate-800 dark:bg-slate-900',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <SidebarBody collapsed={collapsed} onNavigate={() => undefined} onToggleCollapse={() => setCollapsed((c) => !c)} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="safe-top safe-bottom absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close"
              className="absolute right-2 top-3 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-[4px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1.5 sm:gap-2 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Collapse"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:flex dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          {/* Logo/Branding on mobile when sidebar is hidden */}
          <div className="flex items-center gap-2 md:hidden">
            <img src={logoUrl} alt="AanganOS" className="h-6.5 w-6.5 rounded-[4px] object-cover shrink-0 ring-1 ring-emerald-500/20" />
            <span className="text-sm font-bold tracking-tight">
              <span>Aangan</span>
              <span className="text-emerald-600">OS</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={t('admin.help')}
              title={t('admin.help')}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </a>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) refreshUnread(); }}
                aria-label="Notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 ? (
                  <span className="absolute 0 top-0 flex min-w-[15px] h-[15px] items-center justify-center rounded-full bg-rose-600 px-0.5 text-[9px] font-bold leading-none text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </button>
              {notifOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 flex max-h-[70vh] w-[360px] max-w-[92vw] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                      <span className="text-xs font-bold">{t('notifications.title')}</span>
                      <button
                        type="button"
                        onClick={() => void inboxControls.current?.markAllRead()}
                        aria-label={t('notifications.markAllRead')}
                        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-accent"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                      <NotificationInbox onChanged={refreshUnread} controlsRef={(h) => { inboxControls.current = h; }} />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="hidden md:flex items-center gap-1 sm:gap-1.5">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <UserPill />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-3 pb-20 sm:p-4 md:pb-4 lg:p-5">{children}</main>

        <footer className="hidden shrink-0 flex-col items-center justify-between gap-1 border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500 sm:flex-row md:flex dark:border-slate-800 dark:bg-slate-900">
          <span>{t('admin.footer')}</span>
          <span>© {new Date().getFullYear()} AanganOS · v0.1.0</span>
        </footer>

        <BottomBar />
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}

function BottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useMenu(ADMIN_FALLBACK_MENU);
  const { t } = useTranslation();
  const bar = leafItems(items).slice(0, 4);

  const isActive = (route: string | null) => {
    if (!route) return false;
    const norm = route.startsWith('/') ? route : `/${route}`;
    return location.pathname === norm || location.pathname.startsWith(`${norm}/`);
  };

  return (
    <nav className="safe-bottom flex shrink-0 items-stretch border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
      {bar.map((item) => {
        const Icon = menuIcon(item.icon);
        const active = isActive(item.route);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => item.route && navigate(item.route.startsWith('/') ? item.route : `/${item.route}`)}
            className={cn('flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium', active ? 'text-emerald-600' : 'text-slate-500')}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{t(`menu.${item.key}`, { defaultValue: item.label })}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onNavigate: () => void;
  onToggleCollapse?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useMenu(ADMIN_FALLBACK_MENU);

  const go = (route: string) => {
    const norm = route.startsWith('/') ? route : `/${route}`;
    navigate(norm);
    onNavigate();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => go('/dashboard')}
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200/80 px-3.5 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40',
          collapsed ? 'justify-center px-0' : '',
        )}
      >
        <img src={logoUrl} alt="AanganOS" className="h-8 w-8 shrink-0 rounded-[4px] object-cover ring-1 ring-emerald-500/20" />
        {!collapsed ? (
          <span className="text-left leading-none">
            <span className="block text-sm font-bold tracking-tight">
              <span className="text-slate-800 dark:text-slate-100">Aangan</span>
              <span className="text-emerald-600">OS</span>
            </span>
            <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Enterprise ERP
            </span>
          </span>
        ) : null}
      </button>

      <SidebarNav items={items} currentPath={location.pathname} onNavigate={go} collapsed={collapsed} />

      <div className={cn('mt-auto shrink-0 border-t border-slate-200/80 p-2 dark:border-slate-800', collapsed ? 'flex justify-center' : 'flex items-center justify-between')}>
        {!collapsed ? (
          <div className="flex items-center gap-1.5 px-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono">v0.1.0</span>
          </div>
        ) : null}
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
    </>
  );
}

function UserPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { displayName, roles, user, logout } = useAuth();
  const { isDark, setTheme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const name = displayName ?? 'Admin';
  const role = roles[0] ?? 'Admin';
  const contact = user?.email || user?.phone || '';

  const onLogout = async () => {
    await logout();
    toast.success(t('admin.loggedOut'));
    navigate('/login');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded-[4px] border border-border/80 bg-card/60 px-2 text-slate-700 hover:bg-accent/50 dark:text-slate-200 transition-colors shadow-xs"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white shadow-xs">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left leading-none sm:block">
          <span className="block max-w-[110px] truncate text-xs font-semibold text-foreground">{name}</span>
          <span className="mt-0.5 block text-[9.5px] text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className={cn("hidden sm:block h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-60 overflow-hidden rounded-[6px] border border-border bg-card p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 border-b border-border/60 p-2 dark:border-slate-800">
              <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-xs">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{name}</div>
                {contact ? <div className="truncate text-[10.5px] text-muted-foreground">{contact}</div> : null}
                <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{role}</div>
              </div>
            </div>

            {/* Small screen controls: Theme & Language */}
            <div className="border-b border-border/60 p-2 md:hidden dark:border-slate-800 space-y-1.5 bg-muted/20 rounded-[4px] mt-1 mb-1">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  {isDark ? <Moon className="h-3.5 w-3.5 text-primary" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
                  <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="h-6 px-2 text-[11px] font-medium rounded-[4px] border border-border bg-card text-foreground hover:bg-accent transition-colors"
                >
                  {isDark ? 'Light' : 'Dark'}
                </button>
              </div>

              <div className="flex items-center justify-between px-1 text-xs pt-1 border-t border-border/50">
                <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span>{t('admin.language', { defaultValue: 'Language' })}</span>
                </span>
                <LanguageSwitcher className="h-6 text-[11px] px-2 rounded-[4px]" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); setPwdOpen(true); }}
              className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {t('admin.changePassword')}
            </button>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t('admin.help')}
            </a>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-[4px] border-t border-border/60 px-2 py-1.5 mt-0.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('admin.logout')}
            </button>
          </div>
        </>
      ) : null}
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}
