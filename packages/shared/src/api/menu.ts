import type { ApiClient } from './client';

export interface MenuNode {
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  children: MenuNode[];
}

export class MenuClient {
  constructor(private readonly api: ApiClient) {}

  get(options?: { signal?: AbortSignal }): Promise<MenuNode[]> {
    return this.api.get<MenuNode[]>('/api/v1/menu', options);
  }
}
