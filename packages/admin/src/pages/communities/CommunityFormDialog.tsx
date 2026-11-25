import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { communities, organizations } from '@shared/services';
import type { Community } from '@shared/api/communities';
import type { Organization } from '@shared/api/organizations';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';

export function CommunityFormDialog({
  open,
  community,
  presetOrgId,
  onClose,
  onSaved,
}: {
  open: boolean;
  community?: Community | null;
  presetOrgId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!community;
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);

  const orgQuery = useAsync(
    (signal) => (open && !isEdit ? organizations.list({ pageSize: 200 }, { signal }).catch(() => null) : Promise.resolve(null)),
    [open, isEdit],
  );
  const orgOptions = useMemo(
    () => (orgQuery.data?.items ?? []).map((o: Organization) => ({ value: o.id, label: o.name })),
    [orgQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setName(community?.name ?? '');
    setOrgId(presetOrgId ?? '');
  }, [open, community, presetOrgId]);

  const submit = async () => {
    if (busy || !name.trim()) return;
    if (!isEdit && !orgId) {
      toast.error(t('communities.selectOrg'));
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await communities.update(community!.id, { name: name.trim() });
      else await communities.create({ organizationId: orgId, name: name.trim() });
      toast.success(isEdit ? t('communities.updated') : t('communities.created'));
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader title={isEdit ? t('communities.editTitle') : t('communities.addTitle')} />
      <div className="flex flex-col gap-3 pt-1">
        {!isEdit && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('communities.organization')} *</label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue placeholder={t('communities.selectOrgPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {orgOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('communities.name')} *</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('communities.namePlaceholder')}
            maxLength={256}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="h-9 text-xs rounded-[4px]"
          />
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
          {isEdit ? t('communities.saveChanges') : t('communities.createCommunity')}
        </Button>
      </div>
    </Dialog>
  );
}
