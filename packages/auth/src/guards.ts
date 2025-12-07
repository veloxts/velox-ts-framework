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

/**
 * Creates a simple guard from a check function
 *
 * @example
 * ```typescript
 * const isActive = guard('isActive', (ctx) => ctx.user?.status === 'active');
 * ```
 */
export function guard<TContext = unknown>(
  name: string,
  check: GuardFunction<TContext>
): GuardDefinition<TContext> {
  return defineGuard({ name, check });
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
 * @example
 * ```typescript
 * const adminOnly = hasRole('admin');
 * const moderatorOrAdmin = hasRole(['admin', 'moderator']);
 * ```
 */
export function hasRole(
  roles: string | string[]
): GuardDefinition<{ user?: User & { role?: string } }> {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return defineGuard({
    name: `hasRole:${roleArray.join(',')}`,
    check: (ctx) => {
      const userRole = ctx.user?.role;
      return typeof userRole === 'string' && roleArray.includes(userRole);
    },
    message: `Required role: ${roleArray.join(' or ')}`,
  });
}

/**
 * Creates a guard that checks if user has specific permissions
 *
 * @example
 * ```typescript
 * const canEdit = hasPermission('posts.edit');
 * const canManageUsers = hasPermission(['users.create', 'users.delete']);
 * ```
 */
export function hasPermission(
  permissions: string | string[]
): GuardDefinition<{ user?: User & { permissions?: string[] } }> {
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
export function hasAnyPermission(
  permissions: string[]
): GuardDefinition<{ user?: User & { permissions?: string[] } }> {
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
