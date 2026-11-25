import type { EntityPage } from '@shared/components/EntitySelect';
import { communities, organizations } from '@shared/services';

export type Tab = 'bills' | 'charges' | 'expenses' | 'dashboard';
export type Option = { value: string; label: string };

export const ALL = '__all__';
export const PAID_STATUS = 'paid';
export const WAIVED_STATUS = 'waived';
export const FALLBACK_STATUSES = ['unpaid', 'partially_paid', 'paid', 'waived', 'overdue'];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
};

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

export function formatAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}

export function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}

export async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try {
    const c = await communities.get(id, { signal });
    return c.name;
  } catch {
    return null;
  }
}

export async function resolveOrgLabel(id: string, signal: AbortSignal): Promise<string | null> {
  try {
    const o = await organizations.get(id, { signal });
    return o.name;
  } catch {
    return null;
  }
}

export function billTone(status: string): 'success' | 'muted' | 'danger' | 'default' {
  if (status === PAID_STATUS) return 'success';
  if (status === WAIVED_STATUS) return 'muted';
  if (status === 'overdue') return 'danger';
  return 'default';
}
