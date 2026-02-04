/**
 * Narrowing Guards (Experimental)
 *
 * These guards provide TypeScript type narrowing after they pass.
 * When using `guardNarrow(authenticatedNarrow)`, the context type
 * is narrowed to guarantee `ctx.user` is non-null.
 *
 * Additionally, these guards add phantom type tags for use with the
 * Resource API, enabling context-dependent output types.
 *
 * EXPERIMENTAL: This API may change. The current recommended approach
 * is to use middleware for context type extension.
 *
 * @module auth/guards-narrowing
 */

import type { AccessLevel, ADMIN, AUTHENTICATED, TaggedContext } from '@veloxts/router';

import { authenticated, hasRole as hasRoleBase } from './guards.js';
import type { AuthContext, GuardFunction, User } from './types.js';

// Re-export phantom type tags from @veloxts/router for convenience (type-only)
export type { AccessLevel, ADMIN, AUTHENTICATED, TaggedContext };

// ============================================================================
// Narrowing Guard Types
// ============================================================================

/**
 * A guard that narrows the context type after passing.
 *
 * The `_narrows` phantom type indicates what the guard guarantees
 * about the context after it passes.
 *
 * The `accessLevel` property is used by the procedure builder to
 * automatically set `ctx.__accessLevel` for resource auto-projection.
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
  /**
   * Runtime access level for automatic resource projection.
   *
   * When set, the procedure builder will automatically assign this
   * value to `ctx.__accessLevel` after the guard passes, enabling
   * auto-projection with `.resource()`.
   */
  accessLevel?: AccessLevel;
}

/**
 * Context type with a guaranteed authenticated user.
 *
 * After `authenticatedNarrow` passes, the context is narrowed to this type.
 * Includes a phantom tag for the Resource API.
 */
export interface AuthenticatedContext extends TaggedContext<typeof AUTHENTICATED> {
  auth: AuthContext & { isAuthenticated: true };
  user: User;
}

/**
 * Context type with a guaranteed user having admin role.
 *
 * After `adminNarrow` passes, the context is narrowed to this type.
 * Includes a phantom tag for the Resource API.
 */
export interface AdminContext extends TaggedContext<typeof ADMIN> {
  auth: AuthContext & { isAuthenticated: true };
  user: User & { roles: string[] };
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
export const authenticatedNarrow: NarrowingGuard<{ auth?: AuthContext }, AuthenticatedContext> = {
  ...authenticated,
  // Phantom type: value is never used at runtime, only carries type info.
  // The `undefined as unknown as T` pattern is standard for phantom types.
  _narrows: undefined as unknown as AuthenticatedContext,
  // Runtime access level for auto-projection with .resource()
  accessLevel: 'authenticated',
};

/**
 * Admin guard with type narrowing and phantom tag.
 *
 * When used with `guardNarrow()`, narrows `ctx.user` to a User with admin role
 * and tags the context with ADMIN for use with the Resource API.
 *
 * @example
 * ```typescript
 * import { adminNarrow } from '@veloxts/auth';
 * import { resource, UserSchema } from '@veloxts/router';
 *
 * procedure()
 *   .guardNarrow(adminNarrow)
 *   .query(({ ctx }) => {
 *     // ctx.user is typed as User with roles: string[]
 *     // When used with resource(), returns all fields including admin-only
 *     const user = await ctx.db.user.findUnique({ where: { id } });
 *     return resource(user, UserSchema).forAdmin();
 *   });
 * ```
 */
export const adminNarrow: NarrowingGuard<{ user?: User }, AdminContext> = {
  ...hasRoleBase('admin'),
  // Phantom type: carries type info for guardNarrow() and Resource API
  _narrows: undefined as unknown as AdminContext,
  // Runtime access level for auto-projection with .resource()
  accessLevel: 'admin',
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
