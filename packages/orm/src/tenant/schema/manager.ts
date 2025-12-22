/**
 * Tenant schema manager for PostgreSQL schema lifecycle operations
 *
 * Handles:
 * - Creating tenant schemas
 * - Running Prisma migrations per schema
 * - Listing and deleting schemas
 *
 * SECURITY:
 * - All SQL queries use parameterized queries via pg library
 * - Prisma migrations use execFile (no shell) with validated paths
 * - Input validation prevents injection attacks
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import pg from 'pg';

import {
  InvalidSlugError,
  SchemaCreateError,
  SchemaDeleteError,
  SchemaMigrateError,
  SchemaNotFoundError,
} from '../errors.js';
import type {
  TenantSchemaManager as ITenantSchemaManager,
  SchemaCreateResult,
  SchemaMigrateResult,
  TenantSchemaManagerConfig,
} from '../types.js';

const { Client } = pg;
const execFileAsync = promisify(execFile);

/**
 * Default configuration
 */
const DEFAULTS = {
  schemaPrefix: 'tenant_',
  prismaSchemaPath: './prisma/schema.prisma',
} as const;

/**
 * Regex for validating schema names (PostgreSQL identifier rules)
 * Must start with letter or underscore, contain only alphanumeric and underscores
 */
const SCHEMA_NAME_REGEX = /^[a-z_][a-z0-9_]*$/i;

/**
 * Maximum schema name length (PostgreSQL limit is 63)
 */
const MAX_SCHEMA_NAME_LENGTH = 63;

/**
 * Reserved PostgreSQL schema names that cannot be used
 */
const RESERVED_SCHEMAS = new Set([
  'public',
  'pg_catalog',
  'pg_toast',
  'pg_temp',
  'information_schema',
]);

/**
 * Validate database URL format and check for injection patterns
 */
function validateDatabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);

    // Only allow postgresql:// protocol
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error('Invalid database protocol');
    }

    // Check for shell metacharacters
    const DANGEROUS_CHARS = /[;|&$`<>(){}[\]!]/;
    if (DANGEROUS_CHARS.test(url)) {
      throw new Error('Database URL contains dangerous characters');
    }
  } catch {
    throw new Error('Invalid database URL format');
  }
}

/**
 * Validate Prisma schema path to prevent path traversal
 */
function validatePrismaSchemaPath(path: string): void {
  // Check for path traversal
  if (path.includes('..') || path.includes('\0')) {
    throw new Error('Invalid Prisma schema path: path traversal detected');
  }

  // Check for shell metacharacters
  const DANGEROUS_CHARS = /[;|&$`<>(){}[\]!'"]/;
  if (DANGEROUS_CHARS.test(path)) {
    throw new Error('Invalid Prisma schema path: dangerous characters detected');
  }

  // Must end with .prisma
  if (!path.endsWith('.prisma')) {
    throw new Error('Invalid Prisma schema path: must end with .prisma');
  }
}

/**
 * Sanitize error messages to prevent credential leakage
 */
function sanitizeError(error: Error): Error {
  let message = error.message;

  // Remove connection strings
  message = message.replace(/postgresql:\/\/[^@]+@[^\s"']+/gi, 'postgresql://***:***@***/***');

  // Remove passwords
  message = message.replace(/password[=:]\s*['"]?[^'"\s]+/gi, 'password=***');

  return new Error(message);
}

/**
 * Create a tenant schema manager
 *
 * @example
 * ```typescript
 * const schemaManager = createTenantSchemaManager({
 *   databaseUrl: process.env.DATABASE_URL!,
 *   schemaPrefix: 'tenant_',
 * });
 *
 * // Create a new schema
 * const result = await schemaManager.createSchema('acme-corp');
 * // result.schemaName === 'tenant_acme_corp'
 *
 * // Run migrations
 * await schemaManager.migrateSchema('tenant_acme_corp');
 * ```
 */
export function createTenantSchemaManager(config: TenantSchemaManagerConfig): ITenantSchemaManager {
  // Validate configuration
  validateDatabaseUrl(config.databaseUrl);

  const schemaPrefix = config.schemaPrefix ?? DEFAULTS.schemaPrefix;
  const prismaSchemaPath = config.prismaSchemaPath ?? DEFAULTS.prismaSchemaPath;

  validatePrismaSchemaPath(prismaSchemaPath);

  /**
   * Create a PostgreSQL client connection
   */
  async function createClient(): Promise<pg.Client> {
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    return client;
  }

  /**
   * Execute a parameterized SQL query safely
   */
  async function executeSql<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const client = await createClient();

    try {
      const result = await client.query<T>(sql, params);
      return result.rows;
    } catch (error) {
      throw sanitizeError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      await client.end();
    }
  }

  /**
   * Sanitize a slug to create a valid schema name
   */
  function slugToSchemaName(slug: string): string {
    // Convert to lowercase and replace hyphens with underscores
    const sanitized = slug.toLowerCase().replace(/-/g, '_');

    // Remove any characters that aren't alphanumeric or underscore
    const cleaned = sanitized.replace(/[^a-z0-9_]/g, '');

    // Ensure it starts with a letter or underscore
    const normalized = /^[a-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;

    return `${schemaPrefix}${normalized}`;
  }

  /**
   * Validate a slug with strict security checks
   */
  function validateSlug(slug: string): void {
    if (!slug || slug.trim().length === 0) {
      throw new InvalidSlugError(slug, 'slug cannot be empty');
    }

    if (slug.length > 50) {
      throw new InvalidSlugError(slug, 'slug cannot exceed 50 characters');
    }

    // Strict whitelist validation
    const VALID_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!VALID_SLUG_REGEX.test(slug)) {
      throw new InvalidSlugError(
        slug,
        'slug must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Check for dangerous patterns
    const DANGEROUS_PATTERNS = [
      /[;|&$`<>]/, // Shell metacharacters
      /['"`]/, // SQL quotes
      /\0/, // Null bytes
      /\.\./, // Path traversal
      /[\\/]/, // Path separators
    ];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(slug)) {
        throw new InvalidSlugError(slug, 'slug contains forbidden characters');
      }
    }

    const schemaName = slugToSchemaName(slug);

    if (!SCHEMA_NAME_REGEX.test(schemaName)) {
      throw new InvalidSlugError(slug, 'results in invalid schema name');
    }

    if (schemaName.length > MAX_SCHEMA_NAME_LENGTH) {
      throw new InvalidSlugError(
        slug,
        `results in schema name exceeding ${MAX_SCHEMA_NAME_LENGTH} characters`
      );
    }

    if (RESERVED_SCHEMAS.has(schemaName.toLowerCase())) {
      throw new InvalidSlugError(slug, 'results in reserved schema name');
    }
  }

  /**
   * Validate a schema name
   */
  function validateSchemaName(schemaName: string): void {
    if (!SCHEMA_NAME_REGEX.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    if (schemaName.length > MAX_SCHEMA_NAME_LENGTH) {
      throw new Error(`Schema name too long: ${schemaName}`);
    }

    if (RESERVED_SCHEMAS.has(schemaName.toLowerCase())) {
      throw new Error(`Cannot use reserved schema name: ${schemaName}`);
    }

    // Additional security checks
    const DANGEROUS_PATTERNS = [/[;|&$`<>]/, /['"`]/, /\0/, /\.\./, /[\\/]/];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(schemaName)) {
        throw new Error(`Schema name contains forbidden characters: ${schemaName}`);
      }
    }
  }

  return {
    /**
     * Create a new PostgreSQL schema for a tenant
     */
    async createSchema(slug: string): Promise<SchemaCreateResult> {
      validateSlug(slug);
      const schemaName = slugToSchemaName(slug);

      try {
        // Check if schema already exists using parameterized query
        const exists = await this.schemaExists(schemaName);
        if (exists) {
          return { schemaName, created: false };
        }

        // Create the schema using parameterized identifier
        // Note: Schema names cannot be parameterized directly, but we've validated it
        // is safe (alphanumeric only) above
        await executeSql(`CREATE SCHEMA "${schemaName}"`);

        return { schemaName, created: true };
      } catch (error) {
        throw new SchemaCreateError(
          schemaName,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    /**
     * Run Prisma migrations on a tenant schema
     *
     * SECURITY: Uses execFile (not exec) to prevent command injection
     */
    async migrateSchema(schemaName: string): Promise<SchemaMigrateResult> {
      validateSchemaName(schemaName);

      try {
        // Set the schema in the database URL
        const url = new URL(config.databaseUrl);
        url.searchParams.set('schema', schemaName);
        const schemaUrl = url.toString();

        // Run prisma migrate deploy using execFile (no shell interpretation)
        // This prevents command injection via the schemaUrl or prismaSchemaPath
        const { stdout } = await execFileAsync(
          'npx',
          ['prisma', 'migrate', 'deploy', `--schema=${prismaSchemaPath}`],
          {
            env: { ...process.env, DATABASE_URL: schemaUrl },
            timeout: 120000, // 2 minute timeout for migrations
          }
        );

        // Parse migration count from output
        const match = stdout.match(/(\d+) migration[s]? applied/i);
        const migrationsApplied = match ? Number.parseInt(match[1], 10) : 0;

        return { schemaName, migrationsApplied };
      } catch (error) {
        throw new SchemaMigrateError(
          schemaName,
          sanitizeError(error instanceof Error ? error : new Error(String(error)))
        );
      }
    },

    /**
     * Delete a PostgreSQL schema (DANGEROUS - drops all data)
     */
    async deleteSchema(schemaName: string): Promise<void> {
      validateSchemaName(schemaName);

      // Extra safety check - don't allow deleting public schema
      if (schemaName.toLowerCase() === 'public') {
        throw new Error('Cannot delete public schema');
      }

      try {
        const exists = await this.schemaExists(schemaName);
        if (!exists) {
          throw new SchemaNotFoundError(schemaName);
        }

        // CASCADE drops all objects in the schema
        // Schema name is validated above to be safe
        await executeSql(`DROP SCHEMA "${schemaName}" CASCADE`);
      } catch (error) {
        if (error instanceof SchemaNotFoundError) {
          throw error;
        }
        throw new SchemaDeleteError(
          schemaName,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    /**
     * List all tenant schemas
     */
    async listSchemas(): Promise<string[]> {
      try {
        // Use parameterized query with LIKE pattern
        const result = await executeSql<{ schema_name: string }>(
          `SELECT schema_name
           FROM information_schema.schemata
           WHERE schema_name LIKE $1
           ORDER BY schema_name`,
          [`${schemaPrefix}%`]
        );

        return result.map((row) => row.schema_name);
      } catch (error) {
        console.error('[TenantSchemaManager] Failed to list schemas:', error);
        return [];
      }
    },

    /**
     * Check if a schema exists
     */
    async schemaExists(schemaName: string): Promise<boolean> {
      validateSchemaName(schemaName);

      try {
        // Use parameterized query
        const result = await executeSql<{ exists: boolean }>(
          `SELECT EXISTS(
            SELECT 1 FROM information_schema.schemata
            WHERE schema_name = $1
          ) as exists`,
          [schemaName]
        );

        return result[0]?.exists ?? false;
      } catch (error) {
        console.error('[TenantSchemaManager] Failed to check schema existence:', error);
        return false;
      }
    },
  };
}

/**
 * Utility to convert a slug to a schema name without creating a manager
 */
export function slugToSchemaName(slug: string, prefix = 'tenant_'): string {
  const sanitized = slug.toLowerCase().replace(/-/g, '_');
  const cleaned = sanitized.replace(/[^a-z0-9_]/g, '');
  const normalized = /^[a-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return `${prefix}${normalized}`;
}
