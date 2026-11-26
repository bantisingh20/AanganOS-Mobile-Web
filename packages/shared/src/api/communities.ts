import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';
import { cacheInvalidate } from '../lib/cache';

export interface Community {
  id: string;
  organizationId: string;
  name: string;
  communityType?: string | null;
  organizationName: string | null;
}

export interface CommunityListFilters {
  communityType?: string;
  organizationId?: string;
}

export class CommunitiesClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: CommunityListFilters = {}, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<PagedData<Community>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      communityType: filters.communityType,
      organizationId: filters.organizationId,
    });
    if (options?.forceRefresh) {
      cacheInvalidate('communit');
    }
    return this.api.get<PagedData<Community>>(`/api/v1/communities${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Community> {
    if (options?.forceRefresh) {
      cacheInvalidate(`community_${id}`);
    }
    return this.api.get<Community>(`/api/v1/communities/${id}`, options);
  }

  async create(body: { organizationId: string; name: string; communityType?: string }): Promise<Community> {
    const res = await this.api.post<Community>('/api/v1/communities', { body });
    cacheInvalidate('communit');
    return res;
  }

  async update(id: string, body: { name?: string; communityType?: string }): Promise<Community> {
    const res = await this.api.put<Community>(`/api/v1/communities/${id}`, { body });
    cacheInvalidate('communit');
    return res;
  }

  async remove(id: string): Promise<{ id: string }> {
    const res = await this.api.delete<{ id: string }>(`/api/v1/communities/${id}`);
    cacheInvalidate('communit');
    return res;
  }
}
