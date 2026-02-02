import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VeloxTS create-velox-app E2E tests.
 *
 * These tests scaffold real projects and validate frontend behavior
 * using Playwright's browser automation.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.ts',

  // Sequential execution to avoid port conflicts
  // Each test file scaffolds its own project on a unique port
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  // Shared settings for all projects
  use: {
    // Base URL will be set per-test based on dynamic port
    // baseURL: 'http://localhost:3030',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Increase timeout for scaffold operations
    actionTimeout: 10000,
  },

  // Increase test timeout for scaffold + server startup
  timeout: 120000, // 2 minutes per test

  // Global setup/teardown
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  // Configure projects for different browsers (Chromium only for speed)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',
});
