import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export function Drawer({
  open,
  onClose,
  title,
  extra,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[1040px] flex-col bg-card shadow-xl',
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</div>
          {extra}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
