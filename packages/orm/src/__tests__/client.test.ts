/**
 * @veloxts/orm - Database Client Wrapper Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../client.js';
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

describe('createDatabase', () => {
  describe('creation', () => {
    it('should create a database wrapper with valid client', () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      expect(db).toBeDefined();
      expect(db.client).toBe(mockClient);
      expect(db.isConnected).toBe(false);
    });

    it('should throw error if config is null', () => {
      expect(() => createDatabase(null as unknown as { client: DatabaseClient })).toThrow(
        'Database configuration is required'
      );
    });

    it('should throw error if config is not an object', () => {
      expect(() => createDatabase('invalid' as unknown as { client: DatabaseClient })).toThrow(
        'Database configuration is required'
      );
    });

    it('should throw error if client is missing', () => {
      expect(() => createDatabase({} as { client: DatabaseClient })).toThrow(
        'Database client is required in configuration'
      );
    });

    it('should throw error if client does not implement DatabaseClient', () => {
      const invalidClient = { notAClient: true };
      expect(() => createDatabase({ client: invalidClient as unknown as DatabaseClient })).toThrow(
        'Database client must implement $connect and $disconnect methods'
      );
    });
  });

  describe('initial state', () => {
    it('should have disconnected state initially', () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      expect(db.status.state).toBe('disconnected');
      expect(db.status.isConnected).toBe(false);
      expect(db.isConnected).toBe(false);
      expect(db.status.connectedAt).toBeUndefined();
    });
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      await db.connect();

      expect(mockClient.$connect).toHaveBeenCalledTimes(1);
      expect(db.isConnected).toBe(true);
      expect(db.status.state).toBe('connected');
      expect(db.status.connectedAt).toBeInstanceOf(Date);
    });

    it('should throw error if already connected', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      await db.connect();

      await expect(db.connect()).rejects.toThrow('Database is already connected');
    });

    it('should throw error if connection fails', async () => {
      const mockClient = createMockClient({
        $connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });
      const db = createDatabase({ client: mockClient });

      await expect(db.connect()).rejects.toThrow(
        'Failed to connect to database: Connection refused'
      );
      expect(db.isConnected).toBe(false);
      expect(db.status.state).toBe('disconnected');
    });

    it('should handle non-Error rejection', async () => {
      const mockClient = createMockClient({
        $connect: vi.fn().mockRejectedValue('string error'),
      });
      const db = createDatabase({ client: mockClient });

      await expect(db.connect()).rejects.toThrow('Failed to connect to database: string error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database successfully', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      await db.connect();
      await db.disconnect();

      expect(mockClient.$disconnect).toHaveBeenCalledTimes(1);
      expect(db.isConnected).toBe(false);
      expect(db.status.state).toBe('disconnected');
      expect(db.status.connectedAt).toBeUndefined();
    });

    it('should throw error if not connected', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      await expect(db.disconnect()).rejects.toThrow('Database is not connected');
    });

    it('should throw error if disconnection fails', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      });
      const db = createDatabase({ client: mockClient });

      await db.connect();
      await expect(db.disconnect()).rejects.toThrow(
        'Failed to disconnect from database: Disconnect failed'
      );
      // Even on failure, state should be disconnected
      expect(db.isConnected).toBe(false);
    });

    it('should handle non-Error rejection during disconnect', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue('non-error failure'),
      });
      const db = createDatabase({ client: mockClient });

      await db.connect();
      await expect(db.disconnect()).rejects.toThrow(
        'Failed to disconnect from database: non-error failure'
      );
      // Even on failure, state should be disconnected
      expect(db.isConnected).toBe(false);
    });

    it('should clear connectedAt even when disconnect fails', async () => {
      const mockClient = createMockClient({
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      });
      const db = createDatabase({ client: mockClient });

      await db.connect();
      expect(db.status.connectedAt).toBeDefined();

      try {
        await db.disconnect();
      } catch {
        // Expected to throw
      }

      expect(db.status.connectedAt).toBeUndefined();
    });
  });

  describe('client access', () => {
    it('should provide access to underlying client', () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      expect(db.client).toBe(mockClient);
    });

    it('should preserve client type', () => {
      interface ExtendedClient extends DatabaseClient {
        user: { findMany: () => Promise<unknown[]> };
      }

      const extendedClient: ExtendedClient = {
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        user: { findMany: async () => [] },
      };

      const db = createDatabase({ client: extendedClient });

      // TypeScript should preserve the extended type
      expect(db.client.user).toBeDefined();
      expect(typeof db.client.user.findMany).toBe('function');
    });
  });

  describe('status tracking', () => {
    it('should update connectedAt on connect', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      const beforeConnect = new Date();
      await db.connect();
      const afterConnect = new Date();

      expect(db.status.connectedAt).toBeDefined();
      if (db.status.connectedAt) {
        expect(db.status.connectedAt.getTime()).toBeGreaterThanOrEqual(beforeConnect.getTime());
        expect(db.status.connectedAt.getTime()).toBeLessThanOrEqual(afterConnect.getTime());
      }
    });

    it('should clear connectedAt on disconnect', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      await db.connect();
      expect(db.status.connectedAt).toBeDefined();

      await db.disconnect();
      expect(db.status.connectedAt).toBeUndefined();
    });

    it('should maintain consistent status object reference when no state change', () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      const status1 = db.status;
      const status2 = db.status;

      // Should return same cached object when state hasn't changed
      expect(status1).toBe(status2);
    });

    it('should update status object after state changes', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      const statusBeforeConnect = db.status;
      await db.connect();
      const statusAfterConnect = db.status;

      // Status object should be different after connection
      expect(statusBeforeConnect).not.toBe(statusAfterConnect);
      expect(statusBeforeConnect.isConnected).toBe(false);
      expect(statusAfterConnect.isConnected).toBe(true);
    });

    it('should reflect all connection states correctly', async () => {
      const mockClient = createMockClient();
      const db = createDatabase({ client: mockClient });

      // Initial disconnected state
      expect(db.status.state).toBe('disconnected');
      expect(db.status.isConnected).toBe(false);

      // Connected state
      await db.connect();
      expect(db.status.state).toBe('connected');
      expect(db.status.isConnected).toBe(true);

      // Disconnected state again
      await db.disconnect();
      expect(db.status.state).toBe('disconnected');
      expect(db.status.isConnected).toBe(false);
    });
  });

  describe('concurrent operations', () => {
    it('should prevent connect while connecting', async () => {
      let resolveConnect: (() => void) | undefined;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });

      const mockClient = createMockClient({
        $connect: vi.fn().mockImplementation(() => connectPromise),
      });
      const db = createDatabase({ client: mockClient });

      // Start first connect (won't resolve yet)
      const firstConnect = db.connect();

      // Try second connect while first is in progress
      await expect(db.connect()).rejects.toThrow('Database connection is already in progress');

      // Resolve the first connect
      if (resolveConnect) {
        resolveConnect();
      }
      await firstConnect;
    });

    it('should prevent disconnect while disconnecting', async () => {
      let resolveDisconnect: (() => void) | undefined;
      const disconnectPromise = new Promise<void>((resolve) => {
        resolveDisconnect = resolve;
      });

      const mockClient = createMockClient({
        $disconnect: vi.fn().mockImplementation(() => disconnectPromise),
      });
      const db = createDatabase({ client: mockClient });

      await db.connect();

      // Start first disconnect (won't resolve yet)
      const firstDisconnect = db.disconnect();

      // Try second disconnect while first is in progress
      await expect(db.disconnect()).rejects.toThrow(
        'Database disconnection is already in progress'
      );

      // Resolve the first disconnect
      if (resolveDisconnect) {
        resolveDisconnect();
      }
      await firstDisconnect;
    });
  });
});
