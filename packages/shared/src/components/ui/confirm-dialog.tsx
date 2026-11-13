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
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 pr-4 pt-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy} className="h-9 rounded-lg text-xs">{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          className={`h-9 rounded-lg text-xs ${tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
