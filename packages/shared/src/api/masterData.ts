import type { ApiClient } from './client';
import type { PagedData } from './types';

export interface MasterDataEntry {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export class MasterDataClient {
  private readonly cache = new Map<string, Promise<MasterDataEntry[]>>();

  constructor(private readonly api: ApiClient) {}

  list(listKey: string, communityId?: string | null, _options?: { signal?: AbortSignal }): Promise<MasterDataEntry[]> {
    const cacheKey = `${listKey}:${communityId ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = (async () => {
      try {
        const params = new URLSearchParams({ pageSize: '200' });
        if (communityId) params.set('communityId', communityId);
        // Do not pass caller abort signal to master data so it won't be killed mid-flight on component re-render
        const data = await this.api.get<PagedData<MasterDataEntry>>(`/api/v1/master-data/${listKey}?${params.toString()}`);
        return (data.items ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      } catch (err) {
        this.cache.delete(cacheKey);
        throw err;
      }
    })();

    this.cache.set(cacheKey, promise);
    return promise;
  }

  invalidate(listKey?: string): void {
    if (listKey) {
      for (const k of this.cache.keys()) {
        if (k.startsWith(`${listKey}:`)) this.cache.delete(k);
      }
    } else {
      this.cache.clear();
    }
  }
}
