import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages is served at /kamui-demo/ when hosted as a project site.
// Local dev and `vite preview` use "/". CI sets GITHUB_PAGES=1 for the Pages build.
const pages = process.env.GITHUB_PAGES === '1';

export default defineConfig({
  base: pages ? '/kamui-demo/' : '/',
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
