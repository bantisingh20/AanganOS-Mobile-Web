import type { ReactNode } from 'react';
import { ShieldCheck, Users, Settings, Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@shared/lib/utils';
import logoUrl from '@shared/assets/logo.png';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';

const BRAND_POINTS = [
  { icon: ShieldCheck, key: 'features.secureSociety' },
  { icon: Users, key: 'features.connectedResidents' },
  { icon: Settings, key: 'features.easyManagement' },
  { icon: Leaf, key: 'features.greenerLiving' },
] as const;

export function AuthLayout({
  children,
  showBrandAside = true,
  showLanguage = true,
  contentClassName,
}: {
  children: ReactNode;
  showBrandAside?: boolean;
  showLanguage?: boolean;
  contentClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {showBrandAside ? (
        <aside className="relative hidden w-[42%] max-w-[560px] shrink-0 flex-col justify-between overflow-hidden bg-[#0b261d] p-10 text-white lg:flex">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-primary/10" />
          <div className="relative flex items-center gap-3">
            <img src={logoUrl} alt="AanganOS" className="h-12 w-12 rounded-2xl object-contain" />
            <div className="text-2xl font-extrabold"><span>Aangan</span><span className="text-primary">OS</span></div>
          </div>
          <div className="relative space-y-6">
            <h2 className="text-3xl font-extrabold leading-tight">{t('common.tagline')}</h2>
            <ul className="space-y-4">
              {BRAND_POINTS.map((p) => (
                <li key={p.key} className="flex items-center gap-3 text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <p.icon className="h-5 w-5 text-primary" />
                  </span>
                  {t(p.key)}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative text-sm text-white/60">{t('common.manageConnectLiveBetter')}</div>
        </aside>
      ) : null}

      <main className="relative flex min-h-[100dvh] min-w-0 flex-1 flex-col">
        {showLanguage ? (
          <div className="flex justify-end p-4">
            <LanguageSwitcher />
          </div>
        ) : null}
        <div className={cn('mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pb-8 sm:px-6', contentClassName)}>
          {children}
        </div>
      </main>
    </div>
  );
}
