import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock } from 'lucide-react';
import { gate, masterData, residents } from '@shared/services';
import type { Unit } from '@shared/api/units';
import type { RegisterWalkInResult } from '@shared/api/gate';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { UnitSearchField } from '@shared/components/UnitSearchField';

export function RegisterWalkinScreen() {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const communityId = me.data?.units?.[0]?.communityId ?? me.data?.resident?.communityId ?? null;

  const [unit, setUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [whomToMeet, setWhomToMeet] = useState('');
  const [purpose, setPurpose] = useState('');
  const [result, setResult] = useState<RegisterWalkInResult | null>(null);

  const resolvedCommunityId = unit?.communityId ?? communityId ?? undefined;
  const cats = useAsync(
    (signal) => masterData.list('Visitor_Category', resolvedCommunityId ?? null, { signal }).catch(() => []),
    [resolvedCommunityId],
  );
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));

  const submit = useAsyncAction(async () => {
    if (!unit || !name.trim() || !category) return;
    const res = await gate.registerWalkIn({
      hostUnitId: unit.id,
      name: name.trim(),
      category,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(vehicleNumber.trim() ? { vehicleNumber: vehicleNumber.trim().toUpperCase() } : {}),
      ...(whomToMeet.trim() ? { whomToMeet: whomToMeet.trim() } : {}),
      ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
    });
    setResult(res);
  });

  const reset = () => {
    setResult(null);
    setUnit(null);
    setName(''); setPhone(''); setCategory(''); setVehicleNumber(''); setWhomToMeet(''); setPurpose('');
  };

  const canSubmit = Boolean(unit && name.trim() && category);

  if (result) {
    return (
      <PageLayout title={t('registerWalkin.title')} subtitle={t('registerWalkin.subtitle')}>
        <div className="flex flex-col gap-4 px-4 py-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 text-center shadow-sm">
            {result.autoApproved ? <CheckCircle2 className="h-12 w-12 text-emerald-500" /> : <Clock className="h-12 w-12 text-amber-500" />}
            <h2 className="text-lg font-extrabold">{result.autoApproved ? t('registerWalkin.admitted') : t('registerWalkin.pending')}</h2>
            <p className="text-sm text-muted-foreground">{result.visitor.name}</p>
            {result.otp ? (
              <div className="mt-2 rounded-xl bg-primary/10 px-4 py-2">
                <p className="text-xs font-bold text-muted-foreground">{t('registerWalkin.otp')}</p>
                <p className="text-2xl font-black tracking-widest text-primary">{result.otp}</p>
              </div>
            ) : null}
            {!result.autoApproved ? <p className="text-xs text-muted-foreground">{t('registerWalkin.pendingHint')}</p> : null}
          </div>
          <PrimaryButton label={t('registerWalkin.registerAnother')} arrow={false} onClick={reset} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('registerWalkin.title')} subtitle={t('registerWalkin.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        <UnitSearchField label={t('registerWalkin.unit')} placeholder={t('registerWalkin.unitPlaceholder')} communityId={communityId} value={unit} onSelect={setUnit} required />
        <TextField label={t('registerWalkin.name')} requiredMark value={name} onChange={(e) => setName(e.target.value)} placeholder={t('registerWalkin.namePlaceholder')} />
        <TextField label={t('registerWalkin.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('registerWalkin.phonePlaceholder')} inputMode="tel" />
        <SelectField label={t('registerWalkin.category')} required value={category} options={catOptions} placeholder={t('registerWalkin.selectCategory')} onChange={setCategory} />
        <TextField label={t('registerWalkin.whomToMeet')} value={whomToMeet} onChange={(e) => setWhomToMeet(e.target.value)} placeholder={t('registerWalkin.whomToMeetPlaceholder')} />
        <TextField label={t('registerWalkin.vehicle')} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder={t('registerWalkin.vehiclePlaceholder')} />
        <TextField label={t('registerWalkin.purpose')} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('registerWalkin.purposePlaceholder')} />
        {submit.error ? <p className="text-sm text-destructive">{submit.error.message}</p> : null}
        <PrimaryButton label={t('registerWalkin.submit')} arrow={false} loading={submit.running} disabled={!canSubmit} onClick={() => submit.run()} />
      </div>
    </PageLayout>
  );
}
