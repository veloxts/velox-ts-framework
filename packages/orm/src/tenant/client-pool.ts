/**
 * Tenant client pool for managing PrismaClient instances per schema
 *
 * Features:
 * - LRU eviction when pool reaches capacity
 * - Idle timeout cleanup
 * - Connection lifecycle management
 */

import type { DatabaseClient } from '../types.js';
import type {
  CachedClient,
  TenantClientPool as ITenantClientPool,
  TenantClientPoolConfig,
  TenantPoolStats,
} from './types.js';
import { ClientCreateError, ClientDisconnectError, ClientPoolExhaustedError } from './errors.js';

/**
 * Default configuration values
 */
const DEFAULTS = {
  maxClients: 50,
  idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
} as const;

/**
 * Tenant client pool implementation
 *
 * Manages a pool of PrismaClient instances, one per tenant schema.
 * Uses LRU eviction when the pool reaches maximum capacity.
 *
 * @example
 * ```typescript
 * const pool = createTenantClientPool({
 *   baseDatabaseUrl: process.env.DATABASE_URL!,
 *   createClient: (schemaName) => {
 *     const url = `${process.env.DATABASE_URL}?schema=${schemaName}`;
 *     const adapter = new PrismaPg({ connectionString: url });
 *     return new PrismaClient({ adapter });
 *   },
 *   maxClients: 50,
 * });
 *
 * const client = await pool.getClient('tenant_acme');
 * // Use client...
 * pool.releaseClient('tenant_acme');
 * ```
 */
export function createTenantClientPool<TClient extends DatabaseClient>(
  config: TenantClientPoolConfig<TClient>
): ITenantClientPool<TClient> {
  const maxClients = config.maxClients ?? DEFAULTS.maxClients;
  const idleTimeoutMs = config.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs;

  // Pool state
  const clients = new Map<string, CachedClient<TClient>>();
  let totalCreated = 0;
  let totalEvicted = 0;
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the idle cleanup timer
   */
  function startCleanupTimer(): void {
    if (cleanupTimer) return;

    cleanupTimer = setInterval(() => {
      void cleanupIdleClients();
    }, DEFAULTS.cleanupIntervalMs);

    // Don't block process exit
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer
   */
  function stopCleanupTimer(): void {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }

  /**
   * Cleanup clients that have been idle too long
   */
  async function cleanupIdleClients(): Promise<void> {
    const now = Date.now();
    const toEvict: string[] = [];

    for (const [schemaName, cached] of clients) {
      if (now - cached.lastAccessedAt > idleTimeoutMs) {
        toEvict.push(schemaName);
      }
    }

    for (const schemaName of toEvict) {
      await evictClient(schemaName);
    }
  }

  /**
   * Evict a client from the pool
   */
  async function evictClient(schemaName: string): Promise<void> {
    const cached = clients.get(schemaName);
    if (!cached) return;

    clients.delete(schemaName);
    totalEvicted++;

    try {
      await cached.client.$disconnect();
    } catch (error) {
      // Log but don't throw - eviction should be best-effort
      console.warn(`[TenantClientPool] Failed to disconnect client for ${schemaName}:`, error);
    }
  }

  /**
   * Find and evict the least recently used client
   */
  async function evictLRU(): Promise<void> {
    let oldest: { schemaName: string; lastAccessedAt: number } | null = null;

    for (const [schemaName, cached] of clients) {
      if (!oldest || cached.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = { schemaName, lastAccessedAt: cached.lastAccessedAt };
      }
    }

    if (oldest) {
      await evictClient(oldest.schemaName);
    }
  }

  /**
   * Create a new client for a schema
   */
  async function createClient(schemaName: string): Promise<TClient> {
    try {
      const client = config.createClient(schemaName);

      // Connect the client
      await client.$connect();

      return client;
    } catch (error) {
      throw new ClientCreateError(
        schemaName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Start cleanup timer
  startCleanupTimer();

  return {
    /**
     * Get or create a client for a tenant schema
     */
    async getClient(schemaName: string): Promise<TClient> {
      // Check if client exists in pool
      const cached = clients.get(schemaName);
      if (cached) {
        // Update last accessed time (LRU tracking)
        cached.lastAccessedAt = Date.now();
        return cached.client;
      }

      // Check if pool is at capacity
      if (clients.size >= maxClients) {
        // Try to evict idle clients first
        await cleanupIdleClients();

        // If still at capacity, evict LRU
        if (clients.size >= maxClients) {
          await evictLRU();
        }

        // If still at capacity (shouldn't happen), throw
        if (clients.size >= maxClients) {
          throw new ClientPoolExhaustedError(maxClients);
        }
      }

      // Create new client
      const client = await createClient(schemaName);
      const now = Date.now();

      clients.set(schemaName, {
        client,
        schemaName,
        lastAccessedAt: now,
        createdAt: now,
      });

      totalCreated++;

      return client;
    },

    /**
     * Release a client back to the pool
     *
     * Note: This doesn't actually remove the client, it just marks
     * it as available for LRU eviction if needed.
     */
    releaseClient(schemaName: string): void {
      const cached = clients.get(schemaName);
      if (cached) {
        cached.lastAccessedAt = Date.now();
      }
    },

    /**
     * Disconnect all clients and clear the pool
     */
    async disconnectAll(): Promise<void> {
      stopCleanupTimer();

      const errors: Error[] = [];

      for (const [schemaName, cached] of clients) {
        try {
          await cached.client.$disconnect();
        } catch (error) {
          errors.push(
            new ClientDisconnectError(
              schemaName,
              error instanceof Error ? error : new Error(String(error))
            )
          );
        }
      }

      clients.clear();

      if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to disconnect some clients');
      }
    },

    /**
     * Get current pool statistics
     */
    getStats(): TenantPoolStats {
      return {
        activeClients: clients.size,
        maxClients,
        totalCreated,
        totalEvicted,
      };
    },
  };
}

/**
 * Type alias for the client pool
 */
export type { ITenantClientPool as TenantClientPool };
