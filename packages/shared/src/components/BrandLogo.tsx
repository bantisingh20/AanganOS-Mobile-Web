import { useTranslation } from 'react-i18next';
import { cn } from '@shared/lib/utils';
import logoUrl from '@shared/assets/logo.png';

type LogoSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<LogoSize, string> = {
  sm: 'h-16 w-16 sm:h-[72px] sm:w-[72px]',
  md: 'h-20 w-20 sm:h-24 sm:w-24',
  lg: 'h-24 w-24 sm:h-28 sm:w-28',
};

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <img src={logoUrl} alt="AanganOS" className={cn('rounded-3xl object-contain', SIZE_CLASS[size])} />
      {showWordmark ? (
        <div className="text-center">
          <div className="text-2xl font-extrabold leading-none sm:text-3xl">
            <span className="text-[#0b261d]">Aangan</span>
            <span className="text-primary">OS</span>
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{t('common.tagline')}</div>
        </div>
      ) : null}
    </div>
  );
}
