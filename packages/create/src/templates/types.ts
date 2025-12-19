/**
 * Template Types
 *
 * Shared types for the create-velox-app template system.
 */

// ============================================================================
// Template Types
// ============================================================================

/**
 * Available template types
 *
 * - `spa` (alias: `default`) - Monorepo with separate SPA frontend and API backend
 * - `auth` - SPA + API with JWT authentication
 * - `trpc` - SPA + API with tRPC integration
 * - `rsc` (alias: `fullstack`) - React Server Components with Vinxi
 */
export type TemplateType = 'spa' | 'auth' | 'trpc' | 'rsc';

/**
 * Template aliases for backward compatibility
 */
export const TEMPLATE_ALIASES: Record<string, TemplateType> = {
  default: 'spa',
  fullstack: 'rsc',
};

/**
 * Resolve a template name (including aliases) to a canonical template type
 */
export function resolveTemplateAlias(template: string): TemplateType | undefined {
  if (template in TEMPLATE_ALIASES) {
    return TEMPLATE_ALIASES[template];
  }
  if (isValidTemplate(template)) {
    return template as TemplateType;
  }
  return undefined;
}

/**
 * Available database types
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql';

/**
 * Database metadata for CLI display
 */
export interface DatabaseMetadata {
  type: DatabaseType;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Available databases with metadata
 */
export const DATABASE_METADATA: Record<DatabaseType, DatabaseMetadata> = {
  sqlite: {
    type: 'sqlite',
    label: 'SQLite',
    hint: 'File-based, zero setup (recommended for development)',
  },
  postgresql: {
    type: 'postgresql',
    label: 'PostgreSQL',
    hint: 'Coming soon - requires running PostgreSQL server',
    disabled: true,
  },
  mysql: {
    type: 'mysql',
    label: 'MySQL',
    hint: 'Coming soon - requires running MySQL server',
    disabled: true,
  },
};

/**
 * Get all available database options
 */
export function getAvailableDatabases(): DatabaseMetadata[] {
  return Object.values(DATABASE_METADATA);
}

/**
 * Check if a database type is valid
 */
export function isValidDatabase(database: string): database is DatabaseType {
  return database in DATABASE_METADATA;
}

/**
 * Check if a database type is available (not disabled)
 */
export function isDatabaseAvailable(database: DatabaseType): boolean {
  return !DATABASE_METADATA[database].disabled;
}

/**
 * Template metadata for CLI display
 */
export interface TemplateMetadata {
  type: TemplateType;
  label: string;
  description: string;
  hint?: string;
}

/**
 * Template configuration passed to generator functions
 */
export interface TemplateConfig {
  projectName: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  template: TemplateType;
  database: DatabaseType;
}

/**
 * Interface for template generators
 */
export interface TemplateGenerator {
  /**
   * Generate all files for this template
   */
  generateFiles(config: TemplateConfig): TemplateFile[];
}

/**
 * A single template file to be written
 */
export interface TemplateFile {
  /**
   * Relative path from project root (e.g., 'src/index.ts')
   */
  path: string;
  /**
   * File content
   */
  content: string;
}

// ============================================================================
// Template Registry
// ============================================================================

/**
 * Available templates with their metadata
 */
export const TEMPLATE_METADATA: Record<TemplateType, TemplateMetadata> = {
  spa: {
    type: 'spa',
    label: 'SPA + API',
    description: 'Monorepo with SPA frontend and REST API backend',
    hint: 'Separate builds for frontend (Vite) and backend (Fastify)',
  },
  auth: {
    type: 'auth',
    label: 'SPA + Auth',
    description: 'SPA + API with JWT authentication, guards, and sessions',
    hint: 'Includes rate limiting, token rotation, password hashing',
  },
  trpc: {
    type: 'trpc',
    label: 'SPA + tRPC',
    description: 'SPA + API with tRPC for end-to-end type safety',
    hint: 'Type-safe frontend-backend calls without REST boilerplate',
  },
  rsc: {
    type: 'rsc',
    label: 'RSC Full-Stack',
    description: 'React Server Components with Vinxi + embedded Fastify',
    hint: 'Unified server/client with file-based routing and streaming',
  },
};

/**
 * Get all available template types
 */
export function getAvailableTemplates(): TemplateMetadata[] {
  return Object.values(TEMPLATE_METADATA);
}

/**
 * Check if a template type is valid
 */
export function isValidTemplate(template: string): template is TemplateType {
  return template in TEMPLATE_METADATA;
}
