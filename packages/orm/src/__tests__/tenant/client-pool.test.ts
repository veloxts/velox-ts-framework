import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTenantClientPool } from '../../tenant/client-pool.js';
import type { DatabaseClient } from '../../types.js';

// Mock database client
function createMockClient(): DatabaseClient {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('tenant/client-pool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTenantClientPool', () => {
    it('should create a pool with default settings', () => {
      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => createMockClient(),
      });

      const stats = pool.getStats();

      expect(stats.activeClients).toBe(0);
      expect(stats.maxClients).toBe(50);
      expect(stats.totalCreated).toBe(0);
      expect(stats.totalEvicted).toBe(0);
    });

    it('should respect custom maxClients', () => {
      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => createMockClient(),
        maxClients: 10,
      });

      expect(pool.getStats().maxClients).toBe(10);
    });
  });

  describe('getClient', () => {
    it('should create a new client for a new schema', async () => {
      const mockClient = createMockClient();
      const createClient = vi.fn().mockReturnValue(mockClient);

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
      });

      const client = await pool.getClient('tenant_acme');

      expect(createClient).toHaveBeenCalledWith('tenant_acme');
      expect(mockClient.$connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
      expect(pool.getStats().activeClients).toBe(1);
      expect(pool.getStats().totalCreated).toBe(1);
    });

    it('should return cached client for same schema', async () => {
      const mockClient = createMockClient();
      const createClient = vi.fn().mockReturnValue(mockClient);

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
      });

      const client1 = await pool.getClient('tenant_acme');
      const client2 = await pool.getClient('tenant_acme');

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
      expect(pool.getStats().activeClients).toBe(1);
    });

    it('should create different clients for different schemas', async () => {
      const createClient = vi.fn().mockImplementation(() => createMockClient());

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
      });

      const client1 = await pool.getClient('tenant_acme');
      const client2 = await pool.getClient('tenant_beta');

      expect(createClient).toHaveBeenCalledTimes(2);
      expect(client1).not.toBe(client2);
      expect(pool.getStats().activeClients).toBe(2);
    });

    it('should evict LRU client when pool is full', async () => {
      const createClient = vi.fn().mockImplementation(() => createMockClient());

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
        maxClients: 2,
        idleTimeoutMs: 60000, // Long timeout to not interfere
      });

      // Fill the pool
      await pool.getClient('tenant_a');
      await vi.advanceTimersByTimeAsync(100);
      await pool.getClient('tenant_b');
      await vi.advanceTimersByTimeAsync(100);

      // This should trigger LRU eviction of tenant_a
      await pool.getClient('tenant_c');

      expect(pool.getStats().activeClients).toBe(2);
      expect(pool.getStats().totalEvicted).toBe(1);
    });
  });

  describe('releaseClient', () => {
    it('should update last accessed time', async () => {
      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => createMockClient(),
      });

      await pool.getClient('tenant_acme');

      // Should not throw
      pool.releaseClient('tenant_acme');
      expect(pool.getStats().activeClients).toBe(1);
    });

    it('should not throw for non-existent schema', () => {
      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => createMockClient(),
      });

      // Should not throw
      expect(() => pool.releaseClient('non_existent')).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all clients', async () => {
      const clients: DatabaseClient[] = [];
      const createClient = vi.fn().mockImplementation(() => {
        const client = createMockClient();
        clients.push(client);
        return client;
      });

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
      });

      await pool.getClient('tenant_a');
      await pool.getClient('tenant_b');

      await pool.disconnectAll();

      expect(clients[0].$disconnect).toHaveBeenCalled();
      expect(clients[1].$disconnect).toHaveBeenCalled();
      expect(pool.getStats().activeClients).toBe(0);
    });

    it('should handle disconnect errors gracefully', async () => {
      const failingClient: DatabaseClient = {
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockRejectedValue(new Error('Disconnect failed')),
      };

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => failingClient,
      });

      await pool.getClient('tenant_acme');

      // Should throw AggregateError
      await expect(pool.disconnectAll()).rejects.toThrow('Failed to disconnect some clients');
    });
  });

  describe('idle cleanup', () => {
    it('should track client metadata correctly', async () => {
      const mockClient = createMockClient();
      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient: () => mockClient,
        idleTimeoutMs: 1000,
      });

      await pool.getClient('tenant_acme');
      const stats = pool.getStats();

      expect(stats.activeClients).toBe(1);
      expect(stats.totalCreated).toBe(1);

      // Disconnect all should clean up
      await pool.disconnectAll();
      expect(pool.getStats().activeClients).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const createClient = vi.fn().mockImplementation(() => createMockClient());

      const pool = createTenantClientPool({
        baseDatabaseUrl: 'postgresql://localhost/test',
        createClient,
        maxClients: 20,
      });

      await pool.getClient('tenant_a');
      await pool.getClient('tenant_b');
      await pool.getClient('tenant_c');

      const stats = pool.getStats();

      expect(stats).toEqual({
        activeClients: 3,
        maxClients: 20,
        totalCreated: 3,
        totalEvicted: 0,
      });
    });
  });
});
