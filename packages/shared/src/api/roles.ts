import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface PermissionGrant {
  action: number;
  resourceType: string;
}

export interface Role {
  id: string;
  name: string;
  scope: number;
  communityId: string | null;
  permissions: PermissionGrant[];
  isDeleted: boolean;
}

export interface DefineRoleBody {
  name: string;
  scope: number;
  communityId?: string | null;
  permissions: PermissionGrant[];
}

export class RolesClient {
  constructor(private readonly api: ApiClient) {}

  private allRoles: Promise<PagedData<Role>> | null = null;

  list(query: ListQuery = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Role>> {
    const qs = buildQuery(listQueryParams(query));
    return this.api.get<PagedData<Role>>(`/api/v1/roles${qs}`, options);
  }

  /**
   * Every role (up to 100) for dropdowns and lookups, cached for the session. Used by Roles, People
   * and Admin Users pages instead of each fetching the same list. Cleared on any role change.
   */
  all(): Promise<PagedData<Role>> {
    if (!this.allRoles) {
      this.allRoles = this.list({ pageSize: 100 }).catch((err) => { this.allRoles = null; throw err; });
    }
    return this.allRoles;
  }

  invalidate(): void {
    this.allRoles = null;
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Role> {
    return this.api.get<Role>(`/api/v1/roles/${id}`, options);
  }

  create(body: DefineRoleBody): Promise<Role> {
    return this.api.post<Role>('/api/v1/roles', { body }).finally(() => this.invalidate());
  }

  update(id: string, body: DefineRoleBody): Promise<Role> {
    return this.api.put<Role>(`/api/v1/roles/${id}`, { body }).finally(() => this.invalidate());
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/roles/${id}`).finally(() => this.invalidate());
  }
}
