import { useMemo } from 'react';
import { useAuth } from '@shared/store/AuthContext';

export const PermissionAction = {
  View: 0,
  Create: 1,
  Edit: 2,
  Delete: 3,
  Approve: 4,
  Export: 5,
  Assign: 6,
} as const;

export type PermissionActionName = keyof typeof PermissionAction;

export interface PermissionResult {
  isAdmin: boolean;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  canAssign: boolean;
  can: (action: PermissionActionName) => boolean;
}

const KEY_TO_RESOURCE: Record<string, string> = {
  'admin.organizations': 'Organization',
  'admin.communities': 'Community',
  'admin.units': 'Unit',
  'admin.residents': 'Resident',
  'admin.adminUsers': 'User',
  'admin.roles': 'Role',
  'admin.permissions': 'Permission',
  'admin.menu': 'Configuration',
  'admin.config': 'Configuration',
  'admin.announcements': 'Announcement',
  'admin.tickets': 'Ticket',
  'admin.amenities': 'Amenity',
  'admin.maintenance': 'MaintenanceBill',
  'admin.visitors': 'Visitor',
  'admin.notifications': 'Audit',
  'admin.templates': 'Configuration',

  home: 'Announcement',
  services: 'Announcement',
  profile: 'Resident',
  announcements: 'Announcement',
  notifications: 'Audit',
  'my-profile': 'Resident',
  'my-household': 'HouseholdMember',
  'my-tickets': 'Ticket',
  'raise-ticket': 'Ticket',
  visitors: 'Visitor',
  'my-visitors': 'Visitor',
  'invite-visitor': 'VisitPass',
  approvals: 'Visitor',
  'recurring-visitors': 'RecurringVisitor',
  parcels: 'Parcel',
  maintenance: 'MaintenanceBill',
  billing: 'MaintenanceBill',
  'vehicle-lookup': 'Vehicle',
  'verify-pass': 'Visitor',
  'register-walkin': 'Visitor',
  'entry-exit': 'EntryExitEvent',
  watchlist: 'WatchlistEntry',
  sos: 'SosAlert',

  organizations: 'Organization',
  communities: 'Community',
  units: 'Unit',
  residents: 'Resident',
  tickets: 'Ticket',
  amenities: 'Amenity',
  roles: 'Role',
  users: 'User',
};

function isAdminRole(roles: readonly string[]): boolean {
  return roles.some((r) => /admin|poweruser|superadmin/i.test(r));
}

export function resourceForKey(key: string): string {
  const normalized = key.replace(/^\/+/, '');
  return KEY_TO_RESOURCE[key] ?? KEY_TO_RESOURCE[normalized] ?? normalized;
}

export function usePermission(key: string): PermissionResult {
  const { user, roles } = useAuth();

  return useMemo<PermissionResult>(() => {
    const admin = isAdminRole(roles);
    const resource = resourceForKey(key);
    const granted = new Set(user?.permissions ?? []);

    const has = (action: number): boolean => {
      if (admin) return true;
      return granted.has(`${resource}:${action}`);
    };

    const can = (action: PermissionActionName): boolean => has(PermissionAction[action]);

    return {
      isAdmin: admin,
      canView: has(PermissionAction.View),
      canAdd: has(PermissionAction.Create),
      canEdit: has(PermissionAction.Edit),
      canDelete: has(PermissionAction.Delete),
      canApprove: has(PermissionAction.Approve),
      canExport: has(PermissionAction.Export),
      canAssign: has(PermissionAction.Assign),
      can,
    };
  }, [user, roles, key]);
}
