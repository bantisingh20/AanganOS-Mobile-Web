import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sharedSrc = path.resolve(__dirname, '../shared/src');

export default defineConfig({
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
});
