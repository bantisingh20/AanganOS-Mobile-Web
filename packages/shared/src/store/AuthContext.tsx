import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, tokenStore, masterData, roles as rolesApi, menuItems } from '@shared/services';
import { startUnreadPolling, resetUnreadCount } from '@shared/lib/hooks/useUnreadCount';
import { resetEntityNameCache } from '@shared/lib/entityFetchers';
import { loadBootstrap, resetBootstrap } from '@shared/lib/hooks/useBootstrap';
import type { LoginRequest, LoginResponse } from '@shared/api/auth';
import { resetMenuCache } from '@shared/lib/hooks/useMenu';
import { resetHomeTilesCache } from '@shared/lib/appTiles';
import { cacheInvalidate } from '@shared/lib/cache';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: LoginResponse['user'];
  roles: string[];
  displayName: string | null;
  login: (request: LoginRequest) => Promise<LoginResponse>;
  adoptSession: (result: LoginResponse) => void;
  logout: () => Promise<void>;
}

/** Per-account caches that must not leak into the next account on this device. */
function resetSessionCaches() {
  resetEntityNameCache();
  resetBootstrap();
  masterData.invalidate();
  rolesApi.invalidate();
  menuItems.invalidate();
  resetUnreadCount();
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse['user']>(() =>
    tokenStore.getAccessToken() ? tokenStore.getUser<NonNullable<LoginResponse['user']>>() : null,
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!tokenStore.getAccessToken());

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe(() => {
      const hasToken = !!tokenStore.getAccessToken();
      setIsAuthenticated(hasToken);
      setUser(hasToken ? tokenStore.getUser<NonNullable<LoginResponse['user']>>() : null);
      if (!hasToken && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        const loginTarget = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        window.location.replace(loginTarget);
      }
    });
    return unsubscribe;
  }, []);

  // One unread-count poll (60 s, only while visible & online) doubles as the session check: if the
  // session was ended on another device the call returns 401 and the API client signs the user out
  // (tokenStore.subscribe above redirects to login). Replaces the old 3-second heartbeat.
  // Startup data (menu, unread count, task summary, profile, version, common lists) in ONE request.
  // Started during render, not in an effect: child effects (Home, update check, menu) run BEFORE this
  // provider's effects and would otherwise fetch on their own. loadBootstrap() is idempotent.
  if (isAuthenticated) void loadBootstrap();

  useEffect(() => {
    if (!isAuthenticated) return;
    return startUnreadPolling();
  }, [isAuthenticated]);

  const login = useCallback(async (request: LoginRequest) => {
    const result = await auth.login(request);
    resetMenuCache();
    resetHomeTilesCache();
    resetSessionCaches();
    cacheInvalidate();
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }, []);

  const adoptSession = useCallback((result: LoginResponse) => {
    tokenStore.setFromLogin(result);
    resetSessionCaches();
    cacheInvalidate();
    setUser(result.user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      tokenStore.clear();
    } finally {
      resetMenuCache();
      resetHomeTilesCache();
      resetSessionCaches();
      cacheInvalidate();
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const roles = user?.roles ?? [];
  const displayName = user?.name ?? user?.phone ?? user?.email ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, user, roles, displayName, login, adoptSession, logout }),
    [isAuthenticated, user, roles, displayName, login, adoptSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
