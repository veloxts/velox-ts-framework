/**
 * DI Providers for @veloxts/orm
 *
 * Factory provider functions for registering ORM services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module orm/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerOrmProviders, DATABASE, DATABASE_CLIENT } from '@veloxts/orm';
 *
 * const container = new Container();
 * registerOrmProviders(container, { client: prisma });
 *
 * const db = container.resolve(DATABASE);
 * await db.connect();
 * ```
 */

import { type Container, type FactoryProvider, Scope } from '@veloxts/core';

import { createDatabase, type Database } from './client.js';
import { createTenantClientPool } from './tenant/client-pool.js';
import { createTenantSchemaManager } from './tenant/schema/manager.js';
import { createTenantProvisioner } from './tenant/schema/provisioner.js';
import type {
  TenantClientPool,
  TenantClientPoolConfig,
  TenantProvisioner,
  TenantProvisionerConfig,
  TenantSchemaManager,
  TenantSchemaManagerConfig,
} from './tenant/types.js';
import {
  DATABASE,
  DATABASE_CLIENT,
  DATABASE_CONFIG,
  TENANT_CLIENT_POOL,
  TENANT_CLIENT_POOL_CONFIG,
  TENANT_PROVISIONER,
  TENANT_PROVISIONER_CONFIG,
  TENANT_SCHEMA_MANAGER,
  TENANT_SCHEMA_MANAGER_CONFIG,
} from './tokens.js';
import type { DatabaseClient, OrmPluginConfig } from './types.js';

// ============================================================================
// Core Database Providers
// ============================================================================

/**
 * Creates a factory provider for the database wrapper
 *
 * Requires DATABASE_CLIENT to be registered in the container.
 *
 * @example
 * ```typescript
 * container.register({ provide: DATABASE_CLIENT, useValue: prisma });
 * container.register(databaseProvider());
 * const db = container.resolve(DATABASE);
 * ```
 */
export function databaseProvider(): FactoryProvider<Database<DatabaseClient>> {
  return {
    provide: DATABASE,
    useFactory: (client: DatabaseClient) => createDatabase({ client }),
    inject: [DATABASE_CLIENT],
    scope: Scope.SINGLETON,
  };
}

// ============================================================================
// Tenant Providers
// ============================================================================

/**
 * Creates a factory provider for the tenant client pool
 *
 * Requires TENANT_CLIENT_POOL_CONFIG to be registered in the container.
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: TENANT_CLIENT_POOL_CONFIG,
 *   useValue: {
 *     baseDatabaseUrl: process.env.DATABASE_URL,
 *     createClient: (schema) => new PrismaClient({ ... }),
 *   }
 * });
 * container.register(tenantClientPoolProvider());
 * const pool = container.resolve(TENANT_CLIENT_POOL);
 * ```
 */
export function tenantClientPoolProvider(): FactoryProvider<TenantClientPool<DatabaseClient>> {
  return {
    provide: TENANT_CLIENT_POOL,
    useFactory: (config: TenantClientPoolConfig<DatabaseClient>) => createTenantClientPool(config),
    inject: [TENANT_CLIENT_POOL_CONFIG],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for the tenant schema manager
 *
 * Requires TENANT_SCHEMA_MANAGER_CONFIG to be registered in the container.
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: TENANT_SCHEMA_MANAGER_CONFIG,
 *   useValue: { databaseUrl: process.env.DATABASE_URL }
 * });
 * container.register(tenantSchemaManagerProvider());
 * const schemaManager = container.resolve(TENANT_SCHEMA_MANAGER);
 * ```
 */
export function tenantSchemaManagerProvider(): FactoryProvider<TenantSchemaManager> {
  return {
    provide: TENANT_SCHEMA_MANAGER,
    useFactory: (config: TenantSchemaManagerConfig) => createTenantSchemaManager(config),
    inject: [TENANT_SCHEMA_MANAGER_CONFIG],
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a factory provider for the tenant provisioner
 *
 * Requires TENANT_PROVISIONER_CONFIG to be registered in the container.
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: TENANT_PROVISIONER_CONFIG,
 *   useValue: {
 *     schemaManager: container.resolve(TENANT_SCHEMA_MANAGER),
 *     publicClient: prisma,
 *     clientPool: container.resolve(TENANT_CLIENT_POOL),
 *   }
 * });
 * container.register(tenantProvisionerProvider());
 * const provisioner = container.resolve(TENANT_PROVISIONER);
 * ```
 */
export function tenantProvisionerProvider(): FactoryProvider<TenantProvisioner> {
  return {
    provide: TENANT_PROVISIONER,
    useFactory: (config: TenantProvisionerConfig<DatabaseClient>) =>
      createTenantProvisioner(config),
    inject: [TENANT_PROVISIONER_CONFIG],
    scope: Scope.SINGLETON,
  };
}

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers core ORM providers with a container
 *
 * This registers the database client and wrapper for basic ORM usage.
 * For multi-tenant scenarios, use `registerTenantProviders` as well.
 *
 * @param container - The DI container to register providers with
 * @param config - ORM plugin configuration with Prisma client
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerOrmProviders, DATABASE, DATABASE_CLIENT } from '@veloxts/orm';
 *
 * const container = new Container();
 * registerOrmProviders(container, { client: prisma });
 *
 * const db = container.resolve(DATABASE);
 * const client = container.resolve(DATABASE_CLIENT);
 * ```
 */
export function registerOrmProviders(
  container: Container,
  config: OrmPluginConfig<DatabaseClient>
): void {
  // Register config
  container.register({
    provide: DATABASE_CONFIG,
    useValue: config,
  });

  // Register database client
  container.register({
    provide: DATABASE_CLIENT,
    useValue: config.client,
  });

  // Register database wrapper provider
  container.register(databaseProvider());
}

/**
 * Registers tenant providers with a container
 *
 * Use this for multi-tenant scenarios after calling `registerOrmProviders`.
 *
 * @param container - The DI container to register providers with
 * @param config - Tenant configuration options
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import {
 *   registerOrmProviders,
 *   registerTenantProviders,
 *   TENANT_CLIENT_POOL,
 *   TENANT_SCHEMA_MANAGER,
 * } from '@veloxts/orm';
 *
 * const container = new Container();
 *
 * // Register core ORM
 * registerOrmProviders(container, { client: prisma });
 *
 * // Register tenant providers
 * registerTenantProviders(container, {
 *   clientPool: {
 *     baseDatabaseUrl: process.env.DATABASE_URL!,
 *     createClient: (schema) => createPrismaClient(schema),
 *   },
 *   schemaManager: {
 *     databaseUrl: process.env.DATABASE_URL!,
 *   },
 * });
 *
 * const pool = container.resolve(TENANT_CLIENT_POOL);
 * const schemaManager = container.resolve(TENANT_SCHEMA_MANAGER);
 * ```
 */
export function registerTenantProviders(
  container: Container,
  config: {
    clientPool?: TenantClientPoolConfig<DatabaseClient>;
    schemaManager?: TenantSchemaManagerConfig;
    provisioner?: TenantProvisionerConfig<DatabaseClient>;
  }
): void {
  // Register client pool if config provided
  if (config.clientPool) {
    container.register({
      provide: TENANT_CLIENT_POOL_CONFIG,
      useValue: config.clientPool,
    });
    container.register(tenantClientPoolProvider());
  }

  // Register schema manager if config provided
  if (config.schemaManager) {
    container.register({
      provide: TENANT_SCHEMA_MANAGER_CONFIG,
      useValue: config.schemaManager,
    });
    container.register(tenantSchemaManagerProvider());
  }

  // Register provisioner if config provided
  if (config.provisioner) {
    container.register({
      provide: TENANT_PROVISIONER_CONFIG,
      useValue: config.provisioner,
    });
    container.register(tenantProvisionerProvider());
  }
}
