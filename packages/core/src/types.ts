/**
 * Core TypeScript types for the VeloxTS framework
 * @module types
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// JSON Serialization Types
// ============================================================================

/**
 * Primitive JSON value types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-serializable array type
 */
export type JsonArray = JsonValue[];

/**
 * JSON-serializable object type
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Any JSON-serializable value
 *
 * Represents values that can be safely serialized to JSON and sent in HTTP responses.
 * Use this type to ensure handler return values are serializable.
 *
 * @example
 * ```typescript
 * // Valid JsonValue examples
 * const str: JsonValue = "hello";
 * const num: JsonValue = 42;
 * const arr: JsonValue = [1, 2, 3];
 * const obj: JsonValue = { name: "John", age: 30 };
 *
 * // Invalid - functions are not JSON serializable
 * // const fn: JsonValue = () => {}; // Error!
 * ```
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Async request handler function signature
 *
 * Handlers return JSON-serializable data or void. The response type
 * can be narrowed for better type safety in specific handlers.
 *
 * @template TContext - The context type available in the handler
 * @template TResponse - The response type (must be JSON serializable or void)
 * @param request - Fastify request object with context
 * @param reply - Fastify reply object
 * @returns Promise resolving to response data or void
 *
 * @example
 * ```typescript
 * // Handler with inferred response type
 * const handler: AsyncHandler<BaseContext> = async (request, reply) => {
 *   return { message: 'Hello World' };
 * };
 *
 * // Handler with explicit response type
 * type UserResponse = { id: string; name: string };
 * const getUser: AsyncHandler<BaseContext, UserResponse> = async (request) => {
 *   return { id: '1', name: 'John' };
 * };
 * ```
 */
export type AsyncHandler<
  TContext = unknown,
  TResponse extends JsonValue | undefined = JsonValue | undefined,
> = (request: FastifyRequest & { context: TContext }, reply: FastifyReply) => Promise<TResponse>;

/**
 * Synchronous request handler function signature
 *
 * @template TContext - The context type available in the handler
 * @template TResponse - The response type (must be JSON serializable or void)
 * @param request - Fastify request object with context
 * @param reply - Fastify reply object
 * @returns Response data or void
 *
 * @example
 * ```typescript
 * const handler: SyncHandler<BaseContext> = (request, reply) => {
 *   return { message: 'Hello World' };
 * };
 * ```
 */
export type SyncHandler<
  TContext = unknown,
  TResponse extends JsonValue | undefined = JsonValue | undefined,
> = (request: FastifyRequest & { context: TContext }, reply: FastifyReply) => TResponse;

// ============================================================================
// Lifecycle Types
// ============================================================================

/**
 * Lifecycle hook function signature
 * Hooks are called at specific points in the request/response lifecycle
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Promise that resolves when hook processing is complete
 *
 * @example
 * ```typescript
 * const hook: LifecycleHook = async (request, reply) => {
 *   console.log('Request received:', request.url);
 * };
 * ```
 */
export type LifecycleHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/**
 * Shutdown handler function signature
 * Called during graceful shutdown to clean up resources
 *
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * ```typescript
 * const shutdownHandler: ShutdownHandler = async () => {
 *   await database.disconnect();
 *   console.log('Database connection closed');
 * };
 * ```
 */
export type ShutdownHandler = () => Promise<void>;
