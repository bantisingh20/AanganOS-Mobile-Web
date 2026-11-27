import type { ApiResult, ErrorCode } from './types';
import type { TokenStore } from './tokenStore';
import { ApiRequestError } from './errors';

const CORRELATION_ID_HEADER = 'X-Correlation-Id';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  correlationId?: string;
  anonymous?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type TokenRefresher = (store: TokenStore) => Promise<string | null>;

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  refreshToken?: TokenRefresher;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokenStore: TokenStore;
  private readonly refreshToken?: TokenRefresher;
  private inFlightRefresh: Promise<string | null> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.tokenStore = options.tokenStore;
    this.refreshToken = options.refreshToken;
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  put<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const correlationId = options.correlationId ?? newCorrelationId();
    try {
      return await this.send<T>(method, path, options, correlationId);
    } catch (err) {
      if (err instanceof ApiRequestError && err.isUnauthenticated && !options.anonymous) {
        let refreshed: string | null;
        try {
          refreshed = await this.tryRefresh();
        } catch {
          // Refresh couldn't reach the server (offline / timeout / 5xx). Keep the session — the user
          // stays signed in and this request just fails like any other network error.
          throw new ApiRequestError({
            code: 'INTEGRATION_FAILURE',
            message: 'Could not connect to the server. Please try again.',
            correlationId,
            httpStatus: 0,
          });
        }
        if (refreshed) {
          return await this.send<T>(method, path, options, correlationId);
        }
        this.tokenStore.clear();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          const loginTarget = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
          window.location.replace(loginTarget);
        }
      }
      throw err;
    }
  }

  private async send<T>(method: HttpMethod, path: string, options: RequestOptions, correlationId: string): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      [CORRELATION_ID_HEADER]: correlationId,
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!options.anonymous) {
      const token = this.tokenStore.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const onCallerAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      const timedOut = controller.signal.aborted;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      // Keep the real reason (e.g. "Trust anchor for certification path not found",
      // "Unable to resolve host") visible in logcat / chrome://inspect for debugging.
      if (!timedOut) console.warn(`[api] ${method} ${path.split('?')[0]} failed:`, cause);
      const reason = timedOut || offline ? null : await nativeFailureReason(this.baseUrl, cause);
      throw new ApiRequestError({
        code: 'INTEGRATION_FAILURE',
        message: timedOut
          ? 'The server took too long to respond.'
          : offline
            ? 'No internet connection. Please check your network and try again.'
            : `Could not connect to the server. Please try again.${reason ? ` (${reason})` : ''}`,
        correlationId,
        httpStatus: 0,
      });
    } finally {
      clearTimeout(timeout);
      if (options.signal) options.signal.removeEventListener('abort', onCallerAbort);
    }

    return this.parseEnvelope<T>(response, correlationId);
  }

  private async parseEnvelope<T>(response: Response, fallbackCorrelationId: string): Promise<T> {
    const headerCorrelationId = response.headers.get(CORRELATION_ID_HEADER) ?? undefined;
    let envelope: ApiResult<T> | null = null;
    try {
      envelope = (await response.json()) as ApiResult<T>;
    } catch {
      envelope = null;
    }
    const correlationId = envelope?.correlationId || headerCorrelationId || fallbackCorrelationId;

    if (!envelope) {
      if (response.ok) return null as T;
      throw new ApiRequestError({
        code: httpStatusToCode(response.status),
        message: `Unexpected non-JSON response (HTTP ${response.status}).`,
        correlationId,
        httpStatus: response.status,
      });
    }

    if (envelope.success && response.ok) return envelope.data as T;
    if (envelope.error) throw ApiRequestError.fromApiError(envelope.error, correlationId, response.status);

    throw new ApiRequestError({
      code: httpStatusToCode(response.status),
      message: `Request failed (HTTP ${response.status}).`,
      correlationId,
      httpStatus: response.status,
    });
  }

  private tryRefresh(): Promise<string | null> {
    if (!this.refreshToken) return Promise.resolve(null);
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.refreshToken(this.tokenStore).finally(() => {
        this.inFlightRefresh = null;
      });
    }
    return this.inFlightRefresh;
  }
}

function httpStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 429:
      return 'RATE_LIMITED';
    case 502:
      return 'INTEGRATION_FAILURE';
    default:
      return 'INTERNAL_ERROR';
  }
}

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  nativePromise?: (plugin: string, method: string, options: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Explains *why* a request failed inside the Android/iOS app.
 * Capacitor routes GET requests through a local proxy that swallows the native
 * exception, so the page only sees "Failed to fetch". Here we probe /health through
 * the native HTTP plugin directly, which returns the real Java/Swift error
 * (e.g. "SSLHandshakeException: Trust anchor for certification path not found").
 * Returns null on the web, where the browser already reports the cause.
 */
async function nativeFailureReason(baseUrl: string, cause: unknown): Promise<string | null> {
  const cap = (globalThis as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.nativePromise) return null;
  try {
    await cap.nativePromise('CapacitorHttp', 'request', {
      url: `${baseUrl}/health`,
      method: 'GET',
      headers: {},
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    // Native networking works, so the failure is on the WebView side.
    const msg = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    return `webview: ${msg}`.slice(0, 160);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return [err.code, err.message].filter(Boolean).join(': ').slice(0, 160) || 'unknown native error';
  }
}

function newCorrelationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
