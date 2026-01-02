/**
 * Type definitions for @veloxts/orm
 *
 * Provides type-safe abstractions for Prisma client integration
 * without requiring direct Prisma dependency.
 *
 * @module types
 */

// ============================================================================
// Error Code Extension
// ============================================================================

/**
 * Extend the VeloxErrorCodeRegistry to include ORM-specific error codes
 *
 * This enables type-safe error handling for database-related errors
 */
declare module '@veloxts/core' {
  interface VeloxErrorCodeRegistry {
    orm:
      | 'DATABASE_CONNECTION_ERROR'
      | 'DATABASE_DISCONNECTION_ERROR'
      | 'DATABASE_NOT_CONNECTED'
      | 'DATABASE_ALREADY_CONNECTED'
      | 'DATABASE_CONNECTION_IN_PROGRESS'
      | 'DATABASE_DISCONNECTION_IN_PROGRESS';
  }
}

// ============================================================================
// Database Client Types
// ============================================================================

/**
 * Minimal interface that any Prisma client must satisfy
 *
 * This interface allows the ORM package to work with any Prisma client
 * without requiring @prisma/client as a direct dependency.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 *
 * // PrismaClient satisfies DatabaseClient
 * const prisma: DatabaseClient = new PrismaClient();
 * ```
 */
export interface DatabaseClient {
  /**
   * Establishes connection to the database
   *
   * Called automatically when using databasePlugin,
   * or can be called manually with createDatabase.
   */
  $connect: () => Promise<void>;

  /**
   * Disconnects from the database
   *
   * Called automatically during app shutdown when using databasePlugin,
   * or can be called manually with createDatabase.
   */
  $disconnect: () => Promise<void>;
}

/**
 * Type guard to check if an object is a valid DatabaseClient
 *
 * Uses property checks to ensure the object has the required methods
 * without using type assertions.
 *
 * @param value - Value to check
 * @returns true if value satisfies DatabaseClient interface
 *
 * @example
 * ```typescript
 * if (isDatabaseClient(unknownValue)) {
 *   await unknownValue.$connect();
 * }
 * ```
 */
export function isDatabaseClient(value: unknown): value is DatabaseClient {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check for required methods
  return (
    '$connect' in value &&
    typeof value.$connect === 'function' &&
    '$disconnect' in value &&
    typeof value.$disconnect === 'function'
  );
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the database plugin
 *
 * @template TClient - Type of the Prisma client
 */
export interface OrmPluginConfig<TClient extends DatabaseClient> {
  /**
   * The Prisma client instance to use
   *
   * Must be an already-instantiated PrismaClient. Connection will be
   * managed by the plugin (connect on start, disconnect on shutdown).
   *
   * @example
   * ```typescript
   * const prisma = new PrismaClient();
   * const plugin = databasePlugin({ client: prisma });
   * ```
   */
  client: TClient;

  /**
   * Custom name for the plugin registration
   *
   * Defaults to '@veloxts/orm'. Useful when registering multiple database
   * connections with different names.
   *
   * @default '@veloxts/orm'
   */
  name?: string;

  /**
   * DI container for service registration and resolution (optional)
   *
   * When provided, ORM services are registered with the container and can be:
   * - Resolved from the container directly
   * - Mocked in tests by overriding registrations
   * - Managed alongside other application services
   *
   * When not provided, services are created directly (legacy behavior).
   *
   * @example
   * ```typescript
   * import { Container } from '@veloxts/core';
   * import { databasePlugin, DATABASE } from '@veloxts/orm';
   *
   * const container = new Container();
   * app.register(databasePlugin({
   *   client: prisma,
   *   container,
   * }));
   *
   * // Services now available from container
   * const db = container.resolve(DATABASE);
   * ```
   */
  container?: import('@veloxts/core').Container;
}

/**
 * Configuration options for the database wrapper
 */
export interface DatabaseWrapperConfig<TClient extends DatabaseClient> {
  /**
   * The Prisma client instance to wrap
   */
  client: TClient;
}

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * Possible states of a database connection
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

/**
 * Database connection status information
 */
export interface ConnectionStatus {
  /**
   * Current connection state
   */
  state: ConnectionState;

  /**
   * Whether the database is currently connected and ready for queries
   */
  isConnected: boolean;

  /**
   * Timestamp of last successful connection, if any
   */
  connectedAt?: Date;
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Infer the client type from an OrmPluginConfig
 *
 * @template T - OrmPluginConfig type
 *
 * @example
 * ```typescript
 * const config = { client: new PrismaClient() };
 * type Client = InferClientType<typeof config>;
 * // Client = PrismaClient
 * ```
 */
export type InferClientType<T> = T extends OrmPluginConfig<infer C> ? C : never;

/**
 * Infer the client type from a Database wrapper
 *
 * @template T - Database wrapper type
 */
export type InferDatabaseClient<T> = T extends { client: infer C } ? C : never;
