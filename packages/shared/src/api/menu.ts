import type { ApiClient } from './client';

export interface MenuNode {
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  children: MenuNode[];
  /** Permission resource of the DB menu row (MenuItems.RequiredPermissionResource). */
  permissionResource?: string | null;
  /** Actions that make the row visible (MenuItems.RequiredPermissionActions). */
  permissionActions?: number[] | null;
}

export class MenuClient {
  constructor(private readonly api: ApiClient) {}

  get(options?: { signal?: AbortSignal }): Promise<MenuNode[]> {
    return this.api.get<MenuNode[]>('/api/v1/menu', options);
  }
}
