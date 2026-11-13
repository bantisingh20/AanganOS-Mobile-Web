import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@shared/components/ui/select';
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from '@shared/i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const active = (i18n.language as LanguageCode) || 'en';
  const activeNative = SUPPORTED_LANGUAGES.find((l) => l.code === active)?.native ?? 'English';

  return (
    <Select value={active} onValueChange={(v) => setLanguage(v as LanguageCode)}>
      <SelectTrigger className="h-9 w-auto gap-1.5 rounded-full border-border bg-card px-3 text-sm font-semibold shadow-sm">
        <Globe className="h-4 w-4 text-primary" />
        <span>{activeNative}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.native}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
