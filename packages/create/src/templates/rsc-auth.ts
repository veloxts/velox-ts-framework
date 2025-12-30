/**
 * RSC Auth Template (React Server Components + Authentication)
 *
 * Full-stack application with:
 * - React Server Components (RSC) with Vinxi
 * - JWT Authentication via @veloxts/auth
 * - Validated server actions with security features
 * - File-based routing with auth pages
 * - Embedded Fastify API at /api/*
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileTemplate } from './compiler.js';
import { applyDatabaseDependencies, RSC_CONFIG } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read shared script from templates/source/shared/scripts/
 */
function readSharedScript(scriptName: string): string {
  // Try dist path first (production), then src path (development)
  const distPath = path.join(__dirname, '..', '..', 'src', 'templates', 'source', 'shared', 'scripts', scriptName);
  const srcPath = path.join(__dirname, 'source', 'shared', 'scripts', scriptName);

  for (const scriptPath of [distPath, srcPath]) {
    if (fs.existsSync(scriptPath)) {
      return fs.readFileSync(scriptPath, 'utf-8');
    }
  }

  throw new Error(`Shared script not found: ${scriptName}. Checked:\n  - ${distPath}\n  - ${srcPath}`);
}

// ============================================================================
// Template Compilation
// ============================================================================

function generatePackageJson(config: TemplateConfig): string {
  const content = compileTemplate('rsc-auth/package.json', config);
  return applyDatabaseDependencies(content, config);
}

function generateAppConfig(): string {
  return compileTemplate('rsc-auth/app.config.ts', RSC_CONFIG);
}

function generateTsConfig(): string {
  return compileTemplate('rsc-auth/tsconfig.json', RSC_CONFIG);
}

function generateEnvExample(config: TemplateConfig): string {
  return compileTemplate('rsc-auth/env.example', config);
}

function generateGitignore(): string {
  return compileTemplate('rsc-auth/gitignore', RSC_CONFIG);
}

function generateClaudeMd(config: TemplateConfig): string {
  return compileTemplate('rsc-auth/CLAUDE.md', config);
}

// Prisma
function generatePrismaSchema(config: TemplateConfig): string {
  return compileTemplate('rsc-auth/prisma/schema.prisma', config);
}

function generatePrismaConfig(): string {
  return compileTemplate('rsc-auth/prisma.config.ts', RSC_CONFIG);
}

// App layer (RSC) - Pages
function generateHomePage(): string {
  return compileTemplate('rsc-auth/app/pages/index.tsx', RSC_CONFIG);
}

function generateUsersPage(): string {
  return compileTemplate('rsc-auth/app/pages/users.tsx', RSC_CONFIG);
}

function generateNotFoundPage(): string {
  return compileTemplate('rsc-auth/app/pages/_not-found.tsx', RSC_CONFIG);
}

// Auth pages
function generateLoginPage(): string {
  return compileTemplate('rsc-auth/app/pages/auth/login.tsx', RSC_CONFIG);
}

function generateRegisterPage(): string {
  return compileTemplate('rsc-auth/app/pages/auth/register.tsx', RSC_CONFIG);
}

// Dashboard pages
function generateDashboardPage(): string {
  return compileTemplate('rsc-auth/app/pages/dashboard/index.tsx', RSC_CONFIG);
}

// Layouts
function generateRootLayout(): string {
  return compileTemplate('rsc-auth/app/layouts/root.tsx', RSC_CONFIG);
}

function generateMarketingLayout(): string {
  return compileTemplate('rsc-auth/app/layouts/marketing.tsx', RSC_CONFIG);
}

function generateMinimalLayout(): string {
  return compileTemplate('rsc-auth/app/layouts/minimal.tsx', RSC_CONFIG);
}

function generateMinimalContentLayout(): string {
  return compileTemplate('rsc-auth/app/layouts/minimal-content.tsx', RSC_CONFIG);
}

function generateDashboardLayout(): string {
  return compileTemplate('rsc-auth/app/layouts/dashboard.tsx', RSC_CONFIG);
}

// Actions
function generateUserActions(): string {
  return compileTemplate('rsc-auth/app/actions/users.ts', RSC_CONFIG);
}

function generateAuthActions(): string {
  return compileTemplate('rsc-auth/app/actions/auth.ts', RSC_CONFIG);
}

// Source layer - Entry points
function generateEntryClient(): string {
  return compileTemplate('rsc-auth/src/entry.client.tsx', RSC_CONFIG);
}

function generateEntryServer(): string {
  return compileTemplate('rsc-auth/src/entry.server.tsx', RSC_CONFIG);
}

// Source layer - API
function generateApiHandler(): string {
  return compileTemplate('rsc-auth/src/api/handler.ts', RSC_CONFIG);
}

function generateDatabase(config: TemplateConfig): string {
  return compileTemplate('rsc-auth/src/api/database.ts', config);
}

function generateHealthProcedures(): string {
  return compileTemplate('rsc-auth/src/api/procedures/health.ts', RSC_CONFIG);
}

function generateUserProcedures(): string {
  return compileTemplate('rsc-auth/src/api/procedures/users.ts', RSC_CONFIG);
}

function generateAuthProcedures(): string {
  return compileTemplate('rsc-auth/src/api/procedures/auth.ts', RSC_CONFIG);
}

// Schemas
function generateUserSchemas(): string {
  return compileTemplate('rsc-auth/src/api/schemas/user.ts', RSC_CONFIG);
}

function generateAuthSchemas(): string {
  return compileTemplate('rsc-auth/src/api/schemas/auth.ts', RSC_CONFIG);
}

// Utils
function generateAuthUtils(): string {
  return compileTemplate('rsc-auth/src/api/utils/auth.ts', RSC_CONFIG);
}

// Public assets
function generateFavicon(): string {
  return compileTemplate('rsc-auth/public/favicon.svg', RSC_CONFIG);
}

function generateDockerCompose(config: TemplateConfig): string {
  return compileTemplate('rsc-auth/docker-compose.yml', config);
}

// ============================================================================
// RSC Auth Template Generator
// ============================================================================

export function generateRscAuthTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // Root configuration
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'app.config.ts', content: generateAppConfig() },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: '.env.example', content: generateEnvExample(config) },
    { path: '.env', content: generateEnvExample(config) },
    { path: '.gitignore', content: generateGitignore() },
    { path: 'CLAUDE.md', content: generateClaudeMd(config) },

    // Prisma
    { path: 'prisma/schema.prisma', content: generatePrismaSchema(config) },
    { path: 'prisma.config.ts', content: generatePrismaConfig() },

    // App layer - Pages
    { path: 'app/pages/index.tsx', content: generateHomePage() },
    { path: 'app/pages/users.tsx', content: generateUsersPage() },
    { path: 'app/pages/_not-found.tsx', content: generateNotFoundPage() },

    // App layer - Auth pages
    { path: 'app/pages/auth/login.tsx', content: generateLoginPage() },
    { path: 'app/pages/auth/register.tsx', content: generateRegisterPage() },

    // App layer - Dashboard
    { path: 'app/pages/dashboard/index.tsx', content: generateDashboardPage() },

    // App layer - Layouts
    { path: 'app/layouts/root.tsx', content: generateRootLayout() },
    { path: 'app/layouts/marketing.tsx', content: generateMarketingLayout() },
    { path: 'app/layouts/minimal.tsx', content: generateMinimalLayout() },
    { path: 'app/layouts/minimal-content.tsx', content: generateMinimalContentLayout() },
    { path: 'app/layouts/dashboard.tsx', content: generateDashboardLayout() },

    // App layer - Actions
    { path: 'app/actions/users.ts', content: generateUserActions() },
    { path: 'app/actions/auth.ts', content: generateAuthActions() },

    // Source layer - Entry points
    { path: 'src/entry.client.tsx', content: generateEntryClient() },
    { path: 'src/entry.server.tsx', content: generateEntryServer() },

    // Source layer - API
    { path: 'src/api/handler.ts', content: generateApiHandler() },
    { path: 'src/api/database.ts', content: generateDatabase(config) },
    { path: 'src/api/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'src/api/procedures/users.ts', content: generateUserProcedures() },
    { path: 'src/api/procedures/auth.ts', content: generateAuthProcedures() },
    { path: 'src/api/schemas/user.ts', content: generateUserSchemas() },
    { path: 'src/api/schemas/auth.ts', content: generateAuthSchemas() },
    { path: 'src/api/utils/auth.ts', content: generateAuthUtils() },

    // Public assets
    { path: 'public/favicon.svg', content: generateFavicon() },

    // Scripts
    { path: 'scripts/check-client-imports.sh', content: readSharedScript('check-client-imports.sh') },
  ];

  // Add docker-compose for PostgreSQL
  if (config.database === 'postgresql') {
    files.push({
      path: 'docker-compose.yml',
      content: generateDockerCompose(config),
    });
  }

  return files;
}
