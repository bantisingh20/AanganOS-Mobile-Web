import { useEffect, useState } from 'react';
import { menu } from '@shared/services';
import type { MenuNode } from '@shared/api/menu';

// Module-level cache: the menu is per-user and changes rarely, so fetch it ONCE and reuse it across
// every screen/mount. This prevents the "all tiles flash then filter" effect — without a cache,
// each Home/Services mount re-fetched and briefly showed the fallback (full catalog) before the
// permission-filtered menu arrived. Cleared on logout via resetMenuCache().
let cache: MenuNode[] | null = null;
let inflight: Promise<MenuNode[]> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

export function resetMenuCache(): void {
  cache = null;
  inflight = null;
  notify();
}

/**
 * Normalizes the backend menu tree:
 * 1. Filters out client-side mobile tabs ('app.home', 'home', 'app.services', 'services', 'app.profile', 'profile')
 *    from being standalone top-level items.
 * 2. Unpacks container nodes like 'app.services' so their functional groups (Community, Security, Admin, etc.)
 *    become direct top-level groups in both the Desktop Sidebar and Mobile Services Tab.
 */
export function normalizeMenu(nodes: MenuNode[]): MenuNode[] {
  const result: MenuNode[] = [];

  for (const node of nodes) {
    const key = (node.key ?? '').toLowerCase();
    const route = (node.route ?? '').toLowerCase().replace(/^\/+/, '');

    // Skip standalone mobile tab items
    if (key === 'app.home' || (key === 'home' && route === 'home')) continue;
    if (key === 'app.profile' && (!node.children || node.children.length === 0)) continue;

    // If it is 'app.services' or route is 'services', unpack its children into top-level groups
    if (key === 'app.services' || route === 'services') {
      if (node.children && node.children.length > 0) {
        result.push(...normalizeMenu(node.children));
      }
      continue;
    }

    // Recursively normalize children
    const cleanChildren = node.children && node.children.length > 0 ? normalizeMenu(node.children) : [];
    result.push({
      ...node,
      children: cleanChildren,
    });
  }

  return result;
}

async function loadMenu(): Promise<MenuNode[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = menu
      .get()
      .then((items) => {
        cache = normalizeMenu(items);
        inflight = null;
        notify();
        return cache;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
  }
  return inflight;
}

export function useMenu(fallback: MenuNode[] = []): { items: MenuNode[]; loading: boolean } {
  const [items, setItems] = useState<MenuNode[] | null>(cache);

  useEffect(() => {
    let active = true;
    const sync = () => { if (active) setItems(cache); };
    subscribers.add(sync);
    if (cache === null) {
      void loadMenu().then(() => { if (active) setItems(cache); });
    }
    return () => { active = false; subscribers.delete(sync); };
  }, []);

  const resolved = items && items.length > 0 ? items : fallback;
  return { items: resolved, loading: cache === null };
}
