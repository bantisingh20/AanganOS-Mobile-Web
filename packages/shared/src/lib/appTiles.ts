import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@shared/store/AuthContext';
import { resourceForKey } from '@shared/lib/usePermission';
import { resolvePersona, type Persona } from '@shared/lib/roles';
import { useMenu } from '@shared/lib/useMenu';
import type { MenuNode } from '@shared/api/menu';

export type TileGroup = 'myHome' | 'community' | 'security' | 'support';

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
}

const VIEW = 0;
const CREATE = 1;
const ACCESS = 7;

export const APP_TILES: AppTile[] = [
  { code: 'my-profile', route: '/my-profile', icon: 'UserCircle', labelKey: 'services.myProfile', subKey: 'services.myProfileSub', tint: '#05b872', permKey: 'my-profile', permAction: VIEW, group: 'myHome', personas: ['resident', 'security', 'admin'], showInHome: true },
  { code: 'my-household', route: '/my-household', icon: 'Home', labelKey: 'services.myHousehold', subKey: 'services.myHouseholdSub', tint: '#0ea5e9', permKey: 'my-household', permAction: VIEW, group: 'myHome', personas: ['resident'], showInHome: true },

  { code: 'invite-visitor', route: '/invite-visitor', icon: 'UserPlus', labelKey: 'services.inviteVisitor', subKey: 'services.inviteVisitorSub', tint: '#05b872', permKey: 'invite-visitor', permAction: CREATE, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'my-visitors', route: '/visitors', icon: 'Users', labelKey: 'services.myVisitors', subKey: 'services.myVisitorsSub', tint: '#0969da', permKey: 'my-visitors', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'approvals', route: '/approvals', icon: 'CheckCheck', labelKey: 'services.approvals', subKey: 'services.approvalsSub', tint: '#bf8700', permKey: 'approvals', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'recurring-visitors', route: '/recurring-visitors', icon: 'Repeat', labelKey: 'services.recurring', subKey: 'services.recurringSub', tint: '#0969da', permKey: 'recurring-visitors', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'parcels', route: '/parcels', icon: 'Package', labelKey: 'services.myParcels', subKey: 'services.myParcelsSub', tint: '#cf5500', permKey: 'parcels', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'maintenance', route: '/maintenance', icon: 'CreditCard', labelKey: 'services.maintenance', subKey: 'services.maintenanceSub', tint: '#1a7f37', permKey: 'maintenance', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'billing', route: '/billing', icon: 'Wallet', labelKey: 'services.billing', subKey: 'services.billingSub', tint: '#1a7f37', permKey: 'billing', permAction: VIEW, group: 'community', personas: ['admin'], showInHome: true },
  { code: 'raise-ticket', route: '/raise-ticket', icon: 'MessageCircle', labelKey: 'services.helpDesk', subKey: 'services.helpDeskSub', tint: '#16a34a', permKey: 'raise-ticket', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },
  { code: 'announcements', route: '/announcements', icon: 'Megaphone', labelKey: 'services.announcements', subKey: 'services.announcementsSub', tint: '#8250df', permKey: 'announcements', permAction: VIEW, group: 'community', personas: ['resident'], showInHome: true },

  { code: 'verify-pass', route: '/verify-pass', icon: 'ScanLine', labelKey: 'services.verifyPass', subKey: 'services.verifyPassSub', tint: '#05b872', permKey: 'verify-pass', permAction: CREATE, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'register-walkin', route: '/register-walkin', icon: 'UserPlus', labelKey: 'services.registerWalkin', subKey: 'services.registerWalkinSub', tint: '#8250df', permKey: 'register-walkin', permAction: CREATE, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'entry-exit', route: '/entry-exit', icon: 'ArrowLeftRight', labelKey: 'services.entryExit', subKey: 'services.entryExitSub', tint: '#0ea5e9', permKey: 'entry-exit', permAction: VIEW, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'vehicle-lookup', route: '/vehicle-lookup', icon: 'Car', labelKey: 'services.vehicleLookup', subKey: 'services.vehicleLookupSub', tint: '#0969da', permKey: 'vehicle-lookup', permAction: VIEW, group: 'security', personas: ['resident', 'security', 'admin'], showInHome: true },
  { code: 'watchlist', route: '/watchlist', icon: 'ShieldAlert', labelKey: 'services.watchlist', subKey: 'services.watchlistSub', tint: '#dc2626', permKey: 'watchlist', permAction: VIEW, group: 'security', personas: ['security', 'admin'], showInHome: true },
  { code: 'sos', route: '/sos', icon: 'Siren', labelKey: 'services.sos', subKey: 'services.sosSub', tint: '#e11d48', permKey: 'sos', permAction: VIEW, group: 'security', personas: ['resident', 'security', 'admin'], showInHome: true },

  { code: 'notifications', route: '/notifications', icon: 'Bell', labelKey: 'services.notifications', subKey: 'services.notificationsSub', tint: '#d97706', permKey: 'notifications', permAction: VIEW, group: 'support', personas: ['resident', 'security', 'admin'], showInHome: true },
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
  'app.profile': 'my-profile',
  'app.household': 'my-household',
  'app.visitors.invite': 'invite-visitor',
  'app.visitors.my': 'my-visitors',
  'app.visitors.approvals': 'approvals',
  'app.recurring': 'recurring-visitors',
  'app.parcels': 'parcels',
  'app.maintenance': 'maintenance',
  'app.billing': 'billing',
  'app.helpdesk': 'raise-ticket',
  'app.announcements': 'announcements',
  'app.verifypass': 'verify-pass',
  'app.walkin': 'register-walkin',
  'app.entryexit': 'entry-exit',
  'app.vehiclelookup': 'vehicle-lookup',
  'app.watchlist': 'watchlist',
  'app.sos': 'sos',
  'app.notifications': 'notifications',
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

export interface DynamicTilesResult extends AppTilesResult {
  loading: boolean;
  source: 'backend' | 'fallback';
}

/**
 * The tiles shown in Home + Services. Fully backend-driven: renders exactly the per-user,
 * permission-filtered tree from /api/v1/menu (mapped to presentation), in the backend's order.
 * No persona/permission filtering is re-applied here — visibility is entirely the backend's
 * decision (role Surface + the item's Access permission). Falls back to the local persona/permission
 * registry ONLY when the menu endpoint returns nothing (offline / not seeded).
 */
export function useDynamicTiles(): DynamicTilesResult {
  const fallback = useAppTiles();
  const { items: menuNodes, loading } = useMenu([]);

  return useMemo<DynamicTilesResult>(() => {
    const leafNodes = flattenMenu(menuNodes).filter((n) => n.route);
    const tiles: AppTile[] = [];
    const used = new Set<string>();
    for (const n of leafNodes) {
      const code = codeForNode(n);
      if (!code || used.has(code)) continue;
      const tile = TILE_BY_CODE.get(code);
      if (!tile) continue;
      used.add(code);
      tiles.push(tile);
    }

    if (tiles.length === 0) {
      // While the menu is still loading, show NOTHING (empty) rather than the full fallback catalog —
      // that fallback was the "all tabs flash for 1s then filter" bug. Only use the permission-gated
      // fallback once loading has finished and the backend menu genuinely returned no tiles.
      if (loading) {
        const none = (_group: TileGroup): AppTile[] => [];
        return { ...fallback, tiles: [], byGroup: none, loading, source: 'backend' };
      }
      return { ...fallback, loading, source: 'fallback' };
    }

    const byGroup = (group: TileGroup): AppTile[] => tiles.filter((t) => t.group === group);
    return { ...fallback, tiles, byGroup, loading, source: 'backend' };
  }, [fallback, menuNodes, loading]);
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
