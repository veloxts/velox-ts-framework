/**
 * SPA Template
 *
 * Monorepo workspace with separate SPA frontend and API backend:
 * - apps/api: REST API with Fastify and user CRUD operations
 * - apps/web: React SPA with Vite and TanStack Router
 *
 * No authentication - suitable for internal APIs or as a starting point.
 */

import { compileTemplate } from './compiler.js';
import { applyDatabaseDependencies, DEFAULT_CONFIG } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Shorthand: compile a static API template (no user-specific config needed) */
function api(sourcePath: string): string {
  return compileTemplate(sourcePath, DEFAULT_CONFIG);
}

/** Compile API package.json and swap database dependencies based on config */
function generateApiPackageJson(config: TemplateConfig): string {
  const content = compileTemplate('api/package.default.json', config);
  return applyDatabaseDependencies(content, config);
}

// ============================================================================
// SPA Template Generator
// ============================================================================

export function generateSpaTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson(config) },
    { path: 'apps/api/tsconfig.json', content: api('api/tsconfig.json') },
    { path: 'apps/api/tsup.config.ts', content: api('api/tsup.config.ts') },
    { path: 'apps/api/prisma.config.ts', content: api('api/prisma.config.ts') },
    { path: 'apps/api/.env.example', content: compileTemplate('api/env.default', config) },
    { path: 'apps/api/.env', content: compileTemplate('api/env.default', config) },

    // Prisma
    {
      path: 'apps/api/prisma/schema.prisma',
      content: compileTemplate('api/prisma/schema.default.prisma', config),
    },

    // API Source files
    { path: 'apps/api/src/router.ts', content: api('api/router.default.ts') },
    { path: 'apps/api/src/index.ts', content: api('api/index.default.ts') },
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

  // Add root workspace files
  const rootFiles = generateRootFiles(config, false);

  // Add web package files
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
