const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_PREFIX = 'aanganos_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function cacheGet<T>(key: string): T | null {
  const now = Date.now();

  // 1. Check in-memory first
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem) {
    if (now - mem.timestamp < mem.ttlMs) {
      return mem.data;
    }
    memoryCache.delete(key);
  }

  // 2. Check sessionStorage
  if (isStorageAvailable()) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (now - parsed.timestamp < parsed.ttlMs) {
          // Re-populate memory cache
          memoryCache.set(key, parsed as CacheEntry<unknown>);
          return parsed.data;
        }
        window.sessionStorage.removeItem(STORAGE_PREFIX + key);
      }
    } catch {
      // Ignore serialization or storage quota errors
    }
  }

  return null;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttlMs,
  };

  memoryCache.set(key, entry as CacheEntry<unknown>);

  if (isStorageAvailable()) {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Ignore quota errors
    }
  }
}

export function cacheInvalidate(prefixOrKey?: string): void {
  if (!prefixOrKey) {
    memoryCache.clear();
    if (isStorageAvailable()) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k?.startsWith(STORAGE_PREFIX)) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
      } catch {
        // Ignore
      }
    }
    return;
  }

  // Invalidate matching keys
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefixOrKey)) {
      memoryCache.delete(k);
    }
  }

  if (isStorageAvailable()) {
    try {
      const fullPrefix = STORAGE_PREFIX + prefixOrKey;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && (k === fullPrefix || k.startsWith(fullPrefix))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }
}

export async function cacheWrap<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
  forceRefresh: boolean = false,
): Promise<T> {
  if (!forceRefresh) {
    const cached = cacheGet<T>(key);
    if (cached !== null) {
      return cached;
    }
  }

  const result = await fetcher();
  cacheSet(key, result, ttlMs);
  return result;
}
