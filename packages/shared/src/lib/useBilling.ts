import { useMemo } from 'react';
import { maintenanceBilling } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import type {
  MaintenanceBill,
  MaintenanceCharge,
  MaintenanceExpense,
  MaintenanceExpenseBody,
  MaintenanceCollectionSummary,
  PendingPayment,
  GenerateBillsBody,
  SetChargeBody,
  BulkSetChargeBody,
  RecordPaymentBody,
} from '@shared/api/maintenanceBilling';
import type { ListQuery } from '@shared/api/query';
import type { PagedData } from '@shared/api/types';

export interface BillFilters {
  communityId?: string;
  organizationId?: string;
  status?: string;
  periodYear?: number;
  periodMonth?: number;
}

export function useBills(query: ListQuery, filters: BillFilters, reloadKey: unknown) {
  return useAsync<PagedData<MaintenanceBill> | null>(
    (signal) => maintenanceBilling.listBills(query, filters, { signal }).catch(() => null),
    [query.search, query.page, query.pageSize, filters.communityId, filters.organizationId, filters.status, filters.periodYear, filters.periodMonth, reloadKey],
  );
}

export function useCharges(communityId: string | undefined, organizationId: string | undefined, reloadKey: unknown) {
  return useAsync<MaintenanceCharge[]>(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listCharges(communityId, organizationId, { signal }).catch(() => [])
        : Promise.resolve([]),
    [communityId, organizationId, reloadKey],
  );
}

export function useExpenses(communityId: string | undefined, organizationId: string | undefined, reloadKey: unknown) {
  return useAsync<MaintenanceExpense[]>(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listExpenses(communityId, organizationId, { signal }).catch(() => [])
        : Promise.resolve([]),
    [communityId, organizationId, reloadKey],
  );
}

export function useCollectionSummary(communityId: string | undefined, organizationId: string | undefined, reloadKey: unknown) {
  return useAsync<MaintenanceCollectionSummary | null>(
    (signal) => maintenanceBilling.collectionSummary(communityId, organizationId, { signal }).catch(() => null),
    [communityId, organizationId, reloadKey],
  );
}

export function usePendingPayments(communityId: string | undefined, organizationId: string | undefined, reloadKey: unknown) {
  return useAsync<PendingPayment[]>(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listPendingPayments(communityId, organizationId, { signal }).catch(() => [])
        : Promise.resolve([]),
    [communityId, organizationId, reloadKey],
  );
}

export function ledgerTotals(expenses: MaintenanceExpense[]) {
  const spent = expenses.filter((e) => e.direction !== 'credit').reduce((s, e) => s + e.amount, 0);
  const received = expenses.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amount, 0);
  return { spent, received };
}

export function useBillingActions() {
  return useMemo(() => ({
    generateBills: (body: GenerateBillsBody) => maintenanceBilling.generateBills(body),
    waiveBill: (id: string) => maintenanceBilling.waiveBill(id),
    recordPayment: (body: RecordPaymentBody) => maintenanceBilling.recordPayment(body),
    setCharge: (body: SetChargeBody) => maintenanceBilling.setCharge(body),
    bulkSetCharges: (body: BulkSetChargeBody) => maintenanceBilling.bulkSetCharges(body),
    deactivateCharge: (id: string) => maintenanceBilling.deactivateCharge(id),
    saveExpense: (body: MaintenanceExpenseBody, id?: string) => (id ? maintenanceBilling.updateExpense(id, body) : maintenanceBilling.createExpense(body)),
    deleteExpense: (id: string) => maintenanceBilling.deleteExpense(id),
    approvePayment: (id: string) => maintenanceBilling.approvePayment(id),
    rejectPayment: (id: string) => maintenanceBilling.rejectPayment(id),
  }), []);
}
