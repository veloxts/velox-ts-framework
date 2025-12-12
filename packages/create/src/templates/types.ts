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
 */
export type TemplateType = 'default' | 'auth' | 'trpc';

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
  default: {
    type: 'default',
    label: 'API (Default)',
    description: 'REST API with user CRUD operations',
    hint: 'Basic API setup without authentication',
  },
  auth: {
    type: 'auth',
    label: 'Full Auth',
    description: 'Complete JWT authentication with login, register, guards',
    hint: 'Includes rate limiting, token rotation, password hashing',
  },
  trpc: {
    type: 'trpc',
    label: 'tRPC Hybrid',
    description: 'tRPC + REST hybrid API with end-to-end type safety',
    hint: 'Showcases type-safe frontend-backend communication',
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
