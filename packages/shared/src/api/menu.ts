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

  get(params?: { surface?: string }, options?: { signal?: AbortSignal }): Promise<MenuNode[]> {
    const qs = params?.surface ? `?surface=${encodeURIComponent(params.surface)}` : '';
    return this.api.get<MenuNode[]>(`/api/v1/menu${qs}`, options);
  }
}
