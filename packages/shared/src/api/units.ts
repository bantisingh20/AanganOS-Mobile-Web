import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Unit {
  id: string;
  communityId: string;
  hierarchyNodeId: string | null;
  unitNumber: string;
  unitType: string;
  floor: string | null;
  bedrooms: number | null;
  unitStatus: string;
  communityName: string | null;
  organizationName: string | null;
}

export interface UnitListFilters {
  unitStatus?: string;
  unitType?: string;
  floor?: string;
  hierarchyNodeId?: string;
  communityId?: string;
  organizationId?: string;
}

export interface CreateUnitBody {
  communityId: string;
  hierarchyNodeId?: string | null;
  unitNumber: string;
  unitType: string;
  floor?: string | null;
  bedrooms?: number | null;
  unitStatus: string;
}

export interface UpdateUnitBody {
  unitNumber?: string;
  unitType?: string;
  unitStatus?: string;
  floor?: string | null;
  updateFloor?: boolean;
  bedrooms?: number | null;
  updateBedrooms?: boolean;
}

export interface UnitHouseholdMember {
  residentId: string;
  name: string;
  residentType: string;
  relationship: string;
  startDate: string;
  presenceStatus: string;
}

export interface UnitVehicle {
  id: string;
  communityId: string;
  unitId: string;
  registrationNumber: string;
  vehicleType: string;
}

export interface UnitPet {
  id: string;
  communityId: string;
  unitId: string;
  petType: string;
  name: string | null;
}

export interface RegisterVehicleBody {
  unitId: string;
  registrationNumber: string;
  vehicleType: string;
}

export interface RegisterPetBody {
  unitId: string;
  petType: string;
  name?: string;
}

export class UnitsClient {
  constructor(private readonly api: ApiClient) {}

  listHousehold(unitId: string, options?: { signal?: AbortSignal }): Promise<UnitHouseholdMember[]> {
    return this.api.get<UnitHouseholdMember[]>(`/api/v1/units/${unitId}/household`, options);
  }

  listVehicles(unitId: string, options?: { signal?: AbortSignal }): Promise<UnitVehicle[]> {
    return this.api.get<UnitVehicle[]>(`/api/v1/units/${unitId}/vehicles`, options);
  }

  listPets(unitId: string, options?: { signal?: AbortSignal }): Promise<UnitPet[]> {
    return this.api.get<UnitPet[]>(`/api/v1/units/${unitId}/pets`, options);
  }

  registerVehicle(body: RegisterVehicleBody): Promise<UnitVehicle> {
    return this.api.post<UnitVehicle>('/api/v1/vehicles', { body });
  }

  registerPet(body: RegisterPetBody): Promise<UnitPet> {
    return this.api.post<UnitPet>('/api/v1/pets', { body });
  }

  list(query: ListQuery = {}, filters: UnitListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Unit>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      unitStatus: filters.unitStatus,
      unitType: filters.unitType,
      floor: filters.floor,
      hierarchyNodeId: filters.hierarchyNodeId,
      communityId: filters.communityId,
      organizationId: filters.organizationId,
    });
    return this.api.get<PagedData<Unit>>(`/api/v1/units${qs}`, options);
  }

  create(body: CreateUnitBody): Promise<Unit> {
    return this.api.post<Unit>('/api/v1/units', { body });
  }

  update(id: string, body: UpdateUnitBody): Promise<Unit> {
    return this.api.put<Unit>(`/api/v1/units/${id}`, { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/units/${id}`);
  }
}
