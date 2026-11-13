import { useEffect, useState } from 'react';
import { ChevronLeft, Mail, Lock, MessageSquare, ShieldCheck, Check, CircleDashed, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@shared/components/BrandLogo';
import { StepIndicator } from '@shared/components/StepIndicator';
import { PhoneField } from '@shared/components/PhoneField';
import { TextField } from '@shared/components/TextField';
import { FormBanner } from '@shared/components/FormBanner';
import { OtpField } from '@shared/components/OtpField';
import { PasswordField } from '@shared/components/PasswordField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { auth } from '@shared/services';
import { toFormError, type FormErrorView } from '@shared/api/errors';
import { countryFromValue, validatePhoneNumber } from '@shared/lib/countries';
import { cn } from '@shared/lib/utils';

type Step = 'request' | 'verify' | 'reset' | 'done';
type Mode = 'mobile' | 'email';
const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };
const RESEND_SECONDS = 24;

const RULES = [
  { key: 'ruleLength', test: (p: string) => p.length >= 8 },
  { key: 'ruleNumber', test: (p: string) => /\d/.test(p) },
  { key: 'ruleUppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'ruleSpecial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export interface ForgotPasswordProps {
  onExit: () => void;
  onDone?: () => void;
  showBrandLogo?: boolean;
}

export function ForgotPassword({ onExit, onDone, showBrandLogo = true }: ForgotPasswordProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<FormErrorView>(NO_ERROR);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('mobile');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (step !== 'verify' || countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [step, countdown]);

  const back = () => {
    if (step === 'verify') { setStep('request'); setError(NO_ERROR); return; }
    if (step === 'reset') { setStep('verify'); setError(NO_ERROR); return; }
    onExit();
  };

  const goVerify = () => {
    setOtp('');
    setCode('');
    setResent(false);
    setCountdown(RESEND_SECONDS);
    setError(NO_ERROR);
    setStep('verify');
  };

  const sendOtp = async () => {
    if (busy) return;
    const value = identifier.trim();
    if (mode === 'mobile') {
      const phoneError = validatePhoneNumber(value, countryFromValue(value).code);
      if (phoneError) { setError({ message: '', fieldErrors: { identifier: phoneError } }); return; }
    } else if (!value) {
      setError({ message: '', fieldErrors: { identifier: t('forgot.emailPlaceholder') } });
      return;
    }
    setBusy(true);
    setError(NO_ERROR);
    try {
      await auth.forgotPassword({ identifier: value });
      goVerify();
    } catch (err) {
      const view = toFormError(err);
      if (Object.keys(view.fieldErrors).length > 0) setError(view);
      else goVerify();
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (busy) return;
    if (otp.length !== 6) { setError({ message: '', fieldErrors: { code: ' ' } }); return; }
    setBusy(true);
    setError(NO_ERROR);
    try {
      const res = await auth.verifyOtp({ identifier: identifier.trim(), code: otp });
      if (res.valid) { setCode(otp); setNewPassword(''); setConfirm(''); setStep('reset'); }
      else setError({ message: t('forgot.codeInvalid'), fieldErrors: { code: ' ' } });
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    try { await auth.forgotPassword({ identifier: identifier.trim() }); } catch { void 0; }
    finally { setResent(true); setCountdown(RESEND_SECONDS); setResending(false); }
  };

  const ruleState = RULES.map((r) => ({ key: r.key, ok: r.test(newPassword) }));
  const allRulesOk = ruleState.every((r) => r.ok);

  const resetPassword = async () => {
    if (busy) return;
    if (!allRulesOk) { setError({ message: '', fieldErrors: { newPassword: ' ' } }); return; }
    if (newPassword !== confirm) { setError({ message: '', fieldErrors: { confirm: t('forgot.passwordsDoNotMatch') } }); return; }
    setBusy(true);
    setError(NO_ERROR);
    try {
      await auth.resetPassword({ identifier: identifier.trim(), code: code.trim(), newPassword });
      setStep('done');
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = step === 'request' ? 0 : step === 'verify' ? 1 : 2;

  if (step === 'done') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8 text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-accent">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary shadow-lg">
            <CheckCircle2 className="h-14 w-14 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-xl font-extrabold">{t('forgot.successTitle')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('forgot.successMessage')}</p>
        <PrimaryButton label={t('forgot.backToLogin')} onClick={onDone ?? onExit} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center px-3 pt-3">
        <button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center" aria-label={t('forgot.backToLogin')}>
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <StepIndicator current={stepIndex} total={3} />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-6 pt-2">
        {step === 'request' ? (
          <>
            {showBrandLogo ? <BrandLogo size="md" /> : null}
            <h1 className="text-center text-xl font-extrabold">{t('forgot.title')}</h1>
            <p className="text-center text-sm leading-relaxed text-muted-foreground">{t('forgot.subtitle')}</p>

            <div className="flex w-full rounded-xl bg-accent p-1">
              {(['mobile', 'email'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setIdentifier(''); setError(NO_ERROR); }}
                  className={cn('flex-1 rounded-lg py-2.5 text-sm font-bold', mode === m ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}
                >
                  {m === 'mobile' ? t('forgot.tabMobile') : t('forgot.tabEmail')}
                </button>
              ))}
            </div>

            <div className="w-full">
              {mode === 'mobile' ? (
                <PhoneField
                  size="lg"
                  value={identifier}
                  onChange={setIdentifier}
                  {...(error.fieldErrors.identifier ? { error: error.fieldErrors.identifier } : {})}
                  disabled={busy}
                  placeholder={t('forgot.mobilePlaceholder')}
                  onEnter={sendOtp}
                />
              ) : (
                <TextField
                  type="email"
                  icon={Mail}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  {...(error.fieldErrors.identifier ? { error: error.fieldErrors.identifier } : {})}
                  disabled={busy}
                  placeholder={t('forgot.emailPlaceholder')}
                  onEnter={sendOtp}
                />
              )}
            </div>

            <FormBanner message={error.message} />
            <PrimaryButton label={t('forgot.sendOtp')} loading={busy} onClick={sendOtp} />

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t('forgot.secureNote')}
            </div>
          </>
        ) : step === 'verify' ? (
          <>
            <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-accent">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-center text-xl font-extrabold">{t('forgot.verifyTitle')}</h1>
            <p className="text-center text-sm text-muted-foreground">
              {t('forgot.otpSentTo')}
              <br />
              <span className="font-bold text-foreground">{identifier || 'your contact'}</span>
            </p>

            <div className="w-full">
              <OtpField value={otp} onChange={(v) => { setOtp(v); if (error.message || error.fieldErrors.code) setError(NO_ERROR); }} error={!!error.fieldErrors.code} disabled={busy} onComplete={verifyOtp} />
            </div>

            <div className="flex flex-wrap items-center justify-center text-sm">
              <span className="text-muted-foreground">{t('forgot.didntReceive')} </span>
              {countdown > 0 ? (
                <span className="ml-1 font-bold text-muted-foreground">{t('forgot.resendIn')} {formatCountdown(countdown)}</span>
              ) : (
                <button type="button" onClick={resend} disabled={resending} className="ml-1 font-bold text-primary">{resending ? '…' : t('forgot.resend')}</button>
              )}
            </div>

            <FormBanner message={error.message} />
            {resent ? <FormBanner message={t('forgot.newCodeSent')} tone="success" /> : null}
            <PrimaryButton label={t('forgot.verifyOtp')} loading={busy} onClick={verifyOtp} />
          </>
        ) : (
          <>
            <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-accent">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-center text-xl font-extrabold">{t('forgot.resetTitle')}</h1>
            <p className="text-center text-sm text-muted-foreground">{t('forgot.resetSubtitle')}</p>

            <div className="w-full">
              <PasswordField
                value={newPassword}
                onChange={(v) => { setNewPassword(v); if (error.fieldErrors.newPassword) setError(NO_ERROR); }}
                {...(error.fieldErrors.newPassword && error.fieldErrors.newPassword.trim() ? { error: error.fieldErrors.newPassword } : {})}
                disabled={busy}
                placeholder={t('forgot.newPassword')}
              />
            </div>

            <div className="w-full space-y-1.5 pl-1">
              {ruleState.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  {r.ok ? <Check className="h-4 w-4 text-primary" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                  <span className={cn('text-sm', r.ok ? 'text-foreground' : 'text-muted-foreground')}>{t(`forgot.${r.key}`)}</span>
                </div>
              ))}
            </div>

            <div className="w-full">
              <PasswordField
                value={confirm}
                onChange={(v) => { setConfirm(v); if (error.fieldErrors.confirm) setError(NO_ERROR); }}
                {...(error.fieldErrors.confirm && error.fieldErrors.confirm.trim() ? { error: error.fieldErrors.confirm } : {})}
                disabled={busy}
                placeholder={t('forgot.confirmPassword')}
                onEnter={resetPassword}
              />
            </div>

            <FormBanner message={error.message} />
            <PrimaryButton label={t('forgot.resetPassword')} loading={busy} onClick={resetPassword} />
          </>
        )}
      </div>
    </div>
  );
}
