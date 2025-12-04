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
