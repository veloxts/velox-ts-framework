/**
 * Authorization guards for @veloxts/auth
 * @module auth/guards
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthContext, GuardDefinition, GuardFunction, User } from './types.js';

// ============================================================================
// Guard Factory
// ============================================================================

/**
 * Creates a guard definition from a check function
 *
 * @example
 * ```typescript
 * const isAdmin = defineGuard({
 *   name: 'isAdmin',
 *   check: (ctx) => ctx.user?.role === 'admin',
 *   message: 'Admin access required',
 * });
 * ```
 */
export function defineGuard<TContext = unknown>(
  definition: GuardDefinition<TContext>
): GuardDefinition<TContext> {
  return {
    statusCode: 403,
    ...definition,
  };
}

// ============================================================================
// Guard Builder (Fluent API)
// ============================================================================

/**
 * Fluent guard builder for progressive configuration
 *
 * Allows building guards step-by-step with method chaining.
 * The builder is compatible with GuardLike, so it can be used
 * directly with `.guard()` on procedures.
 *
 * **Note**: This builder uses mutable internal state. Each method
 * modifies the builder and returns the same instance. See
 * `createGuardBuilder` for usage patterns and caveats.
 */
export interface GuardBuilder<TContext> {
  /** Guard name for error messages (read-only, set via named()) */
  readonly name: string;
  /** Guard check function (read-only) */
  readonly check: GuardFunction<TContext>;
  /** Custom error message (read-only, set via msg()) */
  readonly message: string | undefined;
  /** HTTP status code on failure (read-only, set via status()) */
  readonly statusCode: number;

  /** Set a descriptive name (used in error messages and debugging) */
  named(name: string): GuardBuilder<TContext>;
  /** Set custom error message shown when guard fails */
  msg(message: string): GuardBuilder<TContext>;
  /** Set HTTP status code returned when guard fails (default: 403) */
  status(code: number): GuardBuilder<TContext>;
}

/**
 * Counter for generating unique guard names when not provided
 * @internal
 */
let guardCounter = 0;

/**
 * Resets the guard counter to zero.
 *
 * This is intended for testing purposes only to ensure deterministic
 * guard naming across test runs. Should not be used in production code.
 *
 * @internal
 * @example
 * ```typescript
 * import { _resetGuardCounter } from '@veloxts/auth';
 *
 * beforeEach(() => {
 *   _resetGuardCounter();
 * });
 * ```
 */
export function _resetGuardCounter(): void {
  guardCounter = 0;
}

/**
 * Attempts to infer a meaningful name from a guard check function
 * @internal
 */
function inferGuardName<TContext>(check: GuardFunction<TContext>): string {
  // Try to use function name if it exists and isn't generic
  if (check.name && check.name !== 'check' && check.name !== 'anonymous') {
    return check.name;
  }
  // Fall back to generated name
  return `guard_${++guardCounter}`;
}

/**
 * Creates a guard builder instance.
 *
 * The builder uses **mutable internal state** with method chaining that returns
 * the same instance. This is intentional for performance and API simplicity:
 *
 * ```typescript
 * // Each method mutates the builder and returns `this`
 * const myGuard = guard((ctx) => ctx.user?.active)
 *   .named('isActive')      // Mutates name, returns same builder
 *   .msg('User inactive')   // Mutates message, returns same builder
 *   .status(403);           // Mutates statusCode, returns same builder
 *
 * // The builder IS the guard definition (implements GuardLike)
 * // No need to call .build() - use directly with .guard()
 * ```
 *
 * **Important**: Because the builder mutates, avoid patterns like:
 * ```typescript
 * // DON'T do this - both variables reference the same mutable builder
 * const base = guard((ctx) => ctx.user != null);
 * const withMsg = base.msg('Auth required');
 * const withOtherMsg = base.msg('Login needed'); // Overwrites previous msg!
 * ```
 *
 * If you need variations, create separate guards:
 * ```typescript
 * const authRequired = guard((ctx) => ctx.user != null, 'Auth required');
 * const loginNeeded = guard((ctx) => ctx.user != null, 'Login needed');
 * ```
 *
 * @internal
 */
function createGuardBuilder<TContext>(
  check: GuardFunction<TContext>,
  initialName: string
): GuardBuilder<TContext> {
  // Mutable internal state - intentionally not exposed directly
  let guardName = initialName;
  let guardMessage: string | undefined;
  let guardStatusCode = 403;

  const builder: GuardBuilder<TContext> = {
    // GuardLike compatible properties (getters for current values)
    get name() {
      return guardName;
    },
    get check() {
      return check;
    },
    get message() {
      return guardMessage;
    },
    get statusCode() {
      return guardStatusCode;
    },

    // Builder methods (return self for chaining)
    named(name: string) {
      guardName = name;
      return builder;
    },
    msg(message: string) {
      guardMessage = message;
      return builder;
    },
    status(code: number) {
      guardStatusCode = code;
      return builder;
    },
  };

  return builder;
}

// ============================================================================
// Guard Factory (Multiple Signatures)
// ============================================================================

/**
 * Creates a guard with simplified syntax
 *
 * Supports three usage patterns with progressive disclosure:
 *
 * @example Simple check function (returns builder for configuration)
 * ```typescript
 * const isVerified = guard((ctx) => ctx.user?.emailVerified === true)
 *   .msg('Email verification required');
 * ```
 *
 * @example Check with message (most common - auto-generates name)
 * ```typescript
 * const isVerified = guard(
 *   (ctx) => ctx.user?.emailVerified === true,
 *   'Email verification required'
 * );
 * ```
 *
 * @example Named guard (explicit name for debugging)
 * ```typescript
 * const isActive = guard('isActive', (ctx) => ctx.user?.status === 'active');
 * ```
 *
 * @example Full fluent configuration
 * ```typescript
 * const isPremium = guard((ctx) => ctx.user?.subscription === 'premium')
 *   .named('isPremium')
 *   .msg('Premium subscription required')
 *   .status(402);
 * ```
 */
// Overload 1: Check function only → returns builder for configuration
export function guard<TContext = unknown>(check: GuardFunction<TContext>): GuardBuilder<TContext>;

// Overload 2: Check with message (most common pattern)
export function guard<TContext = unknown>(
  check: GuardFunction<TContext>,
  message: string
): GuardDefinition<TContext>;

// Overload 3: Legacy signature (name, check) for backwards compatibility
export function guard<TContext = unknown>(
  name: string,
  check: GuardFunction<TContext>
): GuardDefinition<TContext>;

// Implementation
export function guard<TContext = unknown>(
  nameOrCheck: string | GuardFunction<TContext>,
  checkOrMessage?: GuardFunction<TContext> | string
): GuardDefinition<TContext> | GuardBuilder<TContext> {
  // Overload 3: Legacy (name, check)
  if (typeof nameOrCheck === 'string' && typeof checkOrMessage === 'function') {
    return defineGuard({ name: nameOrCheck, check: checkOrMessage });
  }

  // Overloads 1 & 2: (check) or (check, message)
  if (typeof nameOrCheck === 'function') {
    const check = nameOrCheck;
    const message = typeof checkOrMessage === 'string' ? checkOrMessage : undefined;

    if (message !== undefined) {
      // Overload 2: Simple form with message - return completed guard
      return defineGuard({
        name: inferGuardName(check),
        check,
        message,
      });
    }

    // Overload 1: Return builder for fluent configuration
    return createGuardBuilder(check, inferGuardName(check));
  }

  throw new Error('Invalid guard arguments: expected (check), (check, message), or (name, check)');
}

// ============================================================================
// Built-in Guards
// ============================================================================

/**
 * Guard that requires authentication
 * Rejects requests without a valid user
 */
export const authenticated: GuardDefinition<{ auth?: AuthContext }> = defineGuard({
  name: 'authenticated',
  check: (ctx) => ctx.auth?.isAuthenticated === true,
  message: 'Authentication required',
  statusCode: 401,
});

/**
 * Guard that requires a verified email
 */
export const emailVerified: GuardDefinition<{ user?: User }> = defineGuard({
  name: 'emailVerified',
  check: (ctx) => ctx.user?.emailVerified === true,
  message: 'Email verification required',
  statusCode: 403,
});

/**
 * Creates a guard that checks if user has a specific role
 *
 * Checks if the user has ANY of the specified roles.
 *
 * @example
 * ```typescript
 * const adminOnly = hasRole('admin');
 * const moderatorOrAdmin = hasRole(['admin', 'moderator']);
 *
 * // User with multiple roles
 * const user = { id: '1', email: 'a@b.com', roles: ['editor', 'moderator'] };
 * hasRole('moderator') // passes - user has 'moderator' role
 * hasRole(['admin', 'editor']) // passes - user has 'editor' role
 * ```
 */
export function hasRole(roles: string | string[]): GuardDefinition<{ user?: User }> {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return defineGuard({
    name: `hasRole:${requiredRoles.join(',')}`,
    check: (ctx) => {
      const userRoles = ctx.user?.roles;
      if (!Array.isArray(userRoles) || userRoles.length === 0) {
        return false;
      }
      return requiredRoles.some((role) => userRoles.includes(role));
    },
    message: `Required role: ${requiredRoles.join(' or ')}`,
  });
}

/**
 * Creates a guard that checks if user has specific permissions
 *
 * Requires ALL specified permissions (AND logic).
 *
 * @example
 * ```typescript
 * const canEdit = hasPermission('posts.edit');
 * const canManageUsers = hasPermission(['users.create', 'users.delete']);
 * ```
 */
export function hasPermission(permissions: string | string[]): GuardDefinition<{ user?: User }> {
  const required = Array.isArray(permissions) ? permissions : [permissions];

  return defineGuard({
    name: `hasPermission:${required.join(',')}`,
    check: (ctx) => {
      const userPermissions = ctx.user?.permissions;
      if (!Array.isArray(userPermissions)) {
        return false;
      }
      return required.every((p) => userPermissions.includes(p));
    },
    message: `Required permissions: ${required.join(', ')}`,
  });
}

/**
 * Creates a guard that checks if user has ANY of the specified permissions
 *
 * @example
 * ```typescript
 * const canViewOrEdit = hasAnyPermission(['posts.view', 'posts.edit']);
 * ```
 */
export function hasAnyPermission(permissions: string[]): GuardDefinition<{ user?: User }> {
  return defineGuard({
    name: `hasAnyPermission:${permissions.join(',')}`,
    check: (ctx) => {
      const userPermissions = ctx.user?.permissions;
      if (!Array.isArray(userPermissions)) {
        return false;
      }
      return permissions.some((p) => userPermissions.includes(p));
    },
    message: `Required one of: ${permissions.join(', ')}`,
  });
}

/**
 * Creates a guard that checks a custom condition on the user
 *
 * @example
 * ```typescript
 * const isPremium = userCan((user) => user.subscription === 'premium');
 * ```
 */
export function userCan(
  check: (user: User) => boolean | Promise<boolean>,
  name = 'custom'
): GuardDefinition<{ user?: User }> {
  return defineGuard({
    name: `userCan:${name}`,
    check: async (ctx) => {
      if (!ctx.user) {
        return false;
      }
      return check(ctx.user);
    },
  });
}

/**
 * Creates a guard that combines multiple guards with AND logic
 *
 * @example
 * ```typescript
 * const adminWithPermission = allOf([hasRole('admin'), hasPermission('users.delete')]);
 * ```
 */
export function allOf<TContext = unknown>(
  guards: GuardDefinition<TContext>[]
): GuardDefinition<TContext> {
  return defineGuard({
    name: `allOf:${guards.map((g) => g.name).join(',')}`,
    check: async (ctx, request, reply) => {
      for (const guard of guards) {
        const result = await guard.check(ctx, request, reply);
        if (!result) {
          return false;
        }
      }
      return true;
    },
    message: `All conditions required: ${guards.map((g) => g.name).join(', ')}`,
  });
}

/**
 * Creates a guard that passes if ANY of the guards pass
 *
 * @example
 * ```typescript
 * const adminOrModerator = anyOf([hasRole('admin'), hasRole('moderator')]);
 * ```
 */
export function anyOf<TContext = unknown>(
  guards: GuardDefinition<TContext>[]
): GuardDefinition<TContext> {
  return defineGuard({
    name: `anyOf:${guards.map((g) => g.name).join(',')}`,
    check: async (ctx, request, reply) => {
      for (const guard of guards) {
        const result = await guard.check(ctx, request, reply);
        if (result) {
          return true;
        }
      }
      return false;
    },
    message: `One of required: ${guards.map((g) => g.name).join(', ')}`,
  });
}

/**
 * Creates a guard that inverts another guard
 *
 * @example
 * ```typescript
 * const notAdmin = not(hasRole('admin'));
 * ```
 */
export function not<TContext = unknown>(
  guard: GuardDefinition<TContext>
): GuardDefinition<TContext> {
  return defineGuard({
    name: `not:${guard.name}`,
    check: async (ctx, request, reply) => {
      const result = await guard.check(ctx, request, reply);
      return !result;
    },
    message: `Condition must not be met: ${guard.name}`,
  });
}

// ============================================================================
// Guard Execution
// ============================================================================

/**
 * Executes a guard and returns the result
 */
export async function executeGuard<TContext>(
  guard: GuardDefinition<TContext>,
  ctx: TContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ passed: boolean; message?: string; statusCode?: number }> {
  try {
    const passed = await guard.check(ctx, request, reply);
    return {
      passed,
      message: passed ? undefined : guard.message,
      statusCode: passed ? undefined : guard.statusCode,
    };
  } catch (error) {
    return {
      passed: false,
      message: error instanceof Error ? error.message : 'Guard check failed',
      statusCode: 500,
    };
  }
}

/**
 * Executes multiple guards in sequence
 * Returns on first failure
 */
export async function executeGuards<TContext>(
  guards: GuardDefinition<TContext>[],
  ctx: TContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ passed: boolean; failedGuard?: string; message?: string; statusCode?: number }> {
  for (const guard of guards) {
    const result = await executeGuard(guard, ctx, request, reply);
    if (!result.passed) {
      return {
        passed: false,
        failedGuard: guard.name,
        message: result.message,
        statusCode: result.statusCode,
      };
    }
  }

  return { passed: true };
}
