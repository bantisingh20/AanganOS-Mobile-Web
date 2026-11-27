import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsSmallScreen(): boolean {
  return !useMediaQuery('(min-width: 768px)');
}

/** True inside the Capacitor Android/iOS app (not the web build). */
export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * The single layout switch for shared pages: phone-style layout (cards, filter sheet, stacked
 * header) inside the native app or on any screen narrower than 768px — including the admin
 * site opened in a phone browser. Use this instead of `md:hidden` / `hidden md:block` pairs so
 * the header, filters and list always agree.
 */
export function useIsCompact(): boolean {
  const isSmall = useIsSmallScreen();
  return isSmall || isNativeApp();
}
