import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { Input } from '@shared/components/ui/input';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField } from '@shared/components/SelectField';
import { residents, units as unitsApi } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { validatePhone, validateEmail } from '@shared/lib/validation';

export interface PersonDialogProps {
  open: boolean;
  person: Resident | null;
  scopedCommunityId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PersonDialog({
  open,
  person,
  scopedCommunityId,
  onClose,
  onSaved,
}: PersonDialogProps) {
  const isEdit = !!person;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residentType, setResidentType] = useState('owner');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveCommunityId = person?.communityId ?? scopedCommunityId ?? undefined;

  useEffect(() => {
    if (!open) return;
    if (person) {
      setName(person.name || '');
      setPhone(person.phone || '');
      setEmail(person.email || '');
      const type = (person.residentType || '').toLowerCase();
      setResidentType(type.includes('security') ? 'security' : type.includes('tenant') ? 'tenant' : 'owner');
      setUnitId(null);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setResidentType('owner');
      setUnitId(null);
    }
  }, [open, person]);

  // Load existing assigned flat/unit when editing
  const householdQuery = useAsync(
    (signal) => (open && isEdit && person?.id ? residents.listHousehold(person.id, { signal }).catch(() => []) : Promise.resolve([])),
    [open, isEdit, person?.id],
  );

  useEffect(() => {
    if (!isEdit) return;
    const current = householdQuery.data?.[0]?.unitId ?? null;
    if (current) setUnitId(current);
  }, [householdQuery.data, isEdit]);

  // Load units for community
  const unitsQuery = useAsync(
    (signal) => (effectiveCommunityId ? unitsApi.list({ pageSize: 200 }, { communityId: effectiveCommunityId }, { signal }).catch(() => null) : Promise.resolve(null)),
    [effectiveCommunityId],
  );

  const unitOptions = useMemo(() => {
    return (unitsQuery.data?.items ?? []).map((u) => ({
      value: u.id,
      label: u.floor ? `Flat ${u.unitNumber} (Floor ${u.floor})` : `Flat ${u.unitNumber}`,
    }));
  }, [unitsQuery.data]);

  const submit = async () => {
    if (busy) return;
    setPhoneError(null);
    setEmailError(null);
    if (!name.trim()) { toast.error('Name is required'); return; }

    const pErr = validatePhone(phone, true);
    if (pErr) {
      setPhoneError(pErr);
      toast.error(pErr);
      return;
    }

    if (email.trim()) {
      const eErr = validateEmail(email, false);
      if (eErr) {
        setEmailError(eErr);
        toast.error(eErr);
        return;
      }
    }

    setBusy(true);
    try {
      if (isEdit && person) {
        await residents.update(person.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType: (residentType || 'owner').toLowerCase(),
        });

        if (unitId && residentType !== 'security') {
          await residents.associateHousehold(person.id, { unitId, relationship: 'owner' }).catch(() => undefined);
        }

        toast.success('Person updated successfully');
      } else {
        if (!effectiveCommunityId) {
          toast.error('Community is required');
          return;
        }
        const created = await residents.create({
          communityId: effectiveCommunityId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType: (residentType || 'owner').toLowerCase(),
        });

        if (unitId && created?.id && residentType !== 'security') {
          await residents.associateHousehold(created.id, { unitId, relationship: 'owner' }).catch(() => undefined);
        }

        toast.success('Person added successfully');
      }
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SmartFormDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Person' : 'Add Person'}
      subtitle={isEdit ? person?.name : 'Add a resident, tenant, or security staff member.'}
      fieldsCount={5}
      onSave={submit}
      isSaving={busy}
      saveLabel={isEdit ? 'Update' : 'Add Person'}
      closeButton="cross"
    >
      <div className="flex flex-col gap-4 text-xs">
        <div>
          <label className="mb-1.5 block font-bold text-foreground">Full Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="h-10 text-xs sm:text-sm rounded-[4px]"
          />
        </div>

        <div>
          <PhoneField
            label="Mobile Phone *"
            value={phone}
            onChange={(val) => {
              setPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            error={phoneError ?? undefined}
            enableContactPicker
            onContactPicked={(c) => {
              if (c.name && !name.trim()) {
                setName(c.name);
              }
            }}
          />
        </div>

        <div>
          <label className="mb-1.5 block font-bold text-foreground">Email (Optional)</label>
          <Input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            placeholder="ramesh@example.com"
            className="h-10 text-xs sm:text-sm rounded-[4px]"
          />
          {emailError ? (
            <p className="mt-1 text-[11px] text-destructive">{emailError}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block font-bold text-foreground">Role Type *</label>
          <SelectField
            value={residentType}
            options={[
              { value: 'owner', label: 'Resident / Flat Owner' },
              { value: 'tenant', label: 'Tenant' },
              { value: 'security', label: 'Security Guard / Staff' },
            ]}
            onChange={(v) => setResidentType(v)}
          />
        </div>

        {residentType !== 'security' && unitOptions.length > 0 ? (
          <div>
            <label className="mb-1.5 block font-bold text-foreground">Assign Flat / Unit (Optional)</label>
            <SelectField
              value={unitId ?? ''}
              options={[{ value: '', label: 'Select Flat…' }, ...unitOptions]}
              onChange={(v) => setUnitId(v || null)}
            />
          </div>
        ) : null}
      </div>
    </SmartFormDrawer>
  );
}
