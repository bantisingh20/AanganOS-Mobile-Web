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

async function loadMenu(): Promise<MenuNode[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = menu
      .get()
      .then((items) => {
        cache = items;
        inflight = null;
        notify();
        return items;
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
