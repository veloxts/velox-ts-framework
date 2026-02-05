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
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  // Use tRPC package.json with @trpc/server for TypeScript type portability
  const content = compileTemplate('api/package.trpc.json', config);
  return applyDatabaseDependencies(content, config);
}

function generateApiTsConfig(): string {
  return compileTemplate('api/tsconfig.json', DEFAULT_CONFIG);
}

function generateApiTsupConfig(): string {
  return compileTemplate('api/tsup.config.ts', DEFAULT_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  // Reuse default env - same environment variables
  return compileTemplate('api/env.default', config);
}

function generatePrismaSchema(config: TemplateConfig): string {
  // Reuse default schema - same data model
  return compileTemplate('api/prisma/schema.default.prisma', config);
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', DEFAULT_CONFIG);
}

function generateRouterTs(): string {
  return compileTemplate('api/router.trpc.ts', TRPC_CONFIG);
}

function generateIndexTs(): string {
  // Use tRPC-specific entry point
  return compileTemplate('api/index.trpc.ts', TRPC_CONFIG);
}

function generateConfigApp(config: TemplateConfig): string {
  return compileTemplate('api/config/app.ts', config);
}

function generateConfigDatabase(config: TemplateConfig): string {
  return compileTemplate('api/config/database.ts', config);
}

function generateHealthProcedures(): string {
  return compileTemplate('api/procedures/health.ts', DEFAULT_CONFIG);
}

function generateUserProcedures(): string {
  // Reuse default user procedures - same CRUD operations
  return compileTemplate('api/procedures/users.default.ts', DEFAULT_CONFIG);
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', DEFAULT_CONFIG);
}

function generateHealthSchema(): string {
  return compileTemplate('api/schemas/health.ts', DEFAULT_CONFIG);
}

function generateApiTypesTs(): string {
  return compileTemplate('api/types.default.ts', DEFAULT_CONFIG);
}

function generateDockerCompose(config: TemplateConfig): string {
  return compileTemplate('api/docker-compose.yml', config);
}

// ============================================================================
// tRPC Template Generator
// ============================================================================

export function generateTrpcTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // API package files
    { path: 'apps/api/package.json', content: generateApiPackageJson(config) },
    { path: 'apps/api/tsconfig.json', content: generateApiTsConfig() },
    { path: 'apps/api/tsup.config.ts', content: generateApiTsupConfig() },
    { path: 'apps/api/prisma.config.ts', content: generatePrismaConfig() },
    { path: 'apps/api/.env.example', content: generateEnvExample(config) },
    { path: 'apps/api/.env', content: generateEnvExample(config) },

    // Prisma
    { path: 'apps/api/prisma/schema.prisma', content: generatePrismaSchema(config) },

    // API Source files
    { path: 'apps/api/src/router.ts', content: generateRouterTs() },
    { path: 'apps/api/src/index.ts', content: generateIndexTs() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp(config) },
    { path: 'apps/api/src/config/database.ts', content: generateConfigDatabase(config) },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
    { path: 'apps/api/src/schemas/health.ts', content: generateHealthSchema() },
    { path: 'apps/api/src/types.ts', content: generateApiTypesTs() },
  ];

  // Add docker-compose for PostgreSQL
  if (config.database === 'postgresql') {
    files.push({
      path: 'apps/api/docker-compose.yml',
      content: generateDockerCompose(config),
    });
  }

  // Add root workspace files (use 'trpc' variant for tRPC-specific CLAUDE.md)
  const rootFiles = generateRootFiles(config, 'trpc');

  // Add web package files (use false for isAuthTemplate)
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
