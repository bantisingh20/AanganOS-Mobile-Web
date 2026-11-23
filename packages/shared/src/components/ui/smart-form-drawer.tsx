import { useEffect, type ReactNode } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogHeader, DialogFooter } from './dialog';
import { Button } from './button';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { cn } from '@shared/lib/utils';

export interface SmartFormDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /**
   * If <= 3, renders as a centered Dialog/Modal.
   * If > 3, renders as a slide-over / bottom Drawer.
   * Defaults to 4 (Drawer) to enforce the modal avoidance rule for complex forms.
   */
  fieldsCount?: number;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  cancelLabel?: string;
  isSaving?: boolean;
  saveDisabled?: boolean;
  /**
   * Whether to display 'cross' (X icon) or 'cancel' (text button).
   * Default is 'cross' so only one close control is shown.
   */
  closeButton?: 'cross' | 'cancel';
  /**
   * Optional custom header action elements placed alongside Save/Cancel.
   */
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SmartFormDrawer({
  open,
  onClose,
  title,
  subtitle,
  fieldsCount = 4,
  onSave,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  isSaving = false,
  saveDisabled = false,
  closeButton = 'cross',
  headerActions,
  children,
  className,
}: SmartFormDrawerProps) {
  const isSmall = useIsSmallScreen();
  const isDialog = fieldsCount <= 3 && !isSmall;

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, isSaving]);

  if (!open) return null;

  // 1. Small quick forms (<= 3 fields on desktop): Render as Centered Dialog
  if (isDialog) {
    return (
      <Dialog open={open} onClose={onClose} className={cn('sm:max-w-md', className)}>
        <DialogHeader title={title} /> 
        {/* description={subtitle}  */}
        <div className="py-2">{children}</div>
        <DialogFooter>
          {closeButton === 'cancel' ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
              className="h-10 rounded-xl px-4 text-xs sm:text-sm font-semibold hover:bg-muted active:scale-95 transition-all"
            >
              {cancelLabel}
            </Button>
          ) : null}
          {onSave ? (
            <Button
              type="button"
              disabled={saveDisabled || isSaving}
              onClick={onSave}
              className="h-10 rounded-xl bg-primary px-4 sm:px-5 text-xs sm:text-sm font-bold text-white hover:bg-primary/90 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {saveLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </Dialog>
    );
  }

  // 2. Complex forms (> 3 fields or any mobile view): Render as Drawer with Top-Right Action Buttons
  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (!isSaving) onClose();
        }}
      />

      {/* Drawer Surface */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 flex h-full w-full flex-col bg-card shadow-2xl transition-all duration-300',
          // Desktop: Slide from right (max-w-xl or 2xl)
          'md:ml-auto md:w-full md:max-w-xl md:border-l md:border-border/60 md:animate-in md:slide-in-from-right',
          // Mobile: Full height slide-up with safe-area support
          'animate-in slide-in-from-bottom duration-200',
          className,
        )}
      >
        {/* Sticky Header with Title and Top-Right Action Buttons */}
        <header className="safe-top sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-sm">
          {/* Left: Title & Subtitle (subtitle hidden on mobile screen per requirements) */}
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="truncate text-base font-extrabold text-foreground sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="hidden sm:block truncate text-xs font-medium text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Top-Right: Action Buttons (Cancel OR Cross, Medium size h-10 buttons) */}
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}

            {/* Cancel Button (only shown if closeButton === 'cancel') */}
            {closeButton === 'cancel' ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={onClose}
                className="h-10 rounded-xl px-4 text-xs sm:text-sm font-semibold hover:bg-muted active:scale-95 transition-all"
              >
                {cancelLabel}
              </Button>
            ) : null}

            {/* Save / Submit Button (medium size h-10) */}
            {onSave ? (
              <Button
                type="button"
                disabled={saveDisabled || isSaving}
                onClick={onSave}
                className="h-10 rounded-xl bg-primary px-4 sm:px-5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4 stroke-[2.5]" />
                )}
                {saveLabel}
              </Button>
            ) : null}

            {/* Cross Button (only shown if closeButton === 'cross') */}
            {closeButton === 'cross' ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>

        {/* Scrollable Form Body */}
        <div className="safe-bottom min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-lg flex-col gap-4">
            {children}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default SmartFormDrawer;
