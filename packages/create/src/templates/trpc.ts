/**
 * tRPC Hybrid Template (Full-Stack)
 *
 * Full-stack workspace template with:
 * - apps/api: Hybrid tRPC + REST API with user CRUD operations
 * - apps/web: React frontend with TanStack Router
 *
 * Showcases VeloxTS's type-safe frontend-backend communication:
 * - tRPC endpoints for internal consumption (primary)
 * - REST endpoints for external APIs (auto-generated)
 * - End-to-end type safety without code generation
 */

import { compileTemplate } from './compiler.js';
import { DEFAULT_CONFIG, TRPC_CONFIG } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  // Reuse default package.json - @veloxts/velox already includes tRPC utilities
  return compileTemplate('api/package.default.json', config);
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

function generatePrismaSchema(): string {
  // Reuse default schema - same data model
  return compileTemplate('api/prisma/schema.default.prisma', DEFAULT_CONFIG);
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', DEFAULT_CONFIG);
}

function generateRouterTs(): string {
  return compileTemplate('api/router.trpc.ts', TRPC_CONFIG);
}

function generateRouterTypesTs(): string {
  return compileTemplate('api/router.types.trpc.ts', TRPC_CONFIG);
}

function generateIndexTs(): string {
  // Use tRPC-specific entry point
  return compileTemplate('api/index.trpc.ts', TRPC_CONFIG);
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
  // Reuse default user procedures - same CRUD operations
  return compileTemplate('api/procedures/users.default.ts', DEFAULT_CONFIG);
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', DEFAULT_CONFIG);
}

function generateHealthSchema(): string {
  return compileTemplate('api/schemas/health.ts', DEFAULT_CONFIG);
}

function generateRoutes(): string {
  return compileTemplate('api/routes.default.ts', DEFAULT_CONFIG);
}

function generateApiTypesDts(): string {
  return compileTemplate('api/types.d.ts', DEFAULT_CONFIG);
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
    { path: 'apps/api/prisma/schema.prisma', content: generatePrismaSchema() },

    // API Source files
    { path: 'apps/api/src/router.ts', content: generateRouterTs() },
    { path: 'apps/api/src/router.types.ts', content: generateRouterTypesTs() },
    { path: 'apps/api/src/index.ts', content: generateIndexTs() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp(config) },
    { path: 'apps/api/src/config/database.ts', content: generateConfigDatabase() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
    { path: 'apps/api/src/schemas/health.ts', content: generateHealthSchema() },
    { path: 'apps/api/src/routes.ts', content: generateRoutes() },
    { path: 'apps/api/src/types.d.ts', content: generateApiTypesDts() },
  ];

  // Add root workspace files (use false for isAuthTemplate)
  const rootFiles = generateRootFiles(config, false);

  // Add web package files (use false for isAuthTemplate)
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
