import type { ApiClient } from './client';
import { buildQuery } from './query';

export interface ConfigRow {
  id: string;
  key: string;
  scope: number;
  organizationId: string | null;
  communityId: string | null;
  value: string;
}

export interface UpsertConfigBody {
  key: string;
  scope: number;
  organizationId?: string | null;
  communityId?: string | null;
  value: string;
}

export interface ConfigValueResponse {
  key: string;
  communityId: string | null;
  value: string | null;
}

/** Public version info used by the app's update prompt (GET /api/v1/app-version, no login). */
export interface AppVersionInfo {
  platform: string;
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  updateUrl: string;
  updateMessage: string;
}

export class ConfigClient {
  constructor(private readonly api: ApiClient) {}

  appVersion(platform: 'android' | 'ios', options?: { signal?: AbortSignal }): Promise<AppVersionInfo> {
    return this.api.get<AppVersionInfo>(`/api/v1/app-version${buildQuery({ platform })}`, { ...options, anonymous: true });
  }

  list(search?: string, options?: { signal?: AbortSignal }): Promise<ConfigRow[]> {
    const qs = buildQuery({ search });
    return this.api.get<ConfigRow[]>(`/api/v1/config${qs}`, options);
  }

  getValue(key: string, communityId?: string | null, options?: { signal?: AbortSignal }): Promise<ConfigValueResponse> {
    const qs = buildQuery({ communityId: communityId ?? undefined });
    return this.api.get<ConfigValueResponse>(`/api/v1/config/${encodeURIComponent(key)}${qs}`, options);
  }

  upsert(body: UpsertConfigBody): Promise<ConfigRow> {
    return this.api.post<ConfigRow>('/api/v1/config', { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/config/${id}`);
  }
}
