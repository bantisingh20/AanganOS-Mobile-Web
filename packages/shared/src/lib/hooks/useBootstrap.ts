import { useSyncExternalStore } from 'react';
import { auth, masterData, residents } from '@shared/services';
import type { BootstrapResponse } from '@shared/api/auth';
import { isNativeApp } from '@shared/lib/hooks/useMediaQuery';
import { primeMenuCache, waitForMenuFrom } from '@shared/lib/hooks/useMenu';
import { refreshUnreadCount, setUnreadCount } from '@shared/lib/hooks/useUnreadCount';

/**
 * Startup data in ONE request (GET /auth/me?include=bootstrap) after login and on app start.
 * It fills the existing caches so screens don't each fetch the same things:
 *   menu → useMenu · unread count → useUnreadCount · common master-data lists → masterData client
 *   resident profile → residents.me cache · task summary + app version → read via useBootstrap().
 * If the call fails (or the server is older and returns only the basic /me), every screen falls
 * back to its own request exactly as before.
 */

/** Master-data lists almost every session needs (Help Desk filters, forms, Home). */
export const BOOTSTRAP_MASTER_DATA = ['Ticket_Status', 'Ticket_Category', 'Ticket_Priority'];

/** Bootstrap data older than this isn't reused for live widgets (e.g. Home task counts). */
const FRESH_MS = 60_000;

type Status = 'idle' | 'loading' | 'ready' | 'failed';
interface State { status: Status; data: BootstrapResponse | null; loadedAt: number }

let state: State = { status: 'idle', data: null, loadedAt: 0 };
let promise: Promise<BootstrapResponse | null> | null = null;
const listeners = new Set<() => void>();

function set(next: State) { state = next; listeners.forEach((l) => l()); }

export function loadBootstrap(): Promise<BootstrapResponse | null> {
  if (promise) return promise;
  set({ ...state, status: 'loading' });
  promise = auth
    .bootstrap({ platform: isNativeApp() ? 'android' : undefined, masterData: BOOTSTRAP_MASTER_DATA })
    .then((data) => {
      if (Array.isArray(data?.menu)) primeMenuCache(data.menu);
      if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount);
      else void refreshUnreadCount();
      for (const [key, entries] of Object.entries(data?.masterData ?? {})) masterData.prime(key, null, entries);
      if (data?.resident) residents.primeMe(data.resident);
      set({ status: 'ready', data, loadedAt: Date.now() });
      return data;
    })
    .catch(() => {
      set({ status: 'failed', data: null, loadedAt: 0 });
      void refreshUnreadCount();
      return null;
    });
  waitForMenuFrom(promise);
  return promise;
}

/** Forget everything (login / logout / account switch). */
export function resetBootstrap(): void {
  promise = null;
  set({ status: 'idle', data: null, loadedAt: 0 });
}

/** The bootstrap request in flight (or done), if any — lets a screen wait for it instead of fetching. */
export function bootstrapPromise(): Promise<BootstrapResponse | null> | null {
  return promise;
}

/**
 * Waits for the bootstrap (if one is running) and returns its data only if it's fresh
 * (< 1 minute old). Screens call this first and fetch for themselves when it returns null.
 */
export async function freshBootstrap(): Promise<BootstrapResponse | null> {
  if (promise) await promise;
  return state.status === 'ready' && Date.now() - state.loadedAt < FRESH_MS ? state.data : null;
}

export function useBootstrap(): State & { isFresh: boolean } {
  const s = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => state,
  );
  return { ...s, isFresh: s.status === 'ready' && Date.now() - s.loadedAt < FRESH_MS };
}
