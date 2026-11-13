import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { resolveViteBase } from './src/lib/basePath';

// Base path for assets and import.meta.env.BASE_URL (keychain redirects).
// VITE_BASE_PATH wins if set (e.g. actions/configure-pages base_path).
// Otherwise GITHUB_PAGES=1 — which the current Pages workflow already sets —
// uses /kamui-demo/ for the public project site. Local dev and CI stay at /.
export default defineConfig({
  base: resolveViteBase(process.env.VITE_BASE_PATH, process.env.GITHUB_PAGES),
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
