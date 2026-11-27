import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@shared/store/AuthContext';
import { isAdminRole } from '@shared/lib/roles';
import { useMenu } from '@shared/lib/hooks/useMenu';
import type { MenuNode } from '@shared/api/menu';

export const PermissionAction = {
  View: 0,
  Create: 1,
  Edit: 2,
  Delete: 3,
  Approve: 4,
  Export: 5,
  Assign: 6,
  Access: 7,
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

// Admin override (PowerUser / SuperAdmin / OrganizationAdmin / CommunityAdmin) comes from lib/roles.ts.

/**
 * Dynamically resolves any key (e.g. 'admin.announcements', 'announcements', 'app.billing',
 * 'billing', 'MaintenanceBill', etc.) to a matched resource from the user's session permissions
 * without hardcoding.
 */
export function resolveResource(key: string, sessionPermissions: readonly string[] = []): string {
  if (!key) return '';

  // 1. Extract all unique resource types present in the user's active session permissions
  const sessionResources = Array.from(
    new Set(
      sessionPermissions
        .map((p) => p.split(':')[0]?.trim())
        .filter((r): r is string => Boolean(r && !r.includes('.'))),
    ),
  );

  // 2. Exact or case-insensitive match against a session resource
  const exact = sessionResources.find((r) => r.toLowerCase() === key.toLowerCase());
  if (exact) return exact;

  // 3. Clean prefixes (e.g. 'admin.', 'app.', 'features/', leading slashes)
  const cleanKey = key
    .replace(/^\/+/, '')
    .replace(/^(admin|app|features)\./i, '')
    .trim();

  const cleanExact = sessionResources.find((r) => r.toLowerCase() === cleanKey.toLowerCase());
  if (cleanExact) return cleanExact;

  // 4. Singular / Plural normalization (e.g. 'announcements' -> 'announcement', 'communities' -> 'community')
  const singular = cleanKey.endsWith('ies')
    ? cleanKey.slice(0, -3) + 'y'
    : cleanKey.endsWith('s') && !cleanKey.endsWith('ss')
      ? cleanKey.slice(0, -1)
      : cleanKey;

  const singularMatch = sessionResources.find((r) => r.toLowerCase() === singular.toLowerCase());
  if (singularMatch) return singularMatch;

  // 5. Semantic / substring matching against session resources (e.g. 'billing' -> 'MaintenanceBill', 'maintenance' -> 'MaintenanceBill')
  const normKey = cleanKey.replace(/[-_.]/g, '').toLowerCase();
  const fuzzy = sessionResources.find((r) => {
    const normR = r.toLowerCase();
    return normR.includes(normKey) || normKey.includes(normR) || (singular.length >= 4 && normR.includes(singular.toLowerCase()));
  });
  if (fuzzy) return fuzzy;

  // 6. Fallback: PascalCase from base name
  const base = singular || cleanKey;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function resourceForKey(key: string, sessionPermissions: readonly string[] = []): string {
  return resolveResource(key, sessionPermissions);
}

function normRoute(route: string): string {
  return route.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

function flatten(nodes: readonly MenuNode[], out: MenuNode[] = []): MenuNode[] {
  for (const n of nodes) { out.push(n); flatten(n.children ?? [], out); }
  return out;
}

/**
 * Finds the DB menu row for a path: exact route match, else the longest route that the path is under
 * ('/helpdesk/123' -> '/helpdesk'). Its permission resource (or key) is the page's permission key.
 */
export function menuNodeForPath(nodes: readonly MenuNode[], pathname: string): MenuNode | null {
  const path = normRoute(pathname);
  let best: MenuNode | null = null;
  let bestLen = -1;
  for (const n of flatten(nodes)) {
    if (!n.route) continue;
    const r = normRoute(n.route);
    if (!r) continue;
    if ((path === r || path.startsWith(`${r}/`)) && r.length > bestLen) { best = n; bestLen = r.length; }
  }
  return best;
}

/**
 * Rights of the signed-in user.
 *  - usePermission()            → the CURRENT PAGE's rights, resolved from its route via the DB menu
 *                                 (MenuItems.Route → RequiredPermissionResource). No keys in page code;
 *                                 the same rows drive the sidebar and the app's service tiles.
 *  - usePermission('Resource')  → an explicit resource, for sub-features that have no route of their
 *                                 own (e.g. a tab's own resource).
 * Admins (PowerUser / SuperAdmin / OrganizationAdmin / CommunityAdmin) get every right.
 */
export function usePermission(key?: string | readonly string[]): PermissionResult {
  return usePermissionCore(key, undefined);
}

/** Rights of another page by its route, e.g. useRoutePermission('/approvals') for an Approvals tab. */
export function useRoutePermission(route: string): PermissionResult {
  return usePermissionCore(undefined, route);
}

function usePermissionCore(key: string | readonly string[] | undefined, route: string | undefined): PermissionResult {
  const { user, roles } = useAuth();
  const { pathname } = useLocation();
  const { items: menuNodes } = useMenu([]);

  const routeKey = useMemo(() => {
    if (key !== undefined) return null;
    const node = menuNodeForPath(menuNodes, route ?? pathname);
    return node ? (node.permissionResource || node.key) : null;
  }, [key, menuNodes, pathname, route]);

  return useMemo<PermissionResult>(() => {
    const admin = isAdminRole(roles);
    const userPermissions = user?.permissions ?? [];
    const granted = new Set(userPermissions);

    const keys: readonly string[] = key === undefined ? (routeKey ? [routeKey] : []) : Array.isArray(key) ? key : [key as string];

    const has = (action: number): boolean => {
      if (admin) return true;

      return keys.some((k) => {
        // Direct match against session grants (e.g. 'Announcement:0' or raw key 'admin.announcements:0')
        if (granted.has(`${k}:${action}`)) return true;

        // Dynamically resolve resource from session permissions
        const resource = resolveResource(k, userPermissions);
        if (resource && granted.has(`${resource}:${action}`)) return true;

        // Check cleaned key without 'admin.' or 'app.' prefix
        const clean = k.replace(/^(admin|app|features)\./i, '');
        if (clean && granted.has(`${clean}:${action}`)) return true;

        return false;
      });
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
  }, [user, roles, key, routeKey]);
}
