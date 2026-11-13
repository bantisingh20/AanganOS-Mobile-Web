import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Parcel {
  id: string;
  communityId: string;
  recipientUnitId: string;
  trackingNumber: string;
  provider: string;
  category: string;
  status: string;
  condition: string;
  receiver?: string | null;
  receivedLocation?: string | null;
  receivedAtUtc: string;
  photoFileId?: string | null;
  conditionEvidenceFileId?: string | null;
  isPriority: boolean;
  custodyLocationId?: string | null;
}

export interface ParcelListFilters {
  status?: string;
  category?: string;
  condition?: string;
  recipientUnitId?: string;
  isPriority?: boolean;
}

export class ParcelsClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: ParcelListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Parcel>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      category: filters.category,
      condition: filters.condition,
      recipientUnitId: filters.recipientUnitId,
      ...(filters.isPriority != null ? { isPriority: filters.isPriority } : {}),
    });
    return this.api.get<PagedData<Parcel>>(`/api/v1/parcels${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Parcel> {
    return this.api.get<Parcel>(`/api/v1/parcels/${id}`, options);
  }
}
