import type { ApiClient } from './client';
import { buildQuery } from './query';

export interface Permission {
  id: string;
  resourceType: string;
  action: number;
}

export class PermissionsClient {
  constructor(private readonly api: ApiClient) {}

  list(resourceType?: string, options?: { signal?: AbortSignal }): Promise<Permission[]> {
    const qs = buildQuery({ resourceType });
    return this.api.get<Permission[]>(`/api/v1/permissions${qs}`, options);
  }
}
