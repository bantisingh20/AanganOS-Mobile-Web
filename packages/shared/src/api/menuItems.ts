import type { ApiClient } from './client';
import { buildQuery } from './query';

export interface MenuItem {
  id: string;
  parentId: string | null;
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  surface: number;
  requiredPermissionActions: number[];
  requiredPermissionResource: string | null;
  sortOrder: number;
  isActive: boolean;
  showInSidebar: boolean;
}

export interface MenuItemBody {
  parentId?: string | null;
  key?: string;
  label: string;
  icon?: string | null;
  route?: string | null;
  surface: number;
  requiredPermissionActions?: number[];
  requiredPermissionResource?: string | null;
  sortOrder: number;
  isActive: boolean;
  showInSidebar: boolean;
}

export class MenuItemsClient {
  constructor(private readonly api: ApiClient) {}

  list(surface?: string, options?: { signal?: AbortSignal }): Promise<MenuItem[]> {
    const qs = buildQuery({ surface });
    return this.api.get<MenuItem[]>(`/api/v1/menu-items${qs}`, options);
  }

  create(body: MenuItemBody): Promise<MenuItem> {
    return this.api.post<MenuItem>('/api/v1/menu-items', { body });
  }

  update(id: string, body: MenuItemBody): Promise<MenuItem> {
    return this.api.put<MenuItem>(`/api/v1/menu-items/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/menu-items/${id}`);
  }
}
