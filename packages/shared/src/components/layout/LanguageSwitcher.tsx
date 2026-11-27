import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@shared/components/ui/select';
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from '@shared/i18n';
import { cn } from '@shared/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const active = (i18n.language as LanguageCode) || 'en';
  const activeNative = SUPPORTED_LANGUAGES.find((l) => l.code === active)?.native ?? 'English';

  return (
    <Select value={active} onValueChange={(v) => setLanguage(v as LanguageCode)}>
      <SelectTrigger className={cn('h-8 w-auto gap-1.5 rounded-[4px] border-border/80 bg-card px-2 text-xs font-medium shadow-xs', className)}>
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span>{activeNative}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code} className="text-xs">
            {l.native}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
