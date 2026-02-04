import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VeloxTS create-velox-app E2E tests.
 *
 * These tests scaffold real projects and validate frontend behavior
 * using Playwright's browser automation.
 *
 * Each template runs as a separate project so the scaffold fixture
 * is created once per template, not once per test.
 */
export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.ts',

  // Sequential execution to avoid port conflicts between templates
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

  // Configure projects for each template
  // Each project runs tests from a specific spec file
  projects: [
    {
      name: 'spa',
      testMatch: 'spa.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Pass template to fixture via project metadata
        template: 'spa',
      },
    },
    {
      name: 'auth',
      testMatch: 'auth.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        template: 'auth',
      },
    },
    {
      name: 'trpc',
      testMatch: 'trpc.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        template: 'trpc',
      },
    },
    {
      name: 'rsc',
      testMatch: 'rsc.spec.ts',
      timeout: 180000, // 3 minutes - Vinxi takes longer to start
      use: {
        ...devices['Desktop Chrome'],
        template: 'rsc',
      },
    },
    {
      name: 'rsc-auth',
      testMatch: 'rsc-auth.spec.ts',
      timeout: 180000, // 3 minutes - Vinxi takes longer to start
      use: {
        ...devices['Desktop Chrome'],
        template: 'rsc-auth',
      },
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',
});

// Extend Playwright's test options to include our custom template option
declare module '@playwright/test' {
  interface TestOptions {
    template: string;
  }
}
