import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeft, Search, Bell, LogOut, X, HelpCircle, KeyRound, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MenuNode } from '@shared/api/menu';
import logoUrl from '@shared/assets/logo.png';
import { toast } from 'sonner';
import { notifications } from '@shared/services';
import { NotificationInbox, type NotificationInboxHandle } from '@shared/components/NotificationInbox';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { Toaster } from '@shared/components/ui/sonner';
import { SidebarNav } from '@shared/components/SidebarNav';
import { menuIcon } from '@shared/components/menuIcons';
import { useMenu } from '@shared/lib/useMenu';
import { useAuth } from '@shared/store/AuthContext';
import { cn } from '@shared/lib/utils';
import { ADMIN_FALLBACK_MENU } from './nav';
import { ChangePasswordDialog } from './ChangePasswordDialog';

const HELP_URL = 'https://docs.sharcnix.com';

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
    const id = setInterval(refreshUnread, 60000);
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
        <SidebarBody collapsed={collapsed} onNavigate={() => undefined} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="safe-top safe-bottom absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl dark:bg-slate-900">
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close" className="absolute right-2 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-5 w-5" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800">
            <Menu className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label="Collapse" className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800">
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={t('admin.search')}
              className="h-9 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <a href={HELP_URL} target="_blank" rel="noreferrer" aria-label={t('admin.help')} title={t('admin.help')} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <HelpCircle className="h-5 w-5" />
            </a>
            <div className="relative">
              <button type="button" onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) refreshUnread(); }} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>
                ) : null}
              </button>
              {notifOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 flex max-h-[70vh] w-[360px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-sm font-bold">{t('notifications.title')}</span>
                      <button type="button" onClick={() => void inboxControls.current?.markAllRead()} aria-label={t('notifications.markAllRead')} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                      <NotificationInbox onChanged={refreshUnread} controlsRef={(h) => { inboxControls.current = h; }} />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <ThemeToggle />
            <LanguageSwitcher />
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

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
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
        className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800', collapsed ? 'justify-center px-0' : '')}
      >
        <img src={logoUrl} alt="AanganOS" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        {!collapsed ? (
          <span className="text-left leading-none">
            <span className="block text-base font-semibold tracking-tight">
              <span className="text-slate-800 dark:text-slate-100">Aangan</span>
              <span className="text-emerald-600">OS</span>
            </span>
            <span className="mt-0.5 block text-[8.5px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Society ERP System</span>
          </span>
        ) : null}
      </button>

      <SidebarNav items={items} currentPath={location.pathname} onNavigate={go} collapsed={collapsed} />
    </>
  );
}

function UserPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { displayName, roles, user, logout } = useAuth();
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
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[120px] truncate text-xs font-medium">{name}</span>
          <span className="block text-[10px] text-slate-500 dark:text-slate-400">{role}</span>
        </span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-3 dark:border-slate-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{name}</div>
                {contact ? <div className="truncate text-xs text-slate-500 dark:text-slate-400">{contact}</div> : null}
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">{role}</div>
              </div>
            </div>
            <button type="button" onClick={() => { setOpen(false); setPwdOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
              <KeyRound className="h-4 w-4" />
              {t('admin.changePassword')}
            </button>
            <a href={HELP_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
              <HelpCircle className="h-4 w-4" />
              {t('admin.help')}
            </a>
            <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40">
              <LogOut className="h-4 w-4" />
              {t('admin.logout')}
            </button>
          </div>
        </>
      ) : null}
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}
