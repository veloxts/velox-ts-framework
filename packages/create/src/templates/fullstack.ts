/**
 * Full-Stack Template (RSC + Vinxi)
 *
 * Full-stack application template with:
 * - React Server Components (RSC) with streaming
 * - Vinxi as the HTTP infrastructure layer
 * - File-based routing under app/pages/
 * - Server actions with type safety
 * - Embedded Fastify API at /api/*
 *
 * This is a single-package structure (not a monorepo workspace).
 */

import { compileTemplate } from './compiler.js';
import { FULLSTACK_CONFIG } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Template Compilation
// ============================================================================

function generatePackageJson(config: TemplateConfig): string {
  return compileTemplate('fullstack/package.json', config);
}

function generateAppConfig(): string {
  return compileTemplate('fullstack/app.config.ts', FULLSTACK_CONFIG);
}

function generateTsConfig(): string {
  return compileTemplate('fullstack/tsconfig.json', FULLSTACK_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('fullstack/env.example', config);
}

function generateGitignore(): string {
  return compileTemplate('fullstack/gitignore', FULLSTACK_CONFIG);
}

function generateClaudeMd(config: TemplateConfig): string {
  return compileTemplate('fullstack/CLAUDE.md', config);
}

// Prisma
function generatePrismaSchema(): string {
  return compileTemplate('fullstack/prisma/schema.prisma', FULLSTACK_CONFIG);
}

// App layer (RSC)
function generateHomePage(): string {
  return compileTemplate('fullstack/app/pages/index.tsx', FULLSTACK_CONFIG);
}

function generateUsersPage(): string {
  return compileTemplate('fullstack/app/pages/users.tsx', FULLSTACK_CONFIG);
}

function generateRootLayout(): string {
  return compileTemplate('fullstack/app/layouts/root.tsx', FULLSTACK_CONFIG);
}

function generateUserActions(): string {
  return compileTemplate('fullstack/app/actions/users.ts', FULLSTACK_CONFIG);
}

// Source layer
function generateEntryClient(): string {
  return compileTemplate('fullstack/src/entry.client.tsx', FULLSTACK_CONFIG);
}

function generateEntryServer(): string {
  return compileTemplate('fullstack/src/entry.server.tsx', FULLSTACK_CONFIG);
}

function generateApiHandler(): string {
  return compileTemplate('fullstack/src/api/handler.ts', FULLSTACK_CONFIG);
}

function generateDatabase(): string {
  return compileTemplate('fullstack/src/api/database.ts', FULLSTACK_CONFIG);
}

function generateHealthProcedures(): string {
  return compileTemplate('fullstack/src/api/procedures/health.ts', FULLSTACK_CONFIG);
}

function generateUserProcedures(): string {
  return compileTemplate('fullstack/src/api/procedures/users.ts', FULLSTACK_CONFIG);
}

function generateUserSchemas(): string {
  return compileTemplate('fullstack/src/api/schemas/user.ts', FULLSTACK_CONFIG);
}

function generateFavicon(): string {
  return compileTemplate('fullstack/public/favicon.svg', FULLSTACK_CONFIG);
}

// ============================================================================
// Full-Stack Template Generator
// ============================================================================

export function generateFullstackTemplate(config: TemplateConfig): TemplateFile[] {
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

    // App layer (RSC)
    { path: 'app/pages/index.tsx', content: generateHomePage() },
    { path: 'app/pages/users.tsx', content: generateUsersPage() },
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
