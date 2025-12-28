import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'src/__tests__/**',
        'src/__integration__/**',
        'src/index.ts',
        // Schema manager requires real PostgreSQL connections - tested in integration tests
        'src/tenant/schema/manager.ts',
        // Type-only files
        'src/tenant/index.ts',
        'src/tenant/types.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
