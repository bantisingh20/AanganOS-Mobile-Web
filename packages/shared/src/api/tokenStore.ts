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
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  getUser<T = unknown>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setFromLogin(tokens: LoginTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    if (tokens.user != null) {
      localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
    }
    this.emit();
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
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
