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
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  return compileTemplate('api/package.auth.json', config);
}

function generateApiTsConfig(): string {
  return compileTemplate('api/tsconfig.json', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateApiTsupConfig(): string {
  return compileTemplate('api/tsup.config.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('api/env.auth', config);
}

function generatePrismaSchema(): string {
  return compileTemplate('api/prisma/schema.auth.prisma', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateAuthConfig(): string {
  return compileTemplate('api/config/auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateConfigIndexWithAuth(): string {
  return compileTemplate('api/config/index.auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateConfigApp(config: TemplateConfig): string {
  return compileTemplate('api/config/app.ts', config);
}

function generateAuthProcedures(): string {
  return compileTemplate('api/procedures/auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateUserProceduresWithAuth(): string {
  return compileTemplate('api/procedures/users.auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateIndexTs(): string {
  return compileTemplate('api/index.auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateDatabaseIndex(): string {
  return compileTemplate('api/database/index.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateHealthProcedures(): string {
  return compileTemplate('api/procedures/health.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateProceduresIndex(): string {
  return compileTemplate('api/procedures/index.auth.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateSchemasIndex(): string {
  return compileTemplate('api/schemas/index.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
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
    { path: 'apps/api/src/config/index.ts', content: generateConfigIndexWithAuth() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp(config) },
    { path: 'apps/api/src/config/auth.ts', content: generateAuthConfig() },
    { path: 'apps/api/src/database/index.ts', content: generateDatabaseIndex() },
    { path: 'apps/api/src/procedures/index.ts', content: generateProceduresIndex() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/auth.ts', content: generateAuthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProceduresWithAuth() },
    { path: 'apps/api/src/schemas/index.ts', content: generateSchemasIndex() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
  ];

  // Add root workspace files
  const rootFiles = generateRootFiles(config, true);

  // Add web package files (with auth UI)
  const webBaseFiles = generateWebBaseFiles(config, true);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
