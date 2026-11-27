import { useTheme as useNextTheme, ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

export const THEME_STORAGE_KEY = 'aanganos-theme';

export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = true,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      storageKey={storageKey}
    >
      {children}
    </NextThemeProvider>
  );
}

export function useAppTheme() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useNextTheme();
  const isDark = resolvedTheme === 'dark';
  return {
    theme: (theme ?? 'system') as 'light' | 'dark' | 'system',
    setTheme,
    resolvedTheme: (resolvedTheme ?? 'light') as 'light' | 'dark',
    isDark,
    systemTheme,
  };
}

export { useNextTheme as useTheme };
