import type { ApiClient } from './client';

export type SmtpConfigSummary = {
  isConfigured: boolean;
  isEnabled: boolean;
  host: string;
  port: number;
  user: string;
  fromName: string;
  enableSsl: boolean;
  hasPassword: boolean;
};

export type SmsConfigSummary = {
  isConfigured: boolean;
  isEnabled: boolean;
  provider: string;
  apiUrl: string;
  senderId: string;
  fromNumber: string;
  hasApiKey: boolean;
  hasAuthToken: boolean;
};

export type CommunicationConfigSummary = {
  smtp: SmtpConfigSummary;
  sms: SmsConfigSummary;
};

export type TestEmailRequest = {
  useAppSettings: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
  enableSsl?: boolean;
  toEmail: string;
  subject?: string;
  body?: string;
};

export type TestEmailResponse = {
  success: boolean;
  message: string;
  durationMs: number;
  details?: string | null;
  serverUsed?: string | null;
  fromUsed?: string | null;
  errorCode?: string | null;
  testedAtUtc?: string | null;
};

export type TestSmsRequest = {
  useAppSettings: boolean;
  provider?: string;
  apiUrl?: string;
  apiKey?: string;
  senderId?: string;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  httpMethod?: string;
  customHeadersJson?: string;
  customBodyTemplate?: string;
  toPhone: string;
  message: string;
};

export type TestSmsResponse = {
  success: boolean;
  message: string;
  durationMs: number;
  httpStatusCode?: number | null;
  responseBody?: string | null;
  details?: string | null;
  providerUsed?: string | null;
  testedAtUtc?: string | null;
};

export class CommunicationTestClient {
  constructor(private readonly api: ApiClient) {}

  async getConfigSummary(options?: { signal?: AbortSignal }): Promise<CommunicationConfigSummary> {
    return this.api.get<CommunicationConfigSummary>('/api/v1/communication-test/config-summary', options);
  }

  async testEmail(payload: TestEmailRequest, options?: { signal?: AbortSignal }): Promise<TestEmailResponse> {
    return this.api.post<TestEmailResponse>('/api/v1/communication-test/email', {
      body: payload,
      signal: options?.signal,
    });
  }

  async testSms(payload: TestSmsRequest, options?: { signal?: AbortSignal }): Promise<TestSmsResponse> {
    return this.api.post<TestSmsResponse>('/api/v1/communication-test/sms', {
      body: payload,
      signal: options?.signal,
    });
  }
}
