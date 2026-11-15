import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'aanganos.themeMode';
const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

const listeners = new Set<() => void>();
let nativeStatusBarHandler: (() => void) | null = null;

export function registerNativeStatusBar(handler: () => void): void {
  nativeStatusBarHandler = handler;
  nativeStatusBarHandler?.();
}

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
  return mode === 'dark' || (mode === 'system' && (mql?.matches ?? false));
}

function applyMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const isDark = resolveIsDark(mode);
  document.documentElement.classList.toggle('dark', isDark);
  nativeStatusBarHandler?.();
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
  if (mql) {
    mql.addEventListener('change', () => {
      if (readMode() === 'system') {
        applyMode('system');
        listeners.forEach((fn) => fn());
      }
    });
  }
}

/**
 * Universal Theme Hook for both Admin Desktop and Mobile App.
 * Updates synchronously across the entire application whenever theme changes.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode());
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark());

  useEffect(() => {
    return subscribeTheme(() => {
      setModeState(getThemeMode());
      setIsDark(resolveIsDark());
    });
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeMode(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentIsDark = resolveIsDark();
    setThemeMode(currentIsDark ? 'light' : 'dark');
  }, []);

  return {
    theme: mode,
    mode,
    isDark,
    resolvedTheme: isDark ? 'dark' : 'light',
    setTheme,
    setMode: setTheme,
    toggleTheme,
  };
}

export default useTheme;
