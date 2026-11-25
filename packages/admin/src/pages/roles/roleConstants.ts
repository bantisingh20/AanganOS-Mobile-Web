export const SCOPE_PLATFORM = 0;
export const SCOPE_COMMUNITY = 1;
export const SURFACE_APP = 0;
export const SURFACE_ADMIN = 1;

export const ACTION_VIEW = 0;
export const ACTION_CREATE = 1;
export const ACTION_EDIT = 2;
export const ACTION_DELETE = 3;
export const ACTION_APPROVE = 4;
export const ACTION_EXPORT = 5;
export const ACTION_ASSIGN = 6;
export const ACTION_ACCESS = 7;

export interface CoreActionMeta {
  action: number;
  label: string;
  short: string;
}

export const CORE_ACTION_META: CoreActionMeta[] = [
  { action: ACTION_VIEW, label: 'View', short: 'View' },
  { action: ACTION_CREATE, label: 'Create', short: 'Create' },
  { action: ACTION_EDIT, label: 'Edit', short: 'Edit' },
  { action: ACTION_DELETE, label: 'Delete', short: 'Delete' },
];

export const EXTRA_ACTION_LABELS: Record<number, string> = {
  [ACTION_APPROVE]: 'Approve',
  [ACTION_EXPORT]: 'Export',
  [ACTION_ASSIGN]: 'Assign',
  [ACTION_ACCESS]: 'Access',
};

export const DEFAULT_ADMIN_ACTIONS = [ACTION_VIEW, ACTION_CREATE, ACTION_EDIT, ACTION_DELETE];
export const DEFAULT_APP_ACTIONS = [ACTION_ACCESS, ACTION_VIEW];

export const permKey = (resourceType: string, action: number) =>
  `${resourceType.trim().toLowerCase()}:${action}`;

export function getCategoryForModule(label: string, resource: string | null): string {
  const s = `${label} ${resource ?? ''}`.toLowerCase();
  if (s.includes('bill') || s.includes('finance') || s.includes('payment') || s.includes('receipt') || s.includes('invoice') || s.includes('wallet') || s.includes('expense') || s.includes('dues')) {
    return 'Finance & Billing';
  }
  if (s.includes('user') || s.includes('resident') || s.includes('member') || s.includes('people') || s.includes('staff') || s.includes('group') || s.includes('tenant') || s.includes('owner')) {
    return 'People & Residents';
  }
  if (s.includes('notice') || s.includes('announcement') || s.includes('maintenance') || s.includes('helpdesk') || s.includes('ticket') || s.includes('visitor') || s.includes('vehicle') || s.includes('amenity') || s.includes('facility') || s.includes('package') || s.includes('parcel') || s.includes('gate') || s.includes('siren') || s.includes('sos')) {
    return 'Operations';
  }
  if (s.includes('role') || s.includes('permission') || s.includes('menu') || s.includes('setting') || s.includes('security') || s.includes('audit') || s.includes('config') || s.includes('template')) {
    return 'System & Security';
  }
  return 'General';
}
