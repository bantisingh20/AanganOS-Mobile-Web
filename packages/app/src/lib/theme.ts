import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { registerNativeStatusBar } from '@shared/lib/theme';

export * from '@shared/lib/theme';

function applyNativeStatusBar(): void {
  if (!Capacitor.isNativePlatform()) return;
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
}

registerNativeStatusBar(applyNativeStatusBar);
