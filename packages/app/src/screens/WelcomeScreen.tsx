import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Settings, Leaf, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { BrandLogo } from '@shared/components/BrandLogo';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';

const HERO = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=70';

const FEATURES = [
  { icon: ShieldCheck, key: 'features.secureSociety', tint: '#05b872' },
  { icon: Users, key: 'features.connectedResidents', tint: '#0ea5e9' },
  { icon: Settings, key: 'features.easyManagement', tint: '#8250df' },
  { icon: Leaf, key: 'features.greenerLiving', tint: '#16a34a' },
] as const;

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const actions = (
    <>
      <Button onClick={() => navigate('/login')} className="relative h-[52px] rounded-xl text-base font-bold">
        {t('common.login')}
        <span className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <ArrowRight className="h-[18px] w-[18px]" />
        </span>
      </Button>
      <Button variant="outline" onClick={() => navigate('/register')} className="h-[52px] rounded-xl border-2 border-primary text-base font-bold text-primary">
        {t('common.createAccount')}
      </Button>
      <p className="mt-1 text-center text-xs text-muted-foreground">{t('common.manageConnectLiveBetter')}</p>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-card lg:flex-row">
      <div className="relative h-[34vh] min-h-[220px] w-full shrink-0 lg:h-auto lg:min-h-[100dvh] lg:w-[52%]">
        <img src={HERO} alt="Community" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent lg:bg-gradient-to-t lg:from-[#0b261d]/70 lg:via-transparent lg:to-transparent" />
        <div className="safe-top absolute right-0 top-0 p-4">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="safe-bottom relative z-10 -mt-8 flex flex-1 flex-col gap-6 rounded-t-[28px] bg-card px-5 pb-6 pt-6 lg:mx-auto lg:mt-0 lg:min-h-[100dvh] lg:max-w-md lg:justify-center lg:gap-8 lg:rounded-none lg:px-10 lg:pb-10">
        <BrandLogo size="lg" className="lg:items-start" />

        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {FEATURES.map((f) => (
            <div key={f.key} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${f.tint}14` }}>
                <f.icon className="h-5 w-5" style={{ color: f.tint }} />
              </div>
              <span className="text-sm font-semibold leading-tight">{t(f.key)}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 lg:mt-0">
          {actions}
        </div>
      </div>
    </div>
  );
}
