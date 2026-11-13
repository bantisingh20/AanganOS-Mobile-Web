import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@shared/lib/utils';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKb(hidden > 80 ? hidden : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKb(0);
    };
  }, [open]);

  if (!open) return null;

  const kbOpen = kb > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          transform: `translateY(-${kb}px)`,
          maxHeight: kbOpen ? `calc(100dvh - ${kb}px - 12px)` : '88vh',
        }}
        className={cn(
          'relative z-10 flex w-full max-w-2xl flex-col rounded-t-3xl bg-card shadow-2xl transition-[transform,max-height] duration-150',
          'animate-in slide-in-from-bottom',
          className,
        )}
      >
        <div className="flex shrink-0 justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {title ? (
          <div className="shrink-0 px-5 pb-1 pt-2 text-lg font-extrabold">{title}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer ? (
          <div className={cn('shrink-0 border-t border-border px-5 py-3', kbOpen ? '' : 'safe-bottom')}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
