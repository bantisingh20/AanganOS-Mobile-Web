import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@app/components/AuthLayout';
import { BrandLogo } from '@shared/components/BrandLogo';
import { RegisterSociety } from '@shared/components/RegisterSociety';
import { PrimaryButton } from '@shared/components/PrimaryButton';

export function RegisterSocietyScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (successMsg !== null) {
    return (
      <AuthLayout showLanguage={false} contentClassName="max-w-md justify-center gap-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </span>
          <h1 className="text-xl font-extrabold">{t('society.successTitle')}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{successMsg || t('society.successBody')}</p>
          <PrimaryButton label={t('society.goToLogin')} arrow={false} onClick={() => navigate('/login')} />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showLanguage={false} contentClassName="max-w-2xl justify-start gap-3 pt-3">
      <div className="flex items-center">
        <button type="button" onClick={() => navigate('/login')} className="flex h-10 w-10 items-center justify-center" aria-label="Back">
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="lg:hidden">
        <BrandLogo size="sm" />
      </div>
      <h1 className="text-center text-xl font-extrabold">{t('society.title')}</h1>
      <p className="text-center text-sm leading-relaxed text-muted-foreground">{t('society.subtitle')}</p>

      <RegisterSociety onSuccess={(msg) => setSuccessMsg(msg || t('society.successBody'))} />

      <div className="mt-1 flex items-center justify-center gap-1.5 px-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        {t('society.secureNote')}
      </div>
    </AuthLayout>
  );
}
