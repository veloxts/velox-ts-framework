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

function generateMarketingLayout(): string {
  return compileTemplate('rsc/app/layouts/marketing.tsx', RSC_CONFIG);
}

function generateMinimalLayout(): string {
  return compileTemplate('rsc/app/layouts/minimal.tsx', RSC_CONFIG);
}

function generateAboutPage(): string {
  return compileTemplate('rsc/app/pages/(marketing)/about.tsx', RSC_CONFIG);
}

function generatePrintPage(): string {
  return compileTemplate('rsc/app/pages/print.tsx', RSC_CONFIG);
}

function generateNotFoundPage(): string {
  return compileTemplate('rsc/app/pages/_not-found.tsx', RSC_CONFIG);
}

function generateUserActions(): string {
  return compileTemplate('rsc/app/actions/users.ts', RSC_CONFIG);
}

// Route group pages
function generateSettingsPage(): string {
  return compileTemplate('rsc/app/pages/(dashboard)/settings.tsx', RSC_CONFIG);
}

function generateProfilePage(): string {
  return compileTemplate('rsc/app/pages/(dashboard)/profile.tsx', RSC_CONFIG);
}

// Nested dynamic route pages
function generateUserPostsPage(): string {
  return compileTemplate('rsc/app/pages/users/[id]/posts/index.tsx', RSC_CONFIG);
}

function generatePostDetailPage(): string {
  return compileTemplate('rsc/app/pages/users/[id]/posts/[postId].tsx', RSC_CONFIG);
}

function generateNewPostPage(): string {
  return compileTemplate('rsc/app/pages/users/[id]/posts/new.tsx', RSC_CONFIG);
}

// Catch-all page
function generateDocsPage(): string {
  return compileTemplate('rsc/app/pages/docs/[...slug].tsx', RSC_CONFIG);
}

// Additional layouts
function generateDashboardLayout(): string {
  return compileTemplate('rsc/app/layouts/dashboard.tsx', RSC_CONFIG);
}

function generateUsersLayout(): string {
  return compileTemplate('rsc/app/pages/users/_layout.tsx', RSC_CONFIG);
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

function generatePostProcedures(): string {
  return compileTemplate('rsc/src/api/procedures/posts.ts', RSC_CONFIG);
}

function generateUserSchemas(): string {
  return compileTemplate('rsc/src/api/schemas/user.ts', RSC_CONFIG);
}

function generatePostSchemas(): string {
  return compileTemplate('rsc/src/api/schemas/post.ts', RSC_CONFIG);
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

    // App layer (RSC) - Basic pages
    { path: 'app/pages/index.tsx', content: generateHomePage() },
    { path: 'app/pages/users.tsx', content: generateUsersPage() },
    { path: 'app/pages/print.tsx', content: generatePrintPage() },
    { path: 'app/pages/_not-found.tsx', content: generateNotFoundPage() },

    // App layer (RSC) - Nested dynamic routes (users/[id]/*)
    { path: 'app/pages/users/[id].tsx', content: generateUserDetailPage() },
    { path: 'app/pages/users/[id]/posts/index.tsx', content: generateUserPostsPage() },
    { path: 'app/pages/users/[id]/posts/[postId].tsx', content: generatePostDetailPage() },
    { path: 'app/pages/users/[id]/posts/new.tsx', content: generateNewPostPage() },

    // App layer (RSC) - Route groups
    { path: 'app/pages/(marketing)/about.tsx', content: generateAboutPage() },
    { path: 'app/pages/(dashboard)/settings.tsx', content: generateSettingsPage() },
    { path: 'app/pages/(dashboard)/profile.tsx', content: generateProfilePage() },

    // App layer (RSC) - Catch-all routes
    { path: 'app/pages/docs/[...slug].tsx', content: generateDocsPage() },

    // App layer (RSC) - Layouts
    { path: 'app/layouts/root.tsx', content: generateRootLayout() },
    { path: 'app/layouts/marketing.tsx', content: generateMarketingLayout() },
    { path: 'app/layouts/minimal.tsx', content: generateMinimalLayout() },
    { path: 'app/layouts/dashboard.tsx', content: generateDashboardLayout() },
    { path: 'app/pages/users/_layout.tsx', content: generateUsersLayout() },

    // App layer (RSC) - Server actions
    { path: 'app/actions/users.ts', content: generateUserActions() },

    // Source layer - Entry points
    { path: 'src/entry.client.tsx', content: generateEntryClient() },
    { path: 'src/entry.server.tsx', content: generateEntryServer() },

    // Source layer - API
    { path: 'src/api/handler.ts', content: generateApiHandler() },
    { path: 'src/api/database.ts', content: generateDatabase() },
    { path: 'src/api/procedures/health.ts', content: generateHealthProcedures() },
    { path: 'src/api/procedures/users.ts', content: generateUserProcedures() },
    { path: 'src/api/procedures/posts.ts', content: generatePostProcedures() },
    { path: 'src/api/schemas/user.ts', content: generateUserSchemas() },
    { path: 'src/api/schemas/post.ts', content: generatePostSchemas() },

    // Public assets
    { path: 'public/favicon.svg', content: generateFavicon() },
  ];
}
