import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { PhoneField } from '@shared/components/PhoneField';
import { residents, users, adminUsers, communities, units, organizations } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';

export const ROLE_RESIDENT = 'owner';
export const ROLE_SECURITY = 'security';
export const ROLE_COMMUNITY_ADMIN = 'CommunityAdmin';
export const ROLE_ORG_ADMIN = 'OrganizationAdmin';

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

export function UserFormDialog({
  open, person, presetCommunityId, onClose, onSaved,
}: {
  open: boolean;
  person?: Resident | null;
  presetCommunityId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const scope = useScope();
  const isEdit = !!person;
  const [residentType, setResidentType] = useState<string>(ROLE_RESIDENT);
  const [adminRole, setAdminRole] = useState<string>('');
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [originalUnitId, setOriginalUnitId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isResident = residentType !== ROLE_SECURITY;
  const isAdminRole = adminRole === ROLE_ORG_ADMIN || adminRole === ROLE_COMMUNITY_ADMIN;
  const isOrgAdmin = adminRole === ROLE_ORG_ADMIN;
  const effectiveCommunityId = communityId ?? presetCommunityId ?? undefined;

  const roleChoices = useMemo(() => {
    const base = [
      { value: ROLE_RESIDENT, label: t('users.roleResident') },
      { value: ROLE_SECURITY, label: t('users.roleSecurity') },
    ];
    if (scope.isPowerUser) {
      base.push({ value: ROLE_ORG_ADMIN, label: t('adminUsers.roleOrg') });
      base.push({ value: ROLE_COMMUNITY_ADMIN, label: t('adminUsers.roleCommunity') });
    } else if (scope.isOrgAdmin) {
      base.push({ value: ROLE_COMMUNITY_ADMIN, label: t('adminUsers.roleCommunity') });
    }
    return base;
  }, [scope.isPowerUser, scope.isOrgAdmin, t]);

  useEffect(() => {
    if (!open) return;
    setResidentType(person?.residentType === ROLE_SECURITY ? ROLE_SECURITY : (person?.residentType ?? ROLE_RESIDENT));
    const initialRole = person?.roleName ?? person?.roles?.[0] ?? '';
    setAdminRole(initialRole === ROLE_COMMUNITY_ADMIN || initialRole === ROLE_ORG_ADMIN ? initialRole : '');
    setCommunityId(person?.communityId ?? presetCommunityId ?? null);
    setOrganizationId(null);
    setName(person?.name ?? '');
    setPhone(person?.phone ?? '');
    setEmail(person?.email ?? '');
    setUnitId(null);
    setOriginalUnitId(null);
    setPassword('');
  }, [open, person, presetCommunityId]);

  const householdQuery = useAsync(
    (signal) => (open && isEdit && person?.id ? residents.listHousehold(person.id, { signal }).catch(() => []) : Promise.resolve([])),
    [open, isEdit, person?.id],
  );
  useEffect(() => {
    if (!isEdit) return;
    const current = householdQuery.data?.[0]?.unitId ?? null;
    setUnitId(current);
    setOriginalUnitId(current);
  }, [householdQuery.data, isEdit]);

  const editCommunityId = person?.communityId ?? undefined;
  const unitListCommunityId = isEdit ? editCommunityId : effectiveCommunityId;
  const loadUnits = open && (isEdit ? isResident && !!editCommunityId : !isEdit && isResident && !!effectiveCommunityId);

  const unitQuery = useAsync(
    async (signal) => {
      if (!loadUnits || !unitListCommunityId) return [];
      try {
        const d = await units.list({ pageSize: 200 }, { communityId: unitListCommunityId }, { signal });
        return d.items;
      } catch { return []; }
    },
    [loadUnits, unitListCommunityId],
  );
  const unitOptions = (unitQuery.data ?? []).map((u) => ({
    value: u.id,
    label: u.floor ? `${u.unitNumber} · ${t('users.floor')} ${u.floor}` : u.unitNumber,
  }));

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) { toast.error(t('users.needName')); return; }
    const finalRole = isAdminRole ? adminRole : (residentType === ROLE_SECURITY ? 'Security' : 'Resident');

    if (isEdit) {
      setBusy(true);
      try {
        const originalType = person!.residentType;
        const nextType = residentType === ROLE_SECURITY ? ROLE_SECURITY : (originalType && originalType !== ROLE_SECURITY ? originalType : ROLE_RESIDENT);

        await residents.update(person!.id, {
          name: name.trim(),
          residentType: nextType,
          phone: phone.trim() || null,
          updatePhone: true,
          email: email.trim() || null,
          updateEmail: true,
        });

        if (isResident && unitId && unitId !== originalUnitId) {
          await residents.associateHousehold(person!.id, { unitId, relationship: 'owner' });
        }

        if (person!.userId) {
          await users.update(person!.userId, {
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
          });

          if (finalRole && finalRole !== person!.roleName) {
            await adminUsers.update(person!.userId, {
              name: name.trim() || null,
              roleName: finalRole,
              status: 'Active',
              organizationId: isOrgAdmin ? organizationId : null,
              communityId: effectiveCommunityId ?? person!.communityId ?? null,
            }).catch(() => undefined);
          }
        }

        toast.success(t('users.updated'));
        onSaved();
      } catch (err) { toast.error(toFormError(err).message); }
      finally { setBusy(false); }
      return;
    }

    if (isResident && !effectiveCommunityId) { toast.error(t('users.needCommunity')); return; }
    const identifier = phone.trim() || email.trim();
    if (!identifier) { toast.error(t('users.needPhone')); return; }
    if (isResident && !unitId) { toast.error(t('users.needUnit')); return; }
    if (password.length < 4) { toast.error(t('users.needPassword')); return; }

    setBusy(true);
    try {
      const created = await residents.create({
        communityId: effectiveCommunityId ?? undefined,
        organizationId: organizationId ?? undefined,
        name: name.trim(),
        residentType,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (isResident && unitId) {
        await residents.associateHousehold(created.id, { unitId, relationship: 'owner' });
      }

      await residents.createLogin(created.id, { identifier, password, roleName: finalRole });
      toast.success(t('users.created'));
      onSaved();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md p-5 rounded-lg">
      <DialogHeader title={isEdit ? t('users.editTitle') : t('users.addTitle')} />
      <div className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.residentType')}</label>
            <Select value={residentType} onValueChange={(v) => { setResidentType(v); setUnitId(null); }}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLE_RESIDENT} className="text-xs">{t('users.roleResident')}</SelectItem>
                <SelectItem value={ROLE_SECURITY} className="text-xs">{t('users.roleSecurity')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.role')}</label>
            <Select
              value={adminRole || residentType}
              onValueChange={(v) => {
                if (v === ROLE_ORG_ADMIN || v === ROLE_COMMUNITY_ADMIN) setAdminRole(v);
                else { setAdminRole(''); setResidentType(v); setUnitId(null); }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleChoices.map((c) => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {scope.showOrgFilter && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.society')}</label>
            <EntitySelect value={organizationId} onChange={setOrganizationId} fetchPage={fetchOrgPage} resolveLabel={resolveOrgLabel} placeholder={t('users.selectSociety')} className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}

        {!presetCommunityId && isResident && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.wingTower')}</label>
            <EntitySelect value={communityId} onChange={(v) => { setCommunityId(v); setUnitId(null); }} fetchPage={makeCommunityFetch(organizationId ?? undefined)} resolveLabel={resolveCommunityLabel} placeholder={t('users.selectWingTower')} className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3" />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('users.name')} *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('users.namePlaceholder')} maxLength={200} className="h-9 text-xs rounded-[4px]" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.phone')}</label>
            <PhoneField value={phone} onChange={setPhone} placeholder={t('users.phonePlaceholder')} size="sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.email')}</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('users.emailPlaceholder')} maxLength={256} className="h-9 text-xs rounded-[4px]" />
          </div>
        </div>

        {isResident && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{isEdit ? t('users.unitWing') : t('users.unit')} *</label>
            <Select value={unitId ?? ''} onValueChange={setUnitId} disabled={!unitListCommunityId}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue placeholder={unitListCommunityId ? t('users.selectUnit') : t('users.selectCommunityFirst')} />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => <SelectItem key={u.value} value={u.value} className="text-xs">{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isEdit && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('users.password')} *</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('users.passwordPlaceholder')} maxLength={128} className="h-9 text-xs rounded-[4px]" />
          </div>
        )}
      </div>

      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose} className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80">
          {t('orgs.cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={busy || !name.trim()} className="h-8.5 px-4 rounded-[4px] text-xs font-medium">
          {isEdit ? t('users.saveChanges') : t('users.createPerson')}
        </Button>
      </div>
    </Dialog>
  );
}
