import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Organization {
  id: string;
  name: string;
  isArchived: boolean;
  hasActiveAdmin: boolean;
}

export class OrganizationsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Organization>> {
    return this.api.get<PagedData<Organization>>(`/api/v1/organizations${buildQuery(listQueryParams(query))}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Organization> {
    return this.api.get<Organization>(`/api/v1/organizations/${id}`, options);
  }

  create(name: string): Promise<Organization> {
    return this.api.post<Organization>('/api/v1/organizations', { body: { name } });
  }

  update(id: string, name: string): Promise<Organization> {
    return this.api.put<Organization>(`/api/v1/organizations/${id}`, { body: { name } });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/organizations/${id}`);
  }

  activate(id: string): Promise<Organization> {
    return this.api.post<Organization>(`/api/v1/organizations/${id}/activate`, {});
  }
}
