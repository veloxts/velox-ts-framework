import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/database/seed.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  // Skip type checking during build - use type-check script separately
  dts: false,
  // Keep external dependencies from being bundled
  external: [
    '@veloxts/core',
    '@veloxts/router',
    '@veloxts/orm',
    '@veloxts/client',
    '@veloxts/validation',
    '@trpc/server',
    '@prisma/client',
    '@prisma/adapter-better-sqlite3',
    '@fastify/static',
    'fastify',
    'zod',
    'dotenv',
    'node:path',
  ],
});
