import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';

/**
 * Modal used by both apps.
 *  - Desktop: centered card.
 *  - Phones / native app / narrow admin: bottom sheet (full width, max 92% height, scrolls),
 *    so long forms like Add Person don't float as a tall popup. Short confirms stay short.
 */
export function Dialog({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  const compact = useIsCompact();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={cn('fixed inset-0 z-50 flex', compact ? 'items-end justify-center' : 'items-center justify-center p-4')}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg',
          className,
          // Applied after the caller's classes so the sheet shape always wins on phones.
          compact && 'safe-bottom max-h-[92dvh] max-w-none overflow-y-auto rounded-b-none rounded-t-2xl border-x-0 border-b-0 px-4 pb-6 pt-5 animate-in slide-in-from-bottom duration-200',
        )}
      >
        {compact ? <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" /> : null}
        <button type="button" onClick={onClose} aria-label="Close"
          className={cn('absolute right-3 flex items-center justify-center rounded-[4px] text-muted-foreground hover:bg-accent hover:text-foreground',
            compact ? 'top-3 h-9 w-9 rounded-full' : 'top-3 h-7 w-7')}>
          <X className={compact ? 'h-5 w-5' : 'h-4 w-4'} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4 pr-8">
      <h2 className="text-base font-bold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex items-center justify-end gap-2">{children}</div>;
}
