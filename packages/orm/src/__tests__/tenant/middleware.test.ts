import { describe, expect, it, vi } from 'vitest';

import {
  TenantIdMissingError,
  TenantNotFoundError,
  TenantSuspendedError,
} from '../../tenant/errors.js';
import {
  createTenant,
  createTenantMiddleware,
  getTenantOrThrow,
  hasTenant,
} from '../../tenant/middleware.js';
import type { Tenant, TenantClientPool } from '../../tenant/types.js';
import type { DatabaseClient } from '../../types.js';

// Mock tenant
const mockTenant: Tenant = {
  id: 'tenant-123',
  slug: 'acme-corp',
  name: 'Acme Corporation',
  schemaName: 'tenant_acme_corp',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock database client
function createMockClient(): DatabaseClient {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

// Mock client pool
function createMockClientPool(): TenantClientPool<DatabaseClient> {
  const mockClient = createMockClient();
  return {
    getClient: vi.fn().mockResolvedValue(mockClient),
    releaseClient: vi.fn(),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      activeClients: 0,
      maxClients: 50,
      totalCreated: 0,
      totalEvicted: 0,
    }),
  };
}

describe('tenant/middleware', () => {
  describe('createTenantMiddleware', () => {
    it('should add tenant and db to context', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue(mockTenant);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      let capturedCtx: unknown;
      await middleware({
        ctx: {
          auth: { token: { tenantId: 'tenant-123' } },
        },
        next: async ({ ctx }) => {
          capturedCtx = ctx;
        },
      });

      expect(loadTenant).toHaveBeenCalledWith('tenant-123');
      expect(clientPool.getClient).toHaveBeenCalledWith('tenant_acme_corp');
      expect(capturedCtx).toHaveProperty('tenant', mockTenant);
      expect(capturedCtx).toHaveProperty('db');
    });

    it('should include publicDb when configured', async () => {
      const clientPool = createMockClientPool();
      const publicClient = createMockClient();
      const loadTenant = vi.fn().mockResolvedValue(mockTenant);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
        publicClient,
      });

      let capturedCtx: unknown;
      await middleware({
        ctx: {
          auth: { token: { tenantId: 'tenant-123' } },
        },
        next: async ({ ctx }) => {
          capturedCtx = ctx;
        },
      });

      expect(capturedCtx).toHaveProperty('publicDb', publicClient);
    });

    it('should release client after next() completes', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue(mockTenant);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      await middleware({
        ctx: {
          auth: { token: { tenantId: 'tenant-123' } },
        },
        next: async () => {},
      });

      expect(clientPool.releaseClient).toHaveBeenCalledWith('tenant_acme_corp');
    });

    it('should release client even if next() throws', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue(mockTenant);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      await expect(
        middleware({
          ctx: {
            auth: { token: { tenantId: 'tenant-123' } },
          },
          next: async () => {
            throw new Error('Handler error');
          },
        })
      ).rejects.toThrow('Handler error');

      expect(clientPool.releaseClient).toHaveBeenCalledWith('tenant_acme_corp');
    });

    it('should throw TenantIdMissingError when no tenant ID', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn();

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      await expect(
        middleware({
          ctx: {},
          next: async () => {},
        })
      ).rejects.toThrow(TenantIdMissingError);
    });

    it('should allow no tenant when allowNoTenant is true', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn();

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
        allowNoTenant: true,
      });

      let called = false;
      await middleware({
        ctx: {},
        next: async () => {
          called = true;
        },
      });

      expect(called).toBe(true);
      expect(loadTenant).not.toHaveBeenCalled();
    });

    it('should throw TenantNotFoundError when tenant not found', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue(null);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      await expect(
        middleware({
          ctx: {
            auth: { token: { tenantId: 'unknown' } },
          },
          next: async () => {},
        })
      ).rejects.toThrow(TenantNotFoundError);
    });

    it('should throw TenantSuspendedError for suspended tenant', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue({
        ...mockTenant,
        status: 'suspended',
      });

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
      });

      await expect(
        middleware({
          ctx: {
            auth: { token: { tenantId: 'tenant-123' } },
          },
          next: async () => {},
        })
      ).rejects.toThrow(TenantSuspendedError);
    });

    it('should use custom getTenantId when provided', async () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn().mockResolvedValue(mockTenant);

      const middleware = createTenantMiddleware({
        loadTenant,
        clientPool,
        getTenantId: (ctx) => (ctx as { customTenantId?: string }).customTenantId,
      });

      await middleware({
        ctx: { customTenantId: 'tenant-123' },
        next: async () => {},
      });

      expect(loadTenant).toHaveBeenCalledWith('tenant-123');
    });
  });

  describe('createTenant', () => {
    it('should return namespace with middleware', () => {
      const clientPool = createMockClientPool();
      const loadTenant = vi.fn();

      const tenant = createTenant({
        loadTenant,
        clientPool,
      });

      expect(tenant.middleware).toBeTypeOf('function');
      expect(tenant.optionalMiddleware).toBeTypeOf('function');
      expect(tenant.getClientPool).toBeTypeOf('function');
      expect(tenant.getPublicClient).toBeTypeOf('function');
      expect(tenant.loadTenant).toBe(loadTenant);
      expect(tenant.getClient).toBeTypeOf('function');
    });

    it('should return client pool from getClientPool', () => {
      const clientPool = createMockClientPool();

      const tenant = createTenant({
        loadTenant: vi.fn(),
        clientPool,
      });

      expect(tenant.getClientPool()).toBe(clientPool);
    });

    it('should return public client from getPublicClient', () => {
      const clientPool = createMockClientPool();
      const publicClient = createMockClient();

      const tenant = createTenant({
        loadTenant: vi.fn(),
        clientPool,
        publicClient,
      });

      expect(tenant.getPublicClient()).toBe(publicClient);
    });
  });

  describe('hasTenant', () => {
    it('should return true when tenant and db exist', () => {
      const ctx = {
        tenant: mockTenant,
        db: createMockClient(),
      };

      expect(hasTenant(ctx)).toBe(true);
    });

    it('should return false when tenant is missing', () => {
      const ctx = {
        db: createMockClient(),
      };

      expect(hasTenant(ctx)).toBe(false);
    });

    it('should return false when db is missing', () => {
      const ctx = {
        tenant: mockTenant,
      };

      expect(hasTenant(ctx)).toBe(false);
    });

    it('should return false for null context', () => {
      expect(hasTenant(null as unknown as { tenant?: unknown })).toBe(false);
    });
  });

  describe('getTenantOrThrow', () => {
    it('should return tenant context when present', () => {
      const ctx = {
        tenant: mockTenant,
        db: createMockClient(),
      };

      const result = getTenantOrThrow(ctx);

      expect(result.tenant).toBe(mockTenant);
      expect(result.db).toBeDefined();
    });

    it('should throw TenantIdMissingError when no tenant', () => {
      expect(() => getTenantOrThrow({})).toThrow(TenantIdMissingError);
    });
  });
});
