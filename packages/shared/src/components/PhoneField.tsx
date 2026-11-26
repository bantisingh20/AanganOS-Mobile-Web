import { useMemo, useState } from 'react';
import { Contact2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Input } from '@shared/components/ui/input';
import { cn } from '@shared/lib/utils';
import { Field } from './Field';

export interface Country {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  length: number;
}

export const COUNTRIES: Country[] = [
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳', length: 10 },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', length: 10 },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', length: 10 },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', length: 10 },
  { code: 'AE', dialCode: '+971', name: 'UAE', flag: '🇦🇪', length: 9 },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬', length: 8 },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺', length: 9 },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', length: 10 },
];

export interface PhoneFieldProps {
  value?: string;
  onChange: (fullNumber: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  defaultCountry?: string;
  size?: 'sm' | 'lg';
  enableContactPicker?: boolean;
  onContactPicked?: (contact: { name?: string; phone: string }) => void;
}

export function PhoneField({
  value = '',
  onChange,
  label,
  error,
  placeholder,
  disabled,
  onEnter,
  defaultCountry = 'IN',
  size = 'sm',
  enableContactPicker = false,
  onContactPicked,
}: PhoneFieldProps) {
  const [countryCode, setCountryCode] = useState<string>(() => {
    const matched = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length).find((c) => value.startsWith(c.dialCode));
    return matched ? matched.code : defaultCountry;
  });

  const country = useMemo(() => COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0], [countryCode]);

  const rawNumber = useMemo(() => {
    if (!value) return '';
    if (value.startsWith(country.dialCode)) return value.slice(country.dialCode.length);
    return value.replace(/^\+\d{1,4}/, '');
  }, [value, country.dialCode]);

  const onCountry = (code: string) => {
    setCountryCode(code);
    const next = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
    onChange(rawNumber ? `${next.dialCode}${rawNumber}` : '');
  };

  const onNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, country.length);
    onChange(digits ? `${country.dialCode}${digits}` : '');
  };

  const handlePickContact = async () => {
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      try {
        const results = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false });
        if (results && results.length > 0) {
          const c = results[0];
          const rawPhone = Array.isArray(c.tel) ? c.tel[0] : c.tel;
          const rawName = Array.isArray(c.name) ? c.name[0] : c.name;
          if (rawPhone) {
            const cleaned = String(rawPhone).replace(/[^\d+]/g, '');
            const matched = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length).find((co) => cleaned.startsWith(co.dialCode));
            let full = '';
            if (matched) {
              setCountryCode(matched.code);
              const digits = cleaned.slice(matched.dialCode.length).replace(/\D/g, '').slice(0, matched.length);
              full = `${matched.dialCode}${digits}`;
            } else {
              const digits = cleaned.replace(/\D/g, '').slice(-country.length);
              full = `${country.dialCode}${digits}`;
            }
            onChange(full);
            onContactPicked?.({ name: rawName, phone: full });
          }
        }
      } catch (err: any) {
        if (err?.name === 'SecurityError' || err?.name === 'NotAllowedError') {
          toast.error('Contact permission denied. Please allow contacts access in browser/device settings.');
        }
      }
    } else {
      toast.info('Contact picker is available on mobile devices (Chrome on Android).');
    }
  };

  const h = size === 'lg' ? 'h-12' : 'h-10';

  return (
    <Field {...(label !== undefined ? { label } : {})} {...(error ? { error } : {})}>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={onCountry} disabled={disabled}>
          <SelectTrigger className={cn(h, 'w-[104px] shrink-0', size === 'lg' ? 'text-base' : 'text-sm')}>
            <SelectValue>
              <span className="flex items-center gap-1">
                <span>{country.flag}</span>
                <span className="font-medium">{country.dialCode}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code} className="text-sm">
                <span className="flex items-center gap-2">
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.dialCode}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={rawNumber}
          onChange={onNumber}
          disabled={disabled}
          inputMode="numeric"
          maxLength={country.length}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
          className={cn(h, 'flex-1', size === 'lg' ? 'text-base' : 'text-sm', error ? 'border-destructive' : '')}
        />
        {enableContactPicker || onContactPicked ? (
          <button
            type="button"
            disabled={disabled}
            onClick={handlePickContact}
            title="Pick from contacts"
            aria-label="Pick from contacts"
            className={cn(
              h,
              'flex items-center justify-center rounded-xl border border-input bg-card px-3 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 shrink-0 shadow-xs'
            )}
          >
            <Contact2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </Field>
  );
}
