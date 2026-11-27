import type { LucideIcon } from 'lucide-react';
import { initials } from '@shared/lib/format';

export interface QuickActionItem {
  code: string;
  label: string;
  route: string;
  icon: LucideIcon;
  tint: string;
  action?: () => void;
}

export const HERO = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=70';
export const RECENT_NOTICE_DAYS = 15;

export const NOTICE_META: Record<string, { tint: string }> = {
  maintenance: { tint: '#05b872' },
  event: { tint: '#0ea5e9' },
  emergency: { tint: '#dc2626' },
  general: { tint: '#0ea5e9' },
};

export function greetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

/** Initials for the signed-in user; the display name can be an e-mail, so drop the domain first. */
export function initialsOf(name: string): string {
  return initials(name.replace(/@.*$/, ''));
}

export function severityTint(sev: string): string {
  if (sev === 'urgent' || sev === 'high') return '#cf222e';
  if (sev === 'warning' || sev === 'medium') return '#bf8700';
  return '#0969da';
}
