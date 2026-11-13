import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface AdminUserRoleScope {
  roleId: string;
  roleName: string;
  communityId: string | null;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  roles: string[];
  assignments: AdminUserRoleScope[];
}

export interface CreateAdminUserBody {
  name?: string | null;
  identifier: string;
  password: string;
  roleName: string;
  organizationId?: string | null;
  communityId?: string | null;
}

export interface UpdateAdminUserBody {
  name?: string | null;
  password?: string | null;
  roleName: string;
  status: string;
  organizationId?: string | null;
  communityId?: string | null;
}

export class AdminUsersClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, options?: { signal?: AbortSignal }): Promise<PagedData<AdminUser>> {
    return this.api.get<PagedData<AdminUser>>(`/api/v1/admin-users${buildQuery(listQueryParams(query))}`, options);
  }

  create(body: CreateAdminUserBody): Promise<AdminUser> {
    return this.api.post<AdminUser>('/api/v1/admin-users', { body });
  }

  update(id: string, body: UpdateAdminUserBody): Promise<AdminUser> {
    return this.api.put<AdminUser>(`/api/v1/admin-users/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/admin-users/${id}`);
  }
}
