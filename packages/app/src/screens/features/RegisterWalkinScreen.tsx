import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Camera, Image as ImageIcon, X } from 'lucide-react';
import { gate, masterData, residents, communities } from '@shared/services';
import type { Unit } from '@shared/api/units';
import type { RegisterWalkInResult } from '@shared/api/gate';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { UnitSearchField } from '@shared/components/UnitSearchField';
import { compressImageToDataUrl } from '@shared/lib/image';

export function RegisterWalkinScreen() {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const commsQuery = useAsync(
    (signal) => communities.list({ pageSize: 50 }, {}, { signal }).catch(() => null),
    [],
  );

  const defaultCommunityId =
    me.data?.units?.[0]?.communityId ??
    me.data?.resident?.communityId ??
    commsQuery.data?.items?.[0]?.id ??
    null;

  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCommunityId && defaultCommunityId) {
      setSelectedCommunityId(defaultCommunityId);
    }
  }, [defaultCommunityId, selectedCommunityId]);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [whomToMeet, setWhomToMeet] = useState('');
  const [purpose, setPurpose] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterWalkInResult | null>(null);

  const cameraInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);

  const communityOptions: SelectOption[] = useMemo(() => {
    return (commsQuery.data?.items ?? []).map((c) => ({
      value: c.id,
      label: c.name,
    }));
  }, [commsQuery.data]);

  const cats = useAsync(
    (signal) => masterData.list('Visitor_Category', selectedCommunityId ?? null, { signal }).catch(() => []),
    [selectedCommunityId],
  );
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));

  const onCommunityChange = (val: string) => {
    setSelectedCommunityId(val);
    setUnit(null); // Clear unit when community changes
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = useAsyncAction(async () => {
    if (!unit || !name.trim() || !category) return;

    let photoBase64: string | undefined;
    if (photoFile) {
      try {
        photoBase64 = await compressImageToDataUrl(photoFile, 960, 960, 0.75);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Photo compression failed';
        setUploadError(msg);
      }
    }

    const res = await gate.registerWalkIn({
      hostUnitId: unit.id,
      name: name.trim(),
      category,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(vehicleNumber.trim() ? { vehicleNumber: vehicleNumber.trim().toUpperCase() } : {}),
      ...(whomToMeet.trim() ? { whomToMeet: whomToMeet.trim() } : {}),
      ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
      ...(photoBase64 ? { photoBase64 } : {}),
    });
    setResult(res);
  });

  const reset = () => {
    setResult(null);
    setUnit(null);
    setName('');
    setPhone('');
    setCategory('');
    setVehicleNumber('');
    setWhomToMeet('');
    setPurpose('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadError(null);
  };

  const canSubmit = Boolean(unit && name.trim() && category);

  if (result) {
    return (
      <PageLayout title={t('registerWalkin.title')} subtitle={t('registerWalkin.subtitle')}>
        <div className="flex flex-col gap-4 px-4 py-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-6 text-center shadow-sm border border-border/50">
            {result.autoApproved ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            ) : (
              <Clock className="h-12 w-12 text-amber-500" />
            )}
            <h2 className="text-lg font-extrabold">
              {result.autoApproved ? t('registerWalkin.admitted') : t('registerWalkin.pending')}
            </h2>
            <p className="text-sm text-muted-foreground">{result.visitor.name}</p>
            {result.otp ? (
              <div className="mt-2 rounded-xl bg-primary/10 px-4 py-2">
                <p className="text-xs font-bold text-muted-foreground">{t('registerWalkin.otp')}</p>
                <p className="text-2xl font-black tracking-widest text-primary">{result.otp}</p>
              </div>
            ) : null}
            {!result.autoApproved ? (
              <p className="text-xs text-muted-foreground">{t('registerWalkin.pendingHint')}</p>
            ) : null}
          </div>
          <PrimaryButton label={t('registerWalkin.registerAnother')} arrow={false} onClick={reset} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('registerWalkin.title')} subtitle={t('registerWalkin.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Photo capture section */}
        <div className="flex flex-col items-center gap-2.5 py-1">
          <div className="relative flex aspect-square w-full max-w-[200px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 shadow-inner">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="visitor" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setUploadError(null);
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Camera className="h-12 w-12 text-muted-foreground/60" />
            )}
          </div>
          {uploadError ? <p className="text-center text-xs font-semibold text-destructive">{uploadError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold active:scale-95 transition-transform shadow-sm"
            >
              <Camera className="h-4 w-4 text-primary" /> Take Photo
            </button>
            <button
              type="button"
              onClick={() => galleryInput.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold active:scale-95 transition-transform shadow-sm"
            >
              <ImageIcon className="h-4 w-4 text-primary" /> Gallery
            </button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
          <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        </div>

        {/* Community Dropdown */}
        {communityOptions.length > 1 ? (
          <SelectField
            label="Community / Society"
            value={selectedCommunityId ?? ''}
            options={communityOptions}
            placeholder="Select community"
            onChange={onCommunityChange}
          />
        ) : null}

        {/* Unit Search scoped to selected community */}
        <UnitSearchField
          label={t('registerWalkin.unit')}
          placeholder={t('registerWalkin.unitPlaceholder')}
          communityId={selectedCommunityId}
          value={unit}
          onSelect={setUnit}
          required
        />

        <TextField
          label={t('registerWalkin.name')}
          requiredMark
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('registerWalkin.namePlaceholder')}
        />

        <TextField
          label={t('registerWalkin.phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('registerWalkin.phonePlaceholder')}
          inputMode="tel"
        />

        <SelectField
          label={t('registerWalkin.category')}
          required
          value={category}
          options={catOptions}
          placeholder={t('registerWalkin.selectCategory')}
          onChange={setCategory}
        />

        <TextField
          label={t('registerWalkin.whomToMeet')}
          value={whomToMeet}
          onChange={(e) => setWhomToMeet(e.target.value)}
          placeholder={t('registerWalkin.whomToMeetPlaceholder')}
        />

        <TextField
          label={t('registerWalkin.vehicle')}
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
          placeholder={t('registerWalkin.vehiclePlaceholder')}
        />

        <TextField
          label={t('registerWalkin.purpose')}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder={t('registerWalkin.purposePlaceholder')}
        />

        {submit.error ? <p className="text-sm text-destructive">{submit.error.message}</p> : null}
        <PrimaryButton
          label={t('registerWalkin.submit')}
          arrow={false}
          loading={submit.running}
          disabled={!canSubmit}
          onClick={() => submit.run()}
        />
      </div>
    </PageLayout>
  );
}
