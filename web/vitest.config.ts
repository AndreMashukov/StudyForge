import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/pages/HomePage/**/*.spec.ts',
      'src/services/dashboardArtifacts.spec.ts',
      'src/pages/InteractionStatsPage/InteractionStatsPageContainer/DirectoryShareChart/*.spec.ts',
    ],
  },
});
