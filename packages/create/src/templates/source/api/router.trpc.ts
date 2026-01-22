/**
 * Router Definition - tRPC Hybrid Template
 *
 * This file exports the typed tRPC router for frontend type safety.
 * It MUST NOT have any side effects (like importing dotenv) so that
 * the frontend can safely import types from here.
 *
 * IMPORTANT: Do not add 'import dotenv/config' or any side-effect imports here.
 * The server entry point (index.ts) handles environment setup.
 */

// Triple-slash reference ensures TypeScript processes our type augmentations
// for BaseContext (e.g., ctx.db) before type-checking procedures.
// This is NOT a runtime import - it only affects type checking.
/// <reference path="./types.ts" />

import { rpc } from '@veloxts/velox';

import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

/**
 * Procedure collections for REST and tRPC registration
 *
 * IMPORTANT: Use `as const` to preserve literal types for full type inference.
 */
export const collections = [healthProcedures, userProcedures] as const;

/**
 * Create typed tRPC router using the rpc() helper
 *
 * The rpc() helper returns:
 * - `router`: Fully typed tRPC router for client type inference
 * - `register`: Async function to register tRPC routes with Fastify
 *
 * NOTE: `register` is not exported to avoid TypeScript portability issues.
 * Use registerRpc() in index.ts instead.
 */
const { router } = rpc(collections, { prefix: '/trpc' });

/**
 * Typed tRPC router for client imports
 *
 * Use this for type-safe frontend-backend communication.
 */
export { router };

/**
 * AppRouter type for frontend type safety
 *
 * This is the properly typed tRPC router that enables:
 * - Full autocomplete for procedure names
 * - Type-safe input validation
 * - Inferred output types
 *
 * @example
 * ```typescript
 * import type { AppRouter } from '../../api/src/router.js';
 * import { createTRPCClient } from '@trpc/client';
 *
 * const client = createTRPCClient<AppRouter>({ links: [...] });
 * const users = await client.users.listUsers.query(); // Fully typed!
 * ```
 */
export type AppRouter = typeof router;
