/**
 * Contract Utilities - Browser-Safe Type Definitions
 *
 * These utilities enable "Great DX" by allowing developers to define
 * type contracts in a concise, type-safe manner that's compatible
 * with browser bundling.
 *
 * The key insight is that Zod schemas are browser-safe, so we can
 * use them to define contracts without pulling in server code.
 *
 * @example
 * ```typescript
 * // schemas/user.ts - Browser-safe Zod schemas
 * export const GetUserInput = z.object({ id: z.string() });
 * export const UserSchema = z.object({ id: z.string(), name: z.string() });
 *
 * // contracts.ts - Type-safe contract definition
 * import { defineContract } from '@veloxts/router';
 * import { GetUserInput, UserSchema } from './schemas/user.js';
 *
 * export const userContracts = defineContract({
 *   getUser: { input: GetUserInput, output: UserSchema },
 *   createUser: { input: CreateUserInput, output: UserSchema },
 * });
 *
 * export type AppRouter = { users: typeof userContracts };
 * ```
 *
 * @module contracts
 */

import type { ZodType, ZodTypeDef } from 'zod';

// ============================================================================
// Contract Type Definitions
// ============================================================================

/**
 * Represents a single procedure's input/output contract
 *
 * Both input and output are optional to support:
 * - Procedures with no input (e.g., getHealth)
 * - Procedures with inferred output (less common)
 */
export interface ContractEntry {
  /** Input validation schema (optional for procedures with no input) */
  input?: ZodType<unknown, ZodTypeDef, unknown>;
  /** Output validation schema (optional for inferred output) */
  output?: ZodType<unknown, ZodTypeDef, unknown>;
}

/**
 * A collection of procedure contracts
 */
export type ContractDefinition = Record<string, ContractEntry>;

/**
 * Infers the TypeScript type from a Zod schema
 *
 * @template T - The Zod schema type
 */
type InferZodType<T> = T extends ZodType<infer O, ZodTypeDef, unknown> ? O : undefined;

/**
 * Transforms a contract entry into its inferred types
 *
 * @template T - The contract entry type
 */
type InferContractEntry<T extends ContractEntry> = {
  input: T['input'] extends ZodType ? InferZodType<T['input']> : undefined;
  output: T['output'] extends ZodType ? InferZodType<T['output']> : undefined;
};

/**
 * Transforms a contract definition into inferred procedure types
 *
 * This is the core type utility that enables automatic type inference
 * from Zod schemas to procedure contracts.
 *
 * @template T - The contract definition type
 *
 * @example
 * ```typescript
 * const contracts = defineContract({
 *   getUser: { input: GetUserInput, output: UserSchema },
 * });
 *
 * // InferContract<typeof contracts> = {
 * //   getUser: { input: { id: string }; output: { id: string; name: string } }
 * // }
 * ```
 */
export type InferContract<T extends ContractDefinition> = {
  [K in keyof T]: InferContractEntry<T[K]>;
};

/**
 * Infers router types from a collection of contracts
 *
 * @template T - Record of namespace to contract definitions
 *
 * @example
 * ```typescript
 * export type AppRouter = InferRouterFromContracts<{
 *   users: typeof userContracts;
 *   auth: typeof authContracts;
 * }>;
 * ```
 */
export type InferRouterFromContracts<T extends Record<string, ContractDefinition>> = {
  [K in keyof T]: InferContract<T[K]>;
};

// ============================================================================
// Contract Definition Helper
// ============================================================================

/**
 * Defines a type-safe procedure contract from Zod schemas
 *
 * This function provides compile-time validation and autocomplete while
 * returning the contract definition for type inference. The runtime value
 * is just passed through - the magic is all in the types.
 *
 * **Why use defineContract?**
 * - Automatic type inference from Zod schemas
 * - TypeScript validates schema existence at compile time
 * - Autocomplete for schema imports
 * - One-line per procedure (vs 5+ lines with manual types)
 * - Browser-safe - only imports Zod schemas, not server code
 *
 * @template T - The contract definition type (inferred)
 * @param contracts - Object mapping procedure names to their schemas
 * @returns The same object, typed for inference
 *
 * @example
 * ```typescript
 * // Define contracts alongside your schemas
 * import { GetUserInput, UserSchema, CreateUserInput } from './schemas/user.js';
 *
 * export const userContracts = defineContract({
 *   getUser: { input: GetUserInput, output: UserSchema },
 *   listUsers: { output: z.array(UserSchema) },
 *   createUser: { input: CreateUserInput, output: UserSchema },
 *   deleteUser: { input: z.object({ id: z.string() }), output: z.object({ success: z.boolean() }) },
 * });
 *
 * // Use in AppRouter type
 * export type AppRouter = {
 *   users: typeof userContracts;
 *   auth: typeof authContracts;
 * };
 * ```
 */
export function defineContract<T extends ContractDefinition>(contracts: T): T {
  return contracts;
}

// ============================================================================
// Route Definition Helper
// ============================================================================

/**
 * HTTP method type
 */
export type HttpMethodRoute = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A single route entry
 */
export interface RouteDefinition {
  method: HttpMethodRoute;
  path: string;
}

/**
 * Collection of route definitions for a namespace
 */
export type RoutesDefinition = Record<string, RouteDefinition>;

/**
 * Defines route mappings for frontend client
 *
 * This helper provides type safety and autocomplete for route definitions,
 * making it easier to maintain route mappings that match your procedures.
 *
 * @template T - The routes definition type (inferred)
 * @param routes - Object mapping procedure names to their routes
 * @returns The same object, typed for client consumption
 *
 * @example
 * ```typescript
 * export const userRoutes = defineRoutes({
 *   getUser: { method: 'GET', path: '/users/:id' },
 *   listUsers: { method: 'GET', path: '/users' },
 *   createUser: { method: 'POST', path: '/users' },
 * });
 *
 * export const routes = {
 *   users: userRoutes,
 *   auth: authRoutes,
 * } as const;
 * ```
 */
export function defineRoutes<T extends RoutesDefinition>(routes: T): T {
  return routes;
}
