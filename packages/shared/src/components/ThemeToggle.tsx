import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from '@shared/lib/useTheme';

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, setTheme } = useAppTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={
        className ??
        'flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
