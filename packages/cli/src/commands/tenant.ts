/**
 * Tenant command - Multi-tenancy management commands
 *
 * Provides subcommands for managing tenant schemas:
 * - tenant:create - Create a new tenant with PostgreSQL schema
 * - tenant:list - List all tenants
 * - tenant:migrate - Run migrations on tenant schemas
 * - tenant:status - Show tenant status
 * - tenant:suspend - Suspend a tenant
 * - tenant:activate - Activate a suspended tenant
 *
 * SECURITY: All SQL queries use parameterized queries to prevent SQL injection
 */

import * as p from '@clack/prompts';
import {
  createTenantSchemaManager,
  InvalidSlugError,
  slugToSchemaName,
  TenantError,
} from '@veloxts/orm/tenant';
import { Command } from 'commander';
import pg from 'pg';
import pc from 'picocolors';

import { error, info, step, success, warning } from '../utils/output.js';

const { Client } = pg;

// ============================================================================
// Types
// ============================================================================

interface TenantCreateOptions {
  name?: string;
  dryRun: boolean;
  json: boolean;
}

interface TenantListOptions {
  status?: string;
  json: boolean;
}

interface TenantMigrateOptions {
  all: boolean;
  dryRun: boolean;
  json: boolean;
}

interface TenantStatusOptions {
  json: boolean;
}

interface TenantSuspendOptions {
  force: boolean;
  json: boolean;
}

interface TenantActivateOptions {
  json: boolean;
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Security: Input Validation
// ============================================================================

/**
 * Valid tenant statuses
 */
const VALID_STATUSES = new Set(['active', 'suspended', 'pending', 'migrating']);

/**
 * Validate tenant name to prevent SQL injection
 * Names must be alphanumeric with spaces, hyphens, and underscores
 */
function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Name cannot be empty');
  }

  if (name.length > 100) {
    throw new Error('Name cannot exceed 100 characters');
  }

  // Strict whitelist: only allow safe characters
  const SAFE_NAME_REGEX = /^[a-zA-Z0-9\s\-_.']+$/;
  if (!SAFE_NAME_REGEX.test(name)) {
    throw new Error(
      'Name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, periods, and apostrophes are allowed.'
    );
  }
}

/**
 * Validate status filter option
 */
function validateStatus(status: string): void {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${[...VALID_STATUSES].join(', ')}`);
  }
}

/**
 * Validate slug format (additional security check)
 */
function validateSlugInput(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new Error('Slug cannot be empty');
  }

  if (slug.length > 50) {
    throw new Error('Slug cannot exceed 50 characters');
  }

  // Strict whitelist: only lowercase letters, numbers, and hyphens
  const SAFE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  if (!SAFE_SLUG_REGEX.test(slug)) {
    throw new Error(
      'Slug must contain only lowercase letters, numbers, and hyphens, and must start and end with alphanumeric characters.'
    );
  }
}

// ============================================================================
// Security: Database URL Validation
// ============================================================================

/**
 * Validate and sanitize DATABASE_URL
 */
function validateDatabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);

    // Only allow postgresql:// protocol
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      throw new Error('Invalid database protocol. Only postgresql:// is allowed.');
    }

    // Check for shell metacharacters that could indicate injection
    const DANGEROUS_CHARS = /[;|&$`<>(){}[\]!]/;
    if (DANGEROUS_CHARS.test(url)) {
      throw new Error('Database URL contains potentially dangerous characters.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid database')) {
      throw err;
    }
    throw new Error('Invalid DATABASE_URL format');
  }
}

/**
 * Get database URL from environment with validation
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set.\n' +
        'Please set it in your .env file or export it in your shell.'
    );
  }
  validateDatabaseUrl(url);
  return url;
}

// ============================================================================
// Secure Database Operations
// ============================================================================

/**
 * Create a PostgreSQL client connection
 * Ensures proper cleanup even if connect() fails
 */
async function createDbClient(databaseUrl: string): Promise<pg.Client> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    return client;
  } catch (err) {
    // Ensure client is cleaned up even if connect fails
    try {
      await client.end();
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Execute a parameterized SQL query safely
 * Uses pg library with parameterized queries to prevent SQL injection
 */
async function executeQuery<T extends pg.QueryResultRow = TenantRow>(
  databaseUrl: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await createDbClient(databaseUrl);

  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

/**
 * Execute a single-row query
 */
async function executeQuerySingle<T extends pg.QueryResultRow = TenantRow>(
  databaseUrl: string,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await executeQuery<T>(databaseUrl, sql, params);
  return rows[0] ?? null;
}

/**
 * Validate that the tenants table exists in the database
 * Provides a helpful error message if not found
 */
async function validateTenantsTableExists(databaseUrl: string): Promise<void> {
  const result = await executeQuerySingle<{ exists: boolean }>(
    databaseUrl,
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'tenants'
    ) as exists`,
    []
  );

  if (!result?.exists) {
    throw new Error(
      'Tenants table not found in the database.\n' +
        'Please ensure your Prisma schema includes a Tenant model and run migrations:\n' +
        '  npx prisma migrate dev\n' +
        '\nOr create the table manually with the required columns:\n' +
        '  id, slug, name, schema_name, status, created_at, updated_at'
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Format status with color
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'active':
      return pc.green(status);
    case 'suspended':
      return pc.red(status);
    case 'pending':
      return pc.yellow(status);
    case 'migrating':
      return pc.cyan(status);
    default:
      return pc.gray(status);
  }
}

/**
 * Sanitize error messages to prevent credential leakage
 */
function sanitizeErrorMessage(message: string): string {
  // Remove connection strings
  let sanitized = message.replace(
    /postgresql:\/\/[^@]+@[^\s"']+/gi,
    'postgresql://***:***@***/***'
  );

  // Remove passwords
  sanitized = sanitized.replace(/password[=:]\s*['"]?[^'"\s]+/gi, 'password=***');

  return sanitized;
}

// ============================================================================
// tenant:create
// ============================================================================

function createTenantCreateCommand(): Command {
  return new Command('create')
    .description('Create a new tenant with PostgreSQL schema')
    .argument('<slug>', 'URL-safe tenant slug (e.g., acme-corp)')
    .option('-n, --name <name>', 'Human-readable tenant name')
    .option('--dry-run', 'Preview without creating', false)
    .option('--json', 'Output as JSON', false)
    .action(async (slug: string, options: TenantCreateOptions) => {
      try {
        // Validate inputs
        validateSlugInput(slug);
        const name = options.name ?? slug;
        validateName(name);

        const databaseUrl = getDatabaseUrl();
        const schemaManager = createTenantSchemaManager({ databaseUrl });
        const schemaName = slugToSchemaName(slug);

        if (options.dryRun) {
          info(`Would create tenant: ${pc.cyan(slug)}`);
          step(`Schema name: ${pc.cyan(schemaName)}`);
          step(`Display name: ${name}`);
          return;
        }

        // Validate tenants table exists before proceeding
        await validateTenantsTableExists(databaseUrl);

        if (!options.json) {
          info(`Creating tenant: ${pc.cyan(slug)}`);
        }

        const s = p.spinner();
        s.start('Creating PostgreSQL schema...');

        // Create schema
        const schemaResult = await schemaManager.createSchema(slug);

        if (!schemaResult.created) {
          s.stop('Schema already exists');
          warning(`Schema ${schemaName} already exists`);

          if (options.json) {
            console.log(
              JSON.stringify(
                { success: false, error: 'Schema already exists', schemaName },
                null,
                2
              )
            );
          }
          return; // Explicit early return
        }

        // Schema was created, continue with migration
        s.message('Running migrations...');

        // Run migrations
        const migrateResult = await schemaManager.migrateSchema(schemaName);

        s.message('Creating tenant record...');

        // Insert tenant record using parameterized query
        await executeQuery(
          databaseUrl,
          `INSERT INTO tenants (id, slug, name, schema_name, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'active', NOW(), NOW())`,
          [slug, name, schemaName]
        );

        s.stop('Tenant created successfully');

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                success: true,
                tenant: {
                  slug,
                  name,
                  schemaName,
                  status: 'active',
                  migrationsApplied: migrateResult.migrationsApplied,
                },
              },
              null,
              2
            )
          );
        } else {
          success(`Created tenant ${pc.cyan(slug)}`);
          step(`Schema: ${pc.cyan(schemaName)}`);
          step(`Migrations applied: ${migrateResult.migrationsApplied}`);
        }
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          error(err.message);
        } else if (err instanceof TenantError) {
          error(`Tenant error: ${err.message}`);
        } else {
          error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        }
        process.exit(1);
      }
    });
}

// ============================================================================
// tenant:list
// ============================================================================

function createTenantListCommand(): Command {
  return new Command('list')
    .description('List all tenants')
    .option('--status <status>', 'Filter by status (active/suspended/pending)')
    .option('--json', 'Output as JSON', false)
    .action(async (options: TenantListOptions) => {
      try {
        const databaseUrl = getDatabaseUrl();

        // Validate tenants table exists
        await validateTenantsTableExists(databaseUrl);

        // Build query with optional parameterized status filter
        let sql: string;
        let params: unknown[];

        if (options.status) {
          validateStatus(options.status);
          sql =
            'SELECT slug, name, schema_name, status, created_at FROM tenants WHERE status = $1 ORDER BY created_at DESC';
          params = [options.status];
        } else {
          sql =
            'SELECT slug, name, schema_name, status, created_at FROM tenants ORDER BY created_at DESC';
          params = [];
        }

        const tenants = await executeQuery(databaseUrl, sql, params);

        if (tenants.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ tenants: [] }, null, 2));
          } else {
            info('No tenants found');
          }
          return;
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                tenants: tenants.map((t) => ({
                  slug: t.slug,
                  name: t.name,
                  schemaName: t.schema_name,
                  status: t.status,
                  createdAt: t.created_at,
                })),
              },
              null,
              2
            )
          );
        } else {
          console.log('');
          console.log(
            pc.dim(
              '┌─────────────────────┬────────────────────┬────────────┬─────────────────────┐'
            )
          );
          console.log(
            `│ ${pc.bold('Slug')}                │ ${pc.bold('Schema')}             │ ${pc.bold('Status')}     │ ${pc.bold('Created')}             │`
          );
          console.log(
            pc.dim(
              '├─────────────────────┼────────────────────┼────────────┼─────────────────────┤'
            )
          );

          for (const t of tenants) {
            const slug = t.slug.padEnd(19);
            const schema = t.schema_name.padEnd(18);
            const status = formatStatus(t.status).padEnd(20); // Extra padding for color codes
            const created = formatDate(t.created_at);
            console.log(`│ ${slug} │ ${schema} │ ${status} │ ${created} │`);
          }

          console.log(
            pc.dim(
              '└─────────────────────┴────────────────────┴────────────┴─────────────────────┘'
            )
          );
          console.log('');
          info(`Total: ${tenants.length} tenant(s)`);
        }
      } catch (err) {
        error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

// ============================================================================
// tenant:migrate
// ============================================================================

function createTenantMigrateCommand(): Command {
  return new Command('migrate')
    .description('Run migrations on tenant schemas')
    .argument('[slug]', 'Specific tenant to migrate')
    .option('--all', 'Migrate all active tenants', false)
    .option('--dry-run', 'Preview without running migrations', false)
    .option('--json', 'Output as JSON', false)
    .action(async (slug: string | undefined, options: TenantMigrateOptions) => {
      try {
        const databaseUrl = getDatabaseUrl();
        const schemaManager = createTenantSchemaManager({ databaseUrl });

        // Validate tenants table exists
        await validateTenantsTableExists(databaseUrl);

        // Get tenants to migrate using parameterized queries
        let sql: string;
        let params: unknown[];

        if (slug) {
          validateSlugInput(slug);
          sql = 'SELECT slug, schema_name FROM tenants WHERE slug = $1';
          params = [slug];
        } else {
          sql = "SELECT slug, schema_name FROM tenants WHERE status = 'active'";
          params = [];
        }

        const tenants = await executeQuery<{ slug: string; schema_name: string }>(
          databaseUrl,
          sql,
          params
        );

        if (tenants.length === 0) {
          if (slug) {
            error(`Tenant not found: ${slug}`);
            process.exit(1);
          } else {
            info('No active tenants to migrate');
            return;
          }
        }

        if (options.dryRun) {
          info('Would migrate the following tenants:');
          for (const t of tenants) {
            step(`${t.slug} (${t.schema_name})`);
          }
          return;
        }

        const results: Array<{ slug: string; schemaName: string; migrationsApplied: number }> = [];
        const s = p.spinner();

        for (const t of tenants) {
          s.start(`Migrating ${t.slug}...`);

          try {
            // Check current status before updating (prevents concurrent migrations)
            const currentTenant = await executeQuerySingle<{ status: string }>(
              databaseUrl,
              'SELECT status FROM tenants WHERE slug = $1',
              [t.slug]
            );

            if (!currentTenant) {
              s.stop(`Tenant ${t.slug} no longer exists`);
              warning(`Skipping ${t.slug}: tenant not found`);
              continue;
            }

            if (currentTenant.status === 'migrating') {
              s.stop(`Tenant ${t.slug} already migrating`);
              warning(`Skipping ${t.slug}: migration already in progress`);
              continue;
            }

            if (currentTenant.status === 'suspended') {
              s.stop(`Tenant ${t.slug} is suspended`);
              warning(`Skipping ${t.slug}: tenant is suspended`);
              continue;
            }

            // Update status to migrating using parameterized query
            await executeQuery(databaseUrl, 'UPDATE tenants SET status = $1 WHERE slug = $2', [
              'migrating',
              t.slug,
            ]);

            const migrateResult = await schemaManager.migrateSchema(t.schema_name);

            // Update status back to active
            await executeQuery(databaseUrl, 'UPDATE tenants SET status = $1 WHERE slug = $2', [
              'active',
              t.slug,
            ]);

            results.push({
              slug: t.slug,
              schemaName: t.schema_name,
              migrationsApplied: migrateResult.migrationsApplied,
            });

            s.stop(`Migrated ${t.slug}: ${migrateResult.migrationsApplied} migration(s) applied`);
          } catch (err) {
            s.stop(`Failed to migrate ${t.slug}`);
            error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));

            // Restore status (try to set back to active, ignore if it fails)
            try {
              await executeQuery(databaseUrl, 'UPDATE tenants SET status = $1 WHERE slug = $2', [
                'active',
                t.slug,
              ]);
            } catch {
              warning(`Could not restore status for ${t.slug} - may need manual intervention`);
            }
          }
        }

        if (options.json) {
          console.log(JSON.stringify({ results }, null, 2));
        } else {
          console.log('');
          success(`Migrated ${results.length} tenant(s)`);
        }
      } catch (err) {
        error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

// ============================================================================
// tenant:status
// ============================================================================

function createTenantStatusCommand(): Command {
  return new Command('status')
    .description('Show tenant status and schema info')
    .argument('<slug>', 'Tenant slug')
    .option('--json', 'Output as JSON', false)
    .action(async (slug: string, options: TenantStatusOptions) => {
      try {
        validateSlugInput(slug);
        const databaseUrl = getDatabaseUrl();

        // Validate tenants table exists
        await validateTenantsTableExists(databaseUrl);

        // Use parameterized query
        const tenant = await executeQuerySingle(
          databaseUrl,
          `SELECT id, slug, name, schema_name, status, created_at, updated_at
           FROM tenants WHERE slug = $1`,
          [slug]
        );

        if (!tenant) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        // Check if schema exists using parameterized query
        const schemaCheck = await executeQuerySingle<{ exists: boolean }>(
          databaseUrl,
          'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) as exists',
          [tenant.schema_name]
        );

        const tenantInfo = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          schemaName: tenant.schema_name,
          status: tenant.status,
          schemaExists: schemaCheck?.exists ?? false,
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
        };

        if (options.json) {
          console.log(JSON.stringify(tenantInfo, null, 2));
        } else {
          console.log('');
          console.log(`${pc.bold('Tenant:')} ${tenant.name} (${tenant.slug})`);
          console.log(`${pc.bold('Status:')} ${formatStatus(tenant.status)}`);
          console.log(`${pc.bold('Schema:')} ${tenant.schema_name}`);
          console.log(
            `${pc.bold('Schema exists:')} ${tenantInfo.schemaExists ? pc.green('yes') : pc.red('no')}`
          );
          console.log(`${pc.bold('Created:')} ${formatDate(tenant.created_at)}`);
          console.log(`${pc.bold('Updated:')} ${formatDate(tenant.updated_at)}`);
          console.log('');
        }
      } catch (err) {
        error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

// ============================================================================
// tenant:suspend
// ============================================================================

function createTenantSuspendCommand(): Command {
  return new Command('suspend')
    .description('Suspend a tenant (block access)')
    .argument('<slug>', 'Tenant slug to suspend')
    .option('-f, --force', 'Skip confirmation', false)
    .option('--json', 'Output as JSON', false)
    .action(async (slug: string, options: TenantSuspendOptions) => {
      try {
        validateSlugInput(slug);
        const databaseUrl = getDatabaseUrl();

        // Validate tenants table exists
        await validateTenantsTableExists(databaseUrl);

        // Check tenant exists using parameterized query
        const existing = await executeQuerySingle<{ status: string }>(
          databaseUrl,
          'SELECT status FROM tenants WHERE slug = $1',
          [slug]
        );

        if (!existing) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        if (existing.status === 'suspended') {
          warning(`Tenant ${slug} is already suspended`);
          return;
        }

        // Confirm if not forced
        if (!options.force && !options.json) {
          const confirmed = await p.confirm({
            message: `Are you sure you want to suspend tenant ${pc.cyan(slug)}?`,
          });

          if (p.isCancel(confirmed) || !confirmed) {
            info('Cancelled');
            return;
          }
        }

        // Suspend using parameterized query
        await executeQuery(
          databaseUrl,
          'UPDATE tenants SET status = $1, updated_at = NOW() WHERE slug = $2',
          ['suspended', slug]
        );

        if (options.json) {
          console.log(JSON.stringify({ success: true, slug, status: 'suspended' }, null, 2));
        } else {
          success(`Suspended tenant ${pc.cyan(slug)}`);
        }
      } catch (err) {
        error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

// ============================================================================
// tenant:activate
// ============================================================================

function createTenantActivateCommand(): Command {
  return new Command('activate')
    .description('Activate a suspended tenant')
    .argument('<slug>', 'Tenant slug to activate')
    .option('--json', 'Output as JSON', false)
    .action(async (slug: string, options: TenantActivateOptions) => {
      try {
        validateSlugInput(slug);
        const databaseUrl = getDatabaseUrl();

        // Validate tenants table exists
        await validateTenantsTableExists(databaseUrl);

        // Check tenant exists using parameterized query
        const existing = await executeQuerySingle<{ status: string }>(
          databaseUrl,
          'SELECT status FROM tenants WHERE slug = $1',
          [slug]
        );

        if (!existing) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        if (existing.status === 'active') {
          warning(`Tenant ${slug} is already active`);
          return;
        }

        // Activate using parameterized query
        await executeQuery(
          databaseUrl,
          'UPDATE tenants SET status = $1, updated_at = NOW() WHERE slug = $2',
          ['active', slug]
        );

        if (options.json) {
          console.log(JSON.stringify({ success: true, slug, status: 'active' }, null, 2));
        } else {
          success(`Activated tenant ${pc.cyan(slug)}`);
        }
      } catch (err) {
        error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Create the tenant command with subcommands
 */
export function createTenantCommand(): Command {
  const tenant = new Command('tenant')
    .description('Multi-tenancy management commands')
    .addCommand(createTenantCreateCommand())
    .addCommand(createTenantListCommand())
    .addCommand(createTenantMigrateCommand())
    .addCommand(createTenantStatusCommand())
    .addCommand(createTenantSuspendCommand())
    .addCommand(createTenantActivateCommand());

  return tenant;
}
