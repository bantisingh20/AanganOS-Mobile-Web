import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, Users, Settings, Leaf, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { AuthLayout, useLoginForm } from '@shared/features/auth';
import { BrandLogo } from '@shared/components/layout/BrandLogo';
import { PhoneField } from '@shared/components/form/PhoneField';
import { PasswordField } from '@shared/components/form/PasswordField';
import { FormBanner } from '@shared/components/form/FormBanner';
import { PrimaryButton } from '@shared/components/form/PrimaryButton';
import { registerPushDevice } from '@app/lib/push';
import { getSavedCredentials, saveCredential, removeCredential, type SavedCredential } from '@app/lib/savedCredentials';
import { cn } from '@shared/lib/utils';

const FEATURES = [
  { icon: ShieldCheck, key: 'features.secureSociety', tint: '#05b872' },
  { icon: Users, key: 'features.connectedResidents', tint: '#0ea5e9' },
  { icon: Settings, key: 'features.easyManagement', tint: '#8250df' },
  { icon: Leaf, key: 'features.greenerLiving', tint: '#16a34a' },
] as const;

export function LoginScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [saved, setSaved] = useState<SavedCredential[]>(() => getSavedCredentials());
  const [remember, setRemember] = useState(true);
  const { identifier, setIdentifier, password, setPassword, submitting, error, submit } = useLoginForm({
    onSuccess: (result, creds) => {
      if (remember) {
        saveCredential({ identifier: creds.identifier, secret: creds.password, ...(result.user?.name ? { name: result.user.name } : {}) });
      } else {
        removeCredential(creds.identifier);
      }
      void registerPushDevice();
      navigate('/home');
    },
  });

  const pick = (c: SavedCredential) => {
    setIdentifier(c.identifier);
    setPassword(c.secret);
    setRemember(true);
  };

  const forget = (id: string) => {
    removeCredential(id);
    setSaved(getSavedCredentials());
  };

  return (
    <AuthLayout>
      <div className="lg:hidden">
        <BrandLogo size="md" />
      </div>

      <Card className="flex flex-col gap-3 rounded-3xl p-6 md:border-0 md:shadow-none">
          <h1 className="text-2xl font-extrabold">{t('common.welcomeBack')} 👋</h1>
          <p className="-mt-1 text-sm text-muted-foreground">{t('common.signInSubtitle')}</p>

          <FormBanner message={error.message} />

          {saved.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-2">
              <span className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('common.savedAccounts')}</span>
              {saved.map((c) => (
                <div key={c.identifier} className="flex items-center gap-2 rounded-xl bg-card p-2 shadow-sm">
                  <button type="button" onClick={() => pick(c)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0">
                      {c.name ? <span className="block truncate text-sm font-bold">{c.name}</span> : null}
                      <span className="block truncate text-xs text-muted-foreground">{c.identifier}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => forget(c.identifier)} aria-label={t('common.forget')} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <PhoneField
            label={t('common.mobileNumber')}
            value={identifier}
            onChange={setIdentifier}
            {...(error.fieldErrors.identifier ? { error: error.fieldErrors.identifier } : {})}
            disabled={submitting}
            placeholder={t('common.mobileNumber')}
          />
          <PasswordField
            label={t('common.password')}
            value={password}
            onChange={setPassword}
            {...(error.fieldErrors.password ? { error: error.fieldErrors.password } : {})}
            disabled={submitting}
            placeholder={t('common.password')}
            onEnter={submit}
          />

          <div className="-mt-1 flex items-center justify-between">
            <button type="button" onClick={() => setRemember((v) => !v)} className="flex items-center gap-2">
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-md border-[1.5px]', remember ? 'border-primary bg-primary' : 'border-input')}>
                {remember ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
              </span>
              <span className="text-sm font-semibold">{t('common.rememberMe')}</span>
            </button>
            <button type="button" onClick={() => navigate('/forgot')} className="text-sm font-semibold text-primary">
              {t('common.forgotPassword')}
            </button>
          </div>

          <PrimaryButton label={t('common.login')} loading={submitting} onClick={submit} />

          <div className="mt-1 flex items-center justify-center gap-1 text-sm">
            <span className="text-muted-foreground">{t('common.newHere')}</span>
            <button type="button" onClick={() => navigate('/register')} className="font-semibold text-primary">
              {t('common.createAccountShort')}
            </button>
          </div>
          <div className="flex items-center justify-center gap-1 text-sm">
            <span className="text-muted-foreground">{t('common.societyNotRegistered')}</span>
            <button type="button" onClick={() => navigate('/register-society')} className="font-semibold text-primary">
              {t('common.registerYourSociety')}
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-2 px-1 lg:hidden">
          {FEATURES.map((f) => (
            <div key={f.key} className="flex flex-col items-center gap-1.5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${f.tint}1f` }}>
                <f.icon className="h-5 w-5" style={{ color: f.tint }} />
              </span>
              <span className="text-[11px] font-semibold leading-tight">{t(f.key)}</span>
            </div>
          ))}
        </div>
    </AuthLayout>
  );
}
