export interface SavedCredential {
  identifier: string;
  secret: string;
  name?: string;
}

interface StoredCredential {
  identifier: string;
  secret: string;
  name?: string;
}

const KEY = 'aanganos.savedCredentials';

function encode(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return value;
  }
}

function decode(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
}

function read(): StoredCredential[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCredential[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: StoredCredential[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    void 0;
  }
}

export function getSavedCredentials(): SavedCredential[] {
  return read().map((c) => ({ identifier: c.identifier, secret: decode(c.secret), ...(c.name ? { name: c.name } : {}) }));
}

export function saveCredential(cred: SavedCredential): void {
  const id = cred.identifier.trim();
  if (!id) return;
  const list = read().filter((c) => c.identifier !== id);
  list.unshift({ identifier: id, secret: encode(cred.secret), ...(cred.name ? { name: cred.name } : {}) });
  write(list.slice(0, 5));
}

export function removeCredential(identifier: string): void {
  write(read().filter((c) => c.identifier !== identifier.trim()));
}
