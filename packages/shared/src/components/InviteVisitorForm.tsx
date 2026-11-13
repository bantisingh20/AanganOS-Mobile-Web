import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, Share2, User, X, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gate, masterData, files, onboarding } from '@shared/services';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import type { CreateVisitPassResult } from '@shared/api/gate';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';

export interface InviteVisitorUnit {
  unitId: string;
  unitNumber: string;
  communityId?: string;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function endOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

function dayNoonIso(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toISOString();
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function InviteVisitorForm({
  units,
  residentId,
  communityId,
  onDone,
}: {
  units: InviteVisitorUnit[];
  residentId?: string | null;
  communityId?: string | null;
  onDone?: () => void;
}) {
  const { t } = useTranslation();

  const soleUnitId = units.length === 1 ? units[0]!.unitId : null;
  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whom, setWhom] = useState('');
  const [persons, setPersons] = useState('1');
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState('');
  const [visitDate, setVisitDate] = useState(todayPlus(0));
  const [validUntil, setValidUntil] = useState(todayPlus(1));
  const [photoFileId, setPhotoFileId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CreateVisitPassResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);

  const effectiveUnitId = unitId ?? soleUnitId;
  const selectedUnit = useMemo(() => units.find((u) => u.unitId === effectiveUnitId) ?? null, [units, effectiveUnitId]);
  const resolvedCommunityId = selectedUnit?.communityId ?? communityId ?? undefined;

  const vehicleTypes = useAsync(
    (signal) => masterData.list('Vehicle_Type', resolvedCommunityId ?? null, { signal }).catch(() => []),
    [resolvedCommunityId],
  );
  const config = useAsync((signal) => onboarding.getConfig({ signal }).catch(() => null), []);
  const vehicleOptions: SelectOption[] = (vehicleTypes.data ?? []).map((v) => ({ value: v.code, label: v.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: u.unitNumber }));

  useEffect(() => {
    if (result?.pass.qrToken) {
      void QRCode.toDataURL(result.pass.qrToken, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [result]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !resolvedCommunityId) return;
    setUploading(true);
    try {
      const uploaded = await files.upload(file, { owningResourceType: 'VisitPass', communityId: resolvedCommunityId });
      setPhotoFileId(uploaded.reference);
      setPhotoPreview(URL.createObjectURL(file));
    } catch {
      void 0;
    } finally {
      setUploading(false);
    }
  };

  const create = useAsyncAction(async () => {
    if (!selectedUnit) throw new Error(t('myVisitors.warnSelectUnit'));
    if (!name.trim()) throw new Error(t('myVisitors.warnName'));
    if (!validUntil) throw new Error(t('myVisitors.warnValidUntil'));
    const n = Number(persons.trim() || '1');
    const r = await gate.createVisitPass({
      hostUnitId: selectedUnit.unitId,
      visitorName: name.trim(),
      validUntilUtc: endOfDayIso(validUntil),
      ...(Number.isFinite(n) && n > 0 ? { numberOfPersons: n } : {}),
      ...(visitDate ? { visitDateUtc: dayNoonIso(visitDate) } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(whom.trim() ? { whomToMeet: whom.trim() } : {}),
      ...(vehicleType ? { vehicleType } : {}),
      ...(vehicle.trim() ? { vehicleNumber: vehicle.trim() } : {}),
      ...(photoFileId ? { photoFileId } : {}),
      ...(residentId ? { hostResidentId: residentId } : {}),
    });
    setResult(r);
  });

  const valid = !!selectedUnit && name.trim().length > 0 && !!validUntil;

  const reset = () => {
    setName(''); setPhone(''); setEmail(''); setWhom(''); setPersons('1');
    setVehicleType(null); setVehicle(''); setVisitDate(todayPlus(0)); setValidUntil(todayPlus(1));
    setPhotoFileId(null); setPhotoPreview(null); setResult(null); setQrDataUrl(null);
    create.reset();
  };

  const share = async () => {
    if (!result) return;
    const text =
      `Visit pass for ${result.pass.visitorName}\n` +
      `One-time code: ${result.otp}\n` +
      `Valid until: ${formatDateTime(result.pass.validUntilUtc)}\n` +
      `Pass token: ${result.pass.qrToken}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      await nav.share({ title: 'AanganOS Visit Pass', text }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
    }
  };

  if (result) {
    const p = result.pass;
    return (
      <div className="flex flex-col gap-4">
        <FormBanner message={t('myVisitors.passReadySubtitle')} tone="success" />
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 shadow-sm">
          <span className="text-sm font-bold text-muted-foreground">{t('myVisitors.scanAtGate')}</span>
          {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="h-56 w-56 rounded-xl" /> : <div className="h-56 w-56 animate-pulse rounded-xl bg-muted" />}
        </section>
        <section className="overflow-hidden rounded-2xl bg-card text-sm shadow-sm">
          <Row label={t('myVisitors.visitor')} value={p.visitorName} />
          {p.whomToMeet ? <Row label={t('myVisitors.whomToMeet')} value={p.whomToMeet} /> : null}
          {p.vehicleType ? <Row label={t('myVisitors.vehicleType')} value={`${p.vehicleType}${p.vehicleNumber ? ` · ${p.vehicleNumber}` : ''}`} /> : null}
          <Row label={t('myVisitors.persons')} value={`${p.numberOfPersons ?? 1}`} />
          <Row label={t('myVisitors.otp')} value={result.otp} />
          <Row label={t('myVisitors.entriesAllowed')} value={`${p.maxUses}`} />
          {p.visitDateUtc ? <Row label={t('myVisitors.visitDate')} value={formatDateTime(p.visitDateUtc)} /> : null}
          <Row label={t('myVisitors.validUntilLabel')} value={formatDateTime(p.validUntilUtc)} />
        </section>
        <button type="button" onClick={share} className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground">
          <Share2 className="h-5 w-5" /> {t('myVisitors.shareWithVisitor')}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="h-[52px] flex-1 rounded-xl border-2 border-primary text-base font-bold text-primary">
            {t('myVisitors.createAnother')}
          </button>
          {onDone ? <PrimaryButton className="flex-1" arrow={false} label={t('myVisitors.title')} onClick={onDone} /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {create.error ? <FormBanner message={create.error.message} /> : null}

      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><User className="h-4 w-4 text-primary" /></span>
        <span className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{t('myVisitors.sectionDetails')}</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative flex aspect-square w-full max-w-[220px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40">
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="visitor" className="h-full w-full object-cover" />
              <button type="button" onClick={() => { setPhotoFileId(null); setPhotoPreview(null); }} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Camera className="h-12 w-12 text-muted-foreground" />
          )}
          {uploading ? <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-semibold text-white">{t('myVisitors.uploading')}</div> : null}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => cameraInput.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold disabled:opacity-50">
            <Camera className="h-4 w-4 text-primary" /> {t('myVisitors.takePhoto')}
          </button>
          <button type="button" onClick={() => galleryInput.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold disabled:opacity-50">
            <ImageIcon className="h-4 w-4 text-primary" /> {t('myVisitors.fromGallery')}
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
        <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
      </div>

      {units.length > 1 ? (
        <SelectField label={t('myVisitors.hostUnit')} required value={effectiveUnitId} options={unitOptions} placeholder={t('myVisitors.selectUnit')} onChange={setUnitId} />
      ) : null}

      <TextField label={t('myVisitors.visitorName')} requiredMark value={name} onChange={(e) => setName(e.target.value)} placeholder={t('myVisitors.visitorNamePlaceholder')} />
      <PhoneField label={t('myVisitors.phone')} value={phone} onChange={setPhone} />
      <TextField label={t('myVisitors.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('myVisitors.emailPlaceholder')} />
      <TextField label={t('myVisitors.whomToMeet')} value={whom} onChange={(e) => setWhom(e.target.value)} placeholder={t('myVisitors.whomToMeetPlaceholder')} />
      <TextField label={t('myVisitors.persons')} type="number" value={persons} onChange={(e) => setPersons(e.target.value)} placeholder="1" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField label={t('myVisitors.vehicleType')} value={vehicleType} options={vehicleOptions} placeholder={t('myVisitors.selectVehicleType')} onChange={setVehicleType} />
        <TextField label={t('myVisitors.vehicleNumber')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder={t('myVisitors.vehicleNumberPlaceholder')} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('myVisitors.visitDate')}>
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </Field>
        <Field label={t('myVisitors.validUntil')} required>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </Field>
      </div>

      {config.data?.visitPassValidityText ? (
        <p className="px-1 text-center text-xs text-muted-foreground">{t('myVisitors.validityNote', { validity: config.data.visitPassValidityText })}</p>
      ) : null}

      <PrimaryButton label={t('myVisitors.createPass')} loading={create.running} disabled={!valid || uploading} onClick={() => void create.run()} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
