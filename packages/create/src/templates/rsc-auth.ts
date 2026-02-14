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

import { compileTemplate, readSharedScript } from './compiler.js';
import { applyDatabaseDependencies, RSC_CONFIG } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Helpers (only for functions with non-trivial logic)
// ============================================================================

/** Compile package.json and swap database dependencies based on config */
function generatePackageJson(config: TemplateConfig): string {
  const content = compileTemplate('rsc-auth/package.json', config);
  return applyDatabaseDependencies(content, config);
}

/** Shorthand: compile a static RSC-Auth template (no user-specific config needed) */
function rscAuth(sourcePath: string): string {
  return compileTemplate(sourcePath, RSC_CONFIG);
}

// ============================================================================
// RSC Auth Template Generator
// ============================================================================

export function generateRscAuthTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // Root configuration
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'app.config.ts', content: rscAuth('rsc-auth/app.config.ts') },
    { path: 'tsconfig.json', content: rscAuth('rsc-auth/tsconfig.json') },
    { path: '.env.example', content: compileTemplate('rsc-auth/env.example', config) },
    { path: '.env', content: compileTemplate('rsc-auth/env.example', config) },
    { path: '.gitignore', content: rscAuth('rsc-auth/gitignore') },
    { path: 'CLAUDE.md', content: compileTemplate('rsc-auth/CLAUDE.md', config) },

    // Prisma
    {
      path: 'prisma/schema.prisma',
      content: compileTemplate('rsc-auth/prisma/schema.prisma', config),
    },
    { path: 'prisma.config.ts', content: rscAuth('rsc-auth/prisma.config.ts') },

    // App layer - Pages
    { path: 'app/pages/index.tsx', content: rscAuth('rsc-auth/app/pages/index.tsx') },
    { path: 'app/pages/users.tsx', content: rscAuth('rsc-auth/app/pages/users.tsx') },
    { path: 'app/pages/_not-found.tsx', content: rscAuth('rsc-auth/app/pages/_not-found.tsx') },

    // App layer - Auth pages
    { path: 'app/pages/auth/login.tsx', content: rscAuth('rsc-auth/app/pages/auth/login.tsx') },
    {
      path: 'app/pages/auth/register.tsx',
      content: rscAuth('rsc-auth/app/pages/auth/register.tsx'),
    },

    // App layer - Dashboard
    {
      path: 'app/pages/dashboard/index.tsx',
      content: rscAuth('rsc-auth/app/pages/dashboard/index.tsx'),
    },

    // App layer - Layouts
    { path: 'app/layouts/root.tsx', content: rscAuth('rsc-auth/app/layouts/root.tsx') },
    { path: 'app/layouts/marketing.tsx', content: rscAuth('rsc-auth/app/layouts/marketing.tsx') },
    { path: 'app/layouts/minimal.tsx', content: rscAuth('rsc-auth/app/layouts/minimal.tsx') },
    {
      path: 'app/layouts/minimal-content.tsx',
      content: rscAuth('rsc-auth/app/layouts/minimal-content.tsx'),
    },
    { path: 'app/layouts/dashboard.tsx', content: rscAuth('rsc-auth/app/layouts/dashboard.tsx') },

    // App layer - Actions
    { path: 'app/actions/users.ts', content: rscAuth('rsc-auth/app/actions/users.ts') },
    { path: 'app/actions/auth.ts', content: rscAuth('rsc-auth/app/actions/auth.ts') },

    // Source layer - Entry points
    { path: 'src/entry.client.tsx', content: rscAuth('rsc-auth/src/entry.client.tsx') },
    { path: 'src/entry.server.tsx', content: rscAuth('rsc-auth/src/entry.server.tsx') },

    // Source layer - API
    { path: 'src/api/handler.ts', content: rscAuth('rsc-auth/src/api/handler.ts') },
    {
      path: 'src/api/database.ts',
      content: compileTemplate('rsc-auth/src/api/database.ts', config),
    },
    {
      path: 'src/api/procedures/health.ts',
      content: rscAuth('rsc-auth/src/api/procedures/health.ts'),
    },
    {
      path: 'src/api/procedures/users.ts',
      content: rscAuth('rsc-auth/src/api/procedures/users.ts'),
    },
    {
      path: 'src/api/procedures/auth.ts',
      content: rscAuth('rsc-auth/src/api/procedures/auth.ts'),
    },
    {
      path: 'src/api/procedures/profiles.ts',
      content: rscAuth('rsc-auth/src/api/procedures/profiles.ts'),
    },
    { path: 'src/api/schemas/user.ts', content: rscAuth('rsc-auth/src/api/schemas/user.ts') },
    { path: 'src/api/schemas/auth.ts', content: rscAuth('rsc-auth/src/api/schemas/auth.ts') },
    { path: 'src/api/utils/auth.ts', content: rscAuth('rsc-auth/src/api/utils/auth.ts') },

    // Public assets
    { path: 'public/favicon.svg', content: rscAuth('rsc-auth/public/favicon.svg') },

    // Scripts
    {
      path: 'scripts/check-client-imports.sh',
      content: readSharedScript('check-client-imports.sh'),
    },
  ];

  // Add docker-compose for PostgreSQL
  if (config.database === 'postgresql') {
    files.push({
      path: 'docker-compose.yml',
      content: compileTemplate('rsc-auth/docker-compose.yml', config),
    });
  }

  return files;
}
