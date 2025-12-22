import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTenantClientPool } from '../../tenant/client-pool.js';
import { InvalidSlugError, ProvisionError, TenantNotFoundError } from '../../tenant/errors.js';
import { createTenantProvisioner } from '../../tenant/schema/provisioner.js';
import type { Tenant, TenantDatabaseClient, TenantSchemaManager } from '../../tenant/types.js';
import type { DatabaseClient } from '../../types.js';

/**
 * Unit tests for tenant provisioner
 */

// Mock database client
interface MockClient extends DatabaseClient {
  tenant: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

function createMockClient(): MockClient {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function createMockSchemaManager(): TenantSchemaManager {
  return {
    createSchema: vi.fn().mockResolvedValue({ schemaName: 'tenant_test', created: true }),
    migrateSchema: vi.fn().mockResolvedValue({ schemaName: 'tenant_test', migrationsApplied: 3 }),
    deleteSchema: vi.fn().mockResolvedValue(undefined),
    listSchemas: vi.fn().mockResolvedValue(['tenant_test']),
    schemaExists: vi.fn().mockResolvedValue(true),
  };
}

describe('tenant/provisioner', () => {
  let mockClient: MockClient;
  let mockSchemaManager: TenantSchemaManager;
  let clientPool: ReturnType<typeof createTenantClientPool<MockClient>>;

  beforeEach(() => {
    mockClient = createMockClient();
    mockSchemaManager = createMockSchemaManager();
    clientPool = createTenantClientPool<MockClient>({
      baseDatabaseUrl: 'postgresql://localhost/test',
      createClient: () => createMockClient(),
    });
  });

  describe('provision', () => {
    it('should provision a new tenant successfully', async () => {
      const now = new Date();
      const expectedTenant: Tenant = {
        id: 'test-id',
        slug: 'acme-corp',
        name: 'Acme Corporation',
        schemaName: 'tenant_acme_corp',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      mockClient.tenant.findUnique.mockResolvedValue(null); // No existing tenant
      mockClient.tenant.create.mockResolvedValue(expectedTenant);
      mockClient.tenant.update.mockResolvedValue({ ...expectedTenant, status: 'active' });

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const result = await provisioner.provision({
        slug: 'acme-corp',
        name: 'Acme Corporation',
      });

      expect(result.tenant.slug).toBe('acme-corp');
      expect(result.schemaCreated).toBe(true);
      expect(result.migrationsApplied).toBe(3);
      expect(mockSchemaManager.createSchema).toHaveBeenCalledWith('acme-corp');
      expect(mockSchemaManager.migrateSchema).toHaveBeenCalled();
    });

    it('should throw InvalidSlugError for empty slug', async () => {
      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(provisioner.provision({ slug: '', name: 'Test' })).rejects.toThrow(
        InvalidSlugError
      );
    });

    it('should throw InvalidSlugError for slug with invalid characters', async () => {
      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(provisioner.provision({ slug: 'acme@corp!', name: 'Test' })).rejects.toThrow(
        InvalidSlugError
      );
    });

    it('should throw ProvisionError for empty name', async () => {
      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(provisioner.provision({ slug: 'acme', name: '' })).rejects.toThrow(
        ProvisionError
      );
    });

    it('should throw ProvisionError if tenant already exists', async () => {
      mockClient.tenant.findUnique.mockResolvedValue({ id: 'existing' }); // Existing tenant

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(
        provisioner.provision({ slug: 'existing-tenant', name: 'Test' })
      ).rejects.toThrow(ProvisionError);
    });

    it('should rollback on schema creation failure', async () => {
      const now = new Date();
      const createdTenant: Tenant = {
        id: 'test-id',
        slug: 'acme-corp',
        name: 'Acme Corporation',
        schemaName: 'tenant_acme_corp',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      mockClient.tenant.findUnique.mockResolvedValue(null);
      mockClient.tenant.create.mockResolvedValue(createdTenant);
      mockClient.tenant.delete.mockResolvedValue(createdTenant);
      (mockSchemaManager.createSchema as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Schema creation failed')
      );

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(
        provisioner.provision({ slug: 'acme-corp', name: 'Acme Corporation' })
      ).rejects.toThrow(ProvisionError);

      // Should have attempted to delete the tenant record
      expect(mockClient.tenant.delete).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });

    it('should throw InvalidSlugError for slug exceeding 50 characters', async () => {
      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const longSlug = 'a'.repeat(51);
      await expect(provisioner.provision({ slug: longSlug, name: 'Test' })).rejects.toThrow(
        InvalidSlugError
      );
    });
  });

  describe('deprovision', () => {
    it('should deprovision a tenant successfully', async () => {
      const tenant: Tenant = {
        id: 'test-id',
        slug: 'acme-corp',
        name: 'Acme Corporation',
        schemaName: 'tenant_acme_corp',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClient.tenant.findUnique.mockResolvedValue(tenant);
      mockClient.tenant.update.mockResolvedValue({ ...tenant, status: 'suspended' });
      mockClient.tenant.delete.mockResolvedValue(tenant);

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await provisioner.deprovision('test-id');

      expect(mockClient.tenant.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { status: 'suspended' },
      });
      expect(mockSchemaManager.deleteSchema).toHaveBeenCalledWith('tenant_acme_corp');
      expect(mockClient.tenant.delete).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });

    it('should throw TenantNotFoundError if tenant does not exist', async () => {
      mockClient.tenant.findUnique.mockResolvedValue(null);

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      await expect(provisioner.deprovision('unknown-id')).rejects.toThrow(TenantNotFoundError);
    });

    it('should continue if schema deletion fails', async () => {
      const tenant: Tenant = {
        id: 'test-id',
        slug: 'acme-corp',
        name: 'Acme Corporation',
        schemaName: 'tenant_acme_corp',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClient.tenant.findUnique.mockResolvedValue(tenant);
      mockClient.tenant.update.mockResolvedValue({ ...tenant, status: 'suspended' });
      mockClient.tenant.delete.mockResolvedValue(tenant);
      (mockSchemaManager.deleteSchema as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Schema not found')
      );

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      // Should not throw - schema deletion failure is ignored
      await provisioner.deprovision('test-id');

      // Should still delete the tenant record
      expect(mockClient.tenant.delete).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });
  });

  describe('migrateAll', () => {
    it('should migrate all active tenants', async () => {
      const tenants: Tenant[] = [
        {
          id: 't1',
          slug: 'tenant-1',
          name: 'Tenant 1',
          schemaName: 'tenant_tenant_1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't2',
          slug: 'tenant-2',
          name: 'Tenant 2',
          schemaName: 'tenant_tenant_2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClient.tenant.findMany.mockResolvedValue(tenants);
      mockClient.tenant.update.mockResolvedValue({});

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const results = await provisioner.migrateAll();

      expect(results).toHaveLength(2);
      expect(mockSchemaManager.migrateSchema).toHaveBeenCalledTimes(2);
    });

    it('should skip suspended tenants', async () => {
      const tenants: Tenant[] = [
        {
          id: 't1',
          slug: 'active-tenant',
          name: 'Active Tenant',
          schemaName: 'tenant_active',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't2',
          slug: 'suspended-tenant',
          name: 'Suspended Tenant',
          schemaName: 'tenant_suspended',
          status: 'suspended',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClient.tenant.findMany.mockResolvedValue(tenants);
      mockClient.tenant.update.mockResolvedValue({});

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const results = await provisioner.migrateAll();

      expect(results).toHaveLength(1);
      expect(mockSchemaManager.migrateSchema).toHaveBeenCalledWith('tenant_active');
      expect(mockSchemaManager.migrateSchema).not.toHaveBeenCalledWith('tenant_suspended');
    });

    it('should continue on migration failure', async () => {
      const tenants: Tenant[] = [
        {
          id: 't1',
          slug: 'tenant-1',
          name: 'Tenant 1',
          schemaName: 'tenant_1',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't2',
          slug: 'tenant-2',
          name: 'Tenant 2',
          schemaName: 'tenant_2',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClient.tenant.findMany.mockResolvedValue(tenants);
      mockClient.tenant.update.mockResolvedValue({});

      // First migration fails, second succeeds
      (mockSchemaManager.migrateSchema as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Migration failed'))
        .mockResolvedValueOnce({ schemaName: 'tenant_2', migrationsApplied: 1 });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const results = await provisioner.migrateAll();

      // Should only have one successful result
      expect(results).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('type guards', () => {
    it('should work with clients that have tenant model', async () => {
      mockClient.tenant.findUnique.mockResolvedValue(null);
      mockClient.tenant.create.mockResolvedValue({
        id: 'test',
        slug: 'test',
        name: 'Test',
        schemaName: 'tenant_test',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockClient.tenant.update.mockResolvedValue({});

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: mockClient,
        clientPool,
      });

      const result = await provisioner.provision({ slug: 'test', name: 'Test' });
      expect(result.tenant.slug).toBe('test');
    });

    it('should work with clients that have raw query methods', async () => {
      // Client without tenant model but with raw methods
      const rawClient: TenantDatabaseClient = {
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        $queryRaw: vi.fn().mockResolvedValue([{ exists: false }]),
        $executeRaw: vi.fn().mockResolvedValue(1),
      };

      const provisioner = createTenantProvisioner({
        schemaManager: mockSchemaManager,
        publicClient: rawClient,
        clientPool,
      });

      const result = await provisioner.provision({ slug: 'test', name: 'Test' });
      expect(result.tenant.slug).toBe('test');
      expect(rawClient.$executeRaw).toHaveBeenCalled();
    });
  });
});
