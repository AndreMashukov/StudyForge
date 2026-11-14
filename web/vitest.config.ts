import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared-types': fileURLToPath(
        new URL('../libs/shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/pages/HomePage/**/*.spec.ts',
      'src/services/dashboardArtifacts.spec.ts',
      'src/services/statistics*.spec.ts',
      'src/store/api/Statistics/*.spec.ts',
      'src/pages/InteractionStatsPage/InteractionStatsPageContainer/DirectoryShareChart/*.spec.ts',
    ],
  },
});
