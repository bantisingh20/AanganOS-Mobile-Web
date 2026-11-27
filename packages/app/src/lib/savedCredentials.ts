import { safeStorage } from '@shared/lib/storage';

/**
 * "Saved accounts" on the login screen: remembers the phone number (and name) of recent accounts
 * so the user can pick one instead of typing it.
 *
 * Passwords are NO LONGER stored. Users stay signed in through the refresh-token session (until they
 * log out or the account signs in on another device), so keeping a password on the phone only added
 * risk — it used to sit in localStorage, base64-encoded. Old entries are cleaned up on first read.
 *
 * `secret` stays in the type for compatibility with the login screen and is always ''.
 */
export interface SavedCredential {
  identifier: string;
  secret: string;
  name?: string;
}

interface StoredAccount {
  identifier: string;
  name?: string;
}

const KEY = 'aanganos.savedCredentials';

function read(): StoredAccount[] {
  const raw = safeStorage.getJson<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  const list = raw
    .filter((c): c is { identifier: string; name?: string; secret?: string } => !!c && typeof (c as { identifier?: unknown }).identifier === 'string')
    .map((c) => ({ identifier: c.identifier, ...(c.name ? { name: c.name } : {}) }));
  // Wipe passwords saved by older builds.
  if (raw.some((c) => c && typeof c === 'object' && 'secret' in c)) safeStorage.setJson(KEY, list);
  return list;
}

export function getSavedCredentials(): SavedCredential[] {
  return read().map((c) => ({ identifier: c.identifier, secret: '', ...(c.name ? { name: c.name } : {}) }));
}

export function saveCredential(cred: SavedCredential): void {
  const id = cred.identifier.trim();
  if (!id) return;
  const list = read().filter((c) => c.identifier !== id);
  list.unshift({ identifier: id, ...(cred.name ? { name: cred.name } : {}) });
  safeStorage.setJson(KEY, list.slice(0, 5));
}

export function removeCredential(identifier: string): void {
  safeStorage.setJson(KEY, read().filter((c) => c.identifier !== identifier.trim()));
}
