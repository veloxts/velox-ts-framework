/**
 * RSC Template (React Server Components + Vinxi)
 *
 * Unified full-stack application with:
 * - React Server Components (RSC) with streaming
 * - Vinxi as the HTTP infrastructure layer
 * - File-based routing under app/pages/
 * - Server actions with Zod validation
 * - Embedded Fastify API at /api/*
 *
 * This is a single-package structure (not a monorepo workspace).
 */

import { compileTemplate } from './compiler.js';
import { RSC_CONFIG } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Template Compilation
// ============================================================================

function generatePackageJson(config: TemplateConfig): string {
  return compileTemplate('rsc/package.json', config);
}

function generateAppConfig(): string {
  return compileTemplate('rsc/app.config.ts', RSC_CONFIG);
}

function generateTsConfig(): string {
  return compileTemplate('rsc/tsconfig.json', RSC_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('rsc/env.example', config);
}

function generateGitignore(): string {
  return compileTemplate('rsc/gitignore', RSC_CONFIG);
}

function generateClaudeMd(config: TemplateConfig): string {
  return compileTemplate('rsc/CLAUDE.md', config);
}

// Prisma
function generatePrismaSchema(): string {
  return compileTemplate('rsc/prisma/schema.prisma', RSC_CONFIG);
}

function generatePrismaConfig(): string {
  return compileTemplate('rsc/prisma.config.ts', RSC_CONFIG);
}

// App layer (RSC)
function generateHomePage(): string {
  return compileTemplate('rsc/app/pages/index.tsx', RSC_CONFIG);
}

function generateUsersPage(): string {
  return compileTemplate('rsc/app/pages/users.tsx', RSC_CONFIG);
}

function generateUserDetailPage(): string {
  return compileTemplate('rsc/app/pages/users/[id].tsx', RSC_CONFIG);
}

function generateRootLayout(): string {
  return compileTemplate('rsc/app/layouts/root.tsx', RSC_CONFIG);
}

function generateUserActions(): string {
  return compileTemplate('rsc/app/actions/users.ts', RSC_CONFIG);
}

// Source layer
function generateEntryClient(): string {
  return compileTemplate('rsc/src/entry.client.tsx', RSC_CONFIG);
}

function generateEntryServer(): string {
  return compileTemplate('rsc/src/entry.server.tsx', RSC_CONFIG);
}

function generateApiHandler(): string {
  return compileTemplate('rsc/src/api/handler.ts', RSC_CONFIG);
}

function generateDatabase(): string {
  return compileTemplate('rsc/src/api/database.ts', RSC_CONFIG);
}

function generateHealthProcedures(): string {
  return compileTemplate('rsc/src/api/procedures/health.ts', RSC_CONFIG);
}

function generateUserProcedures(): string {
  return compileTemplate('rsc/src/api/procedures/users.ts', RSC_CONFIG);
}

function generateUserSchemas(): string {
  return compileTemplate('rsc/src/api/schemas/user.ts', RSC_CONFIG);
}

function generateFavicon(): string {
  return compileTemplate('rsc/public/favicon.svg', RSC_CONFIG);
}

// ============================================================================
// RSC Template Generator
// ============================================================================

export function generateRscTemplate(config: TemplateConfig): TemplateFile[] {
  return [
    // Root configuration files
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'app.config.ts', content: generateAppConfig() },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: '.env.example', content: generateEnvExample(config) },
    { path: '.env', content: generateEnvExample(config) },
    { path: '.gitignore', content: generateGitignore() },
    { path: 'CLAUDE.md', content: generateClaudeMd(config) },

    // Prisma
    { path: 'prisma/schema.prisma', content: generatePrismaSchema() },
    { path: 'prisma.config.ts', content: generatePrismaConfig() },

    // App layer (RSC)
    { path: 'app/pages/index.tsx', content: generateHomePage() },
    { path: 'app/pages/users.tsx', content: generateUsersPage() },
    { path: 'app/pages/users/[id].tsx', content: generateUserDetailPage() },
    { path: 'app/layouts/root.tsx', content: generateRootLayout() },
    { path: 'app/actions/users.ts', content: generateUserActions() },

    // Source layer
    { path: 'src/entry.client.tsx', content: generateEntryClient() },
    { path: 'src/entry.server.tsx', content: generateEntryServer() },
    { path: 'src/api/handler.ts', content: generateApiHandler() },
    { path: 'src/api/database.ts', content: generateDatabase() },
    { path: 'src/api/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'src/api/procedures/users.ts', content: generateUserProcedures() },
    { path: 'src/api/schemas/user.ts', content: generateUserSchemas() },

    // Public assets
    { path: 'public/favicon.svg', content: generateFavicon() },
  ];
}
