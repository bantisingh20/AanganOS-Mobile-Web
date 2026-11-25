import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogFooter } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] ${tone === 'danger' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'}`}>
          <AlertTriangle className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 pr-4 pt-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy} className="h-8.5 px-3.5 rounded-[4px] text-xs font-medium border-border/80">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          className={`h-8.5 px-4 rounded-[4px] text-xs font-medium ${tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
