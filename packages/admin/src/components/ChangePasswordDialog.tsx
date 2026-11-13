import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { auth } from '@shared/services';
import { toFormError } from '@shared/api/errors';

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
  }, [open]);

  const canSubmit = current.length > 0 && next.length >= 6 && confirm.length > 0;

  const submit = async () => {
    if (busy || !canSubmit) return;
    if (next !== confirm) { toast.error(t('changePwd.mismatch')); return; }
    if (next === current) { toast.error(t('changePwd.sameAsOld')); return; }
    setBusy(true);
    try {
      await auth.changePassword({ currentPassword: current, newPassword: next });
      toast.success(t('changePwd.success'));
      onClose();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader title={t('changePwd.title')} description={t('changePwd.subtitle')} />
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('changePwd.current')}</label>
          <Input type="password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={t('changePwd.currentPlaceholder')} maxLength={256} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('changePwd.new')}</label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={t('changePwd.newPlaceholder')} maxLength={256} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('changePwd.confirm')}</label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('changePwd.confirmPlaceholder')} maxLength={256} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">{t('orgs.cancel')}</Button>
        <Button onClick={submit} disabled={busy || !canSubmit} className="h-9 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700">{t('changePwd.submit')}</Button>
      </DialogFooter>
    </Dialog>
  );
}
