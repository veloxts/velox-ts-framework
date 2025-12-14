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
import { AUTH_CONFIG } from './placeholders.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  return compileTemplate('api/package.auth.json', config);
}

function generateApiTsConfig(): string {
  return compileTemplate('api/tsconfig.json', AUTH_CONFIG);
}

function generateApiTsupConfig(): string {
  return compileTemplate('api/tsup.config.ts', AUTH_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('api/env.auth', config);
}

function generatePrismaSchema(): string {
  return compileTemplate('api/prisma/schema.auth.prisma', AUTH_CONFIG);
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', AUTH_CONFIG);
}

function generateAuthConfig(): string {
  return compileTemplate('api/config/auth.ts', AUTH_CONFIG);
}

function generateConfigApp(config: TemplateConfig): string {
  return compileTemplate('api/config/app.ts', config);
}

function generateAuthProcedures(): string {
  return compileTemplate('api/procedures/auth.ts', AUTH_CONFIG);
}

function generateUserProceduresWithAuth(): string {
  return compileTemplate('api/procedures/users.auth.ts', AUTH_CONFIG);
}

function generateIndexTs(): string {
  return compileTemplate('api/index.auth.ts', AUTH_CONFIG);
}

function generateConfigDatabase(): string {
  return compileTemplate('api/config/database.ts', AUTH_CONFIG);
}

function generateHealthProcedures(): string {
  return compileTemplate('api/procedures/health.ts', AUTH_CONFIG);
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', AUTH_CONFIG);
}

function generateApiTypesDts(): string {
  return compileTemplate('api/types.d.ts', AUTH_CONFIG);
}

// ============================================================================
// Auth Template Generator
// ============================================================================

export function generateAuthTemplate(config: TemplateConfig): TemplateFile[] {
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
    { path: 'apps/api/src/config/auth.ts', content: generateAuthConfig() },
    { path: 'apps/api/src/config/database.ts', content: generateConfigDatabase() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/auth.ts', content: generateAuthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProceduresWithAuth() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
    { path: 'apps/api/src/types.d.ts', content: generateApiTypesDts() },
  ];

  // Add root workspace files
  const rootFiles = generateRootFiles(config, true);

  // Add web package files (with auth UI)
  const webBaseFiles = generateWebBaseFiles(config, true);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
