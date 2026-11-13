import { useTranslation } from 'react-i18next';
import { Card } from '@shared/components/ui/card';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="flex max-w-sm flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Construction className="h-7 w-7" />
        </span>
        <h1 className="text-lg font-bold">{t(titleKey)}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.comingSoon')}</p>
      </Card>
    </div>
  );
}
