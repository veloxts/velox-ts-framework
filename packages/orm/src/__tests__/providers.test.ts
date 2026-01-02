/**
 * Tests for ORM DI Providers
 *
 * Validates:
 * - Factory providers create correct service instances
 * - registerOrmProviders bulk registration works correctly
 * - registerTenantProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Provider dependencies are correctly resolved
 */

import { Container, Scope } from '@veloxts/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../client.js';
import {
  databaseProvider,
  registerOrmProviders,
  registerTenantProviders,
  tenantClientPoolProvider,
  tenantProvisionerProvider,
  tenantSchemaManagerProvider,
} from '../providers.js';
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
} from '../tokens.js';
import type { DatabaseClient, OrmPluginConfig } from '../types.js';

/**
 * Create a mock Prisma client for testing
 */
function createMockClient(overrides: Partial<DatabaseClient> = {}): DatabaseClient {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ORM DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('databaseProvider', () => {
    it('creates Database from DATABASE_CLIENT', () => {
      const mockClient = createMockClient();
      container.register({ provide: DATABASE_CLIENT, useValue: mockClient });
      container.register(databaseProvider());

      const db = container.resolve(DATABASE);

      expect(db).toBeDefined();
      expect(db.client).toBe(mockClient);
    });

    it('provider has SINGLETON scope', () => {
      const provider = databaseProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      const mockClient = createMockClient();
      container.register({ provide: DATABASE_CLIENT, useValue: mockClient });
      container.register(databaseProvider());

      const db1 = container.resolve(DATABASE);
      const db2 = container.resolve(DATABASE);

      expect(db1).toBe(db2);
    });

    it('creates functional Database that can connect', async () => {
      const mockClient = createMockClient();
      container.register({ provide: DATABASE_CLIENT, useValue: mockClient });
      container.register(databaseProvider());

      const db = container.resolve(DATABASE);
      await db.connect();

      expect(mockClient.$connect).toHaveBeenCalledTimes(1);
      expect(db.isConnected).toBe(true);
    });

    it('database has correct initial state', () => {
      const mockClient = createMockClient();
      container.register({ provide: DATABASE_CLIENT, useValue: mockClient });
      container.register(databaseProvider());

      const db = container.resolve(DATABASE);

      expect(db.isConnected).toBe(false);
      expect(db.status.state).toBe('disconnected');
    });

    it('throws if DATABASE_CLIENT is not registered', () => {
      container.register(databaseProvider());

      expect(() => container.resolve(DATABASE)).toThrow('No provider found for: DATABASE_CLIENT');
    });
  });

  describe('tenantClientPoolProvider', () => {
    it('creates TenantClientPool from config', () => {
      const config = {
        baseDatabaseUrl: 'postgresql://localhost:5432/test',
        createClient: vi.fn().mockReturnValue(createMockClient()),
      };
      container.register({ provide: TENANT_CLIENT_POOL_CONFIG, useValue: config });
      container.register(tenantClientPoolProvider());

      const pool = container.resolve(TENANT_CLIENT_POOL);

      expect(pool).toBeDefined();
      expect(typeof pool.getClient).toBe('function');
      expect(typeof pool.releaseClient).toBe('function');
    });

    it('provider has SINGLETON scope', () => {
      const provider = tenantClientPoolProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      const config = {
        baseDatabaseUrl: 'postgresql://localhost:5432/test',
        createClient: vi.fn().mockReturnValue(createMockClient()),
      };
      container.register({ provide: TENANT_CLIENT_POOL_CONFIG, useValue: config });
      container.register(tenantClientPoolProvider());

      const pool1 = container.resolve(TENANT_CLIENT_POOL);
      const pool2 = container.resolve(TENANT_CLIENT_POOL);

      expect(pool1).toBe(pool2);
    });

    it('throws if TENANT_CLIENT_POOL_CONFIG is not registered', () => {
      container.register(tenantClientPoolProvider());

      expect(() => container.resolve(TENANT_CLIENT_POOL)).toThrow(
        'No provider found for: TENANT_CLIENT_POOL_CONFIG'
      );
    });
  });

  describe('tenantSchemaManagerProvider', () => {
    it('creates TenantSchemaManager from config', () => {
      const config = {
        databaseUrl: 'postgresql://localhost:5432/test',
      };
      container.register({ provide: TENANT_SCHEMA_MANAGER_CONFIG, useValue: config });
      container.register(tenantSchemaManagerProvider());

      const schemaManager = container.resolve(TENANT_SCHEMA_MANAGER);

      expect(schemaManager).toBeDefined();
      expect(typeof schemaManager.createSchema).toBe('function');
      expect(typeof schemaManager.deleteSchema).toBe('function');
      expect(typeof schemaManager.schemaExists).toBe('function');
    });

    it('provider has SINGLETON scope', () => {
      const provider = tenantSchemaManagerProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      const config = {
        databaseUrl: 'postgresql://localhost:5432/test',
      };
      container.register({ provide: TENANT_SCHEMA_MANAGER_CONFIG, useValue: config });
      container.register(tenantSchemaManagerProvider());

      const sm1 = container.resolve(TENANT_SCHEMA_MANAGER);
      const sm2 = container.resolve(TENANT_SCHEMA_MANAGER);

      expect(sm1).toBe(sm2);
    });

    it('throws if TENANT_SCHEMA_MANAGER_CONFIG is not registered', () => {
      container.register(tenantSchemaManagerProvider());

      expect(() => container.resolve(TENANT_SCHEMA_MANAGER)).toThrow(
        'No provider found for: TENANT_SCHEMA_MANAGER_CONFIG'
      );
    });
  });

  describe('tenantProvisionerProvider', () => {
    it('creates TenantProvisioner from config', () => {
      const schemaManager = {
        createSchema: vi.fn(),
        deleteSchema: vi.fn(),
        migrateSchema: vi.fn(),
        schemaExists: vi.fn(),
        listSchemas: vi.fn(),
      };
      const clientPool = {
        getClient: vi.fn(),
        releaseClient: vi.fn(),
        hasClient: vi.fn(),
        disconnectAll: vi.fn(),
        close: vi.fn(),
        getStats: vi.fn(),
      };
      const mockPublicClient = createMockClient();

      const config = {
        schemaManager,
        publicClient: mockPublicClient,
        clientPool,
      };

      container.register({ provide: TENANT_PROVISIONER_CONFIG, useValue: config });
      container.register(tenantProvisionerProvider());

      const provisioner = container.resolve(TENANT_PROVISIONER);

      expect(provisioner).toBeDefined();
      expect(typeof provisioner.provision).toBe('function');
      expect(typeof provisioner.deprovision).toBe('function');
    });

    it('provider has SINGLETON scope', () => {
      const provider = tenantProvisionerProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('throws if TENANT_PROVISIONER_CONFIG is not registered', () => {
      container.register(tenantProvisionerProvider());

      expect(() => container.resolve(TENANT_PROVISIONER)).toThrow(
        'No provider found for: TENANT_PROVISIONER_CONFIG'
      );
    });
  });

  describe('registerOrmProviders', () => {
    it('registers all core ORM providers at once', () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      expect(container.isRegistered(DATABASE_CONFIG)).toBe(true);
      expect(container.isRegistered(DATABASE_CLIENT)).toBe(true);
      expect(container.isRegistered(DATABASE)).toBe(true);
    });

    it('config values are accessible from container', () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const dbConfig = container.resolve(DATABASE_CONFIG);
      const dbClient = container.resolve(DATABASE_CLIENT);

      expect(dbConfig).toEqual(config);
      expect(dbClient).toBe(mockClient);
    });

    it('database wrapper is fully functional after bulk registration', async () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const db = container.resolve(DATABASE);

      expect(db.client).toBe(mockClient);
      expect(db.isConnected).toBe(false);

      await db.connect();
      expect(db.isConnected).toBe(true);

      await db.disconnect();
      expect(db.isConnected).toBe(false);
    });

    it('same database instance is returned from DATABASE and used internally', () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const db1 = container.resolve(DATABASE);
      const db2 = container.resolve(DATABASE);

      expect(db1).toBe(db2);
    });
  });

  describe('registerTenantProviders', () => {
    it('registers client pool when config provided', () => {
      const poolConfig = {
        baseDatabaseUrl: 'postgresql://localhost:5432/test',
        createClient: vi.fn().mockReturnValue(createMockClient()),
      };

      registerTenantProviders(container, { clientPool: poolConfig });

      expect(container.isRegistered(TENANT_CLIENT_POOL_CONFIG)).toBe(true);
      expect(container.isRegistered(TENANT_CLIENT_POOL)).toBe(true);
    });

    it('registers schema manager when config provided', () => {
      const schemaConfig = {
        databaseUrl: 'postgresql://localhost:5432/test',
      };

      registerTenantProviders(container, { schemaManager: schemaConfig });

      expect(container.isRegistered(TENANT_SCHEMA_MANAGER_CONFIG)).toBe(true);
      expect(container.isRegistered(TENANT_SCHEMA_MANAGER)).toBe(true);
    });

    it('registers provisioner when config provided', () => {
      const schemaManager = {
        createSchema: vi.fn(),
        deleteSchema: vi.fn(),
        migrateSchema: vi.fn(),
        schemaExists: vi.fn(),
        listSchemas: vi.fn(),
      };
      const clientPool = {
        getClient: vi.fn(),
        releaseClient: vi.fn(),
        hasClient: vi.fn(),
        disconnectAll: vi.fn(),
        close: vi.fn(),
        getStats: vi.fn(),
      };

      const provisionerConfig = {
        schemaManager,
        publicClient: createMockClient(),
        clientPool,
      };

      registerTenantProviders(container, { provisioner: provisionerConfig });

      expect(container.isRegistered(TENANT_PROVISIONER_CONFIG)).toBe(true);
      expect(container.isRegistered(TENANT_PROVISIONER)).toBe(true);
    });

    it('does not register services when configs not provided', () => {
      registerTenantProviders(container, {});

      expect(container.isRegistered(TENANT_CLIENT_POOL_CONFIG)).toBe(false);
      expect(container.isRegistered(TENANT_CLIENT_POOL)).toBe(false);
      expect(container.isRegistered(TENANT_SCHEMA_MANAGER_CONFIG)).toBe(false);
      expect(container.isRegistered(TENANT_SCHEMA_MANAGER)).toBe(false);
      expect(container.isRegistered(TENANT_PROVISIONER_CONFIG)).toBe(false);
      expect(container.isRegistered(TENANT_PROVISIONER)).toBe(false);
    });

    it('registers all tenant services when all configs provided', () => {
      const poolConfig = {
        baseDatabaseUrl: 'postgresql://localhost:5432/test',
        createClient: vi.fn().mockReturnValue(createMockClient()),
      };
      const schemaConfig = {
        databaseUrl: 'postgresql://localhost:5432/test',
      };
      const schemaManager = {
        createSchema: vi.fn(),
        deleteSchema: vi.fn(),
        migrateSchema: vi.fn(),
        schemaExists: vi.fn(),
        listSchemas: vi.fn(),
      };
      const clientPool = {
        getClient: vi.fn(),
        releaseClient: vi.fn(),
        hasClient: vi.fn(),
        disconnectAll: vi.fn(),
        close: vi.fn(),
        getStats: vi.fn(),
      };
      const provisionerConfig = {
        schemaManager,
        publicClient: createMockClient(),
        clientPool,
      };

      registerTenantProviders(container, {
        clientPool: poolConfig,
        schemaManager: schemaConfig,
        provisioner: provisionerConfig,
      });

      expect(container.isRegistered(TENANT_CLIENT_POOL)).toBe(true);
      expect(container.isRegistered(TENANT_SCHEMA_MANAGER)).toBe(true);
      expect(container.isRegistered(TENANT_PROVISIONER)).toBe(true);
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking DATABASE after registration', async () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      // Override with mock
      const mockDatabase: Database<DatabaseClient> = {
        client: mockClient,
        isConnected: true,
        status: { state: 'connected', isConnected: true, connectedAt: new Date() },
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: DATABASE, useValue: mockDatabase });

      const db = container.resolve(DATABASE);

      expect(db.isConnected).toBe(true);
      expect(db).toBe(mockDatabase);
    });

    it('allows mocking DATABASE_CLIENT after registration', () => {
      const originalClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: originalClient };

      registerOrmProviders(container, config);

      // Override with mock
      const mockClient = createMockClient({
        $connect: vi.fn().mockResolvedValue(undefined),
      });

      container.register({ provide: DATABASE_CLIENT, useValue: mockClient });

      const client = container.resolve(DATABASE_CLIENT);

      expect(client).toBe(mockClient);
    });

    it('child container can override parent registrations', () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const childContainer = container.createChild();

      // Override in child
      const childMockClient = createMockClient();
      childContainer.register({ provide: DATABASE_CLIENT, useValue: childMockClient });

      const parentClient = container.resolve(DATABASE_CLIENT);
      const childClient = childContainer.resolve(DATABASE_CLIENT);

      expect(parentClient).toBe(mockClient);
      expect(childClient).toBe(childMockClient);
    });

    it('child container inherits parent registrations', () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const childContainer = container.createChild();

      // Should resolve from parent
      const db = childContainer.resolve(DATABASE);
      const client = childContainer.resolve(DATABASE_CLIENT);

      expect(db).toBeDefined();
      expect(client).toBe(mockClient);
    });
  });

  describe('Provider Injection Dependencies', () => {
    it('databaseProvider injects DATABASE_CLIENT', () => {
      const provider = databaseProvider();

      expect(provider.inject).toContain(DATABASE_CLIENT);
    });

    it('tenantClientPoolProvider injects TENANT_CLIENT_POOL_CONFIG', () => {
      const provider = tenantClientPoolProvider();

      expect(provider.inject).toContain(TENANT_CLIENT_POOL_CONFIG);
    });

    it('tenantSchemaManagerProvider injects TENANT_SCHEMA_MANAGER_CONFIG', () => {
      const provider = tenantSchemaManagerProvider();

      expect(provider.inject).toContain(TENANT_SCHEMA_MANAGER_CONFIG);
    });

    it('tenantProvisionerProvider injects TENANT_PROVISIONER_CONFIG', () => {
      const provider = tenantProvisionerProvider();

      expect(provider.inject).toContain(TENANT_PROVISIONER_CONFIG);
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered token', () => {
      expect(() => container.resolve(DATABASE)).toThrow('No provider found for: DATABASE');
    });

    it('throws when resolving DATABASE without DATABASE_CLIENT', () => {
      container.register(databaseProvider());

      expect(() => container.resolve(DATABASE)).toThrow('No provider found for: DATABASE_CLIENT');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete database flow works with DI-provided services', async () => {
      const mockClient = createMockClient();
      const config: OrmPluginConfig<DatabaseClient> = { client: mockClient };

      registerOrmProviders(container, config);

      const db = container.resolve(DATABASE);

      // Initial state
      expect(db.isConnected).toBe(false);
      expect(db.status.state).toBe('disconnected');

      // Connect
      await db.connect();
      expect(db.isConnected).toBe(true);
      expect(db.status.state).toBe('connected');
      expect(mockClient.$connect).toHaveBeenCalled();

      // Disconnect
      await db.disconnect();
      expect(db.isConnected).toBe(false);
      expect(db.status.state).toBe('disconnected');
      expect(mockClient.$disconnect).toHaveBeenCalled();
    });

    it('multiple containers can have independent service instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      const mockClient1 = createMockClient();
      const mockClient2 = createMockClient();

      registerOrmProviders(container1, { client: mockClient1 });
      registerOrmProviders(container2, { client: mockClient2 });

      const db1 = container1.resolve(DATABASE);
      const db2 = container2.resolve(DATABASE);

      // Different instances
      expect(db1).not.toBe(db2);
      expect(db1.client).not.toBe(db2.client);

      // Both functional independently
      await db1.connect();
      expect(db1.isConnected).toBe(true);
      expect(db2.isConnected).toBe(false);

      await db2.connect();
      expect(db2.isConnected).toBe(true);

      expect(mockClient1.$connect).toHaveBeenCalledTimes(1);
      expect(mockClient2.$connect).toHaveBeenCalledTimes(1);
    });
  });
});
