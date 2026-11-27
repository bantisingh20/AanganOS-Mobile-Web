import { useSyncExternalStore } from 'react';
import { notifications } from '@shared/services';

/**
 * ONE unread-notification count for the whole app (admin bell, app header, Home tabs).
 *
 * Replaces three separate sources: a 3-second "session heartbeat" in AuthContext (~1,200 calls per
 * hour, result thrown away), AdminShell's own 2-minute poll, and a refetch on every Home tab switch.
 * Now: one poll every 60 s, only while the page is visible and online, plus one refresh when the
 * user comes back to the app (throttled). The same call also serves as the session check — if the
 * session was ended elsewhere it returns 401 and the API client signs the user out.
 */

const POLL_MS = 60_000;
const RESUME_MIN_GAP_MS = 15_000;

let count = 0;
let lastFetch = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

function canPoll(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

/** Fetch the count now (deduplicated). Call after marking notifications read. */
export function refreshUnreadCount(): Promise<void> {
  if (inflight) return inflight;
  lastFetch = Date.now();
  inflight = notifications
    .unreadCount()
    .then((n) => { if (n !== count) { count = n; emit(); } })
    .catch(() => undefined) // offline / server down: keep the last value, try again later
    .finally(() => { inflight = null; });
  return inflight;
}

/** Set the count directly (e.g. 0 after "mark all read") without a request. */
export function setUnreadCount(n: number): void {
  if (n !== count) { count = Math.max(0, n); emit(); }
}

export function resetUnreadCount(): void {
  count = 0;
  lastFetch = 0;
  emit();
}

/** Starts the single poller. AuthContext calls this while signed in; returns a stop function. */
export function startUnreadPolling(): () => void {
  // No immediate fetch: the startup bootstrap (useBootstrap) supplies the first count, and falls
  // back to refreshUnreadCount() itself if it fails.
  const timer = setInterval(() => { if (canPoll()) void refreshUnreadCount(); }, POLL_MS);
  const onResume = () => {
    if (canPoll() && Date.now() - lastFetch > RESUME_MIN_GAP_MS) void refreshUnreadCount();
  };
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('online', onResume);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onResume);
    window.removeEventListener('online', onResume);
  };
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => count,
    () => count,
  );
}
