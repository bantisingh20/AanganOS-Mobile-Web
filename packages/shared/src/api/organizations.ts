import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';
import { cacheInvalidate } from '../lib/cache';
import { SubscriptionStatus } from './subscriptions';

export interface Organization {
  id: string;
  name: string;
  propertyType?: string | null;
  isArchived: boolean;
  hasActiveAdmin: boolean;
  communityCount: number;
  expiryData: SubscriptionStatus;
}

export class OrganizationsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<PagedData<Organization>> {
    const qs = buildQuery(listQueryParams(query));
    if (options?.forceRefresh) {
      cacheInvalidate('org');
    }
    return this.api.get<PagedData<Organization>>(`/api/v1/organizations${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Organization> {
    if (options?.forceRefresh) {
      cacheInvalidate(`org_${id}`);
    }
    return this.api.get<Organization>(`/api/v1/organizations/${id}`, options);
  }

  async create(name: string, propertyType?: string): Promise<Organization> {
    const res = await this.api.post<Organization>('/api/v1/organizations', { body: { name, propertyType } });
    cacheInvalidate('org');
    return res;
  }

  async update(id: string, name: string, propertyType?: string): Promise<Organization> {
    const res = await this.api.put<Organization>(`/api/v1/organizations/${id}`, { body: { name, propertyType } });
    cacheInvalidate('org');
    return res;
  }

  async remove(id: string): Promise<{ id: string }> {
    const res = await this.api.delete<{ id: string }>(`/api/v1/organizations/${id}`);
    cacheInvalidate('org');
    return res;
  }

  async activate(id: string): Promise<Organization> {
    const res = await this.api.post<Organization>(`/api/v1/organizations/${id}/activate`, {});
    cacheInvalidate('org');
    return res;
  }
}
