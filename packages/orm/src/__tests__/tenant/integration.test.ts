import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTenant,
  createTenantClientPool,
  TenantIdMissingError,
  TenantNotFoundError,
  TenantSuspendedError,
} from '../../tenant/index.js';
import type { Tenant } from '../../tenant/types.js';
import type { DatabaseClient } from '../../types.js';

/**
 * Integration tests simulating real procedure middleware flow
 */

// Mock database client with user operations
interface MockUserClient extends DatabaseClient {
  user: {
    findMany: () => Promise<Array<{ id: string; name: string; email: string }>>;
    create: (data: {
      data: { name: string; email: string };
    }) => Promise<{ id: string; name: string; email: string }>;
  };
}

function createMockUserClient(schemaName: string): MockUserClient {
  const users = [{ id: '1', name: `User from ${schemaName}`, email: 'user@example.com' }];

  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findMany: vi.fn().mockResolvedValue(users),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: '2', ...data })),
    },
  };
}

// Mock tenants database
const tenantsDb: Record<string, Tenant> = {
  'tenant-acme': {
    id: 'tenant-acme',
    slug: 'acme-corp',
    name: 'Acme Corporation',
    schemaName: 'tenant_acme_corp',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  'tenant-beta': {
    id: 'tenant-beta',
    slug: 'beta-inc',
    name: 'Beta Inc',
    schemaName: 'tenant_beta_inc',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  'tenant-suspended': {
    id: 'tenant-suspended',
    slug: 'suspended-corp',
    name: 'Suspended Corp',
    schemaName: 'tenant_suspended_corp',
    status: 'suspended',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('tenant/integration', () => {
  let clientPool: ReturnType<typeof createTenantClientPool<MockUserClient>>;
  let tenant: ReturnType<typeof createTenant<MockUserClient>>;
  let createdClients: Map<string, MockUserClient>;

  beforeEach(() => {
    createdClients = new Map();

    // Create client pool
    clientPool = createTenantClientPool<MockUserClient>({
      baseDatabaseUrl: 'postgresql://localhost/test',
      createClient: (schemaName) => {
        const client = createMockUserClient(schemaName);
        createdClients.set(schemaName, client);
        return client;
      },
      maxClients: 10,
    });

    // Create tenant middleware
    tenant = createTenant<MockUserClient>({
      loadTenant: async (tenantId) => tenantsDb[tenantId] ?? null,
      clientPool,
    });
  });

  describe('procedure simulation', () => {
    /**
     * Simulates a procedure handler execution with middleware chain
     */
    async function executeProcedure<TResult>(
      ctx: Record<string, unknown>,
      handler: (ctx: { tenant: Tenant; db: MockUserClient }) => Promise<TResult>
    ): Promise<TResult> {
      const middleware = tenant.middleware();
      const resultHolder: { value?: TResult } = {};

      await middleware({
        ctx,
        next: async ({ ctx: extendedCtx }) => {
          resultHolder.value = await handler(extendedCtx as { tenant: Tenant; db: MockUserClient });
        },
      });

      return resultHolder.value as TResult;
    }

    it('should provide tenant-scoped db access in handler', async () => {
      const ctx = {
        auth: { token: { tenantId: 'tenant-acme' } },
      };

      const users = await executeProcedure(ctx, async ({ db }) => {
        return db.user.findMany();
      });

      expect(users).toHaveLength(1);
      expect(users[0].name).toContain('tenant_acme_corp');
    });

    it('should provide tenant info in handler', async () => {
      const ctx = {
        auth: { token: { tenantId: 'tenant-acme' } },
      };

      const tenantInfo = await executeProcedure(ctx, async ({ tenant }) => {
        return {
          id: tenant.id,
          name: tenant.name,
          schema: tenant.schemaName,
        };
      });

      expect(tenantInfo).toEqual({
        id: 'tenant-acme',
        name: 'Acme Corporation',
        schema: 'tenant_acme_corp',
      });
    });

    it('should isolate data between tenants', async () => {
      // First tenant
      const acmeUsers = await executeProcedure(
        { auth: { token: { tenantId: 'tenant-acme' } } },
        async ({ db }) => db.user.findMany()
      );

      // Second tenant
      const betaUsers = await executeProcedure(
        { auth: { token: { tenantId: 'tenant-beta' } } },
        async ({ db }) => db.user.findMany()
      );

      // Verify different schemas were used
      expect(acmeUsers[0].name).toContain('tenant_acme_corp');
      expect(betaUsers[0].name).toContain('tenant_beta_inc');

      // Verify different clients were created
      expect(createdClients.has('tenant_acme_corp')).toBe(true);
      expect(createdClients.has('tenant_beta_inc')).toBe(true);
    });

    it('should reuse client for same tenant', async () => {
      const ctx = { auth: { token: { tenantId: 'tenant-acme' } } };

      // Execute multiple times
      await executeProcedure(ctx, async ({ db }) => db.user.findMany());
      await executeProcedure(ctx, async ({ db }) => db.user.findMany());
      await executeProcedure(ctx, async ({ db }) => db.user.findMany());

      // Should only create one client
      expect(createdClients.size).toBe(1);
      expect(clientPool.getStats().totalCreated).toBe(1);
    });

    it('should reject requests without tenant ID', async () => {
      const ctx = { auth: { token: {} } };

      await expect(executeProcedure(ctx, async ({ db }) => db.user.findMany())).rejects.toThrow(
        TenantIdMissingError
      );
    });

    it('should reject unknown tenant', async () => {
      const ctx = { auth: { token: { tenantId: 'unknown-tenant' } } };

      await expect(executeProcedure(ctx, async ({ db }) => db.user.findMany())).rejects.toThrow(
        TenantNotFoundError
      );
    });

    it('should reject suspended tenant', async () => {
      const ctx = { auth: { token: { tenantId: 'tenant-suspended' } } };

      await expect(executeProcedure(ctx, async ({ db }) => db.user.findMany())).rejects.toThrow(
        TenantSuspendedError
      );
    });
  });

  describe('auth middleware chain simulation', () => {
    /**
     * Simulates auth + tenant middleware chain
     */
    async function executeWithAuth<TResult>(
      authContext: { userId: string; tenantId: string } | null,
      handler: (ctx: {
        user?: { id: string };
        tenant: Tenant;
        db: MockUserClient;
      }) => Promise<TResult>
    ): Promise<TResult> {
      // Simulate auth middleware
      const ctx: Record<string, unknown> = {};

      if (authContext) {
        ctx.user = { id: authContext.userId };
        ctx.auth = {
          isAuthenticated: true,
          token: {
            sub: authContext.userId,
            tenantId: authContext.tenantId,
          },
        };
      }

      // Then tenant middleware
      const middleware = tenant.middleware();
      const resultHolder: { value?: TResult } = {};

      await middleware({
        ctx,
        next: async ({ ctx: extendedCtx }) => {
          resultHolder.value = await handler(
            extendedCtx as { user?: { id: string }; tenant: Tenant; db: MockUserClient }
          );
        },
      });

      return resultHolder.value as TResult;
    }

    it('should have both user and tenant in context', async () => {
      const result = await executeWithAuth(
        { userId: 'user-123', tenantId: 'tenant-acme' },
        async ({ user, tenant }) => ({
          userId: user?.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
        })
      );

      expect(result).toEqual({
        userId: 'user-123',
        tenantId: 'tenant-acme',
        tenantName: 'Acme Corporation',
      });
    });

    it('should allow creating resources scoped to tenant', async () => {
      const newUser = await executeWithAuth(
        { userId: 'user-123', tenantId: 'tenant-acme' },
        async ({ db }) => {
          return db.user.create({
            data: { name: 'New User', email: 'new@acme.com' },
          });
        }
      );

      expect(newUser.id).toBe('2');
      expect(newUser.name).toBe('New User');

      // Verify the correct client was used
      const acmeClient = createdClients.get('tenant_acme_corp');
      expect(acmeClient?.user.create).toHaveBeenCalled();
    });
  });

  describe('optional tenant middleware', () => {
    it('should allow requests without tenant when optional', async () => {
      const optionalMiddleware = tenant.optionalMiddleware();
      let handlerCalled = false;

      await optionalMiddleware({
        ctx: {}, // No auth/tenant
        next: async () => {
          handlerCalled = true;
        },
      });

      expect(handlerCalled).toBe(true);
    });

    it('should still provide tenant context when available', async () => {
      const optionalMiddleware = tenant.optionalMiddleware();
      let capturedTenant: Tenant | undefined;

      await optionalMiddleware({
        ctx: { auth: { token: { tenantId: 'tenant-acme' } } },
        next: async ({ ctx }) => {
          capturedTenant = (ctx as { tenant?: Tenant }).tenant;
        },
      });

      expect(capturedTenant?.id).toBe('tenant-acme');
    });
  });

  describe('client pool lifecycle', () => {
    it('should track pool statistics correctly', async () => {
      // Access multiple tenants
      await executeProcedure({ auth: { token: { tenantId: 'tenant-acme' } } }, async ({ db }) =>
        db.user.findMany()
      );

      await executeProcedure({ auth: { token: { tenantId: 'tenant-beta' } } }, async ({ db }) =>
        db.user.findMany()
      );

      const stats = clientPool.getStats();

      expect(stats.activeClients).toBe(2);
      expect(stats.totalCreated).toBe(2);
      expect(stats.totalEvicted).toBe(0);
    });

    it('should disconnect all clients on shutdown', async () => {
      // Create some clients
      await executeProcedure({ auth: { token: { tenantId: 'tenant-acme' } } }, async ({ db }) =>
        db.user.findMany()
      );

      await executeProcedure({ auth: { token: { tenantId: 'tenant-beta' } } }, async ({ db }) =>
        db.user.findMany()
      );

      // Disconnect all
      await clientPool.disconnectAll();

      // Verify all clients were disconnected
      for (const client of createdClients.values()) {
        expect(client.$disconnect).toHaveBeenCalled();
      }

      expect(clientPool.getStats().activeClients).toBe(0);
    });
  });

  // Helper function for procedure simulation (moved inside describe for access)
  async function executeProcedure<TResult>(
    ctx: Record<string, unknown>,
    handler: (ctx: { tenant: Tenant; db: MockUserClient }) => Promise<TResult>
  ): Promise<TResult> {
    const middleware = tenant.middleware();
    const resultHolder: { value?: TResult } = {};

    await middleware({
      ctx,
      next: async ({ ctx: extendedCtx }) => {
        resultHolder.value = await handler(extendedCtx as { tenant: Tenant; db: MockUserClient });
      },
    });

    return resultHolder.value as TResult;
  }
});
