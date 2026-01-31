import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Exclude integration tests that require Docker - run with test:integration
    exclude: ['src/__tests__/integration.test.ts', 'node_modules'],
  },
});
