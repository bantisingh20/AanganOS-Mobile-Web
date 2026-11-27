import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { roles } from '@shared/services';
import type { Role } from '@shared/api/roles';
import { withToast } from '@shared/lib/withToast';
import { fetchCommunityPage, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import { SCOPE_PLATFORM, SCOPE_COMMUNITY } from './roleConstants';

export function RoleBasicDialog({
  open, role, cloneSource, onClose, onSaved,
}: {
  open: boolean; role?: Role | null; cloneSource?: Role | null; onClose: () => void; onSaved: (savedRole: Role) => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!role;
  const isClone = !!cloneSource && !role;

  const [name, setName] = useState('');
  const [scope, setScope] = useState<number>(SCOPE_PLATFORM);
  const [communityId, setCommunityId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setName(role.name); setScope(role.scope); setCommunityId(role.communityId ?? '');
    } else if (cloneSource) {
      setName(`${cloneSource.name} (Copy)`); setScope(cloneSource.scope); setCommunityId(cloneSource.communityId ?? '');
    } else {
      setName(''); setScope(SCOPE_PLATFORM); setCommunityId('');
    }
  }, [open, role, cloneSource]);

  const canSubmit = !!name.trim() && (scope === SCOPE_PLATFORM || !!communityId);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const permissions = isClone && cloneSource ? cloneSource.permissions : role ? role.permissions : [];
      const body = {
        name: name.trim(), scope, communityId: scope === SCOPE_COMMUNITY ? communityId || null : null, permissions,
      };

      const result = await withToast(
        () => (isEdit ? roles.update(role!.id, body) : roles.create(body)),
        isEdit ? t('roles.updated') : isClone ? 'Role duplicated successfully' : t('roles.created'),
      );
      if (result) onSaved(result);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-xl p-5">
      <DialogHeader title={isEdit ? t('roles.editTitle') : isClone ? 'Duplicate Role' : t('roles.addTitle')} />
      <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('roles.nameLabel')} *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Society Manager, Guard" maxLength={200} className="h-9 text-xs rounded-md" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('roles.scopeLabel')} *</label>
          <Select value={String(scope)} onValueChange={(v) => { const n = Number(v); setScope(n); if (n === SCOPE_PLATFORM) setCommunityId(''); }}>
            <SelectTrigger className="h-9 w-full rounded-md text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={String(SCOPE_PLATFORM)}>Society-wide (All Communities)</SelectItem>
              <SelectItem value={String(SCOPE_COMMUNITY)}>Specific Community Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === SCOPE_COMMUNITY && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('roles.community')} *</label>
            <EntitySelect value={communityId || null} onChange={(v) => setCommunityId(v ?? '')} fetchPage={fetchCommunityPage} resolveLabel={resolveCommunityLabel} placeholder={t('roles.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-md [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
        <div className="mt-2 pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy || !canSubmit} className="h-8.5 px-4 rounded-[4px] text-xs font-medium">
            {busy ? t('common.saving', 'Saving...') : isEdit ? t('roles.saveChanges') : isClone ? 'Duplicate Role' : t('roles.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
