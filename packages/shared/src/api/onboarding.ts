import type { ApiClient } from './client';
import type { LoginResponse } from './auth';

export interface PublicCommunity {
  id: string;
  name: string;
  communityType: string;
}

export interface PublicWing {
  id: string;
  name: string;
  level: string;
  parentId: string | null;
}

export interface PublicUnit {
  id: string;
  unitNumber: string;
  wingId: string | null;
}

export interface SelfRegisterBody {
  communityId: string;
  unitId: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  code: string;
  residentType?: string;
  dateOfBirth?: string;
  gender?: string;
  moveInDate?: string;
  govtIdType?: string;
  selfieBase64?: string;
  govtIdFrontBase64?: string;
  govtIdBackBase64?: string;
}

export interface SelfRegisterResult {
  residentId: string;
  login: LoginResponse;
}

export interface RegisterSocietyBody {
  organizationName: string;
  communityName: string;
  communityType: string;
  adminName: string;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword: string;
  planMonths: number;
  floors?: number;
  roomsPerFloor?: number;
  wings?: string[];
}

export interface RegisterSocietyResult {
  communityId: string;
  communityName: string;
  message: string;
}

export interface OnboardingConfig {
  selfRegistrationEnabled: boolean;
  visitPassValidityAmount: number;
  visitPassValidityUnit: string;
  visitPassValidityText: string;
}

export class OnboardingClient {
  constructor(private readonly api: ApiClient) {}

  getConfig(options?: { signal?: AbortSignal }): Promise<OnboardingConfig> {
    return this.api.get<OnboardingConfig>('/api/v1/public/onboarding-config', { ...options, anonymous: true });
  }

  searchCommunities(search?: string, options?: { signal?: AbortSignal }): Promise<PublicCommunity[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '?search=';
    return this.api.get<PublicCommunity[]>(`/api/v1/public/communities${qs}`, { ...options, anonymous: true });
  }

  listWings(communityId: string, options?: { signal?: AbortSignal }): Promise<PublicWing[]> {
    return this.api.get<PublicWing[]>(`/api/v1/public/communities/${communityId}/wings`, { ...options, anonymous: true });
  }

  listUnits(communityId: string, wingId?: string, search?: string, options?: { signal?: AbortSignal }): Promise<PublicUnit[]> {
    const params = new URLSearchParams();
    if (wingId) params.set('wingId', wingId);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.api.get<PublicUnit[]>(`/api/v1/public/communities/${communityId}/units${qs}`, { ...options, anonymous: true });
  }

  requestOtp(phone: string): Promise<{ valid: boolean }> {
    return this.api.post<{ valid: boolean }>('/api/v1/public/register/request-otp', { body: { phone }, anonymous: true });
  }

  verifyOtp(phone: string, code: string): Promise<{ valid: boolean }> {
    return this.api.post<{ valid: boolean }>('/api/v1/public/register/verify-otp', { body: { phone, code }, anonymous: true });
  }

  selfRegister(body: SelfRegisterBody): Promise<SelfRegisterResult> {
    return this.api.post<SelfRegisterResult>('/api/v1/residents/self-register', { body, anonymous: true });
  }

  registerSociety(body: RegisterSocietyBody): Promise<RegisterSocietyResult> {
    return this.api.post<RegisterSocietyResult>('/api/v1/onboarding/community', { body, anonymous: true });
  }
}
