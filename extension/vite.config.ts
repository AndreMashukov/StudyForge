import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import manifest from './manifest.config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../node_modules/.vite/extension',
  plugins: [react(), nxViteTsPaths(), crx({ manifest })],
  build: {
    outDir: '../dist/extension',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
});