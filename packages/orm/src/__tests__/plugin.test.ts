/**
 * @veloxts/orm - Database Plugin Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { createDatabasePlugin } from '../plugin.js';
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

describe('createDatabasePlugin', () => {
  describe('plugin creation', () => {
    it('should create a valid plugin with client', () => {
      const mockClient = createMockClient();
      const plugin = createDatabasePlugin({ client: mockClient });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@veloxts/orm');
      expect(plugin.version).toBe('0.1.0');
      expect(typeof plugin.register).toBe('function');
    });

    it('should allow custom plugin name', () => {
      const mockClient = createMockClient();
      const plugin = createDatabasePlugin({ client: mockClient, name: 'custom-db' });

      expect(plugin.name).toBe('custom-db');
    });

    it('should throw error if config is null', () => {
      expect(() => createDatabasePlugin(null as unknown as { client: DatabaseClient })).toThrow(
        'Database plugin configuration is required'
      );
    });

    it('should throw error if config is not an object', () => {
      expect(() =>
        createDatabasePlugin('invalid' as unknown as { client: DatabaseClient })
      ).toThrow('Database plugin configuration is required');
    });

    it('should throw error if client is missing', () => {
      expect(() => createDatabasePlugin({} as { client: DatabaseClient })).toThrow(
        'Database client is required'
      );
    });

    it('should throw error if client is invalid', () => {
      const invalidClient = { notAClient: true };
      expect(() =>
        createDatabasePlugin({ client: invalidClient as unknown as DatabaseClient })
      ).toThrow('Database client must implement $connect and $disconnect methods');
    });
  });

  describe('plugin registration', () => {
    it('should connect to database on register', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      expect(mockClient.$connect).toHaveBeenCalledTimes(1);
    });

    it('should add onRequest hook for context injection', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      expect(mockServer.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    });

    it('should add onClose hook for disconnect', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      expect(mockServer.addHook).toHaveBeenCalledWith('onClose', expect.any(Function));
    });

    it('should log successful registration', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      expect(mockServer.log.info).toHaveBeenCalledWith(
        'Database plugin "@veloxts/orm" registered successfully'
      );
    });
  });

  describe('context injection', () => {
    it('should inject db into request context', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Simulate a request with context
      const mockRequest = {
        context: {
          request: {},
          reply: {},
        },
      };

      await mockServer._triggerHook('onRequest', mockRequest);

      expect(mockRequest.context).toHaveProperty('db');
      expect((mockRequest.context as { db: DatabaseClient }).db).toBe(mockClient);
    });

    it('should not inject db if context is missing', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Simulate a request without context
      const mockRequest = {};

      // Should not throw
      await mockServer._triggerHook('onRequest', mockRequest);

      expect(mockRequest).not.toHaveProperty('context');
    });
  });

  describe('shutdown handling', () => {
    it('should disconnect on server close', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Trigger onClose hook
      await mockServer._triggerHook('onClose');

      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      });
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Should not throw even if disconnect fails - error is logged but swallowed
      // to allow graceful shutdown to continue
      await expect(mockServer._triggerHook('onClose')).resolves.not.toThrow();

      // Verify error was logged
      expect(mockServer.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to disconnect database during shutdown'
      );
    });

    it('should handle non-Error disconnect failures gracefully', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue('string error'),
      });
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Should not throw even if disconnect fails with non-Error
      await expect(mockServer._triggerHook('onClose')).resolves.not.toThrow();

      // Verify error was logged with Error wrapper
      expect(mockServer.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to disconnect database during shutdown'
      );

      // Verify the error was wrapped in a VeloxError by the Database wrapper
      const errorCall = mockServer.log.error.mock.calls[0];
      expect(errorCall[0].err.message).toContain('string error');
    });

    it('should handle non-Error object disconnect failures', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue({ code: 'CUSTOM_ERROR', details: 'Failed' }),
      });
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Should not throw even if disconnect fails with non-Error object
      await expect(mockServer._triggerHook('onClose')).resolves.not.toThrow();

      // Verify error was logged with Error wrapper
      expect(mockServer.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to disconnect database during shutdown'
      );
    });

    it('should log info when database disconnects successfully', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);

      // Trigger onClose hook
      await mockServer._triggerHook('onClose');

      // Verify success was logged
      expect(mockServer.log.info).toHaveBeenCalledWith(
        'Database disconnected successfully during shutdown'
      );
    });

    it('should not attempt disconnect if database was never connected', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();

      // Create a new plugin but don't actually register it (connection won't happen)
      // Instead, manually create the hook scenario
      const plugin = createDatabasePlugin({ client: mockClient });

      // Mock connect to fail, so database never becomes connected
      mockClient.$connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      let registrationFailed = false;
      try {
        await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);
      } catch {
        registrationFailed = true;
      }

      expect(registrationFailed).toBe(true);

      // Clear all previous calls
      vi.clearAllMocks();

      // Now trigger onClose - should not attempt disconnect since database never connected
      await mockServer._triggerHook('onClose');

      // Verify disconnect was not called
      expect(mockClient.$disconnect).not.toHaveBeenCalled();
    });

    it('should not attempt disconnect if already disconnected before shutdown', async () => {
      const mockClient = createMockClient();
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      // Register successfully
      await plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0]);
      expect(mockClient.$connect).toHaveBeenCalledTimes(1);

      // Now manually disconnect before shutdown
      // Since the plugin creates its own database wrapper, we need to trigger the disconnect
      // through the onClose hook first
      await mockServer._triggerHook('onClose');
      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);

      // Clear mocks
      vi.clearAllMocks();

      // Trigger onClose again - should not attempt disconnect since already disconnected
      await mockServer._triggerHook('onClose');
      expect(mockClient.$disconnect).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error if connection fails during registration', async () => {
      const mockClient = createMockClient({
        $connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });
      const mockServer = createMockServer();
      const plugin = createDatabasePlugin({ client: mockClient });

      await expect(
        plugin.register(mockServer as unknown as Parameters<typeof plugin.register>[0])
      ).rejects.toThrow('Failed to connect to database');
    });
  });
});
