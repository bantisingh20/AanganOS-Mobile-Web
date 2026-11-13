import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

const ROOT_PATHS = new Set(['/', '/home', '/login', '/splash']);

export function useBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | undefined;
    void App.addListener('backButton', ({ canGoBack }) => {
      const atRoot = ROOT_PATHS.has(location.pathname);
      if (atRoot || !canGoBack) {
        void App.minimizeApp();
      } else {
        navigate(-1);
      }
    }).then((h) => { handle = h; });
    return () => { void handle?.remove(); };
  }, [navigate, location.pathname]);
}
