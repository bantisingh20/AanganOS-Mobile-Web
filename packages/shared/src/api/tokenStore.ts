import { safeStorage } from '../lib/storage';

export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc?: string;
  user?: unknown;
}

export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getUser<T = unknown>(): T | null;
  setFromLogin(tokens: LoginTokens): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

const ACCESS_KEY = 'aanganos.accessToken';
const REFRESH_KEY = 'aanganos.refreshToken';
const USER_KEY = 'aanganos.user';

export class WebTokenStore implements TokenStore {
  private readonly listeners = new Set<() => void>();

  getAccessToken(): string | null {
    return safeStorage.get(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return safeStorage.get(REFRESH_KEY);
  }

  getUser<T = unknown>(): T | null {
    return safeStorage.getJson<T | null>(USER_KEY, null);
  }

  setFromLogin(tokens: LoginTokens): void {
    safeStorage.set(ACCESS_KEY, tokens.accessToken);
    safeStorage.set(REFRESH_KEY, tokens.refreshToken);
    if (tokens.user != null) {
      safeStorage.setJson(USER_KEY, tokens.user);
    }
    this.emit();
  }

  clear(): void {
    safeStorage.remove(ACCESS_KEY);
    safeStorage.remove(REFRESH_KEY);
    safeStorage.remove(USER_KEY);
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        void 0;
      }
    });
  }
}
