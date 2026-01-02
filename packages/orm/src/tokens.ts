/**
 * DI Tokens for @veloxts/orm
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow services to be registered, resolved, and mocked via the DI container.
 *
 * @module orm/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { DATABASE_CLIENT, DATABASE, registerOrmProviders } from '@veloxts/orm';
 *
 * const container = new Container();
 * registerOrmProviders(container, { client: prisma });
 *
 * const db = container.resolve(DATABASE);
 * const client = container.resolve(DATABASE_CLIENT);
 * ```
 */

import { token } from '@veloxts/core';

import type { Database } from './client.js';
import type {
  TenantClientPool,
  TenantClientPoolConfig,
  TenantMiddlewareConfig,
  TenantProvisioner,
  TenantProvisionerConfig,
  TenantSchemaManager,
  TenantSchemaManagerConfig,
} from './tenant/types.js';
import type { DatabaseClient, OrmPluginConfig } from './types.js';

// ============================================================================
// Core Database Tokens
// ============================================================================

/**
 * Database client token (raw Prisma client)
 *
 * The underlying Prisma client instance used for database queries.
 * This is the client passed to `databasePlugin({ client: ... })`.
 *
 * @example
 * ```typescript
 * const client = container.resolve(DATABASE_CLIENT);
 * const users = await client.user.findMany();
 * ```
 */
export const DATABASE_CLIENT = token.symbol<DatabaseClient>('DATABASE_CLIENT');

/**
 * Database wrapper token (with lifecycle management)
 *
 * The Database wrapper provides connection state tracking and
 * controlled connect/disconnect methods.
 *
 * @example
 * ```typescript
 * const db = container.resolve(DATABASE);
 * await db.connect();
 * console.log(db.isConnected); // true
 * const users = await db.client.user.findMany();
 * ```
 */
export const DATABASE = token.symbol<Database<DatabaseClient>>('DATABASE');

/**
 * ORM plugin configuration token
 *
 * Contains the plugin configuration including the Prisma client.
 */
export const DATABASE_CONFIG = token.symbol<OrmPluginConfig<DatabaseClient>>('DATABASE_CONFIG');

// ============================================================================
// Tenant Tokens - Configuration
// ============================================================================

/**
 * Tenant client pool configuration token
 *
 * Configuration for creating tenant-scoped database clients.
 */
export const TENANT_CLIENT_POOL_CONFIG = token.symbol<TenantClientPoolConfig<DatabaseClient>>(
  'TENANT_CLIENT_POOL_CONFIG'
);

/**
 * Tenant schema manager configuration token
 *
 * Configuration for PostgreSQL schema management operations.
 */
export const TENANT_SCHEMA_MANAGER_CONFIG = token.symbol<TenantSchemaManagerConfig>(
  'TENANT_SCHEMA_MANAGER_CONFIG'
);

/**
 * Tenant provisioner configuration token
 *
 * Configuration for tenant provisioning operations.
 */
export const TENANT_PROVISIONER_CONFIG = token.symbol<TenantProvisionerConfig<DatabaseClient>>(
  'TENANT_PROVISIONER_CONFIG'
);

/**
 * Tenant middleware configuration token
 *
 * Configuration for tenant middleware including tenant loading and client pool.
 */
export const TENANT_MIDDLEWARE_CONFIG = token.symbol<TenantMiddlewareConfig<DatabaseClient>>(
  'TENANT_MIDDLEWARE_CONFIG'
);

// ============================================================================
// Tenant Tokens - Services
// ============================================================================

/**
 * Tenant client pool token
 *
 * Pool of tenant-scoped database clients for schema-per-tenant isolation.
 *
 * @example
 * ```typescript
 * const pool = container.resolve(TENANT_CLIENT_POOL);
 * const client = await pool.getClient('tenant_acme_corp');
 * ```
 */
export const TENANT_CLIENT_POOL =
  token.symbol<TenantClientPool<DatabaseClient>>('TENANT_CLIENT_POOL');

/**
 * Tenant schema manager token
 *
 * Manages PostgreSQL schemas for tenant isolation.
 *
 * @example
 * ```typescript
 * const schemaManager = container.resolve(TENANT_SCHEMA_MANAGER);
 * await schemaManager.createSchema('acme-corp');
 * ```
 */
export const TENANT_SCHEMA_MANAGER = token.symbol<TenantSchemaManager>('TENANT_SCHEMA_MANAGER');

/**
 * Tenant provisioner token
 *
 * Handles full tenant lifecycle: creation, migration, and deprovisioning.
 *
 * @example
 * ```typescript
 * const provisioner = container.resolve(TENANT_PROVISIONER);
 * const result = await provisioner.provision({ slug: 'acme-corp', name: 'Acme Corp' });
 * ```
 */
export const TENANT_PROVISIONER = token.symbol<TenantProvisioner>('TENANT_PROVISIONER');

// ============================================================================
// Public Database Token (for multi-tenant scenarios)
// ============================================================================

/**
 * Public database client token (shared schema)
 *
 * In multi-tenant scenarios, this token represents the public schema client
 * used for shared data like tenant records, user lookups, etc.
 *
 * @example
 * ```typescript
 * const publicDb = container.resolve(PUBLIC_DATABASE_CLIENT);
 * const tenant = await publicDb.tenant.findUnique({ where: { id } });
 * ```
 */
export const PUBLIC_DATABASE_CLIENT = token.symbol<DatabaseClient>('PUBLIC_DATABASE_CLIENT');
