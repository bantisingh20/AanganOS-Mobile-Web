import type { ApiClient } from './client';
import { buildQuery } from './query';

export const MyTaskType = {
  WalkInApproval: 'walkin_approval',
  ParcelPickup: 'parcel_pickup',
  MaintenanceDue: 'maintenance_due',
  KycPending: 'kyc_pending',
  ApprovedWalkInCheckIn: 'approved_walkin_checkin',
  ActiveSos: 'active_sos',
  ResidentToVerify: 'resident_verify',
  OpenTicket: 'open_ticket',
  OverdueBill: 'overdue_bill',
  PendingPaymentApproval: 'pending_payment_approval',
} as const;

export interface MyTaskSummaryItem {
  type: string;
  label: string;
  count: number;
  severity: string;
}

export interface MyTaskCard {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  amount: number | null;
  dateUtc: string | null;
  status: string | null;
}

export class MyTasksClient {
  constructor(private readonly api: ApiClient) {}

  summary(options?: { signal?: AbortSignal }): Promise<MyTaskSummaryItem[]> {
    return this.api.get<MyTaskSummaryItem[]>('/api/v1/my-tasks/summary', options);
  }

  cards(type?: string, options?: { signal?: AbortSignal }): Promise<MyTaskCard[]> {
    const qs = buildQuery(type && type !== 'all' ? { type } : {});
    return this.api.get<MyTaskCard[]>(`/api/v1/my-tasks${qs}`, options);
  }
}
