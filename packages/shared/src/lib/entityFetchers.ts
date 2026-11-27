import type { EntityPage } from '@shared/components/form/EntitySelect';
import { communities, organizations } from '@shared/services';

/**
 * Loaders for the organization / community pickers (EntitySelect `fetchPage` / `resolveLabel`).
 * One copy for every page in both apps — don't re-declare these locally.
 *
 * Two things here stop repeat requests:
 *  - makeCommunityFetch(orgId) returns the SAME function for the same org. Pages call it inline in
 *    render; a new function each render made EntitySelect reset and re-look-up the selected
 *    community's name (GET /communities/{id}) on every render.
 *  - Name lookups are cached per id for the session (names rarely change; cleared on login/logout).
 */

export async function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  const d = await organizations.list({ search: search || undefined, page, pageSize }, { signal });
  d.items.forEach((o) => orgNames.set(o.id, Promise.resolve(o.name)));
  return { items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount };
}

type PageFetcher = (search: string, page: number, pageSize: number, signal: AbortSignal) => Promise<EntityPage>;
const communityFetchers = new Map<string, PageFetcher>();

/** Community loader, optionally limited to one organization. Stable per organization id. */
export function makeCommunityFetch(organizationId?: string | null): PageFetcher {
  const key = organizationId ?? '';
  let fn = communityFetchers.get(key);
  if (!fn) {
    fn = async (search, page, pageSize, signal) => {
      const d = await communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal });
      d.items.forEach((c) => communityNames.set(c.id, Promise.resolve(c.name)));
      return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
    };
    communityFetchers.set(key, fn);
  }
  return fn;
}

/** All communities (no organization filter). */
export const fetchCommunityPage = makeCommunityFetch();

const orgNames = new Map<string, Promise<string | null>>();
const communityNames = new Map<string, Promise<string | null>>();

function cachedName(cache: Map<string, Promise<string | null>>, id: string, load: () => Promise<string>): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = load().catch(() => { cache.delete(id); return null; });
    cache.set(id, p);
  }
  return p;
}

export function resolveOrgLabel(id: string, signal?: AbortSignal): Promise<string | null> {
  return cachedName(orgNames, id, async () => (await organizations.get(id, signal ? { signal } : undefined)).name);
}

export function resolveCommunityLabel(id: string, signal?: AbortSignal): Promise<string | null> {
  return cachedName(communityNames, id, async () => (await communities.get(id, signal ? { signal } : undefined)).name);
}

/** Forget cached names (call on login/logout, and after renaming an org/community). */
export function resetEntityNameCache(): void {
  orgNames.clear();
  communityNames.clear();
}
