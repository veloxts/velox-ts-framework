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
import { DEFAULT_CONFIG } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  return compileTemplate('api/package.default.json', config);
}

function generateApiTsConfig(): string {
  return compileTemplate('api/tsconfig.json', DEFAULT_CONFIG);
}

function generateApiTsupConfig(): string {
  return compileTemplate('api/tsup.config.ts', DEFAULT_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('api/env.default', config);
}

function generatePrismaSchema(): string {
  return compileTemplate('api/prisma/schema.default.prisma', DEFAULT_CONFIG);
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', DEFAULT_CONFIG);
}

function generateIndexTs(): string {
  return compileTemplate('api/index.default.ts', DEFAULT_CONFIG);
}

function generateConfigApp(config: TemplateConfig): string {
  return compileTemplate('api/config/app.ts', config);
}

function generateConfigDatabase(): string {
  return compileTemplate('api/config/database.ts', DEFAULT_CONFIG);
}

function generateHealthProcedures(): string {
  return compileTemplate('api/procedures/health.ts', DEFAULT_CONFIG);
}

function generateUserProcedures(): string {
  return compileTemplate('api/procedures/users.default.ts', DEFAULT_CONFIG);
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', DEFAULT_CONFIG);
}

function generateApiTypesDts(): string {
  return compileTemplate('api/types.d.ts', DEFAULT_CONFIG);
}

// ============================================================================
// SPA Template Generator
// ============================================================================

export function generateSpaTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson(config) },
    { path: 'apps/api/tsconfig.json', content: generateApiTsConfig() },
    { path: 'apps/api/tsup.config.ts', content: generateApiTsupConfig() },
    { path: 'apps/api/prisma.config.ts', content: generatePrismaConfig() },
    { path: 'apps/api/.env.example', content: generateEnvExample(config) },
    { path: 'apps/api/.env', content: generateEnvExample(config) },

    // Prisma
    { path: 'apps/api/prisma/schema.prisma', content: generatePrismaSchema() },

    // API Source files
    { path: 'apps/api/src/index.ts', content: generateIndexTs() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp(config) },
    { path: 'apps/api/src/config/database.ts', content: generateConfigDatabase() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
    { path: 'apps/api/src/types.d.ts', content: generateApiTypesDts() },
  ];

  // Add root workspace files
  const rootFiles = generateRootFiles(config, false);

  // Add web package files
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
