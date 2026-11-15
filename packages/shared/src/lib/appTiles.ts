import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@shared/store/AuthContext';
import { resourceForKey } from '@shared/lib/usePermission';
import { resolvePersona, type Persona } from '@shared/lib/roles';
import { useMenu } from '@shared/lib/useMenu';
import type { MenuNode } from '@shared/api/menu';

export type TileGroup = 'myHome' | 'community' | 'security' | 'support' | 'admin';

/**
 * Presentation-only registry for app tiles: icon / label / tint / group / route keyed by a stable
 * code. It does NOT decide visibility — the backend /api/v1/menu (role + Access permission driven)
 * decides which tiles show and in what order. This array only supplies how a returned tile looks.
 * The permKey/permAction/personas fields are used ONLY by the fallback path (when the menu endpoint
 * returns nothing), so the app still renders something offline.
 */
export interface AppTile {
  code: string;
  route: string;
  icon: string;
  labelKey: string;
  subKey: string;
  tint: string;
  permKey: string;
  permAction: number;
  group: TileGroup;
  personas: Persona[];
  showInHome: boolean;
  label?: string;
  groupTitle?: string;
}

const VIEW = 0;
const CREATE = 1;
const ACCESS = 7;

export const APP_TILES: AppTile[] = [
  { code: 'my-profile', route: '/my-profile', icon: 'UserCircle', labelKey: 'services.myProfile', subKey: 'services.myProfileSub', tint: '#05b872', permKey: 'my-profile', permAction: VIEW, group: 'myHome', personas: ['resident', 'security', 'admin'], showInHome: true },
  { code: 'my-household', route: '/my-household', icon: 'Home', labelKey: 'services.myHousehold', subKey: 'services.myHouseholdSub', tint: '#0ea5e9', permKey: 'my-household', permAction: VIEW, group: 'myHome', personas: ['resident'], showInHome: true },

  { code: 'invite-visitor', route: '/invite-visitor', icon: 'UserPlus', labelKey: 'services.inviteVisitor', subKey: 'services.inviteVisitorSub', tint: '#05b872', permKey: 'invite-visitor', permAction: CREATE, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'my-visitors', route: '/visitors', icon: 'Users', labelKey: 'services.myVisitors', subKey: 'services.myVisitorsSub', tint: '#0969da', permKey: 'visitors', permAction: VIEW, group: 'community', personas: ['resident', 'admin'], showInHome: true },
  { code: 'approvals', route: '/approvals', icon: 'CheckCheck', labelKey: 'services.approvals', subKey: 'services.approvalsSub', tint: '#bf8700', permKey: 'approvals', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'recurring-visitors', route: '/recurring-visitors', icon: 'Repeat', labelKey: 'services.recurring', subKey: 'services.recurringSub', tint: '#0969da', permKey: 'recurring-visitors', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'parcels', route: '/parcels', icon: 'Package', labelKey: 'services.myParcels', subKey: 'services.myParcelsSub', tint: '#cf5500', permKey: 'parcels', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'maintenance', route: '/maintenance', icon: 'CreditCard', labelKey: 'services.maintenance', subKey: 'services.maintenanceSub', tint: '#1a7f37', permKey: 'maintenance', permAction: VIEW, group: 'community', personas: ['resident', 'admin'], showInHome: true },
  { code: 'billing', route: '/billing', icon: 'Wallet', labelKey: 'services.billing', subKey: 'services.billingSub', tint: '#1a7f37', permKey: 'billing', permAction: VIEW, group: 'community', personas: ['admin', 'resident'], showInHome: true },
  { code: 'helpdesk', route: '/my-tickets', icon: 'MessageCircle', labelKey: 'services.helpDesk', subKey: 'services.helpDeskSub', tint: '#16a34a', permKey: 'tickets', permAction: VIEW, group: 'community', personas: ['resident', 'admin'], showInHome: true },
  { code: 'raise-ticket', route: '/raise-ticket', icon: 'MessageCircle', labelKey: 'services.helpDesk', subKey: 'services.helpDeskSub', tint: '#16a34a', permKey: 'tickets', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: false },
  { code: 'announcements', route: '/announcements', icon: 'Megaphone', labelKey: 'services.announcements', subKey: 'services.announcementsSub', tint: '#8250df', permKey: 'announcements', permAction: VIEW, group: 'community', personas: ['resident', 'admin'], showInHome: true },
  { code: 'amenities', route: '/amenities', icon: 'Coffee', labelKey: 'services.amenities', subKey: '', tint: '#0284c7', permKey: 'amenities', permAction: VIEW, group: 'community', personas: ['resident', 'admin'], showInHome: true },

  { code: 'verify-pass', route: '/verify-pass', icon: 'ScanLine', labelKey: 'services.verifyPass', subKey: 'services.verifyPassSub', tint: '#05b872', permKey: 'verify-pass', permAction: CREATE, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'register-walkin', route: '/register-walkin', icon: 'UserPlus', labelKey: 'services.registerWalkin', subKey: 'services.registerWalkinSub', tint: '#8250df', permKey: 'register-walkin', permAction: CREATE, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'entry-exit', route: '/entry-exit', icon: 'ArrowLeftRight', labelKey: 'services.entryExit', subKey: 'services.entryExitSub', tint: '#0ea5e9', permKey: 'entry-exit', permAction: VIEW, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'vehicle-lookup', route: '/vehicle-lookup', icon: 'Car', labelKey: 'services.vehicleLookup', subKey: 'services.vehicleLookupSub', tint: '#0969da', permKey: 'vehicle-lookup', permAction: VIEW, group: 'security', personas: ['resident', 'security', 'admin'], showInHome: true },
  { code: 'watchlist', route: '/watchlist', icon: 'ShieldAlert', labelKey: 'services.watchlist', subKey: 'services.watchlistSub', tint: '#dc2626', permKey: 'watchlist', permAction: VIEW, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'sos', route: '/sos', icon: 'Siren', labelKey: 'services.sos', subKey: 'services.sosSub', tint: '#e11d48', permKey: 'sos', permAction: VIEW, group: 'security', personas: ['resident', 'security', 'admin'], showInHome: true },

  { code: 'notifications', route: '/notifications', icon: 'Bell', labelKey: 'services.notifications', subKey: 'services.notificationsSub', tint: '#d97706', permKey: 'notifications', permAction: VIEW, group: 'support', personas: ['resident', 'security', 'admin'], showInHome: true },

  { code: 'manage-residents', route: '/manage-residents', icon: 'Users', labelKey: 'services.manageResidents', subKey: 'services.manageResidentsSub', tint: '#8250df', permKey: 'residents', permAction: VIEW, group: 'admin', personas: ['admin'], showInHome: false },
  { code: 'resident-approvals', route: '/resident-approvals', icon: 'UserCheck', labelKey: 'services.residentApprovals', subKey: 'services.residentApprovalsSub', tint: '#05b872', permKey: 'residents', permAction: CREATE, group: 'admin', personas: ['admin'], showInHome: false },
];

const TILE_BY_CODE = new Map(APP_TILES.map((t) => [t.code, t]));

export interface AppTilesResult {
  persona: Persona;
  isAdmin: boolean;
  tiles: AppTile[];
  canSee: (permKey: string, action?: number) => boolean;
  byGroup: (group: TileGroup) => AppTile[];
}

/**
 * FALLBACK ONLY. Used when the backend menu is empty/unreachable so the app still shows something.
 * Filters the presentation registry by persona + permission locally. The primary path
 * (useDynamicTiles) ignores this and renders exactly what the backend menu returns.
 */
export function useAppTiles(): AppTilesResult {
  const { user, roles } = useAuth();

  return useMemo<AppTilesResult>(() => {
    const persona = resolvePersona(roles);
    const isAdmin = roles.some((r) => /admin|poweruser|superadmin/i.test(r));
    const granted = new Set(user?.permissions ?? []);

    const canSee = (permKey: string, action: number = VIEW): boolean => {
      if (isAdmin) return true;
      const resource = resourceForKey(permKey);
      return granted.has(`${resource}:${action}`) || granted.has(`${resource}:${ACCESS}`);
    };

    const tiles = APP_TILES.filter((tile) => (isAdmin || tile.personas.includes(persona)) && canSee(tile.permKey, tile.permAction));
    const byGroup = (group: TileGroup): AppTile[] => tiles.filter((tile) => tile.group === group);

    return { persona, isAdmin, tiles, canSee, byGroup };
  }, [user, roles]);
}

const MENU_KEY_TO_CODE: Record<string, string> = {
  // Canonical Common Keys
  'announcements': 'announcements',
  'billing': 'billing',
  'visitors': 'my-visitors',
  'tickets': 'helpdesk',
  'residents': 'manage-residents',
  'notifications': 'notifications',
  'amenities': 'amenities',

  // App & Legacy Keys
  'app.profile': 'my-profile',
  'app.household': 'my-household',
  'app.visitors.invite': 'invite-visitor',
  'app.visitors.my': 'my-visitors',
  'app.visitors.approvals': 'approvals',
  'app.recurring': 'recurring-visitors',
  'app.parcels': 'parcels',
  'app.maintenance': 'maintenance',
  'app.billing': 'billing',
  'app.helpdesk': 'helpdesk',
  'app.announcements': 'announcements',
  'app.verifypass': 'verify-pass',
  'app.walkin': 'register-walkin',
  'app.entryexit': 'entry-exit',
  'app.vehiclelookup': 'vehicle-lookup',
  'app.watchlist': 'watchlist',
  'app.sos': 'sos',
  'app.notifications': 'notifications',
  'app.residents.manage': 'manage-residents',
  'app.residents.approvals': 'resident-approvals',
  'admin.residents': 'manage-residents',
  'app.admin.residents': 'manage-residents',
  'app.admin.resident-approvals': 'resident-approvals',
  'admin.resident-approvals': 'resident-approvals',
  'admin.announcements': 'announcements',
  'admin.billing': 'billing',
  'admin.visitors': 'my-visitors',
  'admin.maintenance': 'helpdesk',
  'admin.notifications': 'notifications',
  'admin.amenities': 'amenities',
};

const ROUTE_TO_CODE: Record<string, string> = Object.fromEntries(
  APP_TILES.map((t) => [t.route.replace(/^\/+/, ''), t.code]),
);

function flattenMenu(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = [];
  const walk = (list: MenuNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function codeForNode(node: MenuNode): string | null {
  if (MENU_KEY_TO_CODE[node.key]) return MENU_KEY_TO_CODE[node.key]!;
  const route = (node.route ?? '').replace(/^\/+/, '');
  if (route && ROUTE_TO_CODE[route]) return ROUTE_TO_CODE[route]!;
  const tail = node.key.split('.').pop() ?? '';
  if (tail && ROUTE_TO_CODE[tail]) return ROUTE_TO_CODE[tail]!;
  return null;
}

export interface DynamicTileGroup {
  id: string;
  title: string;
  items: AppTile[];
}

export interface DynamicTilesResult extends AppTilesResult {
  loading: boolean;
  source: 'backend' | 'fallback';
  groups: DynamicTileGroup[];
}

const WEB_ONLY_ROUTES = new Set([
  '/dashboard',
  '/reports',
  '/config',
  '/menu-management',
  '/roles',
  '/notification-templates',
  '/admin-users',
]);

const WEB_ONLY_KEYS = new Set([
  'admin.group.overview',
  'admin.dashboard',
  'admin.overview',
  'admin.menu',
  'admin.config',
  'admin.roles',
  'admin.reports',
  'admin.notification-templates',
  'admin.adminusers',
]);

function isWebOnlyNode(node: MenuNode): boolean {
  if (node.key && WEB_ONLY_KEYS.has(node.key)) return true;
  if (node.route && WEB_ONLY_ROUTES.has(node.route)) return true;
  const normRoute = (node.route ?? '').replace(/\/+$/, '');
  if (WEB_ONLY_ROUTES.has(normRoute)) return true;
  return false;
}

/**
 * The tiles shown in Home + Services. Fully backend-driven: renders exactly the per-user,
 * permission-filtered tree from /api/v1/menu (mapped to presentation), in the backend's order.
 * Only Common and App/Mobile menus are shown (Web-only menus like Dashboard/Overview are filtered out).
 * If a user lacks permission, nothing is shown by default.
 */
export function useDynamicTiles(): DynamicTilesResult {
  const fallback = useAppTiles();
  const { user, roles } = useAuth();
  const { items: menuNodes, loading } = useMenu([]);

  const isAdmin = roles.some((r) => /admin|poweruser|superadmin/i.test(r));
  const granted = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const canSee = (permKey: string, action: number = VIEW): boolean => {
    if (isAdmin) return true;
    if (!permKey) return true;
    const resource = resourceForKey(permKey);
    return (
      granted.has(`${resource}:${action}`) ||
      granted.has(`${resource}:${ACCESS}`) ||
      granted.has(`${permKey}:${action}`) ||
      granted.has(`${permKey}:${ACCESS}`)
    );
  };

  return useMemo<DynamicTilesResult>(() => {
    const tiles: AppTile[] = [];
    const used = new Set<string>();
    const groups: DynamicTileGroup[] = [];

    // Recursively extract all group nodes (e.g. My Home, Community, Security) that contain leaf routes
    const extractGroups = (nodeList: MenuNode[]) => {
      for (const node of nodeList) {
        if (!node.children || node.children.length === 0) continue;
        // Skip web-only groups (e.g. Overview / Dashboard)
        if (isWebOnlyNode(node)) continue;

        // Check if direct children have routes (leaf items like My Profile, My Household)
        const leafChildren = node.children.filter((c) => Boolean(c.route) && !isWebOnlyNode(c));
        if (leafChildren.length > 0) {
          const itemsInGroup: AppTile[] = [];
          for (const n of leafChildren) {
            const code = codeForNode(n) || n.key || (n.route ?? '').replace(/^\/+/, '');
            if (used.has(code)) continue;

            const baseTile = TILE_BY_CODE.get(code);
            const permKey = baseTile?.permKey || n.key;
            const permAction = baseTile?.permAction ?? VIEW;

            // Strict permission check: by default don't show anything if user lacks permission
            if (!canSee(permKey, permAction)) continue;

            used.add(code);
            const resolvedTile: AppTile = baseTile
              ? {
                  ...baseTile,
                  label: n.label?.trim() || undefined,
                  icon: n.icon || baseTile.icon,
                  groupTitle: node.label?.trim() || undefined,
                }
              : {
                  code,
                  route: n.route ?? '',
                  icon: n.icon || 'LayoutGrid',
                  labelKey: n.key,
                  subKey: '',
                  tint: '#05b872',
                  permKey: n.key,
                  permAction: 0,
                  group: 'admin' as TileGroup,
                  personas: ['admin', 'resident', 'security'],
                  showInHome: true,
                  label: n.label?.trim() || n.key,
                  groupTitle: node.label?.trim() || undefined,
                };
            itemsInGroup.push(resolvedTile);
            tiles.push(resolvedTile);
          }
          if (itemsInGroup.length > 0) {
            groups.push({
              id: node.key,
              title: node.label,
              items: itemsInGroup,
            });
          }
        }

        // Also recurse into nested group containers (e.g. app.services containing groups)
        const subGroups = node.children.filter((c) => c.children && c.children.length > 0 && !c.route && !isWebOnlyNode(c));
        if (subGroups.length > 0) {
          extractGroups(subGroups);
        }
      }
    };

    extractGroups(menuNodes);

    // Capture any remaining standalone leaf nodes (excluding web-only items)
    const leafNodes = flattenMenu(menuNodes).filter((n) => n.route && !isWebOnlyNode(n));
    for (const n of leafNodes) {
      const code = codeForNode(n) || n.key || (n.route ?? '').replace(/^\/+/, '');
      if (used.has(code)) continue;

      const baseTile = TILE_BY_CODE.get(code);
      const permKey = baseTile?.permKey || n.key;
      const permAction = baseTile?.permAction ?? VIEW;

      if (!canSee(permKey, permAction)) continue;

      used.add(code);
      const resolvedTile: AppTile = baseTile
        ? {
            ...baseTile,
            label: n.label?.trim() || undefined,
            icon: n.icon || baseTile.icon,
          }
        : {
            code,
            route: n.route ?? '',
            icon: n.icon || 'LayoutGrid',
            labelKey: n.key,
            subKey: '',
            tint: '#05b872',
            permKey: n.key,
            permAction: 0,
            group: 'admin' as TileGroup,
            personas: ['admin', 'resident', 'security'],
            showInHome: true,
            label: n.label?.trim() || n.key,
          };
      tiles.push(resolvedTile);
    }

    // By default do not show anything if the user has no permissions or 0 allowed tiles
    if (tiles.length === 0) {
      const none = (_group: TileGroup): AppTile[] => [];
      return { ...fallback, tiles: [], groups: [], byGroup: none, loading, source: 'backend' };
    }

    const byGroup = (group: TileGroup): AppTile[] => tiles.filter((t) => t.group === group);
    return { ...fallback, tiles, groups, byGroup, loading, source: 'backend' };
  }, [fallback, menuNodes, loading, isAdmin, granted]);
}

const HOME_TILES_MAX = 4;

function homeConfigKeyForPersona(persona: Persona): string {
  return persona === 'security' ? 'app.home.tiles.security' : 'app.home.tiles.resident';
}

const homeTileCodesCache = new Map<string, string[]>();
const homeTileCodesPromise = new Map<string, Promise<string[]>>();

export function resetHomeTilesCache(): void {
  homeTileCodesCache.clear();
  homeTileCodesPromise.clear();
}

async function loadHomeTileCodes(configKey: string): Promise<string[]> {
  const { appConfig } = await import('@shared/services');
  const res = await appConfig.getValue(configKey);
  return (res.value ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function useHomeTiles(): DynamicTilesResult {
  const dynamic = useDynamicTiles();
  const configKey = homeConfigKeyForPersona(dynamic.persona);
  const [codes, setCodes] = useState<string[] | null>(homeTileCodesCache.get(configKey) ?? null);

  useEffect(() => {
    const cached = homeTileCodesCache.get(configKey);
    if (cached) {
      setCodes(cached);
      return;
    }
    let active = true;
    if (!homeTileCodesPromise.has(configKey)) {
      homeTileCodesPromise.set(configKey, loadHomeTileCodes(configKey).then((c) => { homeTileCodesCache.set(configKey, c); return c; }).catch(() => []));
    }
    void homeTileCodesPromise.get(configKey)!.then((c) => { if (active) setCodes(c); });
    return () => { active = false; };
  }, [configKey]);

  return useMemo<DynamicTilesResult>(() => {
    if (!codes || codes.length === 0) {
      const homeFromFlag = dynamic.tiles.filter((t) => t.showInHome).slice(0, HOME_TILES_MAX);
      const byGroupFlag = (group: TileGroup): AppTile[] => homeFromFlag.filter((t) => t.group === group);
      return { ...dynamic, tiles: homeFromFlag, byGroup: byGroupFlag };
    }
    const order = new Map(codes.map((code, i) => [code, i]));
    const tiles = dynamic.tiles
      .filter((t) => order.has(t.code))
      .sort((a, b) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0))
      .slice(0, HOME_TILES_MAX);
    const byGroup = (group: TileGroup): AppTile[] => tiles.filter((t) => t.group === group);
    return { ...dynamic, tiles, byGroup };
  }, [dynamic, codes]);
}
