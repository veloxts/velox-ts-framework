/**
 * Database client wrapper for Prisma
 *
 * Provides lifecycle management and connection state tracking
 * for Prisma clients in a type-safe manner.
 *
 * @module client
 */

import { ConfigurationError, VeloxError } from '@veloxts/core';

import type {
  ConnectionState,
  ConnectionStatus,
  DatabaseClient,
  DatabaseWrapperConfig,
} from './types.js';
import { isDatabaseClient } from './types.js';

// ============================================================================
// Database Wrapper
// ============================================================================

/**
 * Wrapped database client with connection lifecycle management
 *
 * @template TClient - Type of the underlying Prisma client
 */
export interface Database<TClient extends DatabaseClient> {
  /**
   * The underlying Prisma client instance
   *
   * Use this for all database queries. The client is always available,
   * but queries will fail if not connected.
   *
   * @example
   * ```typescript
   * const db = createDatabase({ client: prisma });
   * await db.connect();
   *
   * const users = await db.client.user.findMany();
   * ```
   */
  readonly client: TClient;

  /**
   * Current connection status
   */
  readonly status: ConnectionStatus;

  /**
   * Whether the database is connected
   *
   * Convenience getter equivalent to `status.isConnected`
   */
  readonly isConnected: boolean;

  /**
   * Establishes connection to the database
   *
   * @throws {VeloxError} If already connected or connection fails
   *
   * @example
   * ```typescript
   * const db = createDatabase({ client: prisma });
   * await db.connect();
   * console.log(db.isConnected); // true
   * ```
   */
  connect(): Promise<void>;

  /**
   * Disconnects from the database
   *
   * @throws {VeloxError} If not connected or disconnection fails
   *
   * @example
   * ```typescript
   * await db.disconnect();
   * console.log(db.isConnected); // false
   * ```
   */
  disconnect(): Promise<void>;
}

/**
 * Internal state for the database wrapper
 *
 * @internal
 */
interface DatabaseState {
  connectionState: ConnectionState;
  connectedAt?: Date;
}

/**
 * Creates a database wrapper with connection lifecycle management
 *
 * This wrapper provides:
 * - Connection state tracking
 * - Controlled connect/disconnect methods
 * - Type-safe access to the underlying client
 *
 * The client is NOT automatically connected - call `connect()` explicitly
 * or use `createDatabasePlugin` for automatic lifecycle management.
 *
 * @template TClient - Type of the Prisma client
 * @param config - Database configuration with client instance
 * @returns Database wrapper with lifecycle management
 *
 * @throws {VeloxError} If config is invalid or client doesn't implement DatabaseClient
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createDatabase } from '@veloxts/orm';
 *
 * const prisma = new PrismaClient();
 * const db = createDatabase({ client: prisma });
 *
 * // Manual connection management
 * await db.connect();
 * const users = await db.client.user.findMany();
 * await db.disconnect();
 * ```
 *
 * @example
 * ```typescript
 * // Check connection status
 * const db = createDatabase({ client: prisma });
 *
 * console.log(db.isConnected); // false
 * console.log(db.status.state); // 'disconnected'
 *
 * await db.connect();
 *
 * console.log(db.isConnected); // true
 * console.log(db.status.state); // 'connected'
 * console.log(db.status.connectedAt); // Date
 * ```
 */
export function createDatabase<TClient extends DatabaseClient>(
  config: DatabaseWrapperConfig<TClient>
): Database<TClient> {
  // Validate configuration
  if (!config || typeof config !== 'object') {
    throw new ConfigurationError('Database configuration is required');
  }

  if (!config.client) {
    throw new ConfigurationError('Database client is required in configuration');
  }

  // Validate that the client implements DatabaseClient interface
  if (!isDatabaseClient(config.client)) {
    throw new ConfigurationError('Database client must implement $connect and $disconnect methods');
  }

  // Internal state
  const state: DatabaseState = {
    connectionState: 'disconnected',
    connectedAt: undefined,
  };

  // PERFORMANCE: Cached status object to avoid creating new objects on each access
  // Updated only when connection state changes
  let cachedStatus: ConnectionStatus = buildStatusObject();

  /**
   * Builds a new status object from current state
   * @internal
   */
  function buildStatusObject(): ConnectionStatus {
    return {
      state: state.connectionState,
      isConnected: state.connectionState === 'connected',
      connectedAt: state.connectedAt,
    };
  }

  /**
   * Updates the cached status object when state changes
   * @internal
   */
  function updateCachedStatus(): void {
    cachedStatus = buildStatusObject();
  }

  // Connection method
  async function connect(): Promise<void> {
    if (state.connectionState === 'connected') {
      throw new VeloxError('Database is already connected', 500, 'DATABASE_ALREADY_CONNECTED');
    }

    if (state.connectionState === 'connecting') {
      throw new VeloxError(
        'Database connection is already in progress',
        500,
        'DATABASE_CONNECTION_IN_PROGRESS'
      );
    }

    state.connectionState = 'connecting';
    updateCachedStatus();

    try {
      await config.client.$connect();
      state.connectionState = 'connected';
      state.connectedAt = new Date();
      updateCachedStatus();
    } catch (error) {
      state.connectionState = 'disconnected';
      updateCachedStatus();
      throw new VeloxError(
        `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'DATABASE_CONNECTION_ERROR'
      );
    }
  }

  // Disconnection method
  async function disconnect(): Promise<void> {
    if (state.connectionState === 'disconnected') {
      throw new VeloxError('Database is not connected', 500, 'DATABASE_NOT_CONNECTED');
    }

    if (state.connectionState === 'disconnecting') {
      throw new VeloxError(
        'Database disconnection is already in progress',
        500,
        'DATABASE_DISCONNECTION_IN_PROGRESS'
      );
    }

    state.connectionState = 'disconnecting';
    updateCachedStatus();

    try {
      await config.client.$disconnect();
      state.connectionState = 'disconnected';
      state.connectedAt = undefined;
      updateCachedStatus();
    } catch (error) {
      // Even if disconnect fails, mark as disconnected
      state.connectionState = 'disconnected';
      state.connectedAt = undefined;
      updateCachedStatus();
      throw new VeloxError(
        `Failed to disconnect from database: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'DATABASE_DISCONNECTION_ERROR'
      );
    }
  }

  // Return the database wrapper object with proper getters for reactive properties
  // PERFORMANCE: status getter returns cached object instead of creating new one
  const database: Database<TClient> = {
    client: config.client,
    connect,
    disconnect,
    get status(): ConnectionStatus {
      return cachedStatus;
    },
    get isConnected(): boolean {
      return state.connectionState === 'connected';
    },
  };

  return database;
}
