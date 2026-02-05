/**
 * Template Placeholder System
 *
 * Handles placeholder replacement in template source files.
 * Uses simple string replacement for maximum speed.
 */

import { VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig } from './types.js';

// ============================================================================
// Placeholder Definitions
// ============================================================================

/**
 * All supported placeholders and their descriptions.
 * Placeholders use the format __PLACEHOLDER_NAME__
 */
export const PLACEHOLDERS = {
  /** User-provided project name (e.g., "my-app") */
  PROJECT_NAME: '__PROJECT_NAME__',
  /** Package manager choice (npm, pnpm, yarn) */
  PACKAGE_MANAGER: '__PACKAGE_MANAGER__',
  /** Current VeloxTS framework version */
  VELOXTS_VERSION: '__VELOXTS_VERSION__',
  /** Package manager run command (npm run, pnpm, yarn) */
  RUN_CMD: '__RUN_CMD__',
  /** Workspace command prefix for api package (e.g., "pnpm -F api", "npm run -w api") */
  WS_API: '__WS_API__',
  /** Complete dev command for running api and web in parallel */
  DEV_CMD: '__DEV_CMD__',
  /** Recursive run command (e.g., "pnpm -r", "npm run -ws") */
  WS_ALL: '__WS_ALL__',
  /** API server port (default: 3030) */
  API_PORT: '__API_PORT__',
  /** Web dev server port (default: 8080) */
  WEB_PORT: '__WEB_PORT__',
  /** Database provider for Prisma schema (sqlite, postgresql) */
  DATABASE_PROVIDER: '__DATABASE_PROVIDER__',
  /** Database URL for .env files */
  DATABASE_URL: '__DATABASE_URL__',
  /** Display-friendly database name (SQLite, PostgreSQL) */
  DATABASE_DISPLAY: '__DATABASE_DISPLAY__',
} as const;

/**
 * Default template configuration for templates that don't need real values.
 * Used when compiling templates that only need placeholder markers stripped,
 * not actual user-provided values (e.g., shared templates, route files).
 */
export const DEFAULT_CONFIG: TemplateConfig = {
  projectName: '',
  packageManager: 'pnpm',
  template: 'spa',
  database: 'sqlite',
};

/**
 * Auth template configuration for auth-specific templates.
 * Same as DEFAULT_CONFIG but with template set to 'auth'.
 */
export const AUTH_CONFIG: TemplateConfig = {
  projectName: '',
  packageManager: 'pnpm',
  template: 'auth',
  database: 'sqlite',
};

/**
 * tRPC template configuration for tRPC-specific templates.
 * Same as DEFAULT_CONFIG but with template set to 'trpc'.
 */
export const TRPC_CONFIG: TemplateConfig = {
  projectName: '',
  packageManager: 'pnpm',
  template: 'trpc',
  database: 'sqlite',
};

/**
 * RSC template configuration for RSC + Vinxi projects.
 * Uses React Server Components with file-based routing.
 */
export const RSC_CONFIG: TemplateConfig = {
  projectName: '',
  packageManager: 'pnpm',
  template: 'rsc',
  database: 'sqlite',
};

// ============================================================================
// Placeholder Replacement
// ============================================================================

/**
 * Get the run command for the package manager.
 */
function getRunCommand(packageManager: TemplateConfig['packageManager']): string {
  return packageManager === 'npm' ? 'npm run' : packageManager;
}

/**
 * Get the workspace command prefix for the api package.
 * Used for commands like db:push, db:generate that target the api workspace.
 */
function getWsApiCommand(packageManager: TemplateConfig['packageManager']): string {
  switch (packageManager) {
    case 'npm':
      return 'npm run -w api';
    case 'yarn':
      return 'yarn workspace api';
    default:
      return 'pnpm -F api';
  }
}

/**
 * Get the complete dev command for running api and web in parallel.
 * Note: npm doesn't support parallel workspace execution natively,
 * so we use concurrently for npm users.
 */
function getDevCommand(packageManager: TemplateConfig['packageManager']): string {
  switch (packageManager) {
    case 'npm':
      // npm doesn't have built-in parallel execution for workspaces
      // Use concurrently to run api and web dev servers in parallel
      // Quotes are escaped for JSON compatibility
      return 'concurrently \\"npm run -w api dev\\" \\"npm run -w web dev\\"';
    case 'yarn':
      return 'yarn workspaces foreach -A --parallel run dev';
    default:
      return 'pnpm --parallel -r dev';
  }
}

/**
 * Get the recursive workspace run command.
 * Used for running build across all workspaces.
 */
function getWsAllCommand(packageManager: TemplateConfig['packageManager']): string {
  switch (packageManager) {
    case 'npm':
      return 'npm run -ws --if-present';
    case 'yarn':
      return 'yarn workspaces foreach -A run';
    default:
      return 'pnpm -r';
  }
}

/**
 * Get the default DATABASE_URL for the selected database.
 */
function getDatabaseUrl(database: TemplateConfig['database']): string {
  if (database === 'postgresql') {
    return 'postgresql://user:password@localhost:5432/myapp';
  }
  return 'file:./dev.db';
}

/**
 * Get the display-friendly database name.
 */
function getDatabaseDisplay(database: TemplateConfig['database']): string {
  const displayNames: Record<TemplateConfig['database'], string> = {
    sqlite: 'SQLite',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
  };
  return displayNames[database];
}

/**
 * Apply placeholder replacements to template content.
 *
 * Uses replaceAll for fast, simple string replacement.
 * No dependencies, no parsing overhead.
 *
 * @param content - Template content with placeholders
 * @param config - Template configuration
 * @returns Content with placeholders replaced
 */
export function applyPlaceholders(content: string, config: TemplateConfig): string {
  const replacements: Record<string, string> = {
    [PLACEHOLDERS.PROJECT_NAME]: config.projectName,
    [PLACEHOLDERS.PACKAGE_MANAGER]: config.packageManager,
    [PLACEHOLDERS.VELOXTS_VERSION]: VELOXTS_VERSION,
    [PLACEHOLDERS.RUN_CMD]: getRunCommand(config.packageManager),
    [PLACEHOLDERS.WS_API]: getWsApiCommand(config.packageManager),
    [PLACEHOLDERS.DEV_CMD]: getDevCommand(config.packageManager),
    [PLACEHOLDERS.WS_ALL]: getWsAllCommand(config.packageManager),
    [PLACEHOLDERS.API_PORT]: '3030',
    [PLACEHOLDERS.WEB_PORT]: '8080',
    [PLACEHOLDERS.DATABASE_PROVIDER]: config.database,
    [PLACEHOLDERS.DATABASE_URL]: getDatabaseUrl(config.database),
    [PLACEHOLDERS.DATABASE_DISPLAY]: getDatabaseDisplay(config.database),
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Apply placeholders to JSON content (handles proper escaping).
 */
export function applyPlaceholdersToJson(
  content: Record<string, unknown>,
  config: TemplateConfig
): string {
  const jsonString = JSON.stringify(content, null, 2);
  return applyPlaceholders(jsonString, config);
}

// Database adapter versions
const PRISMA_VERSION = '7.2.0';
const PG_VERSION = '8.16.0';

/**
 * Apply database-specific dependency modifications to package.json content.
 *
 * - SQLite: Uses @prisma/adapter-better-sqlite3, better-sqlite3
 * - PostgreSQL: Uses @prisma/adapter-pg, pg, @types/pg
 *
 * @param content - Raw package.json content string
 * @param config - Template configuration with database choice
 * @returns Modified package.json string with correct database dependencies
 */
export function applyDatabaseDependencies(content: string, config: TemplateConfig): string {
  const pkg = JSON.parse(content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  if (config.database === 'postgresql') {
    // Remove SQLite dependencies
    if (pkg.dependencies) {
      delete pkg.dependencies['@prisma/adapter-better-sqlite3'];
      delete pkg.dependencies['better-sqlite3'];
    }

    // Add PostgreSQL dependencies
    pkg.dependencies = pkg.dependencies ?? {};
    pkg.dependencies['@prisma/adapter-pg'] = PRISMA_VERSION;
    pkg.dependencies.pg = PG_VERSION;

    // Add @types/pg to devDependencies
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.devDependencies['@types/pg'] = PG_VERSION;

    // Sort dependencies alphabetically
    if (pkg.dependencies) {
      pkg.dependencies = Object.fromEntries(
        Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b))
      );
    }
    if (pkg.devDependencies) {
      pkg.devDependencies = Object.fromEntries(
        Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b))
      );
    }
  }
  // SQLite is already the default in the source files, no changes needed

  return JSON.stringify(pkg, null, 2);
}

// ============================================================================
// Conditional Content
// ============================================================================

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Conditional block markers for template-specific content.
 * Use these in source files to mark sections that should only appear in certain templates.
 */
export const CONDITIONALS = {
  // Template conditionals
  AUTH_START: '/* @if auth */',
  AUTH_END: '/* @endif auth */',
  DEFAULT_START: '/* @if default */',
  DEFAULT_END: '/* @endif default */',
  TRPC_START: '/* @if trpc */',
  TRPC_END: '/* @endif trpc */',
  REST_START: '/* @if rest */',
  REST_END: '/* @endif rest */',
  // JSX-style template conditionals (wrapped in braces)
  JSX_AUTH_START: '{/* @if auth */}',
  JSX_AUTH_END: '{/* @endif auth */}',
  JSX_DEFAULT_START: '{/* @if default */}',
  JSX_DEFAULT_END: '{/* @endif default */}',
  JSX_TRPC_START: '{/* @if trpc */}',
  JSX_TRPC_END: '{/* @endif trpc */}',
  JSX_REST_START: '{/* @if rest */}',
  JSX_REST_END: '{/* @endif rest */}',
  // Database conditionals
  SQLITE_START: '/* @if sqlite */',
  SQLITE_END: '/* @endif sqlite */',
  POSTGRESQL_START: '/* @if postgresql */',
  POSTGRESQL_END: '/* @endif postgresql */',
  // JSX-style database conditionals
  JSX_SQLITE_START: '{/* @if sqlite */}',
  JSX_SQLITE_END: '{/* @endif sqlite */}',
  JSX_POSTGRESQL_START: '{/* @if postgresql */}',
  JSX_POSTGRESQL_END: '{/* @endif postgresql */}',
} as const;

/** Pre-compiled regex for auth conditional blocks (performance optimization) */
const AUTH_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.AUTH_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.AUTH_END)}`,
  'g'
);

/** Pre-compiled regex for default conditional blocks (performance optimization) */
const DEFAULT_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.DEFAULT_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.DEFAULT_END)}`,
  'g'
);

/** Pre-compiled regex for JSX auth conditional blocks */
const JSX_AUTH_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_AUTH_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_AUTH_END)}`,
  'g'
);

/** Pre-compiled regex for JSX default conditional blocks */
const JSX_DEFAULT_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_DEFAULT_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_DEFAULT_END)}`,
  'g'
);

/** Pre-compiled regex for trpc conditional blocks */
const TRPC_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.TRPC_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.TRPC_END)}`,
  'g'
);

/** Pre-compiled regex for JSX trpc conditional blocks */
const JSX_TRPC_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_TRPC_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_TRPC_END)}`,
  'g'
);

/** Pre-compiled regex for rest conditional blocks (all templates except trpc) */
const REST_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.REST_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.REST_END)}`,
  'g'
);

/** Pre-compiled regex for JSX rest conditional blocks */
const JSX_REST_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_REST_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_REST_END)}`,
  'g'
);

/** Pre-compiled regex for sqlite conditional blocks */
const SQLITE_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.SQLITE_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.SQLITE_END)}`,
  'g'
);

/** Pre-compiled regex for postgresql conditional blocks */
const POSTGRESQL_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.POSTGRESQL_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.POSTGRESQL_END)}`,
  'g'
);

/** Pre-compiled regex for JSX sqlite conditional blocks */
const JSX_SQLITE_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_SQLITE_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_SQLITE_END)}`,
  'g'
);

/** Pre-compiled regex for JSX postgresql conditional blocks */
const JSX_POSTGRESQL_BLOCK_PATTERN = new RegExp(
  `${escapeRegex(CONDITIONALS.JSX_POSTGRESQL_START)}[\\s\\S]*?${escapeRegex(CONDITIONALS.JSX_POSTGRESQL_END)}`,
  'g'
);

/**
 * Process conditional blocks in template content.
 *
 * @param content - Template content with conditional blocks
 * @param config - Template configuration (template type and database)
 * @returns Content with appropriate blocks included/removed
 */
export function processConditionals(content: string, config: TemplateConfig): string {
  let result = content;
  const { template, database } = config;

  // =========================================================================
  // Template conditionals
  // =========================================================================

  // Process auth conditionals (both JS and JSX style)
  if (template === 'auth') {
    // Keep auth content but remove markers
    result = result.replaceAll(CONDITIONALS.AUTH_START, '');
    result = result.replaceAll(CONDITIONALS.AUTH_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_AUTH_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_AUTH_END, '');
  } else {
    // Remove entire auth blocks (for default and trpc templates)
    result = result.replace(AUTH_BLOCK_PATTERN, '');
    result = result.replace(JSX_AUTH_BLOCK_PATTERN, '');
  }

  // Process default conditionals (both JS and JSX style)
  // Note: 'rsc' template uses default-style content (no auth)
  // 'trpc' template has its own @if trpc blocks for tRPC-specific configuration
  if (template === 'spa' || template === 'rsc') {
    // Keep default content but remove markers
    result = result.replaceAll(CONDITIONALS.DEFAULT_START, '');
    result = result.replaceAll(CONDITIONALS.DEFAULT_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_DEFAULT_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_DEFAULT_END, '');
  } else {
    // Remove entire default blocks (for auth and trpc templates)
    result = result.replace(DEFAULT_BLOCK_PATTERN, '');
    result = result.replace(JSX_DEFAULT_BLOCK_PATTERN, '');
  }

  // Process trpc conditionals (both JS and JSX style)
  if (template === 'trpc') {
    // Keep trpc content but remove markers
    result = result.replaceAll(CONDITIONALS.TRPC_START, '');
    result = result.replaceAll(CONDITIONALS.TRPC_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_TRPC_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_TRPC_END, '');
  } else {
    // Remove entire trpc blocks (for spa, auth, rsc templates)
    result = result.replace(TRPC_BLOCK_PATTERN, '');
    result = result.replace(JSX_TRPC_BLOCK_PATTERN, '');
  }

  // Process rest conditionals (both JS and JSX style)
  // REST mode applies to all templates except trpc (spa, auth, rsc)
  if (template !== 'trpc') {
    // Keep rest content but remove markers
    result = result.replaceAll(CONDITIONALS.REST_START, '');
    result = result.replaceAll(CONDITIONALS.REST_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_REST_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_REST_END, '');
  } else {
    // Remove entire rest blocks (for trpc template)
    result = result.replace(REST_BLOCK_PATTERN, '');
    result = result.replace(JSX_REST_BLOCK_PATTERN, '');
  }

  // =========================================================================
  // Database conditionals
  // =========================================================================

  // Process sqlite conditionals
  if (database === 'sqlite') {
    // Keep sqlite content but remove markers
    result = result.replaceAll(CONDITIONALS.SQLITE_START, '');
    result = result.replaceAll(CONDITIONALS.SQLITE_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_SQLITE_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_SQLITE_END, '');
  } else {
    // Remove entire sqlite blocks
    result = result.replace(SQLITE_BLOCK_PATTERN, '');
    result = result.replace(JSX_SQLITE_BLOCK_PATTERN, '');
  }

  // Process postgresql conditionals
  if (database === 'postgresql') {
    // Keep postgresql content but remove markers
    result = result.replaceAll(CONDITIONALS.POSTGRESQL_START, '');
    result = result.replaceAll(CONDITIONALS.POSTGRESQL_END, '');
    result = result.replaceAll(CONDITIONALS.JSX_POSTGRESQL_START, '');
    result = result.replaceAll(CONDITIONALS.JSX_POSTGRESQL_END, '');
  } else {
    // Remove entire postgresql blocks
    result = result.replace(POSTGRESQL_BLOCK_PATTERN, '');
    result = result.replace(JSX_POSTGRESQL_BLOCK_PATTERN, '');
  }

  return result;
}
