import { useState } from 'react';
import { Building2, Home, User, Mail, Layers, DoorOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { PasswordField } from '@shared/components/PasswordField';
import { SelectField } from '@shared/components/SelectField';
import { FormBanner } from '@shared/components/FormBanner';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { onboarding } from '@shared/services';
import { toFormError, type FormErrorView } from '@shared/api/errors';
import { countryFromValue, validatePhoneNumber } from '@shared/lib/countries';

const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };

const PLAN_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '9', label: '9 months' },
  { value: '12', label: '12 months' },
];

export interface RegisterSocietyProps {
  onSuccess: (message: string) => void;
  submitLabel?: string;
  twoColumn?: boolean;
}

export function RegisterSociety({ onSuccess, submitLabel, twoColumn = true }: RegisterSocietyProps) {
  const { t } = useTranslation();

  const TYPES = [
    { value: 'apartment_society', label: t('society.typeApartment') },
    { value: 'gated_community', label: t('society.typeGated') },
    { value: 'villa_bungalow', label: t('society.typeVilla') },
    { value: 'townhouse', label: t('society.typeTownhouse') },
    { value: 'mixed', label: t('society.typeMixed') },
  ];

  const [organizationName, setOrganizationName] = useState('');
  const [wingsText, setWingsText] = useState('');
  const [communityType, setCommunityType] = useState<string>('apartment_society');
  const [planMonths, setPlanMonths] = useState<string>('12');
  const [floors, setFloors] = useState('');
  const [roomsPerFloor, setRoomsPerFloor] = useState('');

  const parseWings = (text: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of text.split(/[,\n]+/)) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  };
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);

  const validate = (): boolean => {
    const fieldErrors: Record<string, string> = {};
    if (!organizationName.trim()) fieldErrors.organizationName = t('society.enterSociety');
    if (parseWings(wingsText).length === 0) fieldErrors.wings = t('society.enterWings');
    if (!adminName.trim()) fieldErrors.adminName = t('society.enterAdmin');
    const country = countryFromValue(adminPhone);
    if (adminPhone.trim() && adminPhone.trim() !== country.dialCode) {
      const phoneError = validatePhoneNumber(adminPhone, country.code);
      if (phoneError) fieldErrors.adminPhone = phoneError;
    }
    if (adminPassword.length < 6) fieldErrors.adminPassword = t('society.minPassword');
    const nFloors = floors.trim() ? Number(floors) : 0;
    const nRooms = roomsPerFloor.trim() ? Number(roomsPerFloor) : 0;
    if (floors.trim() && (!Number.isInteger(nFloors) || nFloors < 0 || nFloors > 200)) fieldErrors.floors = t('society.floorsInvalid');
    if (roomsPerFloor.trim() && (!Number.isInteger(nRooms) || nRooms < 0 || nRooms > 200)) fieldErrors.roomsPerFloor = t('society.roomsInvalid');
    if (Object.keys(fieldErrors).length > 0) {
      setError({ message: '', fieldErrors });
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (busy) return;
    setError(NO_ERROR);
    if (!validate()) return;
    setBusy(true);
    try {
      const wings = parseWings(wingsText);
      const result = await onboarding.registerSociety({
        organizationName: organizationName.trim(),
        communityName: wings[0] ?? '',
        communityType,
        adminName: adminName.trim(),
        adminPassword,
        planMonths: Number(planMonths),
        wings,
        ...(floors.trim() ? { floors: Number(floors) } : {}),
        ...(roomsPerFloor.trim() ? { roomsPerFloor: Number(roomsPerFloor) } : {}),
        ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}),
        ...(adminPhone.trim() && adminPhone.trim() !== countryFromValue(adminPhone).dialCode ? { adminPhone: adminPhone.trim() } : {}),
      });
      onSuccess(result.message || '');
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  const rowClass = twoColumn ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'flex flex-col gap-3';

  return (
    <div className="flex flex-col gap-3">
      <FormBanner message={error.message} />

      <TextField label={t('society.societyName')} icon={Building2} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} {...(error.fieldErrors.organizationName ? { error: error.fieldErrors.organizationName } : {})} placeholder={t('society.societyPlaceholder')} disabled={busy} />

      <div className={rowClass}>
        <TextField label={t('society.wings')} icon={Home} value={wingsText} onChange={(e) => setWingsText(e.target.value)} {...(error.fieldErrors.wings ? { error: error.fieldErrors.wings } : {})} placeholder={t('society.wingsPlaceholder')} disabled={busy} />
        <SelectField label={t('society.type')} value={communityType} options={TYPES} onChange={setCommunityType} disabled={busy} />
      </div>

      <div className={rowClass}>
        <TextField label={t('society.floors')} icon={Layers} type="number" inputMode="numeric" min={0} max={200} value={floors} onChange={(e) => setFloors(e.target.value)} {...(error.fieldErrors.floors ? { error: error.fieldErrors.floors } : {})} placeholder={t('society.floorsPlaceholder')} disabled={busy} />
        <TextField label={t('society.roomsPerFloor')} icon={DoorOpen} type="number" inputMode="numeric" min={0} max={200} value={roomsPerFloor} onChange={(e) => setRoomsPerFloor(e.target.value)} {...(error.fieldErrors.roomsPerFloor ? { error: error.fieldErrors.roomsPerFloor } : {})} placeholder={t('society.roomsPlaceholder')} disabled={busy} />
      </div>

      <p className="-mt-1 text-xs text-muted-foreground">{t('society.wingsHint')}</p>

      <div className={rowClass}>
        <SelectField label={t('society.subscriptionDuration')} value={planMonths} options={PLAN_OPTIONS} onChange={setPlanMonths} disabled={busy} />
        <TextField label={t('society.adminName')} icon={User} value={adminName} onChange={(e) => setAdminName(e.target.value)} {...(error.fieldErrors.adminName ? { error: error.fieldErrors.adminName } : {})} placeholder={t('society.adminNamePlaceholder')} disabled={busy} />
      </div>

      <div className={rowClass}>
        <PhoneField size="lg" label={t('society.phone')} value={adminPhone} onChange={setAdminPhone} {...(error.fieldErrors.adminPhone ? { error: error.fieldErrors.adminPhone } : {})} disabled={busy} placeholder={t('society.phonePlaceholder')} />
        <TextField label={t('society.emailOptional')} icon={Mail} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} {...(error.fieldErrors.adminEmail ? { error: error.fieldErrors.adminEmail } : {})} placeholder={t('society.emailPlaceholder')} disabled={busy} />
      </div>

      <PasswordField label={t('society.adminPassword')} value={adminPassword} onChange={setAdminPassword} {...(error.fieldErrors.adminPassword ? { error: error.fieldErrors.adminPassword } : {})} disabled={busy} placeholder={t('society.passwordPlaceholder')} onEnter={submit} />

      <PrimaryButton label={submitLabel ?? t('society.submit')} loading={busy} onClick={submit} />
    </div>
  );
}
