import type { MenuItem } from '@shared/api/menuItems';
import type { PermissionGrant } from '@shared/api/roles';
import {
  SURFACE_ADMIN, SURFACE_APP, SURFACE_COMMON,
  DEFAULT_ADMIN_ACTIONS, DEFAULT_APP_ACTIONS,
  getCategoryForModule,
} from './roleConstants';

export type PermSurfaceFilter = 'all' | 'Common' | 'Web' | 'Mobile';

export interface DescendantTarget {
  resource: string;
  actions: number[];
}

export interface PermTreeRow {
  id: string;
  label: string;
  icon: string | null;
  resource: string;
  hasResource: boolean;
  actions: number[];
  category: string;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  descendants: DescendantTarget[];
  surface: number;
}

export function buildTree(
  items: MenuItem[],
  surfaceFilter: PermSurfaceFilter,
  currentGrants: PermissionGrant[],
  canonicalMap: Map<string, string>,
): PermTreeRow[] {
  const activeItems = items.filter((m) => m.isActive !== false);
  const surfaceItems = activeItems.filter((m) => {
    if (surfaceFilter === 'all') return true;
    if (surfaceFilter === 'Common') return m.surface === SURFACE_COMMON;
    if (surfaceFilter === 'Web') return m.surface === SURFACE_ADMIN || m.surface === SURFACE_COMMON;
    if (surfaceFilter === 'Mobile') return m.surface === SURFACE_APP || m.surface === SURFACE_COMMON;
    return true;
  });
  const byParent = new Map<string | null, MenuItem[]>();
  for (const m of surfaceItems) {
    const p = m.parentId ?? null;
    const list = byParent.get(p) ?? [];
    list.push(m);
    byParent.set(p, list);
  }

  const seenResources = new Set<string>();
  const defaultActions = surfaceFilter === 'Mobile' ? DEFAULT_APP_ACTIONS : DEFAULT_ADMIN_ACTIONS;

  const getAllDescendants = (nodeId: string): DescendantTarget[] => {
    const list: DescendantTarget[] = [];
    for (const child of byParent.get(nodeId) ?? []) {
      const childRes = child.requiredPermissionResource?.trim() || (child.route ? child.key?.trim() : '');
      if (childRes) {
        const lowerRes = childRes.toLowerCase();
        canonicalMap.set(lowerRes, childRes);
        seenResources.add(lowerRes);
        const merged = Array.from(new Set([...defaultActions, ...(child.requiredPermissionActions ?? [])])).sort((a, b) => a - b);
        list.push({ resource: childRes, actions: merged });
      }
      list.push(...getAllDescendants(child.id));
    }
    return list;
  };

  const rows: PermTreeRow[] = [];

  const walk = (parentId: string | null, depth: number) => {
    const children = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    for (const m of children) {
      const rawRes = m.requiredPermissionResource?.trim() || (m.route ? m.key?.trim() : '');
      const hasRes = rawRes.length > 0;
      let nodeTarget: DescendantTarget | null = null;

      if (hasRes) {
        const lowerRes = rawRes.toLowerCase();
        canonicalMap.set(lowerRes, rawRes);
        seenResources.add(lowerRes);
        const merged = Array.from(new Set([...defaultActions, ...(m.requiredPermissionActions ?? [])])).sort((a, b) => a - b);
        nodeTarget = { resource: rawRes, actions: merged };
      }

      const childTargets = getAllDescendants(m.id);
      const allTargets = [...(nodeTarget ? [nodeTarget] : []), ...childTargets];
      const distinctActions = Array.from(new Set(allTargets.flatMap((t) => t.actions))).sort((a, b) => a - b);
      const kids = byParent.get(m.id) ?? [];

      rows.push({
        id: m.id,
        label: m.label,
        icon: m.icon,
        resource: rawRes,
        hasResource: hasRes,
        actions: distinctActions,
        category: getCategoryForModule(m.label, rawRes),
        depth,
        hasChildren: kids.length > 0,
        childCount: kids.length,
        descendants: allTargets,
        surface: m.surface,
      });

      walk(m.id, depth + 1);
    }
  };

  walk(null, 0);

  if (currentGrants.length > 0) {
    const extras: DescendantTarget[] = [];
    for (const p of currentGrants) {
      const lowerRes = p.resourceType.trim().toLowerCase();
      if (!seenResources.has(lowerRes)) {
        const existing = extras.find((e) => e.resource.toLowerCase() === lowerRes);
        if (existing) {
          if (!existing.actions.includes(p.action)) existing.actions.push(p.action);
        } else {
          const canonical = canonicalMap.get(lowerRes) ?? p.resourceType.trim();
          extras.push({ resource: canonical, actions: [p.action] });
        }
      }
    }
    if (extras.length > 0) {
      const groupTargets = extras.map((e) => ({ ...e, actions: e.actions.sort((a, b) => a - b) }));
      const groupActions = Array.from(new Set(groupTargets.flatMap((e) => e.actions))).sort((a, b) => a - b);
      rows.push({
        id: 'extra-group-root',
        label: 'Custom & System Permissions',
        icon: 'KeyRound',
        resource: '',
        hasResource: false,
        actions: groupActions,
        category: 'System & Security',
        depth: 0,
        hasChildren: true,
        childCount: extras.length,
        descendants: groupTargets,
        surface: SURFACE_COMMON,
      });
      for (const e of groupTargets) {
        rows.push({
          id: `extra-${e.resource.toLowerCase()}`,
          label: e.resource,
          icon: null,
          resource: e.resource,
          hasResource: true,
          actions: e.actions,
          category: 'System & Security',
          depth: 1,
          hasChildren: false,
          childCount: 0,
          descendants: [e],
          surface: SURFACE_COMMON,
        });
      }
    }
  }

  return rows;
}
