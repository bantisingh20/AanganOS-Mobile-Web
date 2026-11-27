/**
 * Display formatting used by every screen in both apps. Use these instead of local helpers so dates,
 * money and labels look the same everywhere. Empty / invalid input always renders as EMPTY ('—').
 */

export const EMPTY = '—';

function toDate(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 14 Nov 2026 */
export function formatDate(value?: string | number | Date | null): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : EMPTY;
}

/** 14 Nov 2026, 10:30 am */
export function formatDateTime(value?: string | number | Date | null): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : EMPTY;
}

/** 10:30 am */
export function formatTime(value?: string | number | Date | null): string {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : EMPTY;
}

/** 1,25,000.00 (Indian grouping, 2 decimals). */
export function formatAmount(n?: number | null): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ₹1,25,000 — whole rupees with the symbol, for summaries and cards. Use formatAmount for ledgers. */
export function formatMoney(n?: number | null, opts: { decimals?: boolean } = {}): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `₹${v.toLocaleString('en-IN', opts.decimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
}

/** 'partially_paid' / 'in-progress' / 'InProgress' → 'Partially Paid' / 'In Progress'. */
export function humanize(code?: string | null): string {
  if (!code) return '';
  return code
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** 'Ramesh Kumar Patel' → 'RK'; 'ramesh' → 'RA'; '' → '?'. */
export function initials(name?: string | null, max = 2): string {
  const parts = (name ?? '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, max).toUpperCase();
  return parts.slice(0, max).map((p) => p[0]!).join('').toUpperCase();
}
