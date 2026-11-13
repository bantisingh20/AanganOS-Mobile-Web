import type { ApiClient } from './client';
import type { TokenStore } from './tokenStore';

export interface LoginUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  residentId: string | null;
  communityId: string | null;
  communityName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  roles: string[];
  refreshToken: string;
  user: LoginUser | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  platform?: string;
}

export interface ForgotPasswordRequest {
  identifier: string;
}

export interface VerifyOtpRequest {
  identifier: string;
  code: string;
}

export interface VerifyOtpResponse {
  valid: boolean;
}

export interface ResetPasswordRequest {
  identifier: string;
  code: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  constructor(
    private readonly api: ApiClient,
    private readonly tokenStore: TokenStore,
  ) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    const login = await this.api.post<LoginResponse>('/api/v1/auth/login', {
      body: request,
      anonymous: true,
    });
    this.tokenStore.setFromLogin(login);
    return login;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post<{ loggedOut: boolean }>('/api/v1/auth/logout');
    } finally {
      this.tokenStore.clear();
    }
  }

  forgotPassword(request: ForgotPasswordRequest): Promise<{ message: string }> {
    return this.api.post<{ message: string }>('/api/v1/auth/password/forgot', {
      body: request,
      anonymous: true,
    });
  }

  verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    return this.api.post<VerifyOtpResponse>('/api/v1/auth/password/verify-otp', {
      body: request,
      anonymous: true,
    });
  }

  resetPassword(request: ResetPasswordRequest): Promise<{ passwordReset: boolean }> {
    return this.api.post<{ passwordReset: boolean }>('/api/v1/auth/password/reset', {
      body: request,
      anonymous: true,
    });
  }

  changePassword(request: ChangePasswordRequest): Promise<{ passwordChanged: boolean }> {
    return this.api.post<{ passwordChanged: boolean }>('/api/v1/auth/password/change', { body: request });
  }

  registerDevice(path: string, oneSignalPlayerId: string, platform?: string): Promise<{ registered: boolean }> {
    return this.api.post<{ registered: boolean }>(path, { body: { oneSignalPlayerId, ...(platform ? { platform } : {}) } });
  }
}
