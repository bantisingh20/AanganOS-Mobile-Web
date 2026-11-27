import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const ROOT_PATHS = new Set(['/', '/home', '/login', '/splash']);

/**
 * Android hardware back button. Registered ONCE; the current path is read from a ref.
 * (Previously the listener was re-added on every navigation and the async handle could be missed
 * in cleanup, stacking listeners so one press went back several pages.)
 */
export function useBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const registration = App.addListener('backButton', ({ canGoBack }) => {
      if (ROOT_PATHS.has(pathRef.current) || !canGoBack) void App.minimizeApp();
      else navigate(-1);
    });
    return () => { void registration.then((h) => h.remove()); };
  }, [navigate]);
}
