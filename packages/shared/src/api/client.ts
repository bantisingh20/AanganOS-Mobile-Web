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
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return await this.send<T>(method, path, options, correlationId);
        }
        this.tokenStore.clear();
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
    const timeout = setTimeout(() => controller.abort(), 15000);
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
      throw new ApiRequestError({
        code: 'INTEGRATION_FAILURE',
        message: timedOut ? 'The server took too long to respond.' : 'Network request failed.',
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

function newCorrelationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
