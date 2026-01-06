/**
 * Narrowing Guards (Experimental)
 *
 * These guards provide TypeScript type narrowing after they pass.
 * When using `guardNarrow(authenticatedNarrow)`, the context type
 * is narrowed to guarantee `ctx.user` is non-null.
 *
 * EXPERIMENTAL: This API may change. The current recommended approach
 * is to use middleware for context type extension.
 *
 * @module auth/guards-narrowing
 */

import type { AuthContext, GuardFunction, User } from './types.js';
import { authenticated, hasRole as hasRoleBase } from './guards.js';

// ============================================================================
// Narrowing Guard Types
// ============================================================================

/**
 * A guard that narrows the context type after passing.
 *
 * The `_narrows` phantom type indicates what the guard guarantees
 * about the context after it passes.
 *
 * @template TRequired - Context properties required to run the guard
 * @template TGuaranteed - Context properties guaranteed after guard passes
 */
export interface NarrowingGuard<TRequired, TGuaranteed> {
  /** Guard name for error messages */
  name: string;
  /** Guard check function (matches GuardFunction signature) */
  check: GuardFunction<TRequired>;
  /** Custom error message */
  message?: string;
  /** HTTP status code for guard failures */
  statusCode?: number;
  /**
   * Phantom type declaring what the guard guarantees.
   * Used by ProcedureBuilder.guardNarrow() for type narrowing.
   * @internal
   */
  readonly _narrows: TGuaranteed;
}

/**
 * Context type with a guaranteed authenticated user.
 *
 * After `authenticatedNarrow` passes, the context is narrowed to this type.
 */
export interface AuthenticatedContext {
  auth: AuthContext & { isAuthenticated: true };
  user: User;
}

/**
 * Context type with a guaranteed user having specific roles.
 */
export interface RoleNarrowedContext {
  user: User & { roles: string[] };
}

// ============================================================================
// Narrowing Guards
// ============================================================================

/**
 * Authenticated guard with type narrowing.
 *
 * When used with `guardNarrow()`, narrows `ctx.user` from `User | undefined`
 * to `User`, eliminating the need for null checks in the handler.
 *
 * @example
 * ```typescript
 * import { authenticatedNarrow } from '@veloxts/auth';
 *
 * // With guardNarrow (experimental):
 * procedure()
 *   .guardNarrow(authenticatedNarrow)
 *   .query(({ ctx }) => {
 *     // ctx.user is typed as User (non-null)
 *     return { email: ctx.user.email };
 *   });
 *
 * // Current recommended alternative using middleware:
 * procedure()
 *   .guard(authenticated)
 *   .use(async ({ ctx, next }) => {
 *     if (!ctx.user) throw new Error('Unreachable');
 *     return next({ ctx: { user: ctx.user } });
 *   })
 *   .query(({ ctx }) => {
 *     // ctx.user is non-null via middleware
 *   });
 * ```
 */
export const authenticatedNarrow: NarrowingGuard<
  { auth?: AuthContext },
  AuthenticatedContext
> = {
  ...authenticated,
  // Phantom type: value is never used at runtime, only carries type info.
  // The `undefined as unknown as T` pattern is standard for phantom types.
  _narrows: undefined as unknown as AuthenticatedContext,
};

/**
 * Creates a role-checking guard with type narrowing.
 *
 * Narrows `ctx.user` to guarantee non-null with roles array.
 *
 * @param roles - Required role(s)
 * @returns NarrowingGuard that guarantees user with roles
 *
 * @example
 * ```typescript
 * import { hasRoleNarrow } from '@veloxts/auth';
 *
 * procedure()
 *   .guardNarrow(hasRoleNarrow('admin'))
 *   .mutation(({ ctx }) => {
 *     // ctx.user is typed as User (non-null)
 *     // ctx.user.roles is string[]
 *   });
 * ```
 */
export function hasRoleNarrow(
  roles: string | string[]
): NarrowingGuard<{ user?: User }, RoleNarrowedContext> {
  const baseGuard = hasRoleBase(roles);
  return {
    ...baseGuard,
    // Phantom type: carries type info for guardNarrow() context narrowing
    _narrows: undefined as unknown as RoleNarrowedContext,
  };
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Extracts the narrowed context type from a NarrowingGuard.
 *
 * @example
 * ```typescript
 * type Ctx = InferNarrowedContext<typeof authenticatedNarrow>;
 * // Ctx = AuthenticatedContext = { auth: AuthContext & { isAuthenticated: true }; user: User }
 * ```
 */
export type InferNarrowedContext<T> = T extends NarrowingGuard<unknown, infer U> ? U : never;
