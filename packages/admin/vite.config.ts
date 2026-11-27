import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const sharedSrc = path.resolve(__dirname, '../shared/src');

// A production build must know the real API URL; without it the bundle would silently call localhost.
function requireApiUrl(mode: string) {
  if (mode !== 'production') return;
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), 'VITE_');
  if (!env.VITE_API_BASE_URL) throw new Error('VITE_API_BASE_URL is not set for this production build (.env.production).');
  if (env.VITE_API_BASE_URL.startsWith('http://')) throw new Error('VITE_API_BASE_URL must be https:// for production builds.');
}

export default defineConfig(({ mode }) => (requireApiUrl(mode), {
  envDir: path.resolve(__dirname, '../..'),
  
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedSrc,
      '@admin': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    host: true,
  },
}));
