import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { organizations } from '@shared/services';
import type { Organization } from '@shared/api/organizations';
import { toFormError } from '@shared/api/errors';

export function OrgFormDialog({
  open,
  org,
  typeOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  org?: Organization | null;
  typeOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!org;
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState('apartment_society');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(org?.name ?? '');
      setPropertyType(org?.propertyType ?? 'apartment_society');
    }
  }, [open, org]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      if (isEdit) await organizations.update(org!.id, name.trim(), propertyType);
      else await organizations.create(name.trim(), propertyType);
      toast.success(isEdit ? t('orgs.updated') : t('orgs.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={isEdit ? t('orgs.editTitle') : t('orgs.addTitle')} />
      <div className="flex flex-col gap-3 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('orgs.orgName')} *</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('orgs.orgNamePlaceholder')}
            maxLength={256}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('orgs.propertyType')} *</label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80"
        >
          {t('orgs.cancel')}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {isEdit ? t('orgs.saveChanges') : t('orgs.createOrg')}
        </Button>
      </div>
    </Dialog>
  );
}
