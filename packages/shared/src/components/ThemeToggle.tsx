import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@shared/lib/theme';

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className={className ?? 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
