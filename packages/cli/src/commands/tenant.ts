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
 */

import * as p from '@clack/prompts';
import {
  createTenantSchemaManager,
  InvalidSlugError,
  slugToSchemaName,
  TenantError,
} from '@veloxts/orm/tenant';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, step, success, warning } from '../utils/output.js';

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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get database URL from environment
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set.\n' +
        'Please set it in your .env file or export it in your shell.'
    );
  }
  return url;
}

/**
 * Execute raw SQL query via psql
 */
async function executeQuery(sql: string, databaseUrl: string): Promise<string> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const escapedSql = sql.replace(/'/g, "'\\''");

  try {
    const { stdout } = await execAsync(`psql "${databaseUrl}" -c '${escapedSql}' -t -A`, {
      timeout: 30000,
    });
    return stdout.trim();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

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
        const databaseUrl = getDatabaseUrl();
        const schemaManager = createTenantSchemaManager({ databaseUrl });
        const schemaName = slugToSchemaName(slug);
        const name = options.name ?? slug;

        if (options.json && !options.dryRun) {
          // Silent mode for JSON output
        } else if (options.dryRun) {
          info(`Would create tenant: ${pc.cyan(slug)}`);
          step(`Schema name: ${pc.cyan(schemaName)}`);
          step(`Display name: ${name}`);
          return;
        } else {
          info(`Creating tenant: ${pc.cyan(slug)}`);
        }

        const s = p.spinner();
        s.start('Creating PostgreSQL schema...');

        // Create schema
        const schemaResult = await schemaManager.createSchema(slug);

        if (!schemaResult.created) {
          s.stop('Schema already exists');
          warning(`Schema ${schemaName} already exists`);
        } else {
          s.message('Running migrations...');

          // Run migrations
          const migrateResult = await schemaManager.migrateSchema(schemaName);

          s.message('Creating tenant record...');

          // Insert tenant record
          const now = new Date().toISOString();
          await executeQuery(
            `INSERT INTO tenants (id, slug, name, schema_name, status, created_at, updated_at)
             VALUES (gen_random_uuid(), '${slug}', '${name}', '${schemaName}', 'active', '${now}', '${now}')`,
            databaseUrl
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
        }
      } catch (err) {
        if (err instanceof InvalidSlugError) {
          error(err.message);
        } else if (err instanceof TenantError) {
          error(`Tenant error: ${err.message}`);
        } else {
          error(err instanceof Error ? err.message : String(err));
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

        let query = 'SELECT slug, name, schema_name, status, created_at FROM tenants';
        if (options.status) {
          query += ` WHERE status = '${options.status}'`;
        }
        query += ' ORDER BY created_at DESC';

        const result = await executeQuery(query, databaseUrl);

        if (!result) {
          if (options.json) {
            console.log(JSON.stringify({ tenants: [] }, null, 2));
          } else {
            info('No tenants found');
          }
          return;
        }

        const tenants = result.split('\n').map((line) => {
          const [slug, name, schemaName, status, createdAt] = line.split('|');
          return { slug, name, schemaName, status, createdAt };
        });

        if (options.json) {
          console.log(JSON.stringify({ tenants }, null, 2));
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
            const schema = t.schemaName.padEnd(18);
            const status = formatStatus(t.status).padEnd(20); // Extra padding for color codes
            const created = formatDate(t.createdAt);
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
        error(err instanceof Error ? err.message : String(err));
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

        // Get tenants to migrate
        let query = "SELECT slug, schema_name FROM tenants WHERE status = 'active'";
        if (slug) {
          query = `SELECT slug, schema_name FROM tenants WHERE slug = '${slug}'`;
        }

        const result = await executeQuery(query, databaseUrl);

        if (!result) {
          if (slug) {
            error(`Tenant not found: ${slug}`);
          } else {
            info('No active tenants to migrate');
          }
          return;
        }

        const tenants = result.split('\n').map((line) => {
          const [tenantSlug, schemaName] = line.split('|');
          return { slug: tenantSlug, schemaName };
        });

        if (options.dryRun) {
          info('Would migrate the following tenants:');
          for (const t of tenants) {
            step(`${t.slug} (${t.schemaName})`);
          }
          return;
        }

        const results: Array<{ slug: string; schemaName: string; migrationsApplied: number }> = [];
        const s = p.spinner();

        for (const t of tenants) {
          s.start(`Migrating ${t.slug}...`);

          try {
            // Update status to migrating
            await executeQuery(
              `UPDATE tenants SET status = 'migrating' WHERE slug = '${t.slug}'`,
              databaseUrl
            );

            const migrateResult = await schemaManager.migrateSchema(t.schemaName);

            // Update status back to active
            await executeQuery(
              `UPDATE tenants SET status = 'active' WHERE slug = '${t.slug}'`,
              databaseUrl
            );

            results.push({
              slug: t.slug,
              schemaName: t.schemaName,
              migrationsApplied: migrateResult.migrationsApplied,
            });

            s.stop(`Migrated ${t.slug}: ${migrateResult.migrationsApplied} migration(s) applied`);
          } catch (err) {
            s.stop(`Failed to migrate ${t.slug}`);
            error(err instanceof Error ? err.message : String(err));

            // Restore status
            await executeQuery(
              `UPDATE tenants SET status = 'active' WHERE slug = '${t.slug}'`,
              databaseUrl
            );
          }
        }

        if (options.json) {
          console.log(JSON.stringify({ results }, null, 2));
        } else {
          console.log('');
          success(`Migrated ${results.length} tenant(s)`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
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
        const databaseUrl = getDatabaseUrl();

        const result = await executeQuery(
          `SELECT id, slug, name, schema_name, status, created_at, updated_at
           FROM tenants WHERE slug = '${slug}'`,
          databaseUrl
        );

        if (!result) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        const [id, tenantSlug, name, schemaName, status, createdAt, updatedAt] = result.split('|');

        // Check if schema exists
        const schemaExists = await executeQuery(
          `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '${schemaName}')`,
          databaseUrl
        );

        const tenant = {
          id,
          slug: tenantSlug,
          name,
          schemaName,
          status,
          schemaExists: schemaExists === 't' || schemaExists === 'true',
          createdAt,
          updatedAt,
        };

        if (options.json) {
          console.log(JSON.stringify(tenant, null, 2));
        } else {
          console.log('');
          console.log(`${pc.bold('Tenant:')} ${name} (${tenantSlug})`);
          console.log(`${pc.bold('Status:')} ${formatStatus(status)}`);
          console.log(`${pc.bold('Schema:')} ${schemaName}`);
          console.log(
            `${pc.bold('Schema exists:')} ${tenant.schemaExists ? pc.green('yes') : pc.red('no')}`
          );
          console.log(`${pc.bold('Created:')} ${formatDate(createdAt)}`);
          console.log(`${pc.bold('Updated:')} ${formatDate(updatedAt)}`);
          console.log('');
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
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
        const databaseUrl = getDatabaseUrl();

        // Check tenant exists
        const existing = await executeQuery(
          `SELECT status FROM tenants WHERE slug = '${slug}'`,
          databaseUrl
        );

        if (!existing) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        if (existing === 'suspended') {
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

        // Suspend
        await executeQuery(
          `UPDATE tenants SET status = 'suspended', updated_at = '${new Date().toISOString()}' WHERE slug = '${slug}'`,
          databaseUrl
        );

        if (options.json) {
          console.log(JSON.stringify({ success: true, slug, status: 'suspended' }, null, 2));
        } else {
          success(`Suspended tenant ${pc.cyan(slug)}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
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
        const databaseUrl = getDatabaseUrl();

        // Check tenant exists
        const existing = await executeQuery(
          `SELECT status FROM tenants WHERE slug = '${slug}'`,
          databaseUrl
        );

        if (!existing) {
          error(`Tenant not found: ${slug}`);
          process.exit(1);
        }

        if (existing === 'active') {
          warning(`Tenant ${slug} is already active`);
          return;
        }

        // Activate
        await executeQuery(
          `UPDATE tenants SET status = 'active', updated_at = '${new Date().toISOString()}' WHERE slug = '${slug}'`,
          databaseUrl
        );

        if (options.json) {
          console.log(JSON.stringify({ success: true, slug, status: 'active' }, null, 2));
        } else {
          success(`Activated tenant ${pc.cyan(slug)}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
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
