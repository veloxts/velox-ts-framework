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

import { compileTemplate, readSharedScript } from './compiler.js';
import { applyDatabaseDependencies, RSC_CONFIG } from './placeholders.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Helpers (only for functions with non-trivial logic)
// ============================================================================

/** Compile package.json and swap database dependencies based on config */
function generatePackageJson(config: TemplateConfig): string {
  const content = compileTemplate('rsc/package.json', config);
  return applyDatabaseDependencies(content, config);
}

/** Shorthand: compile a static RSC template (no user-specific config needed) */
function rsc(sourcePath: string): string {
  return compileTemplate(sourcePath, RSC_CONFIG);
}

// ============================================================================
// RSC Template Generator
// ============================================================================

export function generateRscTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // Root configuration files
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'app.config.ts', content: rsc('rsc/app.config.ts') },
    { path: 'tsconfig.json', content: rsc('rsc/tsconfig.json') },
    { path: '.env.example', content: compileTemplate('rsc/env.example', config) },
    { path: '.env', content: compileTemplate('rsc/env.example', config) },
    { path: '.gitignore', content: rsc('rsc/gitignore') },
    { path: 'CLAUDE.md', content: compileTemplate('rsc/CLAUDE.md', config) },

    // Prisma
    { path: 'prisma/schema.prisma', content: compileTemplate('rsc/prisma/schema.prisma', config) },
    { path: 'prisma.config.ts', content: rsc('rsc/prisma.config.ts') },

    // App layer (RSC) - Basic pages
    { path: 'app/pages/index.tsx', content: rsc('rsc/app/pages/index.tsx') },
    { path: 'app/pages/users.tsx', content: rsc('rsc/app/pages/users.tsx') },
    { path: 'app/pages/print.tsx', content: rsc('rsc/app/pages/print.tsx') },
    { path: 'app/pages/_not-found.tsx', content: rsc('rsc/app/pages/_not-found.tsx') },

    // App layer (RSC) - Nested dynamic routes (users/[id]/*)
    { path: 'app/pages/users/[id].tsx', content: rsc('rsc/app/pages/users/[id].tsx') },
    {
      path: 'app/pages/users/[id]/posts/index.tsx',
      content: rsc('rsc/app/pages/users/[id]/posts/index.tsx'),
    },
    {
      path: 'app/pages/users/[id]/posts/[postId].tsx',
      content: rsc('rsc/app/pages/users/[id]/posts/[postId].tsx'),
    },
    {
      path: 'app/pages/users/[id]/posts/new.tsx',
      content: rsc('rsc/app/pages/users/[id]/posts/new.tsx'),
    },

    // App layer (RSC) - Route groups
    {
      path: 'app/pages/(marketing)/about.tsx',
      content: rsc('rsc/app/pages/(marketing)/about.tsx'),
    },
    {
      path: 'app/pages/(dashboard)/settings.tsx',
      content: rsc('rsc/app/pages/(dashboard)/settings.tsx'),
    },
    {
      path: 'app/pages/(dashboard)/profile.tsx',
      content: rsc('rsc/app/pages/(dashboard)/profile.tsx'),
    },

    // App layer (RSC) - Catch-all routes
    { path: 'app/pages/docs/[...slug].tsx', content: rsc('rsc/app/pages/docs/[...slug].tsx') },

    // App layer (RSC) - Layouts
    { path: 'app/layouts/root.tsx', content: rsc('rsc/app/layouts/root.tsx') },
    { path: 'app/layouts/marketing.tsx', content: rsc('rsc/app/layouts/marketing.tsx') },
    { path: 'app/layouts/minimal.tsx', content: rsc('rsc/app/layouts/minimal.tsx') },
    {
      path: 'app/layouts/minimal-content.tsx',
      content: rsc('rsc/app/layouts/minimal-content.tsx'),
    },
    { path: 'app/layouts/dashboard.tsx', content: rsc('rsc/app/layouts/dashboard.tsx') },
    { path: 'app/pages/users/_layout.tsx', content: rsc('rsc/app/pages/users/_layout.tsx') },

    // App layer (RSC) - Server actions
    { path: 'app/actions/users.ts', content: rsc('rsc/app/actions/users.ts') },
    { path: 'app/actions/posts.ts', content: rsc('rsc/app/actions/posts.ts') },

    // Source layer - Entry points
    { path: 'src/entry.client.tsx', content: rsc('rsc/src/entry.client.tsx') },
    { path: 'src/entry.server.tsx', content: rsc('rsc/src/entry.server.tsx') },

    // Source layer - API
    { path: 'src/api/handler.ts', content: rsc('rsc/src/api/handler.ts') },
    { path: 'src/api/database.ts', content: compileTemplate('rsc/src/api/database.ts', config) },
    { path: 'src/api/procedures/health.ts', content: rsc('rsc/src/api/procedures/health.ts') },
    { path: 'src/api/procedures/users.ts', content: rsc('rsc/src/api/procedures/users.ts') },
    { path: 'src/api/procedures/posts.ts', content: rsc('rsc/src/api/procedures/posts.ts') },
    { path: 'src/api/schemas/user.ts', content: rsc('rsc/src/api/schemas/user.ts') },
    { path: 'src/api/schemas/post.ts', content: rsc('rsc/src/api/schemas/post.ts') },

    // Public assets
    { path: 'public/favicon.svg', content: rsc('rsc/public/favicon.svg') },

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
      content: compileTemplate('rsc/docker-compose.yml', config),
    });
  }

  return files;
}
