import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared-types': path.resolve(__dirname, 'libs/shared-types/src/index.ts'),
      '@study-forge/backend-core': path.resolve(__dirname, 'libs/backend/core/src'),
      '@study-forge/backend-directories': path.resolve(
        __dirname,
        'libs/backend/directories/src'
      ),
      '@study-forge/backend-documents': path.resolve(
        __dirname,
        'libs/backend/documents/src'
      ),
      '@study-forge/backend-generation': path.resolve(
        __dirname,
        'libs/backend/generation/src'
      ),
      '@study-forge/backend-artifacts': path.resolve(
        __dirname,
        'libs/backend/artifacts/src'
      ),
      '@study-forge/backend-agent': path.resolve(__dirname, 'libs/backend/agent/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['libs/backend/**/*.spec.ts'],
  },
});
