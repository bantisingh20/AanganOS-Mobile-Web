import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import logoUrl from '@shared/assets/logo.png';
import { LanguageSwitcher } from '@shared/components/layout/LanguageSwitcher';
import { PhoneField } from '@shared/components/form/PhoneField';
import { PasswordField } from '@shared/components/form/PasswordField';
import { PrimaryButton } from '@shared/components/form/PrimaryButton';
import { useForceLight } from '@shared/lib/hooks/useForceLight';
import { useLoginForm } from '@shared/features/auth';

export function LoginPage() {
  const { t } = useTranslation();
  useForceLight();

  return (
    <div className="force-light flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-slate-100 via-emerald-50/20 to-teal-100/20 text-slate-800 antialiased">
      <aside className="relative hidden w-2/5 max-w-md shrink-0 select-none flex-col justify-between overflow-hidden border-r border-emerald-200/70 bg-gradient-to-br from-emerald-100/80 via-teal-50/70 to-emerald-200/50 p-6 lg:flex lg:p-8 xl:max-w-lg xl:p-10">
        <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl" />

        <div className="relative z-10 flex items-center gap-2.5">
          <img src={logoUrl} alt="AanganOS" className="h-10 w-10 rounded-xl object-cover shadow-sm shadow-emerald-600/30 xl:h-11 xl:w-11" />
          <div>
            <span className="text-base font-bold tracking-tight xl:text-lg">
              <span className="text-slate-800">Aangan</span>
              <span className="text-emerald-600">OS</span>
            </span>
            <span className="block text-[9px] font-medium uppercase tracking-wider text-emerald-800 xl:text-[9.5px]">
              Society ERP System
            </span>
          </div>
        </div>

        <div className="relative z-10 my-auto space-y-3 xl:space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-medium text-white shadow xl:text-[10.5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live Operations
          </div>

          <h2 className="m-0 text-base font-medium leading-snug tracking-tight text-slate-800 sm:text-lg lg:text-xl xl:text-2xl">
            The modern operating system for{' '}
            <span className="font-serif italic text-emerald-700">residential communities.</span>
          </h2>

          <p className="m-0 max-w-sm text-[11px] leading-relaxed text-slate-600 xl:text-xs">
            Streamline gatekeeper logs, verify resident KYC applications, and coordinate tower
            maintenance in one cohesive suite.
          </p>

          <div className="space-y-2 pt-0.5 xl:space-y-2.5">
            <FeatureCard icon={Building2} tint="emerald" title="Multi-Community & Towers" sub="Real-time wing, block, and occupancy overview." />
            <FeatureCard icon={Users} tint="blue" title="Resident Verification Queue" sub="Instant lease approvals for owners & tenants." />
            <FeatureCard icon={ShieldCheck} tint="teal" title="Gatekeeper Security Sync" sub="Visitor passes, deliveries, and vehicle tracking." />
          </div>

          <div className="flex items-center gap-3 pt-0.5 text-[10px] font-medium text-slate-600 xl:text-[10.5px]">
            <Stat dot="bg-emerald-500" label="12 Societies" />
            <Stat dot="bg-blue-500" label="1,480+ Flats" />
            <Stat dot="bg-teal-500" label="99.9% Uptime" />
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-emerald-200/70 pt-2.5 text-[10px] font-medium text-slate-500 xl:text-[10.5px]">
          <span>AanganOS v0.1.0</span>
          <span>© {new Date().getFullYear()} AanganOS</span>
        </div>
      </aside>

      <div className="relative flex h-full flex-1 flex-col overflow-y-auto bg-slate-50/50">
        <div className="flex min-h-full flex-1 flex-col justify-between p-3 sm:p-5 lg:p-6 xl:p-8">
          <div className="z-20 flex w-full shrink-0 items-center justify-between">
            <div className="flex items-center gap-2 lg:hidden">
              <img src={logoUrl} alt="AanganOS" className="h-7 w-7 rounded-lg object-cover" />
              <span className="text-xs font-semibold text-slate-800 sm:text-sm">AanganOS</span>
            </div>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="z-10 mx-auto my-auto w-full max-w-xs py-2 sm:max-w-sm sm:py-3 lg:max-w-md">
            <div className="mb-5 flex flex-col items-center gap-2.5">
              <img
                src={logoUrl}
                alt="AanganOS"
                className="h-16 w-16 rounded-2xl object-cover shadow-md shadow-emerald-600/20 sm:h-20 sm:w-20"
              />
              <div className="text-center leading-none">
                <span className="text-xl font-bold tracking-tight sm:text-2xl">
                  <span className="text-slate-800">Aangan</span>
                  <span className="text-emerald-600">OS</span>
                </span>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-[10px]">
                  Smart Living · Stronger Communities
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-6 lg:p-7">
              <div className="mb-3 text-left sm:mb-4">
                <h1 className="m-0 text-sm font-semibold tracking-tight text-slate-800 sm:text-base lg:text-lg">
                  {t('admin.signInTitle', { defaultValue: 'Sign in to Admin' })}
                </h1>
                <p className="mb-0 mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                  {t('admin.signInSubtitle', { defaultValue: 'Access your society administration dashboard' })}
                </p>
              </div>

              <SignInForm />
            </div>
          </div>

          <div className="z-10 shrink-0 pt-2 text-center text-[10px] text-slate-400">
            Enterprise Community &amp; Estate Management System
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, tint, title, sub }: { icon: typeof Building2; tint: 'emerald' | 'blue' | 'teal'; title: string; sub: string }) {
  const tints = {
    emerald: 'border-emerald-100 hover:border-emerald-300 [&_.tile]:bg-emerald-100 [&_.tile]:text-emerald-700',
    blue: 'border-blue-100 hover:border-blue-300 [&_.tile]:bg-blue-100 [&_.tile]:text-blue-700',
    teal: 'border-teal-100 hover:border-teal-300 [&_.tile]:bg-teal-100 [&_.tile]:text-teal-700',
  }[tint];
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border bg-white/90 p-2 shadow-sm transition-all xl:p-2.5 ${tints}`}>
      <div className="tile flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h4 className="m-0 text-[11.5px] font-semibold text-slate-800">{title}</h4>
        <p className="m-0 text-[10.5px] text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { identifier, setIdentifier, password, setPassword, submitting, error, submit } = useLoginForm({
    onSuccess: () => {
      toast.success(t('admin.signedIn'));
      navigate('/dashboard');
    },
    onError: (view) => { if (view.message) toast.error(view.message); },
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <PhoneField
          size="lg"
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
          placeholder="••••••••"
          onEnter={submit}
        />
        <PrimaryButton label="Sign In to Portal" loading={submitting} onClick={submit} />
        <button
          type="button"
          onClick={() => navigate('/forgot')}
          className="-mt-1 self-end border-none bg-transparent p-0 text-[11px] font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline sm:text-xs"
        >
          {t('common.forgotPassword')}
        </button>
      </div>


      {/* Same shared pages the app uses: /register (resident account) and /register-society. */}
      <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-[11px] sm:text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{t('common.newHere')}</span>
          <button type="button" onClick={() => navigate('/register')}
            className="flex items-center gap-1 border-none bg-transparent p-0 font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline">
            <span>{t('common.createAccountShort')}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">{t('common.societyNotRegistered')}</span>
          <button type="button" onClick={() => navigate('/register-society')}
            className="flex items-center gap-1 border-none bg-transparent p-0 font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline">
            <span>{t('common.registerYourSociety')}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}
