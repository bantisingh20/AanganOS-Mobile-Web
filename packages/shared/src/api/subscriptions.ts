import type { ApiClient } from './client';

export interface SubscriptionStatus {
  organizationId: string;
  planMonths: number;
  startsAtUtc: string | null;
  expiresAtUtc: string | null;
  status: string;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  hasSubscription: boolean;
  hasPendingRenewal: boolean;
  requestedPlanMonths: number | null;
}

export interface RenewalRequest {
  id: string;
  organizationId: string;
  organizationName: string;
  requestedPlanMonths: number;
  status: string;
  requestedAtUtc: string;
}

export interface SetExpiryBody {
  organizationId: string;
  planMonths: number;
  startsAtUtc: string;
  expiresAtUtc: string;
}

export interface ApproveRenewalBody {
  planMonths: number;
  startsAtUtc: string;
  expiresAtUtc: string;
}

export class SubscriptionsClient {
  constructor(private readonly api: ApiClient) {}

  byOrg(orgId: string, options?: { signal?: AbortSignal }): Promise<SubscriptionStatus> {
    return this.api.get<SubscriptionStatus>(`/api/v1/subscriptions/by-org/${orgId}`, options);
  }

  setExpiry(body: SetExpiryBody): Promise<SubscriptionStatus> {
    return this.api.post<SubscriptionStatus>('/api/v1/subscriptions/set-expiry', { body });
  }

  pendingRenewals(options?: { signal?: AbortSignal }): Promise<RenewalRequest[]> {
    return this.api.get<RenewalRequest[]>('/api/v1/subscriptions/renewals/pending', options);
  }

  approveRenewal(id: string, body: ApproveRenewalBody): Promise<SubscriptionStatus> {
    return this.api.post<SubscriptionStatus>(`/api/v1/subscriptions/renewals/${id}/approve`, { body });
  }
}
