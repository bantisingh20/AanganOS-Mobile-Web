import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function applyNativeStatusBar(isDark = false): void {
  if (!Capacitor.isNativePlatform()) return;
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => undefined);
}

export function initTheme(): void {
  applyNativeStatusBar();
  // Listen to dark mode changes on <html> to update native status bar
  if (typeof window !== 'undefined') {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      applyNativeStatusBar(isDark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
}
