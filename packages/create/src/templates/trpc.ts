/**
 * tRPC Template (Full-Stack)
 *
 * Full-stack workspace template with:
 * - apps/api: tRPC-only API with user CRUD operations
 * - apps/web: React frontend with TanStack Router
 *
 * Showcases VeloxTS's type-safe frontend-backend communication:
 * - tRPC endpoints only (no REST)
 * - End-to-end type safety without code generation
 * - Frontend imports types directly from router.ts
 *
 * For REST + tRPC hybrid, use --default template and add registerRpc().
 */

import { compileTemplate } from './compiler.js';
import { applyDatabaseDependencies, DEFAULT_CONFIG, TRPC_CONFIG } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Shorthand: compile a static API template (no user-specific config needed) */
function api(sourcePath: string): string {
  return compileTemplate(sourcePath, DEFAULT_CONFIG);
}

/** Shorthand: compile a tRPC-specific template */
function trpc(sourcePath: string): string {
  return compileTemplate(sourcePath, TRPC_CONFIG);
}

/** Compile API package.json with tRPC deps and swap database dependencies */
function generateApiPackageJson(config: TemplateConfig): string {
  const content = compileTemplate('api/package.trpc.json', config);
  return applyDatabaseDependencies(content, config);
}

// ============================================================================
// tRPC Template Generator
// ============================================================================

export function generateTrpcTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson(config) },
    { path: 'apps/api/tsconfig.json', content: api('api/tsconfig.json') },
    { path: 'apps/api/tsup.config.ts', content: api('api/tsup.config.ts') },
    { path: 'apps/api/prisma.config.ts', content: api('api/prisma.config.ts') },
    { path: 'apps/api/.env.example', content: compileTemplate('api/env.trpc', config) },
    { path: 'apps/api/.env', content: compileTemplate('api/env.trpc', config) },

    // Prisma (reuses default schema - same data model)
    {
      path: 'apps/api/prisma/schema.prisma',
      content: compileTemplate('api/prisma/schema.default.prisma', config),
    },

    // API Source files
    { path: 'apps/api/src/router.ts', content: trpc('api/router.trpc.ts') },
    { path: 'apps/api/src/index.ts', content: trpc('api/index.trpc.ts') },
    { path: 'apps/api/src/config/app.ts', content: compileTemplate('api/config/app.ts', config) },
    {
      path: 'apps/api/src/config/database.ts',
      content: compileTemplate('api/config/database.ts', config),
    },
    { path: 'apps/api/src/procedures/health.ts', content: api('api/procedures/health.ts') },
    { path: 'apps/api/src/procedures/users.ts', content: api('api/procedures/users.default.ts') },
    { path: 'apps/api/src/schemas/user.ts', content: api('api/schemas/user.ts') },
    { path: 'apps/api/src/schemas/health.ts', content: api('api/schemas/health.ts') },
    { path: 'apps/api/src/types.ts', content: api('api/types.default.ts') },
  ];

  // Add docker-compose for PostgreSQL
  if (config.database === 'postgresql') {
    files.push({
      path: 'apps/api/docker-compose.yml',
      content: compileTemplate('api/docker-compose.yml', config),
    });
  }

  // Add root workspace files (use 'trpc' variant for tRPC-specific CLAUDE.md)
  const rootFiles = generateRootFiles(config, 'trpc');

  // Add web package files
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
