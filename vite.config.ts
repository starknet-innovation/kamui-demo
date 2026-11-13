import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { resolveViteBase } from './src/lib/basePath';

// Base path for assets and import.meta.env.BASE_URL (keychain redirects).
// Defaults to "/" so private GitHub Pages at the site root, local dev, and CI
// all work. The Pages workflow should pass actions/configure-pages's
// base_path as VITE_BASE_PATH so a future public project site at
// /kamui-demo/ is picked up automatically.
export default defineConfig({
  base: resolveViteBase(process.env.VITE_BASE_PATH),
  plugins: [react()],
  resolve: {
    alias: {
      '@kamui/sdk': fileURLToPath(new URL('./vendor/kamui-sdk/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5175,
    host: 'localhost',
  },
  preview: {
    port: 4173,
    host: 'localhost',
  },
});
