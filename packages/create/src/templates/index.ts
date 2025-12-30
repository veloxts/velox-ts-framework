/**
 * Template Registry
 *
 * Central hub for all project templates.
 */

import { generateAuthTemplate } from './auth.js';
import { generateRscTemplate } from './rsc.js';
import { generateRscAuthTemplate } from './rsc-auth.js';
import { VELOXTS_VERSION } from './shared.js';
import { generateSpaTemplate } from './spa.js';
import { generateTrpcTemplate } from './trpc.js';
import type { TemplateConfig, TemplateFile, TemplateType } from './types.js';
import {
  DATABASE_METADATA,
  getAvailableDatabases,
  getAvailableTemplates,
  isDatabaseAvailable,
  isValidDatabase,
  isValidTemplate,
  TEMPLATE_METADATA,
} from './types.js';

// ============================================================================
// Re-exports
// ============================================================================

export { VELOXTS_VERSION };

export type {
  DatabaseMetadata,
  DatabaseType,
  TemplateConfig,
  TemplateFile,
  TemplateMetadata,
  TemplateType,
} from './types.js';
export {
  DATABASE_METADATA,
  getAvailableDatabases,
  getAvailableTemplates,
  isDatabaseAvailable,
  isValidDatabase,
  isValidTemplate,
  TEMPLATE_METADATA,
};

// ============================================================================
// Template Generator
// ============================================================================

/**
 * Generate all files for a given template
 */
export function generateTemplateFiles(config: TemplateConfig): TemplateFile[] {
  switch (config.template) {
    case 'auth':
      return generateAuthTemplate(config);
    case 'trpc':
      return generateTrpcTemplate(config);
    case 'rsc':
      return generateRscTemplate(config);
    case 'rsc-auth':
      return generateRscAuthTemplate(config);
    case 'spa':
      return generateSpaTemplate(config);
    default: {
      // Exhaustive type checking - TypeScript will error if a template is missing
      const exhaustiveCheck: never = config.template;
      throw new Error(`Unknown template: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Get directories that need to be created for the template
 */
export function getTemplateDirectories(template: TemplateType): string[] {
  // RSC templates have a different structure (single-package, not monorepo)
  if (template === 'rsc') {
    return [
      // App layer (RSC)
      'app',
      'app/pages',
      'app/layouts',
      'app/actions',

      // Source layer
      'src',
      'src/api',
      'src/api/procedures',
      'src/api/schemas',

      // Prisma
      'prisma',

      // Public assets
      'public',

      // Scripts
      'scripts',
    ];
  }

  // RSC with Auth has additional directories for auth pages and utils
  if (template === 'rsc-auth') {
    return [
      // App layer (RSC)
      'app',
      'app/pages',
      'app/pages/auth',
      'app/pages/dashboard',
      'app/layouts',
      'app/actions',

      // Source layer
      'src',
      'src/api',
      'src/api/procedures',
      'src/api/schemas',
      'src/api/utils',

      // Prisma
      'prisma',

      // Public assets
      'public',

      // Scripts
      'scripts',
    ];
  }

  // Workspace-based directory structure (default, auth, trpc)
  return [
    // Root
    'apps',

    // API package
    'apps/api',
    'apps/api/src',
    'apps/api/src/config',
    'apps/api/src/database',
    'apps/api/src/procedures',
    'apps/api/src/schemas',
    'apps/api/prisma',

    // Web package
    'apps/web',
    'apps/web/src',
    'apps/web/src/routes',
    'apps/web/src/styles',
    'apps/web/src/components',
    'apps/web/public',
  ];
}
