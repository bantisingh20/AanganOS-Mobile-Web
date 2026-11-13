import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Community {
  id: string;
  organizationId: string;
  name: string;
  communityType: string;
  organizationName: string | null;
}

export interface CommunityListFilters {
  communityType?: string;
  organizationId?: string;
}

export class CommunitiesClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: CommunityListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Community>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      communityType: filters.communityType,
      organizationId: filters.organizationId,
    });
    return this.api.get<PagedData<Community>>(`/api/v1/communities${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Community> {
    return this.api.get<Community>(`/api/v1/communities/${id}`, options);
  }

  create(body: { organizationId: string; name: string; communityType: string }): Promise<Community> {
    return this.api.post<Community>('/api/v1/communities', { body });
  }

  update(id: string, body: { name?: string; communityType?: string }): Promise<Community> {
    return this.api.put<Community>(`/api/v1/communities/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/communities/${id}`);
  }
}
