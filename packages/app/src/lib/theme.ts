import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'aanganos.themeMode';
const mql = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    void 0;
  }
  return 'system';
}

export function getThemeMode(): ThemeMode {
  return readMode();
}

export function resolveIsDark(mode: ThemeMode = readMode()): boolean {
  return mode === 'dark' || (mode === 'system' && mql.matches);
}

function applyNativeStatusBar(): void {
  if (!Capacitor.isNativePlatform()) return;
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
}

function applyMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolveIsDark(mode));
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    void 0;
  }
  applyMode(mode);
  listeners.forEach((fn) => fn());
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme(): void {
  applyMode(readMode());
  mql.addEventListener('change', () => {
    if (readMode() === 'system') {
      applyMode('system');
      listeners.forEach((fn) => fn());
    }
  });
  applyNativeStatusBar();
}
