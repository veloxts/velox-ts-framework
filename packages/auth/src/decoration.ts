/**
 * Shared decoration utilities for @veloxts/auth
 *
 * This module provides common functionality for decorating Fastify instances
 * and requests with authentication state, shared between the native auth plugin
 * and external auth adapters.
 *
 * @module auth/decoration
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthContext, User } from './types.js';

// ============================================================================
// Registration Protection
// ============================================================================

/**
 * Symbol used to mark a Fastify instance as having auth already registered.
 *
 * This prevents double-registration of conflicting auth systems (e.g., using
 * both authPlugin and an AuthAdapter on the same server).
 */
export const AUTH_REGISTERED = Symbol.for('@veloxts/auth/registered');

/**
 * Extended Fastify instance type with auth registration marker
 * @internal
 */
interface FastifyWithAuthMarker extends FastifyInstance {
  [AUTH_REGISTERED]?: string;
}

/**
 * Checks for double-registration of auth systems and throws if detected.
 *
 * Call this at the start of both `authPlugin` and `createAuthAdapterPlugin`
 * registration to ensure only one auth system is active.
 *
 * @param fastify - Fastify server instance
 * @param source - Identifier for the auth system being registered (e.g., 'authPlugin', 'adapter:better-auth')
 * @throws {Error} If auth has already been registered by another source
 *
 * @example
 * ```typescript
 * // In authPlugin registration
 * checkDoubleRegistration(fastify, 'authPlugin');
 *
 * // In adapter plugin registration
 * checkDoubleRegistration(fastify, `adapter:${adapter.name}`);
 * ```
 */
export function checkDoubleRegistration(fastify: FastifyInstance, source: string): void {
  const decorated = fastify as FastifyWithAuthMarker;

  if (decorated[AUTH_REGISTERED]) {
    throw new Error(
      `Auth already registered by "${decorated[AUTH_REGISTERED]}". ` +
        `Cannot register "${source}". ` +
        `Use either authPlugin OR an AuthAdapter, not both.`
    );
  }

  decorated[AUTH_REGISTERED] = source;
}

// ============================================================================
// Request Decoration
// ============================================================================

/**
 * Extended request type with auth properties
 * @internal
 */
interface AuthDecoratedRequest extends FastifyRequest {
  auth?: AuthContext;
  user?: User;
}

/**
 * Decorates a Fastify instance with auth-related request decorators.
 *
 * This function safely adds `auth` and `user` properties to requests,
 * checking if they already exist (idempotent operation).
 *
 * @param fastify - Fastify server instance to decorate
 *
 * @example
 * ```typescript
 * decorateAuth(fastify);
 * // Now all requests will have request.auth and request.user available
 * ```
 */
export function decorateAuth(fastify: FastifyInstance): void {
  if (!fastify.hasRequestDecorator('auth')) {
    fastify.decorateRequest('auth', undefined);
  }
  if (!fastify.hasRequestDecorator('user')) {
    fastify.decorateRequest('user', undefined);
  }
}

/**
 * Sets the auth context and user on a request.
 *
 * This is a type-safe helper that properly casts the request to include
 * auth properties before setting them.
 *
 * @param request - Fastify request object
 * @param auth - Auth context to set
 * @param user - User to set (optional, defaults to auth.user if NativeAuthContext)
 *
 * @example
 * ```typescript
 * setRequestAuth(request, {
 *   authMode: 'native',
 *   isAuthenticated: true,
 *   token: tokenPayload,
 *   payload: tokenPayload,
 * }, user);
 * ```
 */
export function setRequestAuth(request: FastifyRequest, auth: AuthContext, user?: User): void {
  const decoratedRequest = request as AuthDecoratedRequest;
  decoratedRequest.auth = auth;
  decoratedRequest.user = user ?? (auth.isAuthenticated && 'user' in auth ? auth.user : undefined);
}

/**
 * Gets the current auth context from a request.
 *
 * @param request - Fastify request object
 * @returns The auth context, or undefined if not set
 */
export function getRequestAuth(request: FastifyRequest): AuthContext | undefined {
  return (request as AuthDecoratedRequest).auth;
}

/**
 * Gets the current user from a request.
 *
 * @param request - Fastify request object
 * @returns The user, or undefined if not authenticated
 */
export function getRequestUser(request: FastifyRequest): User | undefined {
  return (request as AuthDecoratedRequest).user;
}
