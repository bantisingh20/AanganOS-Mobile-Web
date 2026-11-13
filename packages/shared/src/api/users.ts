import type { ApiClient } from './client';

export type UserStatus = 'Active' | 'Suspended';

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
}

export interface UpdateUserBody {
  status: UserStatus;
}

export class UsersClient {
  constructor(private readonly api: ApiClient) {}

  get(id: string, options?: { signal?: AbortSignal }): Promise<User> {
    return this.api.get<User>(`/api/v1/users/${id}`, options);
  }

  update(id: string, body: UpdateUserBody): Promise<User> {
    return this.api.put<User>(`/api/v1/users/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/users/${id}`);
  }
}
