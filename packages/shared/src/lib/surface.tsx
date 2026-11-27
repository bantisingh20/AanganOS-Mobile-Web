import { createContext, useContext, type ReactNode } from 'react';

/**
 * Which app is hosting a shared page.
 *  - 'app':   resident/staff mobile app. The page owns the whole screen and draws its own top bar.
 *  - 'admin': admin web. AdminShell already draws the top bar/sidebar; the page draws an inline header.
 *
 * Set once at each app's root, so routes no longer pass mode="mobile" | "admin".
 * Layout density (cards vs table) is a separate question answered by useIsCompact().
 */
export type Surface = 'app' | 'admin';

const SurfaceContext = createContext<Surface>('admin');

export function SurfaceProvider({ value, children }: { value: Surface; children: ReactNode }) {
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useSurface(): Surface {
  return useContext(SurfaceContext);
}

/** Maps the legacy `mode` prop onto a surface; an explicit prop still wins. */
export function useResolvedSurface(mode?: 'admin' | 'mobile'): Surface {
  const surface = useSurface();
  if (mode === 'mobile') return 'app';
  if (mode === 'admin') return 'admin';
  return surface;
}
