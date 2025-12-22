/**
 * Tenant provisioner for creating and managing tenant lifecycle
 *
 * Orchestrates:
 * - Creating tenant records in public schema
 * - Creating PostgreSQL schemas
 * - Running migrations
 * - Cleanup on failure
 */

import type { DatabaseClient } from '../../types.js';
import {
  DeprovisionError,
  InvalidSlugError,
  ProvisionError,
  TenantNotFoundError,
} from '../errors.js';
import type {
  TenantProvisioner as ITenantProvisioner,
  SchemaMigrateResult,
  Tenant,
  TenantProvisionerConfig,
  TenantProvisionInput,
  TenantProvisionResult,
} from '../types.js';
import { slugToSchemaName } from './manager.js';

/**
 * Create a tenant provisioner
 *
 * @example
 * ```typescript
 * const provisioner = createTenantProvisioner({
 *   schemaManager,
 *   publicClient: publicDb,
 *   clientPool,
 * });
 *
 * // Provision a new tenant
 * const result = await provisioner.provision({
 *   slug: 'acme-corp',
 *   name: 'Acme Corporation',
 * });
 *
 * console.log(result.tenant.schemaName); // 'tenant_acme_corp'
 * ```
 */
export function createTenantProvisioner<TClient extends DatabaseClient>(
  config: TenantProvisionerConfig<TClient>
): ITenantProvisioner {
  const { schemaManager, publicClient, clientPool } = config;

  /**
   * Validate provision input
   */
  function validateInput(input: TenantProvisionInput): void {
    if (!input.slug || input.slug.trim().length === 0) {
      throw new InvalidSlugError(input.slug || '', 'slug is required');
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new ProvisionError(input.slug, new Error('name is required'));
    }

    // Basic slug validation
    if (!/^[a-z0-9-]+$/i.test(input.slug)) {
      throw new InvalidSlugError(
        input.slug,
        'slug must contain only letters, numbers, and hyphens'
      );
    }

    if (input.slug.length > 50) {
      throw new InvalidSlugError(input.slug, 'slug cannot exceed 50 characters');
    }
  }

  /**
   * Check if a tenant with this slug already exists
   */
  async function tenantExists(slug: string): Promise<boolean> {
    // Use raw query to check existence
    // This assumes the public schema has a 'tenants' table
    const db = publicClient as DatabaseClient & {
      tenant?: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> };
      $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
    };

    if (db.tenant?.findUnique) {
      const existing = await db.tenant.findUnique({ where: { slug } });
      return existing !== null;
    }

    // Fallback: try raw query
    if (db.$queryRaw) {
      const result = await db.$queryRaw<{ exists: boolean }>`
        SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = ${slug}) as exists
      `;
      return result[0]?.exists ?? false;
    }

    return false;
  }

  /**
   * Create tenant record in public schema
   */
  async function createTenantRecord(
    input: TenantProvisionInput,
    schemaName: string
  ): Promise<Tenant> {
    const db = publicClient as DatabaseClient & {
      tenant?: {
        create: (args: {
          data: {
            slug: string;
            name: string;
            schemaName: string;
            status: string;
          };
        }) => Promise<Tenant>;
      };
      $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
      $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
    };

    const now = new Date();

    if (db.tenant?.create) {
      return db.tenant.create({
        data: {
          slug: input.slug,
          name: input.name,
          schemaName,
          status: 'pending',
        },
      });
    }

    // Fallback: raw query
    if (db.$executeRaw && db.$queryRaw) {
      const id = crypto.randomUUID();

      await db.$executeRaw`
        INSERT INTO tenants (id, slug, name, schema_name, status, created_at, updated_at)
        VALUES (${id}, ${input.slug}, ${input.name}, ${schemaName}, 'pending', ${now}, ${now})
      `;

      return {
        id,
        slug: input.slug,
        name: input.name,
        schemaName,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
    }

    throw new Error('Unable to create tenant record: no compatible method found');
  }

  /**
   * Update tenant status
   */
  async function updateTenantStatus(
    tenantId: string,
    status: 'active' | 'suspended' | 'pending' | 'migrating'
  ): Promise<void> {
    const db = publicClient as DatabaseClient & {
      tenant?: {
        update: (args: { where: { id: string }; data: { status: string } }) => Promise<unknown>;
      };
      $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
    };

    if (db.tenant?.update) {
      await db.tenant.update({
        where: { id: tenantId },
        data: { status },
      });
      return;
    }

    if (db.$executeRaw) {
      await db.$executeRaw`
        UPDATE tenants SET status = ${status}, updated_at = ${new Date()} WHERE id = ${tenantId}
      `;
      return;
    }

    throw new Error('Unable to update tenant status: no compatible method found');
  }

  /**
   * Delete tenant record
   */
  async function deleteTenantRecord(tenantId: string): Promise<void> {
    const db = publicClient as DatabaseClient & {
      tenant?: {
        delete: (args: { where: { id: string } }) => Promise<unknown>;
      };
      $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
    };

    if (db.tenant?.delete) {
      await db.tenant.delete({ where: { id: tenantId } });
      return;
    }

    if (db.$executeRaw) {
      await db.$executeRaw`DELETE FROM tenants WHERE id = ${tenantId}`;
      return;
    }

    throw new Error('Unable to delete tenant record: no compatible method found');
  }

  /**
   * Get tenant by ID
   */
  async function getTenant(tenantId: string): Promise<Tenant | null> {
    const db = publicClient as DatabaseClient & {
      tenant?: {
        findUnique: (args: { where: { id: string } }) => Promise<Tenant | null>;
      };
      $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
    };

    if (db.tenant?.findUnique) {
      return db.tenant.findUnique({ where: { id: tenantId } });
    }

    if (db.$queryRaw) {
      const result = await db.$queryRaw<Tenant>`
        SELECT * FROM tenants WHERE id = ${tenantId} LIMIT 1
      `;
      return result[0] ?? null;
    }

    return null;
  }

  /**
   * Get all tenants
   */
  async function getAllTenants(): Promise<Tenant[]> {
    const db = publicClient as DatabaseClient & {
      tenant?: {
        findMany: () => Promise<Tenant[]>;
      };
      $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
    };

    if (db.tenant?.findMany) {
      return db.tenant.findMany();
    }

    if (db.$queryRaw) {
      return db.$queryRaw<Tenant>`SELECT * FROM tenants`;
    }

    return [];
  }

  return {
    /**
     * Provision a new tenant
     */
    async provision(input: TenantProvisionInput): Promise<TenantProvisionResult> {
      validateInput(input);

      const schemaName = slugToSchemaName(input.slug);
      let tenant: Tenant | null = null;
      let schemaCreated = false;

      try {
        // Check for existing tenant
        const exists = await tenantExists(input.slug);
        if (exists) {
          throw new Error(`Tenant with slug '${input.slug}' already exists`);
        }

        // 1. Create tenant record (status: pending)
        tenant = await createTenantRecord(input, schemaName);

        // 2. Create PostgreSQL schema
        const schemaResult = await schemaManager.createSchema(input.slug);
        schemaCreated = schemaResult.created;

        // 3. Update status to migrating
        await updateTenantStatus(tenant.id, 'migrating');

        // 4. Run migrations
        const migrateResult = await schemaManager.migrateSchema(schemaName);

        // 5. Test connection via client pool
        await clientPool.getClient(schemaName);
        clientPool.releaseClient(schemaName);

        // 6. Update status to active
        await updateTenantStatus(tenant.id, 'active');

        return {
          tenant: { ...tenant, status: 'active' },
          schemaCreated,
          migrationsApplied: migrateResult.migrationsApplied,
        };
      } catch (error) {
        // Rollback on failure
        if (tenant) {
          try {
            await deleteTenantRecord(tenant.id);
          } catch {
            // Ignore cleanup errors
          }
        }

        if (schemaCreated) {
          try {
            await schemaManager.deleteSchema(schemaName);
          } catch {
            // Ignore cleanup errors
          }
        }

        throw new ProvisionError(
          input.slug,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    /**
     * Deprovision a tenant (delete schema and record)
     */
    async deprovision(tenantId: string): Promise<void> {
      const tenant = await getTenant(tenantId);

      if (!tenant) {
        throw new TenantNotFoundError(tenantId);
      }

      try {
        // 1. Update status to suspended first
        await updateTenantStatus(tenantId, 'suspended');

        // 2. Delete the schema
        try {
          await schemaManager.deleteSchema(tenant.schemaName);
        } catch {
          // Schema might not exist - continue with record deletion
        }

        // 3. Delete the tenant record
        await deleteTenantRecord(tenantId);
      } catch (error) {
        if (error instanceof TenantNotFoundError) {
          throw error;
        }
        throw new DeprovisionError(
          tenantId,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    /**
     * Migrate all tenant schemas
     */
    async migrateAll(): Promise<SchemaMigrateResult[]> {
      const tenants = await getAllTenants();
      const results: SchemaMigrateResult[] = [];

      for (const tenant of tenants) {
        if (tenant.status !== 'active' && tenant.status !== 'pending') {
          continue; // Skip suspended/migrating tenants
        }

        try {
          await updateTenantStatus(tenant.id, 'migrating');
          const result = await schemaManager.migrateSchema(tenant.schemaName);
          results.push(result);
          await updateTenantStatus(tenant.id, 'active');
        } catch (error) {
          console.error(`[TenantProvisioner] Failed to migrate ${tenant.schemaName}:`, error);
          // Continue with other tenants
        }
      }

      return results;
    },
  };
}
