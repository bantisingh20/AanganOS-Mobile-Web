import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { PhoneField } from '@shared/components/PhoneField';
import { adminUsers, organizations, communities } from '@shared/services';
import type { AdminUser } from '@shared/api/adminUsers';
import type { Role } from '@shared/api/roles';
import { cn } from '@shared/lib/utils';
import { toFormError } from '@shared/api/errors';

export const ROLE_POWER = 'PowerUser';
export const ROLE_ORG = 'OrganizationAdmin';
export const ROLE_COMMUNITY = 'CommunityAdmin';

function fetchOrgPage(search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> {
  return organizations.list({ search: search || undefined, page, pageSize }, { signal })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));
}

function makeCommunityFetch(organizationId?: string) {
  return (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
    communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal })
      .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));
}

function resolveCommunityLabel(id: string, signal: AbortSignal) {
  return communities.get(id, { signal }).then((c) => c.name).catch(() => null);
}

function resolveOrgLabel(id: string, signal: AbortSignal) {
  return organizations.get(id, { signal }).then((o) => o.name).catch(() => null);
}

export function AdminUserFormDialog({
  open, admin, creatableRoles, dbRoles, onClose, onSaved,
}: {
  open: boolean;
  admin?: AdminUser | null;
  creatableRoles: string[];
  dbRoles?: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!admin;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('');
  const [active, setActive] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedRoleObj = useMemo(
    () => dbRoles?.find((r) => r.name.toLowerCase() === roleName.toLowerCase()),
    [dbRoles, roleName],
  );
  const isCommunityScope = selectedRoleObj ? selectedRoleObj.scope !== 0 : roleName === ROLE_COMMUNITY;
  const isOrgScope = roleName === ROLE_ORG;

  const needsOrg = isOrgScope || isCommunityScope;
  const needsCommunity = isCommunityScope;

  const roleLabel = (n: string) => {
    if (n === ROLE_POWER) return t('adminUsers.rolePower');
    if (n === ROLE_ORG) return t('adminUsers.roleOrg');
    if (n === ROLE_COMMUNITY) return t('adminUsers.roleCommunity');
    const fromDb = dbRoles?.find((r) => r.name.toLowerCase() === n.toLowerCase());
    return fromDb ? fromDb.name : n;
  };

  const roleChoices = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of creatableRoles) {
      const trimmed = r.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    }
    if (admin) {
      for (const r of admin.roles) {
        const trimmed = r.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          list.push(trimmed);
        }
      }
    }
    return list;
  }, [creatableRoles, admin]);

  useEffect(() => {
    if (!open) return;
    setName(admin?.name ?? '');
    setPhone(admin?.phone ?? '');
    setEmail(admin?.email ?? '');
    setPassword('');
    setRoleName(admin?.roles[0] ?? creatableRoles[0] ?? '');
    setActive(admin?.status !== 'Suspended');
    const assignedCommId = admin?.assignments.find((a) => a.communityId)?.communityId ?? null;
    setCommunityId(assignedCommId);
    setOrganizationId(null);
    if (assignedCommId) {
      communities.get(assignedCommId).then((c) => {
        if (c?.organizationId) setOrganizationId(c.organizationId);
      }).catch(() => undefined);
    }
  }, [open, admin, creatableRoles]);

  const submit = async () => {
    if (busy || !roleName) return;
    const loginIdentifier = phone.trim() || email.trim();
    if (!isEdit && (!loginIdentifier || password.length < 8)) { toast.error(t('adminUsers.needCredentials')); return; }
    if (isEdit && password && password.length < 8) { toast.error(t('adminUsers.needCredentials')); return; }
    if (needsOrg && !organizationId && !(isEdit && needsCommunity && communityId)) { toast.error(t('adminUsers.needOrg')); return; }
    if (needsCommunity && !communityId) { toast.error(t('adminUsers.needCommunity')); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await adminUsers.update(admin!.id, {
          name: name.trim() || null,
          password: password ? password : null,
          roleName,
          status: active ? 'Active' : 'Suspended',
          organizationId: needsOrg ? organizationId : null,
          communityId: needsCommunity ? communityId : null,
        });
      } else {
        await adminUsers.create({
          name: name.trim() || null,
          identifier: loginIdentifier,
          password,
          roleName,
          organizationId: needsOrg ? organizationId : null,
          communityId: needsCommunity ? communityId : null,
        });
      }
      toast.success(isEdit ? t('adminUsers.updated') : t('adminUsers.created'));
      onSaved();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md p-5 rounded-lg">
      <DialogHeader title={isEdit ? t('adminUsers.editTitle') : t('adminUsers.addTitle')} />
      <div className="flex flex-col gap-3 pt-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.name')}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('adminUsers.namePlaceholder')} maxLength={200} className="h-9 text-xs rounded-[4px]" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.role')} *</label>
          <Select value={roleName} onValueChange={(v) => { setRoleName(v); setOrganizationId(null); setCommunityId(null); }}>
            <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
              <SelectValue placeholder={t('adminUsers.selectRole')} />
            </SelectTrigger>
            <SelectContent>
              {roleChoices.map((r) => <SelectItem key={r} value={r} className="text-xs">{roleLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isEdit ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.activeLabel')}</label>
            <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/80">
              <button type="button" onClick={() => setActive(true)} className={cn('flex-1 rounded-[3px] py-1 text-xs font-medium transition-colors', active ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground')}>{t('adminUsers.statusActive')}</button>
              <button type="button" onClick={() => setActive(false)} className={cn('flex-1 rounded-[3px] py-1 text-xs font-medium transition-colors', !active ? 'bg-background text-rose-600 shadow-xs' : 'text-muted-foreground')}>{t('adminUsers.statusSuspended')}</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.phone')}</label>
              <PhoneField value={phone} onChange={setPhone} placeholder={t('adminUsers.phonePlaceholder')} size="sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.email')}</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('adminUsers.emailPlaceholder')} maxLength={256} className="h-9 text-xs rounded-[4px]" />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{isEdit ? t('adminUsers.newPassword') : t('adminUsers.password')} {isEdit ? '' : '*'}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? t('adminUsers.newPasswordPlaceholder') : t('adminUsers.passwordPlaceholder')} maxLength={256} className="h-9 text-xs rounded-[4px]" />
        </div>

        {needsOrg && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.organization')} *</label>
            <EntitySelect value={organizationId} onChange={(v) => { setOrganizationId(v); setCommunityId(null); }} fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('adminUsers.selectOrg')} className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}

        {needsCommunity && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('adminUsers.community')} *</label>
            <EntitySelect value={communityId} onChange={setCommunityId} fetchPage={makeCommunityFetch(organizationId ?? undefined)} resolveLabel={resolveCommunityLabel} placeholder={t('adminUsers.selectCommunity')} className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}
      </div>

      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
          {t('orgs.cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={busy || !roleName} className="h-8.5 px-4 rounded-[4px] text-xs font-medium">
          {isEdit ? t('adminUsers.saveChanges') : t('adminUsers.createUser')}
        </Button>
      </div>
    </Dialog>
  );
}
