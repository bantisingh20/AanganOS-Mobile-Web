import type { ApiClient } from './client';
import type { PagedData } from './types';

export interface MasterDataEntry {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export class MasterDataClient {
  constructor(private readonly api: ApiClient) {}

  async list(listKey: string, communityId?: string | null, options?: { signal?: AbortSignal }): Promise<MasterDataEntry[]> {
    const params = new URLSearchParams({ pageSize: '200' });
    if (communityId) params.set('communityId', communityId);
    const data = await this.api.get<PagedData<MasterDataEntry>>(`/api/v1/master-data/${listKey}?${params.toString()}`, options);
    return (data.items ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
