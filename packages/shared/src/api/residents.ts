import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export const ResidentVerificationStatus = {
  Draft: 'draft',
  Pending: 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;

export interface Resident {
  id: string;
  communityId?: string | null;
  organizationId?: string | null;

  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  residentType: string;
  verificationStatus: string;
  rejectionReason: string | null;
  isArchived: boolean;
  presenceStatus: string;
  photoFileId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  moveInDate: string | null;
  govtIdType: string | null;
  govtIdFrontFileId: string | null;
  govtIdBackFileId: string | null;
  loginStatus: string | null;
  communityName?: string | null;
  organizationName?: string | null;
  roleName?: string | null;
  roles?: string[];
}

export interface ResidentListFilters {
  verificationStatus?: string;
  residentType?: string;
  communityId?: string;
  organizationId?: string;
}

export interface ResidentHouseholdUnit {
  unitId: string;
  unitNumber: string;
  unitType: string;
  unitStatus: string;
  floor: string | null;
  communityId?: string | null;
  organizationId?: string | null;

  relationship: string;
  startDate: string;
}

export interface ResidentMe {
  resident: Resident | null;
  units: ResidentHouseholdUnit[];
}

export interface EmergencyContact {
  id: string;
  residentId: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface Vehicle {
  id: string;
  communityId?: string | null;
  organizationId?: string | null;

  unitId: string;
  registrationNumber: string;
  vehicleType: string;
}

export interface CommunicationPreference {
  category: string;
  optedIn: boolean;
}

export interface CommunicationPreferenceUpdate {
  category: string;
  optedIn: boolean;
}

export interface UpdateResidentBody {
  name?: string;
  residentType?: string;
  email?: string | null;
  updateEmail?: boolean;
  phone?: string | null;
  updatePhone?: boolean;
  photoFileId?: string | null;
  updatePhotoFileId?: boolean;
}

export interface SubmitKycBody {
  residentType?: string;
  dateOfBirth?: string;
  gender?: string;
  moveInDate?: string;
  govtIdType?: string;
  selfieBase64?: string;
  govtIdFrontBase64?: string;
  govtIdBackBase64?: string;
}

export interface AddEmergencyContactBody {
  name: string;
  phone: string;
  relationship: string;
}

export interface CreateResidentBody {
  communityId?: string | null;
  organizationId?: string | null;

  name: string;
  residentType: string;
  phone?: string;
  email?: string;
}

export interface AssociateHouseholdBody {
  unitId: string;
  relationship: string;
  startDate?: string;
}

export interface HouseholdMember {
  id: string;
  residentId: string;
  unitId: string;
  relationship: string;
  startDate: string;
}

export interface CreateLoginBody {
  identifier: string;
  password: string;
  roleName?: string;
}

export interface ResidentLoginResult {
  userId: string;
  identifier: string;
  roleName: string | null;
}

export class ResidentsClient {
  constructor(private readonly api: ApiClient) {}

  me(options?: { signal?: AbortSignal }): Promise<ResidentMe> {
    return this.api.get<ResidentMe>('/api/v1/residents/me', options);
  }

  list(query: ListQuery = {}, filters: ResidentListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Resident>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      verificationStatus: filters.verificationStatus,
      residentType: filters.residentType,
      communityId: filters.communityId,
      organizationId: filters.organizationId,
    });
    return this.api.get<PagedData<Resident>>(`/api/v1/residents${qs}`, options);
  }

  create(body: CreateResidentBody): Promise<Resident> {
    return this.api.post<Resident>('/api/v1/residents', { body });
  }

  remove(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/residents/${id}`);
  }

  associateHousehold(id: string, body: AssociateHouseholdBody): Promise<HouseholdMember> {
    return this.api.post<HouseholdMember>(`/api/v1/residents/${id}/household`, { body });
  }

  createLogin(id: string, body: CreateLoginBody): Promise<ResidentLoginResult> {
    return this.api.post<ResidentLoginResult>(`/api/v1/residents/${id}/login`, { body });
  }

  verify(id: string): Promise<Resident> {
    return this.api.post<Resident>(`/api/v1/residents/${id}/verify`, {});
  }

  reject(id: string, reason: string): Promise<Resident> {
    return this.api.post<Resident>(`/api/v1/residents/${id}/reject`, { body: { reason } });
  }

  setPresence(presenceStatus: 'at_home' | 'outdoor'): Promise<Resident> {
    return this.api.post<Resident>('/api/v1/residents/me/presence', { body: { presenceStatus } });
  }

  submitKyc(body: SubmitKycBody): Promise<Resident> {
    return this.api.post<Resident>('/api/v1/residents/me/submit-kyc', { body });
  }

  update(id: string, body: UpdateResidentBody): Promise<Resident> {
    return this.api.put<Resident>(`/api/v1/residents/${id}`, { body });
  }

  listHousehold(id: string, options?: { signal?: AbortSignal }): Promise<ResidentHouseholdUnit[]> {
    return this.api.get<ResidentHouseholdUnit[]>(`/api/v1/residents/${id}/household`, options);
  }

  listEmergencyContacts(id: string, options?: { signal?: AbortSignal }): Promise<EmergencyContact[]> {
    return this.api.get<EmergencyContact[]>(`/api/v1/residents/${id}/emergency-contacts`, options);
  }

  addEmergencyContact(id: string, body: AddEmergencyContactBody): Promise<EmergencyContact> {
    return this.api.post<EmergencyContact>(`/api/v1/residents/${id}/emergency-contacts`, { body });
  }

  getCommunicationPreferences(id: string, options?: { signal?: AbortSignal }): Promise<CommunicationPreference[]> {
    return this.api.get<CommunicationPreference[]>(`/api/v1/residents/${id}/communication-preferences`, options);
  }

  setCommunicationPreferences(id: string, preferences: readonly CommunicationPreferenceUpdate[]): Promise<CommunicationPreference[]> {
    return this.api.put<CommunicationPreference[]>(`/api/v1/residents/${id}/communication-preferences`, { body: { preferences } });
  }
}
