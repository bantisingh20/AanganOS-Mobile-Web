import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface WatchlistEntry {
  id: string;
  communityId: string;
  subjectType: string;
  subjectIdentifier: string;
  reason: string;
  severity: string;
  status: string;
}

export interface WatchlistFilters {
  status?: string;
  subjectType?: string;
  severity?: string;
}

export interface AddWatchlistEntryBody {
  communityId: string;
  subjectType: string;
  subjectIdentifier: string;
  reason: string;
  severity: string;
}

export interface SosAlert {
  id: string;
  communityId: string;
  raisedByUserId: string;
  unitId?: string | null;
  location?: string | null;
  status: string;
  raisedAtUtc: string;
}

export interface RaiseSosBody {
  communityId: string;
  raisedByUserId: string;
  unitId?: string;
  location?: string;
}

export class SecurityOpsClient {
  constructor(private readonly api: ApiClient) {}

  listWatchlist(query: ListQuery = {}, filters: WatchlistFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<WatchlistEntry>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      subjectType: filters.subjectType,
      severity: filters.severity,
    });
    return this.api.get<PagedData<WatchlistEntry>>(`/api/v1/watchlist${qs}`, options);
  }

  addWatchlistEntry(body: AddWatchlistEntryBody): Promise<WatchlistEntry> {
    return this.api.post<WatchlistEntry>('/api/v1/watchlist', { body });
  }

  clearWatchlistEntry(id: string): Promise<WatchlistEntry> {
    return this.api.post<WatchlistEntry>(`/api/v1/watchlist/${id}/clear`, {});
  }

  listSosAlerts(query: ListQuery = {}, status?: string, options?: { signal?: AbortSignal }): Promise<PagedData<SosAlert>> {
    const qs = buildQuery({ ...listQueryParams(query), status });
    return this.api.get<PagedData<SosAlert>>(`/api/v1/sos-alerts${qs}`, options);
  }

  raiseSos(body: RaiseSosBody): Promise<SosAlert> {
    return this.api.post<SosAlert>('/api/v1/sos-alerts', { body });
  }

  acknowledgeSos(id: string, userId: string): Promise<SosAlert> {
    return this.api.post<SosAlert>(`/api/v1/sos-alerts/${id}/acknowledge`, { body: { userId } });
  }

  resolveSos(id: string, userId: string): Promise<SosAlert> {
    return this.api.post<SosAlert>(`/api/v1/sos-alerts/${id}/resolve`, { body: { userId } });
  }
}
