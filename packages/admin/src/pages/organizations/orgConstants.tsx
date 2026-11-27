import { Badge } from '@shared/components/ui/badge';
import type { SubscriptionStatus } from '@shared/api/subscriptions';
import { useTranslation } from 'react-i18next';

export const PLAN_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '9', label: '9 months' },
  { value: '12', label: '12 months' },
];

export const TYPE_OPTIONS = [
  { value: 'apartment_society', label: 'Apartment Society' },
  { value: 'gated_community', label: 'Gated Community' },
  { value: 'villa_bungalow', label: 'Villa / Bungalow' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'mixed', label: 'Mixed Development' },
];

export function typeLabel(type?: string | null): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? 'Apartment Society';
}

export function typeTone(type?: string | null): 'success' | 'info' | 'default' | 'warning' {
  const t = (type || '').toLowerCase();
  if (t.includes('apartment')) return 'success';
  if (t.includes('gated')) return 'info';
  if (t.includes('villa') || t.includes('townhouse')) return 'default';
  return 'warning';
}

export function SubBadge({ sub }: { sub: SubscriptionStatus | undefined }) {
  const { t } = useTranslation();
  if (!sub || !sub.hasSubscription) return <Badge tone="muted" className="text-[10px] px-1.5 py-0 rounded">{t('orgs.notSet')}</Badge>;
  if (sub.isExpired) return <Badge tone="danger" className="text-[10px] px-1.5 py-0 rounded">{t('orgs.expired')}</Badge>;
  if (sub.isExpiringSoon) return <Badge tone="warning" className="text-[10px] px-1.5 py-0 rounded">{t('orgs.daysLeft', { days: sub.daysRemaining })}</Badge>;
  return <Badge tone="success" className="text-[10px] px-1.5 py-0 rounded">{t('orgs.activeDays', { days: sub.daysRemaining })}</Badge>;
}
