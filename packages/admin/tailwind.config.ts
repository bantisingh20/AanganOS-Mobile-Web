import type { Config } from 'tailwindcss';
import { aanganosPreset } from '@aanganos/shared/tailwind-preset';

export default {
  presets: [aanganosPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
