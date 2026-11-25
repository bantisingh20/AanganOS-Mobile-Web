import type { ApiClient } from './client';
import { buildQuery } from './query';

export interface ErrorLogSummary {
  id: string;
  createdAtUtc: string;
  correlationId: string | null;
  apiPath: string;
  httpMethod: string;
  statusCode: number;
  exceptionType: string;
  errorMessage: string;
  fileName: string | null;
  controllerOrFunction: string | null;
  lineNumber: number | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  organizationId: string | null;
  communityId: string | null;
}

export interface ErrorLogDetail extends ErrorLogSummary {
  stackTrace: string | null;
  requestBody: string | null;
  queryParams: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

export interface ErrorLogListQuery {
  search?: string;
  statusCode?: number;
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedErrorLogs {
  items: ErrorLogSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export class ErrorLogsClient {
  constructor(private readonly api: ApiClient) {}

  list(query?: ErrorLogListQuery, options?: { signal?: AbortSignal }): Promise<PagedErrorLogs> {
    const qs = buildQuery({
      search: query?.search,
      statusCode: query?.statusCode,
      fromUtc: query?.fromUtc,
      toUtc: query?.toUtc,
      page: query?.page,
      pageSize: query?.pageSize,
    });
    return this.api.get<PagedErrorLogs>(`/api/v1/error-logs${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<ErrorLogDetail> {
    return this.api.get<ErrorLogDetail>(`/api/v1/error-logs/${id}`, options);
  }

  delete(id: string): Promise<boolean> {
    return this.api.delete<boolean>(`/api/v1/error-logs/${id}`);
  }

  clear(olderThanDays?: number): Promise<number> {
    const qs = buildQuery({ olderThanDays });
    return this.api.delete<number>(`/api/v1/error-logs/clear${qs}`);
  }
}
