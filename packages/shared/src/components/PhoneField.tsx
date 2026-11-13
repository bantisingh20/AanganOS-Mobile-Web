import { useMemo, useState } from 'react';
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

  const h = size === 'lg' ? 'h-12' : 'h-9';

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
      </div>
    </Field>
  );
}
