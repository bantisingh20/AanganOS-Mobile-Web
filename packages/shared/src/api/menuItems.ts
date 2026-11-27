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

  // Session cache per surface: Menu management, Roles → Permissions and Master data all load the
  // same catalog. Cleared on any create / update / delete and on account change.
  private readonly cache = new Map<string, Promise<MenuItem[]>>();

  list(surface?: string, _options?: { signal?: AbortSignal }): Promise<MenuItem[]> {
    const key = surface ?? '';
    let p = this.cache.get(key);
    if (!p) {
      const qs = buildQuery({ surface });
      // No abort signal on the shared request: other screens may be waiting for the same result.
      p = this.api.get<MenuItem[]>(`/api/v1/menu-items${qs}`).catch((err) => { this.cache.delete(key); throw err; });
      this.cache.set(key, p);
    }
    return p;
  }

  invalidate(): void {
    this.cache.clear();
  }

  create(body: MenuItemBody): Promise<MenuItem> {
    return this.api.post<MenuItem>('/api/v1/menu-items', { body }).finally(() => this.invalidate());
  }

  update(id: string, body: MenuItemBody): Promise<MenuItem> {
    return this.api.put<MenuItem>(`/api/v1/menu-items/${id}`, { body }).finally(() => this.invalidate());
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/menu-items/${id}`).finally(() => this.invalidate());
  }
}
