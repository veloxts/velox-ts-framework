/**
 * Default Template (Full-Stack)
 *
 * Full-stack workspace template with:
 * - apps/api: REST API with user CRUD operations
 * - apps/web: React frontend with TanStack Router
 *
 * No authentication - suitable for internal APIs or as a starting point.
 */

import { compileTemplate } from './compiler.js';
import { generateRootFiles, generateWebBaseFiles, generateWebStyleFiles } from './shared/index.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// API Template Compilation
// ============================================================================

function generateApiPackageJson(config: TemplateConfig): string {
  return compileTemplate('api/package.default.json', config);
}

function generateApiTsConfig(): string {
  return compileTemplate('api/tsconfig.json', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateApiTsupConfig(): string {
  return compileTemplate('api/tsup.config.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('api/env.default', config);
}

function generatePrismaSchema(): string {
  return compileTemplate('api/prisma/schema.default.prisma', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generatePrismaConfig(): string {
  return compileTemplate('api/prisma.config.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateIndexTs(): string {
  return compileTemplate('api/index.default.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateConfigIndex(): string {
  return compileTemplate('api/config/index.default.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateConfigApp(config: TemplateConfig): string {
  return compileTemplate('api/config/app.ts', config);
}

function generateDatabaseIndex(): string {
  return compileTemplate('api/database/index.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateHealthProcedures(): string {
  return compileTemplate('api/procedures/health.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateProceduresIndex(): string {
  return compileTemplate('api/procedures/index.default.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateUserProcedures(): string {
  return compileTemplate('api/procedures/users.default.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateSchemasIndex(): string {
  return compileTemplate('api/schemas/index.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

function generateUserSchema(): string {
  return compileTemplate('api/schemas/user.ts', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

// ============================================================================
// Default Template Generator
// ============================================================================

export function generateDefaultTemplate(config: TemplateConfig): TemplateFile[] {
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
    { path: 'apps/api/src/config/index.ts', content: generateConfigIndex() },
    { path: 'apps/api/src/config/app.ts', content: generateConfigApp(config) },
    { path: 'apps/api/src/database/index.ts', content: generateDatabaseIndex() },
    { path: 'apps/api/src/procedures/index.ts', content: generateProceduresIndex() },
    { path: 'apps/api/src/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'apps/api/src/procedures/users.ts', content: generateUserProcedures() },
    { path: 'apps/api/src/schemas/index.ts', content: generateSchemasIndex() },
    { path: 'apps/api/src/schemas/user.ts', content: generateUserSchema() },
  ];

  // Add root workspace files
  const rootFiles = generateRootFiles(config, false);

  // Add web package files
  const webBaseFiles = generateWebBaseFiles(config, false);
  const webStyleFiles = generateWebStyleFiles();

  return [...files, ...rootFiles, ...webBaseFiles, ...webStyleFiles];
}
