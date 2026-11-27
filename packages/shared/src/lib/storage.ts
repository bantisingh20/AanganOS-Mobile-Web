/**
 * localStorage that never throws (private mode, storage full, disabled WebView storage).
 * Use instead of calling localStorage directly during render or startup.
 */
export const safeStorage = {
  get(key: string): string | null {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  },
  set(key: string, value: string): boolean {
    try { globalThis.localStorage?.setItem(key, value); return true; } catch { return false; }
  },
  remove(key: string): void {
    try { globalThis.localStorage?.removeItem(key); } catch { /* ignore */ }
  },
  getJson<T>(key: string, fallback: T): T {
    const raw = safeStorage.get(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  },
  setJson(key: string, value: unknown): boolean {
    try { return safeStorage.set(key, JSON.stringify(value)); } catch { return false; }
  },
};
