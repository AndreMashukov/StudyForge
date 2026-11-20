import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@shared-types',
        replacement: fileURLToPath(
          new URL('../libs/shared-types/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@studyforge\/client-data\/(.*)$/,
        replacement: fileURLToPath(
          new URL('../libs/client-data/src/$1', import.meta.url),
        ),
      },
      {
        find: /^@studyforge\/client-data$/,
        replacement: fileURLToPath(
          new URL('../libs/client-data/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'src/pages/HomePage/**/*.spec.ts',
      'src/services/dashboardArtifacts.spec.ts',
      'src/services/statistics*.spec.ts',
      'src/services/usageFirestore.spec.ts',
      'src/store/api/Statistics/*.spec.ts',
      'src/pages/InteractionStatsPage/InteractionStatsPageContainer/DirectoryShareChart/*.spec.ts',
      'src/pages/SlideDeckPage/**/*.spec.ts',
      'src/utils/slideDeckImageExport.spec.ts',
      'src/utils/ruleApplicabilityUtils.spec.ts',
    ],
  },
});
