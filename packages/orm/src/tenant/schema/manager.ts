/**
 * Tenant schema manager for PostgreSQL schema lifecycle operations
 *
 * Handles:
 * - Creating tenant schemas
 * - Running Prisma migrations per schema
 * - Listing and deleting schemas
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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

const execAsync = promisify(exec);

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
  const schemaPrefix = config.schemaPrefix ?? DEFAULTS.schemaPrefix;
  const prismaSchemaPath = config.prismaSchemaPath ?? DEFAULTS.prismaSchemaPath;

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
   * Validate a slug
   */
  function validateSlug(slug: string): void {
    if (!slug || slug.trim().length === 0) {
      throw new InvalidSlugError(slug, 'slug cannot be empty');
    }

    if (slug.length > 50) {
      throw new InvalidSlugError(slug, 'slug cannot exceed 50 characters');
    }

    // Check for path traversal or injection attempts
    if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
      throw new InvalidSlugError(slug, 'slug contains invalid characters');
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
  }

  /**
   * Execute a SQL query using psql
   */
  async function executeSql(sql: string): Promise<string> {
    // Escape single quotes in SQL
    const escapedSql = sql.replace(/'/g, "'\\''");

    try {
      const { stdout } = await execAsync(`psql "${config.databaseUrl}" -c '${escapedSql}' -t -A`, {
        timeout: 30000,
      });
      return stdout.trim();
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
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
        // Check if schema already exists
        const exists = await this.schemaExists(schemaName);
        if (exists) {
          return { schemaName, created: false };
        }

        // Create the schema
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
     */
    async migrateSchema(schemaName: string): Promise<SchemaMigrateResult> {
      validateSchemaName(schemaName);

      try {
        // Set the schema in the database URL
        const url = new URL(config.databaseUrl);
        url.searchParams.set('schema', schemaName);
        const schemaUrl = url.toString();

        // Run prisma migrate deploy
        const { stdout } = await execAsync(
          `DATABASE_URL="${schemaUrl}" npx prisma migrate deploy --schema="${prismaSchemaPath}"`,
          { timeout: 120000 } // 2 minute timeout for migrations
        );

        // Parse migration count from output
        const match = stdout.match(/(\d+) migration[s]? applied/i);
        const migrationsApplied = match ? Number.parseInt(match[1], 10) : 0;

        return { schemaName, migrationsApplied };
      } catch (error) {
        throw new SchemaMigrateError(
          schemaName,
          error instanceof Error ? error : new Error(String(error))
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
        const result = await executeSql(`
          SELECT schema_name
          FROM information_schema.schemata
          WHERE schema_name LIKE '${schemaPrefix}%'
          ORDER BY schema_name
        `);

        if (!result) return [];

        return result
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
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
        const result = await executeSql(`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.schemata
            WHERE schema_name = '${schemaName}'
          )
        `);

        return result === 't' || result === 'true' || result === '1';
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
