import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

/** Minimal Vite config for Storybook — not the library build config. */
export default defineConfig({
  plugins: [react(), nxViteTsPaths()],
});
