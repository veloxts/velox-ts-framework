/**
 * Typed Context Utilities
 *
 * Provides an alternative to declaration merging that is more discoverable
 * and provides better IDE support for context typing.
 *
 * @module typed-context
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Base properties always available in context
 */
export interface CoreContext {
  request: FastifyRequest;
  reply: FastifyReply;
}

/**
 * Type for context extensions provided by plugins
 */
export type ContextExtension = Record<string, unknown>;

// ============================================================================
// Type Composition Utilities
// ============================================================================

/**
 * Helper to convert union to intersection
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Merges core context with plugin extensions
 */
export type MergeContext<TExtensions extends ContextExtension[]> = CoreContext &
  UnionToIntersection<TExtensions[number]>;

/**
 * Combines multiple context extensions into one
 *
 * @example
 * ```typescript
 * type AppContext = CombineContexts<[
 *   { db: PrismaClient },
 *   { auth?: { user?: User } },
 *   { session?: Session },
 * ]>;
 * // Result: CoreContext & { db: PrismaClient } & { auth?: ... } & { session?: ... }
 * ```
 */
export type CombineContexts<T extends ContextExtension[]> = MergeContext<T>;

// ============================================================================
// Context Definition Helper
// ============================================================================

/**
 * Defines application context type from plugin extensions
 *
 * This is the primary way to create a typed context without declaration merging.
 * Define once in your app's context file, use everywhere.
 *
 * @example
 * ```typescript
 * // In your app's context.ts
 * import type { defineContext, DbContextExtension } from '@veloxts/core';
 * import type { PrismaClient } from './generated/prisma/client.js';
 *
 * export type AppContext = defineContext<[
 *   DbContextExtension<PrismaClient>,
 * ]>;
 *
 * // AppContext = {
 * //   request: FastifyRequest;
 * //   reply: FastifyReply;
 * //   db: PrismaClient;
 * // }
 * ```
 */
export type defineContext<T extends ContextExtension[]> = MergeContext<T>;

// ============================================================================
// Plugin Context Type Exports
// ============================================================================

/**
 * Context extension type for ORM plugin
 *
 * @example
 * ```typescript
 * import type { DbContextExtension } from '@veloxts/core';
 * import type { PrismaClient } from './generated/prisma/client.js';
 *
 * type AppContext = defineContext<[
 *   DbContextExtension<PrismaClient>,
 * ]>;
 * ```
 */
export type DbContextExtension<TClient> = { db: TClient };

/**
 * Context extension type for Auth plugin
 *
 * @example
 * ```typescript
 * import type { AuthContextExtension } from '@veloxts/core';
 * import type { User } from './types.js';
 *
 * type AppContext = defineContext<[
 *   AuthContextExtension<User>,
 * ]>;
 * ```
 */
export type AuthContextExtension<TUser> = {
  auth?: {
    user?: TUser;
    isAuthenticated: boolean;
  };
};

/**
 * Context extension type for Session plugin
 *
 * @example
 * ```typescript
 * import type { SessionContextExtension } from '@veloxts/core';
 *
 * type AppContext = defineContext<[
 *   SessionContextExtension<{ cart: string[] }>,
 * ]>;
 * ```
 */
export type SessionContextExtension<TSessionData = Record<string, unknown>> = {
  session?: {
    id: string;
    data: TSessionData;
    get: <K extends keyof TSessionData>(key: K) => TSessionData[K] | undefined;
    set: <K extends keyof TSessionData>(key: K, value: TSessionData[K]) => void;
  };
};
