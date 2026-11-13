import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Amenity {
  id: string;
  communityId: string;
  name: string;
  code: string;
  amenityType: string;
  status: string;
  location?: string | null;
  description?: string | null;
  defaultCapacity: number;
  createdAtUtc: string;
  communityName?: string | null;
  organizationName?: string | null;
}

export interface AmenityListFilters {
  amenityType?: string;
  status?: string;
  communityId?: string;
  organizationId?: string;
}

export interface CreateAmenityBody {
  communityId: string;
  name: string;
  code: string;
  amenityType: string;
  location?: string;
  description?: string;
  defaultCapacity: number;
}

export interface UpdateAmenityBody {
  name?: string;
  amenityType?: string;
  status?: string;
  location?: string;
  description?: string;
  defaultCapacity?: number;
}

export class AmenitiesClient {
  constructor(private readonly api: ApiClient) {}

  list(query: ListQuery = {}, filters: AmenityListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Amenity>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      amenityType: filters.amenityType,
      status: filters.status,
      communityId: filters.communityId,
      organizationId: filters.organizationId,
    });
    return this.api.get<PagedData<Amenity>>(`/api/v1/amenities${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Amenity> {
    return this.api.get<Amenity>(`/api/v1/amenities/${id}`, options);
  }

  create(body: CreateAmenityBody): Promise<Amenity> {
    return this.api.post<Amenity>('/api/v1/amenities', { body });
  }

  update(id: string, body: UpdateAmenityBody): Promise<Amenity> {
    return this.api.put<Amenity>(`/api/v1/amenities/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/amenities/${id}`);
  }
}
