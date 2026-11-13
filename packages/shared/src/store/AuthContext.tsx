import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth, tokenStore } from '@shared/services';
import type { LoginRequest, LoginResponse } from '@shared/api/auth';
import { resetMenuCache } from '@shared/lib/useMenu';
import { resetHomeTilesCache } from '@shared/lib/appTiles';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: LoginResponse['user'];
  roles: string[];
  displayName: string | null;
  login: (request: LoginRequest) => Promise<LoginResponse>;
  adoptSession: (result: LoginResponse) => void;
  logout: () => Promise<void>;
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
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (request: LoginRequest) => {
    const result = await auth.login(request);
    resetMenuCache();
    resetHomeTilesCache();
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }, []);

  const adoptSession = useCallback((result: LoginResponse) => {
    tokenStore.setFromLogin(result);
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
