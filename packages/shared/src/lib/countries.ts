export interface CountryInfo {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  length: number;
  pattern?: RegExp;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳', length: 10, pattern: /^[6-9]\d{9}$/ },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', length: 10 },
  { code: 'CA', dialCode: '+1', name: 'Canada', flag: '🇨🇦', length: 10 },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', length: 10 },
  { code: 'AE', dialCode: '+971', name: 'UAE', flag: '🇦🇪', length: 9 },
  { code: 'SG', dialCode: '+65', name: 'Singapore', flag: '🇸🇬', length: 8 },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺', length: 9 },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', length: 10 },
];

export const DEFAULT_COUNTRY = 'IN';

export function countryByCode(code: string): CountryInfo {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
}

export function countryFromValue(value: string, fallback = DEFAULT_COUNTRY): CountryInfo {
  if (value) {
    const match = [...COUNTRIES]
      .sort((a, b) => b.dialCode.length - a.dialCode.length)
      .find((c) => value.startsWith(c.dialCode));
    if (match) return match;
  }
  return countryByCode(fallback);
}

export function nationalDigits(value: string, country: CountryInfo): string {
  if (!value) return '';
  if (value.startsWith(country.dialCode)) return value.slice(country.dialCode.length).replace(/\D/g, '');
  return value.replace(/^\+\d{1,4}/, '').replace(/\D/g, '');
}

function isInvalidSeriesOrDummy(numOnly: string): boolean {
  if (!numOnly || numOnly.length < 5) return false;
  if (/^(\d)\1+$/.test(numOnly)) return true;
  if ('0123456789012345'.includes(numOnly) || '9876543210987654'.includes(numOnly)) return true;
  if (/^(\d{2})\1+$/.test(numOnly)) return true;
  if (/^(\d{3})\1+$/.test(numOnly)) return true;
  return false;
}

export function validatePhoneNumber(fullValue: string | undefined, countryCode = DEFAULT_COUNTRY, checkSeries = true): string | null {
  if (!fullValue || !fullValue.trim()) return 'Phone number is required';
  const country = countryByCode(countryCode);
  const digits = nationalDigits(fullValue.trim(), country);

  if (digits.length !== country.length) {
    return `Phone number must be ${country.length} digits for ${country.name}`;
  }
  if (checkSeries) {
    if (country.pattern && !country.pattern.test(digits)) {
      return `Invalid mobile number format for ${country.name}`;
    }
    if (isInvalidSeriesOrDummy(digits)) {
      return 'Sequential or dummy numbers are not allowed';
    }
  }
  return null;
}
