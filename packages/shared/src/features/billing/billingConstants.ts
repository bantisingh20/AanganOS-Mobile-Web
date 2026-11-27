// Billing-only constants. Shared formatting / pickers / status colours live in
// @shared/lib/format, @shared/lib/entityFetchers and @shared/lib/statusTone — import those directly.

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

export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

