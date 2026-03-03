import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.ts',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
