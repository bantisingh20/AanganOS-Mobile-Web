import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Camera, CheckCircle2, Upload, X, User, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@app/components/AuthLayout';
import { BrandLogo } from '@shared/components/BrandLogo';
import { StepIndicator } from '@shared/components/StepIndicator';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { PasswordField } from '@shared/components/PasswordField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { OtpField } from '@shared/components/OtpField';
import { FormBanner } from '@shared/components/FormBanner';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { Field } from '@shared/components/Field';
import { Button } from '@shared/components/ui/button';
import { onboarding } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import { toFormError, type FormErrorView } from '@shared/api/errors';
import type { PublicCommunity, PublicSociety, PublicUnit } from '@shared/api/onboarding';
import { countryFromValue, validatePhoneNumber } from '@shared/lib/countries';
import { compressImageToDataUrl } from '@shared/lib/image';

type Step = 'society' | 'mobile' | 'otp' | 'selfie' | 'preview' | 'personal' | 'id' | 'done';
const STEP_ORDER: Step[] = ['society', 'mobile', 'otp', 'selfie', 'preview', 'personal', 'id'];
const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };
const RESEND_SECONDS = 24;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RegisterScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { adoptSession } = useAuth();

  const RESIDENT_TYPES: SelectOption[] = [
    { value: 'owner', label: t('register.owner') },
    { value: 'tenant', label: t('register.tenant') },
  ];
  const ID_TYPES: SelectOption[] = [
    { value: 'aadhaar', label: t('register.aadhaar') },
    { value: 'pan', label: t('register.pan') },
    { value: 'passport', label: t('register.passport') },
    { value: 'driving_license', label: t('register.drivingLicense') },
  ];
  const GENDERS: SelectOption[] = [
    { value: 'male', label: t('register.male') },
    { value: 'female', label: t('register.female') },
    { value: 'other', label: t('register.other') },
  ];

  const [step, setStep] = useState<Step>('society');
  const [error, setError] = useState<FormErrorView>(NO_ERROR);
  const [busy, setBusy] = useState(false);

  const [societySearch, setSocietySearch] = useState('');
  const [societies, setSocieties] = useState<PublicSociety[]>([]);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<PublicCommunity[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);

  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [residentType, setResidentType] = useState<string | null>('owner');

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  const [selfie, setSelfie] = useState<string | null>(null);
  const selfieInput = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const [idType, setIdType] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const idFrontInput = useRef<HTMLInputElement | null>(null);
  const idBackInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = societySearch.trim();
    if (societyId || q.length < 2) {
      setSocieties([]);
      setSearching(false);
      setSearched(false);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError('');
    const id = setTimeout(() => {
      void onboarding.searchSociety(q, { signal: controller.signal })
        .then((list) => {
          setSocieties(list);
          setSearched(true);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setSocieties([]);
          setSearched(true);
          setSearchError(toFormError(err).message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [societySearch, societyId]);

  useEffect(() => {
    if (!societyId) {
      setCommunities([]);
      setCommunityId(null);
      return;
    }
    setLoadingCommunities(true);
    void onboarding.searchCommunities('', societyId)
      .then((list) => {
        setCommunities(list);
        if (list.length === 1) {
          setCommunityId(list[0].id);
        }
      })
      .catch(() => setCommunities([]))
      .finally(() => setLoadingCommunities(false));
  }, [societyId]);

  useEffect(() => {
    if (!communityId) {
      setUnits([]);
      setUnitId(null);
      return;
    }
    setLoadingUnits(true);
    void onboarding.listUnits(communityId)
      .then(setUnits)
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [communityId]);

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [step, countdown]);

  const communityOptions: SelectOption[] = useMemo(
    () => communities.map((c) => ({ value: c.id, label: c.name })),
    [communities]
  );
  const unitOptions: SelectOption[] = useMemo(
    () => units.map((u) => ({ value: u.id, label: `${u.unitNumber}` })), //${t('register.unit')}
    [units, t]
  );

  const stepIndex = STEP_ORDER.indexOf(step);
  const warn = (msg: string) => setError({ message: msg, fieldErrors: {} });

  const back = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i <= 0) { navigate('/login'); return; }
    setStep(STEP_ORDER[i - 1]!);
    setError(NO_ERROR);
  };

  const chooseSociety = (s: PublicSociety) => {
    setSocietyId(s.id);
    setSocietySearch(s.name);
    setSocieties([]);
    setCommunityId(null);
    setUnitId(null);
  };

  const nextFromCommunity = () => {
    if (!societyId) { warn(t('register.selectSociety')); return; }
    if (!communityId) { warn(t('register.towerPlaceholder')); return; }
    if (!unitId) { warn(t('register.unitPlaceholder')); return; }
    setError(NO_ERROR);
    setStep('mobile');
  };

  const sendOtp = async () => {
    if (busy) return;
    const phoneError = validatePhoneNumber(phone, countryFromValue(phone).code);
    if (phoneError) { warn(phoneError); return; }
    setBusy(true);
    setError(NO_ERROR);
    try { await onboarding.requestOtp(phone.trim()); } catch { void 0; }
    finally { setOtp(''); setCountdown(RESEND_SECONDS); setStep('otp'); setBusy(false); }
  };

  const verifyOtp = async () => {
    if (busy) return;
    if (otp.length !== 6) { warn(t('register.enterCode')); return; }
    setBusy(true);
    setError(NO_ERROR);
    try {
      const res = await onboarding.verifyOtp(phone.trim(), otp);
      if (res.valid) { setVerifiedCode(otp); setStep('selfie'); }
      else warn(t('forgot.codeInvalid'));
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    try { await onboarding.requestOtp(phone.trim()); } catch { void 0; }
    finally { setCountdown(RESEND_SECONDS); setResending(false); }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const compressed = await compressImageToDataUrl(file);
    set(compressed);
  };

  const submitRegister = async () => {
    if (busy) return;
    if (!name.trim()) { warn(t('register.fullName')); return; }
    if (password.length < 6) { warn(t('register.passwordPlaceholder')); return; }
    if (!idType) { warn(t('register.selectIdType')); return; }
    setBusy(true);
    setError(NO_ERROR);
    try {
      const result = await onboarding.selfRegister({
        communityId: communityId!,
        unitId: unitId!,
        name: name.trim(),
        phone: phone.trim(),
        password,
        code: verifiedCode,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(residentType ? { residentType } : {}),
        ...(dob ? { dateOfBirth: dob } : {}),
        ...(gender ? { gender } : {}),
        ...(idType ? { govtIdType: idType } : {}),
        ...(selfie ? { selfieBase64: selfie } : {}),
        ...(idFront ? { govtIdFrontBase64: idFront } : {}),
        ...(idBack ? { govtIdBackBase64: idBack } : {}),
      });
      adoptSession(result.login);
      setStep('done');
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthLayout showBrandAside={false} showLanguage={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="h-20 w-20 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold">{t('register.doneTitle')}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('register.doneSubtitle')}</p>
          <div className="w-full rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
            <Row label={t('register.name')} value={name} />
            <Row label={t('register.unitSummary')} value={unitOptions.find((u) => u.value === unitId)?.label ?? ''} />
            <Row label={t('register.memberType')} value={RESIDENT_TYPES.find((r) => r.value === residentType)?.label ?? ''} />
          </div>
          <PrimaryButton label={t('register.goToHome')} onClick={() => navigate('/home')} />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBrandAside={false} showLanguage={false} contentClassName="justify-start gap-3 pt-3">
      <div className="flex items-center">
        <button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center" aria-label="Back">
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <StepIndicator current={Math.min(stepIndex, 6)} total={7} />

      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {step === 'society' ? (
          <>
            <BrandLogo size="sm" className="mb-1" />
            <h1 className="text-xl font-extrabold">{t('register.createTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.createSubtitle')}</p>
            <FormBanner message={error.message} />
            <TextField
              label={t('register.selectSociety')}
              icon={Search}
              value={societySearch}
              onChange={(e) => { setSocietySearch(e.target.value); setSocietyId(null); setCommunityId(null); setUnitId(null); }}
              placeholder={t('register.societyPlaceholder')}
            />
            {!societyId && societies.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {societies.map((s) => (
                  <button key={s.id} type="button" onClick={() => chooseSociety(s)} className="block w-full border-b border-border px-3 py-3 text-left text-sm last:border-b-0 hover:bg-accent">
                    {s.name}
                  </button>
                ))}
              </div>
            ) : !societyId && searching ? (
              <p className="px-1 text-sm text-muted-foreground">{t('register.searching')}</p>
            ) : !societyId && searchError ? (
              <p className="px-1 text-sm text-destructive">{searchError}</p>
            ) : !societyId && searched && societies.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">{t('register.noSocieties')}</p>
            ) : null}
            {societyId ? (
              <>
                <SelectField
                  label={t('register.towerBlock')}
                  value={communityId}
                  options={communityOptions}
                  placeholder={loadingCommunities ? t('register.searching') : t('register.towerPlaceholder')}
                  onChange={(v) => { setCommunityId(v); setUnitId(null); }}
                />
                {communityId ? (
                  <SelectField
                    label={t('register.unit')}
                    value={unitId}
                    options={unitOptions}
                    placeholder={loadingUnits ? t('register.searching') : t('register.unitPlaceholder')}
                    onChange={setUnitId}
                  />
                ) : null}
                <SelectField label={t('register.residentType')} value={residentType} options={RESIDENT_TYPES} onChange={setResidentType} />
              </>
            ) : null}
            <PrimaryButton label={t('register.next')} onClick={nextFromCommunity} />
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-muted-foreground">{t('register.haveAccount')}</span>
              <button type="button" onClick={() => navigate('/login')} className="font-semibold text-primary">{t('register.logIn')}</button>
            </div>
          </>
        ) : step === 'mobile' ? (
          <>
            <h1 className="text-xl font-extrabold">{t('register.mobileTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.mobileSubtitle')}</p>
            <FormBanner message={error.message} />
            <PhoneField label={t('register.mobileNumber')} value={phone} onChange={setPhone} disabled={busy} placeholder={t('register.mobilePlaceholder')} onEnter={sendOtp} />
            <PrimaryButton label={t('register.sendOtp')} loading={busy} onClick={sendOtp} />
          </>
        ) : step === 'otp' ? (
          <>
            <h1 className="text-xl font-extrabold">{t('register.otpTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">
              {t('register.otpSentTo')} <span className="font-bold text-foreground">{phone}</span>
            </p>
            <FormBanner message={error.message} />
            <OtpField value={otp} onChange={setOtp} disabled={busy} onComplete={verifyOtp} />
            <div className="flex items-center justify-center text-sm">
              <span className="text-muted-foreground">{t('register.didntReceive')} </span>
              {countdown > 0 ? (
                <span className="ml-1 font-bold text-muted-foreground">{t('register.resendIn')} {formatCountdown(countdown)}</span>
              ) : (
                <button type="button" onClick={resend} disabled={resending} className="ml-1 font-bold text-primary">{resending ? '…' : t('register.resend')}</button>
              )}
            </div>
            <PrimaryButton label={t('register.verifyOtp')} loading={busy} onClick={verifyOtp} />
          </>
        ) : step === 'selfie' ? (
          <>
            <h1 className="text-xl font-extrabold">{t('register.selfieTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.selfieSubtitle')}</p>
            <div className="mx-auto flex aspect-square w-56 max-w-[70%] items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-border bg-muted/40 sm:w-64">
              {selfie ? <img src={selfie} alt="selfie" className="h-full w-full object-cover" /> : <Camera className="h-14 w-14 text-muted-foreground" />}
            </div>
            <input ref={selfieInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPickFile(e, (v) => { setSelfie(v); setStep('preview'); })} />
            <PrimaryButton label={t('register.takePhoto')} arrow={false} onClick={() => selfieInput.current?.click()} />
          </>
        ) : step === 'preview' ? (
          <>
            <h1 className="text-xl font-extrabold">{t('register.previewTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.previewSubtitle')}</p>
            <div className="mx-auto aspect-square w-56 max-w-[70%] overflow-hidden rounded-full border-4 border-primary/30 sm:w-64">
              {selfie ? <img src={selfie} alt="selfie" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="h-[52px] flex-1 rounded-xl border-2 border-primary text-base font-bold text-primary" onClick={() => { setSelfie(null); setStep('selfie'); }}>
                {t('register.retake')}
              </Button>
              <PrimaryButton className="flex-1" label={t('register.usePhoto')} arrow={false} onClick={() => setStep('personal')} />
            </div>
          </>
        ) : step === 'personal' ? (
          <>
            <h1 className="text-xl font-extrabold">{t('register.personalTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.personalSubtitle')}</p>
            <FormBanner message={error.message} />
            <TextField label={t('register.fullName')} icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('register.fullNamePlaceholder')} />
            <TextField label={t('register.emailOptional')} icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('register.emailPlaceholder')} />
            <Field label={t('register.dateOfBirth')}>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </Field>
            <SelectField label={t('register.gender')} value={gender} options={GENDERS} onChange={setGender} />
            <PasswordField label={t('register.password')} value={password} onChange={setPassword} placeholder={t('register.passwordPlaceholder')} />
            <PrimaryButton label={t('register.next')} onClick={() => { if (!name.trim()) { warn(t('register.fullName')); return; } if (password.length < 6) { warn(t('register.passwordPlaceholder')); return; } setError(NO_ERROR); setStep('id'); }} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold">{t('register.idTitle')}</h1>
            <p className="-mt-1 text-sm text-muted-foreground">{t('register.idSubtitle')}</p>
            <FormBanner message={error.message} />
            <SelectField label={t('register.selectIdType')} value={idType} options={ID_TYPES} placeholder={t('register.idTypePlaceholder')} onChange={setIdType} />
            <div className="grid grid-cols-2 gap-3">
              <UploadTile label={t('register.frontSide')} value={idFront} onClear={() => setIdFront(null)} onClick={() => idFrontInput.current?.click()} uploadLabel={t('register.upload')} />
              <UploadTile label={t('register.backSide')} value={idBack} onClear={() => setIdBack(null)} onClick={() => idBackInput.current?.click()} uploadLabel={t('register.upload')} />
            </div>
            <input ref={idFrontInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e, setIdFront)} />
            <input ref={idBackInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e, setIdBack)} />
            <div className="flex items-center justify-center gap-1.5 px-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              {t('register.secureNote')}
            </div>
            <PrimaryButton label={t('register.createAccount')} loading={busy} onClick={submitRegister} />
          </>
        )}
      </div>
    </AuthLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function UploadTile({ label, value, uploadLabel, onClick, onClear }: { label: string; value: string | null; uploadLabel: string; onClick: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <button type="button" onClick={onClick} className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30">
        {value ? (
          <>
            <img src={value} alt={label} className="h-full w-full object-cover" />
            <span onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
              <X className="h-4 w-4" />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <span className="text-xs font-medium">{uploadLabel}</span>
          </span>
        )}
      </button>
    </div>
  );
}
