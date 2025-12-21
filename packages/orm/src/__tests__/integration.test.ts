/**
 * @veloxts/orm - Integration Tests
 *
 * Tests the complete workflow of database integration with VeloxApp
 */

import { describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../client.js';
import { databasePlugin } from '../plugin.js';
import type { DatabaseClient } from '../types.js';

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

/**
 * Create a mock Fastify server for testing
 */
function createMockServer() {
  const hooks: Record<string, Array<(...args: unknown[]) => Promise<void>>> = {};

  return {
    addHook: vi.fn((hookName: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (!hooks[hookName]) {
        hooks[hookName] = [];
      }
      hooks[hookName].push(handler);
    }),
    log: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    // Helper to trigger hooks in tests
    _triggerHook: async (hookName: string, ...args: unknown[]) => {
      const handlers = hooks[hookName] || [];
      for (const handler of handlers) {
        await handler(...args);
      }
    },
    _hooks: hooks,
  };
}

describe('Integration: Complete Database Lifecycle', () => {
  it('should handle full app lifecycle with database', async () => {
    const mockClient = createMockClient();
    const mockServer = createMockServer();
    const plugin = databasePlugin({ client: mockClient });

    // 1. Register plugin (connects to database)
    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);
    expect(mockClient.$connect).toHaveBeenCalledTimes(1);

    // 2. Simulate multiple requests with database access
    for (let i = 0; i < 3; i++) {
      const mockRequest = {
        context: {
          request: {},
          reply: {},
        },
      };

      await mockServer._triggerHook('onRequest', mockRequest);
      expect(mockRequest.context).toHaveProperty('db');
      expect((mockRequest.context as { db: DatabaseClient }).db).toBe(mockClient);
    }

    // 3. Graceful shutdown (disconnects from database)
    await mockServer._triggerHook('onClose');
    expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple plugins with different database clients', async () => {
    const primaryClient = createMockClient();
    const secondaryClient = createMockClient();
    const mockServer = createMockServer();

    const primaryPlugin = databasePlugin({ client: primaryClient, name: 'primary-db' });
    const secondaryPlugin = databasePlugin({
      client: secondaryClient,
      name: 'secondary-db',
    });

    // Register both plugins
    await primaryPlugin.register(
      mockServer as unknown as Parameters<typeof primaryPlugin.register>[0]
    );
    await secondaryPlugin.register(
      mockServer as unknown as Parameters<typeof secondaryPlugin.register>[0]
    );

    expect(primaryClient.$connect).toHaveBeenCalledTimes(1);
    expect(secondaryClient.$connect).toHaveBeenCalledTimes(1);

    // Both should disconnect on shutdown
    await mockServer._triggerHook('onClose');
    expect(primaryClient.$disconnect).toHaveBeenCalledTimes(1);
    expect(secondaryClient.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('should maintain connection across many concurrent requests', async () => {
    const mockClient = createMockClient();
    const mockServer = createMockServer();
    const plugin = databasePlugin({ client: mockClient });

    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

    // Simulate 100 concurrent requests
    const requests = Array.from({ length: 100 }, () => ({
      context: {
        request: {},
        reply: {},
      },
    }));

    await Promise.all(requests.map((req) => mockServer._triggerHook('onRequest', req)));

    // All requests should have db in context
    for (const request of requests) {
      expect(request.context).toHaveProperty('db');
      expect((request.context as { db: DatabaseClient }).db).toBe(mockClient);
    }

    // Connection should still be maintained
    expect(mockClient.$connect).toHaveBeenCalledTimes(1);
  });
});

describe('Integration: Database Wrapper and Plugin', () => {
  it('should use database wrapper correctly within plugin', async () => {
    const mockClient = createMockClient();
    const mockServer = createMockServer();

    // Create database wrapper manually
    const db = createDatabase({ client: mockClient });
    expect(db.isConnected).toBe(false);

    // Create plugin with same client
    const plugin = databasePlugin({ client: mockClient });
    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

    // Plugin should have connected
    expect(mockClient.$connect).toHaveBeenCalledTimes(1);

    // Manual wrapper should still show same client
    expect(db.client).toBe(mockClient);
  });

  it('should handle connection state transitions correctly', async () => {
    const mockClient = createMockClient();
    const db = createDatabase({ client: mockClient });

    // Track state transitions
    const states: string[] = [];

    states.push(db.status.state); // disconnected
    await db.connect();
    states.push(db.status.state); // connected
    await db.disconnect();
    states.push(db.status.state); // disconnected

    expect(states).toEqual(['disconnected', 'connected', 'disconnected']);
  });
});

describe('Integration: Error Recovery', () => {
  it('should recover from temporary connection failures', async () => {
    let connectAttempts = 0;
    const mockClient = createMockClient({
      $connect: vi.fn().mockImplementation(async () => {
        connectAttempts++;
        if (connectAttempts === 1) {
          throw new Error('Temporary network error');
        }
        // Success on second attempt
      }),
    });

    const db = createDatabase({ client: mockClient });

    // First attempt fails
    await expect(db.connect()).rejects.toThrow('Temporary network error');
    expect(db.isConnected).toBe(false);

    // Second attempt succeeds
    await db.connect();
    expect(db.isConnected).toBe(true);
    expect(connectAttempts).toBe(2);
  });

  it('should handle disconnect failure during shutdown without affecting app', async () => {
    const mockClient = createMockClient({
      $disconnect: vi.fn().mockRejectedValue(new Error('Database locked')),
    });
    const mockServer = createMockServer();
    const plugin = databasePlugin({ client: mockClient });

    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

    // Should not throw even though disconnect fails
    await expect(mockServer._triggerHook('onClose')).resolves.not.toThrow();

    // Error should be logged
    expect(mockServer.log.error).toHaveBeenCalled();
  });

  it('should prevent operations on disconnected database', async () => {
    const mockClient = createMockClient();
    const db = createDatabase({ client: mockClient });

    // Try to disconnect without connecting first
    await expect(db.disconnect()).rejects.toThrow('Database is not connected');

    // Connect and disconnect
    await db.connect();
    await db.disconnect();

    // Try to disconnect again
    await expect(db.disconnect()).rejects.toThrow('Database is not connected');
  });
});

describe('Integration: Type Safety', () => {
  it('should preserve extended client types through wrapper', () => {
    interface ExtendedClient extends DatabaseClient {
      user: {
        findMany: () => Promise<unknown[]>;
        findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      };
      post: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    }

    const extendedClient: ExtendedClient = {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      user: {
        findMany: async () => [],
        findUnique: async () => ({}),
      },
      post: {
        create: async () => ({}),
      },
    };

    const db = createDatabase({ client: extendedClient });

    // TypeScript should preserve the extended type
    expect(db.client.user).toBeDefined();
    expect(db.client.post).toBeDefined();
    expect(typeof db.client.user.findMany).toBe('function');
    expect(typeof db.client.user.findUnique).toBe('function');
    expect(typeof db.client.post.create).toBe('function');
  });

  it('should work with minimal DatabaseClient implementation', () => {
    const minimalClient: DatabaseClient = {
      $connect: async () => {},
      $disconnect: async () => {},
    };

    const db = createDatabase({ client: minimalClient });

    expect(db.client).toBe(minimalClient);
    expect(db.client.$connect).toBeDefined();
    expect(db.client.$disconnect).toBeDefined();
  });
});

describe('Integration: Real-world Scenarios', () => {
  it('should simulate production app startup and shutdown', async () => {
    const mockClient = createMockClient();
    const mockServer = createMockServer();

    // 1. Create and register plugin
    const plugin = databasePlugin({ client: mockClient });
    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

    // 2. Simulate server receiving requests
    const requestCount = 50;
    for (let i = 0; i < requestCount; i++) {
      const mockRequest = {
        context: {
          request: { id: i },
          reply: {},
        },
      };
      await mockServer._triggerHook('onRequest', mockRequest);
      expect(mockRequest.context).toHaveProperty('db');
    }

    // 3. Graceful shutdown
    await mockServer._triggerHook('onClose');

    // Verify lifecycle
    expect(mockClient.$connect).toHaveBeenCalledTimes(1);
    expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
    expect(mockServer.log.info).toHaveBeenCalledWith(
      expect.stringContaining('registered successfully')
    );
    expect(mockServer.log.info).toHaveBeenCalledWith(
      expect.stringContaining('disconnected successfully')
    );
  });

  it('should handle connection pooling scenario', async () => {
    // Simulate a client that tracks connection state
    let connectionCount = 0;
    const mockClient = createMockClient({
      $connect: vi.fn().mockImplementation(async () => {
        connectionCount++;
      }),
      $disconnect: vi.fn().mockImplementation(async () => {
        connectionCount--;
      }),
    });

    const db = createDatabase({ client: mockClient });

    // Multiple connect/disconnect cycles
    await db.connect();
    expect(connectionCount).toBe(1);

    await db.disconnect();
    expect(connectionCount).toBe(0);

    await db.connect();
    expect(connectionCount).toBe(1);

    await db.disconnect();
    expect(connectionCount).toBe(0);
  });

  it('should handle context injection with custom properties', async () => {
    const mockClient = createMockClient();
    const mockServer = createMockServer();
    const plugin = databasePlugin({ client: mockClient });

    await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

    // Request with pre-existing context properties
    const mockRequest = {
      context: {
        request: { id: 'req-123' },
        reply: {},
        customProp: 'custom-value',
      },
    };

    await mockServer._triggerHook('onRequest', mockRequest);

    // Should preserve existing properties while adding db
    expect(mockRequest.context).toHaveProperty('db');
    expect(mockRequest.context).toHaveProperty('customProp');
    expect((mockRequest.context as { customProp: string }).customProp).toBe('custom-value');
  });
});
