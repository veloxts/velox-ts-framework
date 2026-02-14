/**
 * Auth Template (Full-Stack with Authentication)
 *
 * Full-stack workspace template with:
 * - apps/api: REST API with JWT authentication, guards, rate limiting
 * - apps/web: React frontend with login/register UI
 *
 * Complete authentication system ready for production.
 */

import { compileTemplate } from './compiler.js';
import { AUTH_CONFIG, applyDatabaseDependencies } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Shorthand: compile a static auth API template (no user-specific config needed) */
function auth(sourcePath: string): string {
  return compileTemplate(sourcePath, AUTH_CONFIG);
}

/** Compile API package.json and swap database dependencies based on config */
function generateApiPackageJson(config: TemplateConfig): string {
  const content = compileTemplate('api/package.auth.json', config);
  return applyDatabaseDependencies(content, config);
}

// ============================================================================
// Auth Template Generator
// ============================================================================

export function generateAuthTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson(config) },
    { path: 'apps/api/tsconfig.json', content: auth('api/tsconfig.json') },
    { path: 'apps/api/tsup.config.ts', content: auth('api/tsup.config.ts') },
    { path: 'apps/api/prisma.config.ts', content: auth('api/prisma.config.ts') },
    { path: 'apps/api/.env.example', content: compileTemplate('api/env.auth', config) },
    { path: 'apps/api/.env', content: compileTemplate('api/env.auth', config) },

    // Prisma
    {
      path: 'apps/api/prisma/schema.prisma',
      content: compileTemplate('api/prisma/schema.auth.prisma', config),
    },

    // API Source files
    { path: 'apps/api/src/router.ts', content: auth('api/router.auth.ts') },
    { path: 'apps/api/src/index.ts', content: auth('api/index.auth.ts') },
    { path: 'apps/api/src/config/app.ts', content: compileTemplate('api/config/app.ts', config) },
    { path: 'apps/api/src/config/auth.ts', content: auth('api/config/auth.ts') },
    {
      path: 'apps/api/src/config/database.ts',
      content: compileTemplate('api/config/database.ts', config),
    },
    { path: 'apps/api/src/procedures/health.ts', content: auth('api/procedures/health.ts') },
    { path: 'apps/api/src/procedures/auth.ts', content: auth('api/procedures/auth.ts') },
    { path: 'apps/api/src/procedures/users.ts', content: auth('api/procedures/users.auth.ts') },
    {
      path: 'apps/api/src/procedures/profiles.ts',
      content: auth('api/procedures/profiles.auth.ts'),
    },
    { path: 'apps/api/src/schemas/user.ts', content: auth('api/schemas/user.ts') },
    { path: 'apps/api/src/schemas/auth.ts', content: auth('api/schemas/auth.ts') },
    { path: 'apps/api/src/schemas/health.ts', content: auth('api/schemas/health.ts') },
    { path: 'apps/api/src/types.ts', content: auth('api/types.auth.ts') },
    { path: 'apps/api/src/utils/auth.ts', content: auth('api/utils/auth.ts') },
  ];

  // Add docker-compose for PostgreSQL
  if (config.database === 'postgresql') {
    files.push({
      path: 'apps/api/docker-compose.yml',
      content: compileTemplate('api/docker-compose.yml', config),
    });
  }

  // Add root workspace files
  const rootFiles = generateRootFiles(config, true);

  // Add web package files (with auth UI)
  const webBaseFiles = generateWebBaseFiles(config, true);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
