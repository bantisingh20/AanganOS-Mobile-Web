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
        'flex h-8 w-8 items-center justify-center rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors'
      }
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
