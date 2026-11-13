import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { hi } from './hi';
import { gu } from './gu';
import { mr } from './mr';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const LANGUAGE_KEY = 'aanganos.language';

export function initI18n(): typeof i18n {
  if (!i18n.isInitialized) {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(LANGUAGE_KEY)) || 'en';
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        hi: { translation: hi },
        gu: { translation: gu },
        mr: { translation: mr },
      },
      lng: stored,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}

export function setLanguage(code: LanguageCode): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, code);
  void i18n.changeLanguage(code);
}

export function currentLanguage(): LanguageCode {
  return (i18n.language as LanguageCode) || 'en';
}

export type { Translation } from './en';
