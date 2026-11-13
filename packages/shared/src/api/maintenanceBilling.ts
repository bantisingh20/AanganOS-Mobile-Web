import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface MaintenanceBill {
  id: string;
  communityId: string;
  unitId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  amountPaid: number;
  amountDue: number;
  label: string;
  status: string;
  dueDateUtc?: string | null;
  issuedAtUtc: string;
  pendingApproval: boolean;
  unitNumber?: string | null;
  communityName?: string | null;
  organizationName?: string | null;
}

export interface MaintenancePayment {
  id: string;
  communityId: string;
  maintenanceBillId: string;
  unitId: string;
  amount: number;
  method: string;
  reference: string;
  paidAtUtc: string;
  status: string;
  submittedByResident: boolean;
  approvedAtUtc?: string | null;
}

export interface MaintenanceCollectionByCommunity {
  communityId: string;
  communityName: string;
  organizationName: string;
  collected: number;
  outstanding: number;
  spent: number;
  received: number;
}

export interface MaintenanceCollectionSummary {
  totalCollected: number;
  totalOutstanding: number;
  paidBillCount: number;
  unpaidBillCount: number;
  byCommunity: MaintenanceCollectionByCommunity[];
  totalReceived: number;
}

export interface GenerateBillsResult {
  communityId: string;
  periodYear: number;
  periodMonth: number;
  billsCreated: number;
  unitsSkipped: number;
}

export interface BillListFilters {
  status?: string;
  unitId?: string;
  communityId?: string;
  periodYear?: number;
  periodMonth?: number;
}

export interface GenerateBillsBody {
  communityId: string;
  periodYear: number;
  periodMonth: number;
  dueDateUtc?: string;
}

export interface RecordPaymentBody {
  maintenanceBillId: string;
  amount: number;
  method: string;
  reference?: string;
  paidAtUtc?: string;
}

export interface MaintenanceCharge {
  id: string;
  communityId: string;
  unitId: string;
  amount: number;
  label: string;
  isActive: boolean;
  unitNumber?: string | null;
}

export interface SetChargeBody {
  communityId: string;
  unitId: string;
  amount: number;
  label?: string;
  isActive: boolean;
}

export interface BulkSetChargeBody {
  communityId: string;
  unitIds?: string[];
  amount: number;
  label?: string;
  isActive: boolean;
  applyToAllUnits: boolean;
}

export interface BulkSetChargeResult {
  communityId: string;
  created: number;
  updated: number;
}

export interface MaintenanceExpense {
  id: string;
  communityId: string;
  direction: string;
  category: string;
  title: string;
  amount: number;
  spentOnUtc: string;
  vendor: string;
  notes: string;
}

export interface MaintenanceExpenseBody {
  communityId: string;
  direction: string;
  category: string;
  title: string;
  amount: number;
  spentOnUtc: string;
  vendor?: string;
  notes?: string;
}

export interface PendingPayment {
  id: string;
  communityId: string;
  maintenanceBillId: string;
  unitId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  method: string;
  reference: string;
  paidAtUtc: string;
  submittedByResident: boolean;
}

export class MaintenanceBillingClient {
  constructor(private readonly api: ApiClient) {}

  listBills(query: ListQuery = {}, filters: BillListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<MaintenanceBill>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      unitId: filters.unitId,
      communityId: filters.communityId,
      periodYear: filters.periodYear,
      periodMonth: filters.periodMonth,
    });
    return this.api.get<PagedData<MaintenanceBill>>(`/api/v1/maintenance-bills${qs}`, options);
  }

  getBill(id: string, options?: { signal?: AbortSignal }): Promise<MaintenanceBill> {
    return this.api.get<MaintenanceBill>(`/api/v1/maintenance-bills/${id}`, options);
  }

  generateBills(body: GenerateBillsBody): Promise<GenerateBillsResult> {
    return this.api.post<GenerateBillsResult>('/api/v1/maintenance-bills/generate', { body });
  }

  waiveBill(id: string): Promise<MaintenanceBill> {
    return this.api.post<MaintenanceBill>(`/api/v1/maintenance-bills/${id}/waive`, {});
  }

  listPayments(billId: string, options?: { signal?: AbortSignal }): Promise<MaintenancePayment[]> {
    return this.api.get<MaintenancePayment[]>(`/api/v1/maintenance-bills/${billId}/payments`, options);
  }

  recordPayment(body: RecordPaymentBody): Promise<MaintenancePayment> {
    return this.api.post<MaintenancePayment>('/api/v1/maintenance-payments', { body });
  }

  myBills(query: ListQuery = {}, status?: string, options?: { signal?: AbortSignal }): Promise<PagedData<MaintenanceBill>> {
    const qs = buildQuery({ ...listQueryParams(query), status });
    return this.api.get<PagedData<MaintenanceBill>>(`/api/v1/maintenance-bills/me${qs}`, options);
  }

  submitPayment(body: RecordPaymentBody): Promise<MaintenancePayment> {
    return this.api.post<MaintenancePayment>('/api/v1/maintenance-payments/submit', { body });
  }

  collectionSummary(communityId?: string, options?: { signal?: AbortSignal }): Promise<MaintenanceCollectionSummary> {
    const qs = buildQuery({ communityId });
    return this.api.get<MaintenanceCollectionSummary>(`/api/v1/maintenance-bills/collection-summary${qs}`, options);
  }

  listCharges(communityId: string, options?: { signal?: AbortSignal }): Promise<MaintenanceCharge[]> {
    const qs = buildQuery({ communityId });
    return this.api.get<MaintenanceCharge[]>(`/api/v1/maintenance-charges${qs}`, options);
  }

  setCharge(body: SetChargeBody): Promise<MaintenanceCharge> {
    return this.api.post<MaintenanceCharge>('/api/v1/maintenance-charges', { body });
  }

  bulkSetCharges(body: BulkSetChargeBody): Promise<BulkSetChargeResult> {
    return this.api.post<BulkSetChargeResult>('/api/v1/maintenance-charges/bulk', { body });
  }

  deactivateCharge(id: string): Promise<MaintenanceCharge> {
    return this.api.delete<MaintenanceCharge>(`/api/v1/maintenance-charges/${id}`);
  }

  listExpenses(communityId: string, options?: { signal?: AbortSignal }): Promise<MaintenanceExpense[]> {
    const qs = buildQuery({ communityId });
    return this.api.get<MaintenanceExpense[]>(`/api/v1/maintenance-expenses${qs}`, options);
  }

  createExpense(body: MaintenanceExpenseBody): Promise<MaintenanceExpense> {
    return this.api.post<MaintenanceExpense>('/api/v1/maintenance-expenses', { body });
  }

  updateExpense(id: string, body: MaintenanceExpenseBody): Promise<MaintenanceExpense> {
    return this.api.put<MaintenanceExpense>(`/api/v1/maintenance-expenses/${id}`, { body });
  }

  deleteExpense(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/v1/maintenance-expenses/${id}`);
  }

  listPendingPayments(communityId: string, options?: { signal?: AbortSignal }): Promise<PendingPayment[]> {
    const qs = buildQuery({ communityId });
    return this.api.get<PendingPayment[]>(`/api/v1/maintenance-payments/pending${qs}`, options);
  }

  approvePayment(id: string): Promise<MaintenancePayment> {
    return this.api.post<MaintenancePayment>(`/api/v1/maintenance-payments/${id}/approve`, {});
  }

  rejectPayment(id: string): Promise<MaintenancePayment> {
    return this.api.post<MaintenancePayment>(`/api/v1/maintenance-payments/${id}/reject`, {});
  }
}
