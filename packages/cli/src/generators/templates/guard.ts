/**
 * Guard Template
 *
 * Generates auth guard files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface GuardOptions {
  /** Generate role-based guard */
  role: boolean;
  /** Generate permission-based guard */
  permission: boolean;
  /** Generate ownership guard */
  ownership: boolean;
  /** Generate composite guard */
  composite: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a guard file
 */
export function getGuardPath(entityName: string, _project: ProjectContext): string {
  return `src/guards/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate role-based guard
 */
function generateRoleGuard(ctx: TemplateContext<GuardOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Role Guard
 *
 * Guards routes based on user roles.
 */

import { hasRole, allOf, anyOf, authenticated } from '@veloxts/auth';

/**
 * Require ${entity.humanReadable} role
 */
export const is${entity.pascal} = hasRole('${entity.snake}');

/**
 * Require admin role
 */
export const isAdmin = hasRole('admin');

/**
 * Require either ${entity.humanReadable} or admin role
 */
export const is${entity.pascal}OrAdmin = anyOf(
  is${entity.pascal},
  isAdmin
);

/**
 * Require authentication AND ${entity.humanReadable} role
 */
export const authenticated${entity.pascal} = allOf(
  authenticated,
  is${entity.pascal}
);

/**
 * Guard factory for dynamic role checking
 *
 * @example
 * const isModerator = requireRole('moderator');
 * procedure.guard(isModerator).query(...)
 */
export function requireRole(role: string) {
  return hasRole(role);
}

/**
 * Guard factory for multiple roles (any match)
 *
 * @example
 * const isStaff = requireAnyRole('admin', 'moderator', 'support');
 */
export function requireAnyRole(...roles: string[]) {
  return anyOf(...roles.map(hasRole));
}

/**
 * Guard factory for multiple roles (all required)
 *
 * @example
 * const isSuperAdmin = requireAllRoles('admin', 'verified');
 */
export function requireAllRoles(...roles: string[]) {
  return allOf(...roles.map(hasRole));
}
`;
}

/**
 * Generate permission-based guard
 */
function generatePermissionGuard(ctx: TemplateContext<GuardOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Permission Guard
 *
 * Fine-grained permission-based access control.
 */

import { hasPermission, allOf, anyOf, authenticated } from '@veloxts/auth';

/**
 * ${entity.pascal} permissions
 */
export const ${entity.pascal}Permissions = {
  READ: '${entity.snake}:read',
  CREATE: '${entity.snake}:create',
  UPDATE: '${entity.snake}:update',
  DELETE: '${entity.snake}:delete',
  MANAGE: '${entity.snake}:manage',
} as const;

type ${entity.pascal}Permission = (typeof ${entity.pascal}Permissions)[keyof typeof ${entity.pascal}Permissions];

/**
 * Can read ${entity.humanReadable}
 */
export const canRead${entity.pascal} = hasPermission(${entity.pascal}Permissions.READ);

/**
 * Can create ${entity.humanReadable}
 */
export const canCreate${entity.pascal} = hasPermission(${entity.pascal}Permissions.CREATE);

/**
 * Can update ${entity.humanReadable}
 */
export const canUpdate${entity.pascal} = hasPermission(${entity.pascal}Permissions.UPDATE);

/**
 * Can delete ${entity.humanReadable}
 */
export const canDelete${entity.pascal} = hasPermission(${entity.pascal}Permissions.DELETE);

/**
 * Full ${entity.humanReadable} management (all permissions)
 */
export const canManage${entity.pascal} = anyOf(
  hasPermission(${entity.pascal}Permissions.MANAGE),
  allOf(
    canRead${entity.pascal},
    canCreate${entity.pascal},
    canUpdate${entity.pascal},
    canDelete${entity.pascal}
  )
);

/**
 * Guard factory for permission checking
 *
 * @example
 * procedure.guard(require${entity.pascal}Permission('read')).query(...)
 */
export function require${entity.pascal}Permission(action: keyof typeof ${entity.pascal}Permissions) {
  return hasPermission(${entity.pascal}Permissions[action]);
}
`;
}

/**
 * Generate ownership guard
 */
function generateOwnershipGuard(ctx: TemplateContext<GuardOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Ownership Guard
 *
 * Guards based on resource ownership.
 */

import type { BaseContext, Guard } from '@veloxts/router';
import { allOf, authenticated } from '@veloxts/auth';

/**
 * Create an ownership guard for ${entity.humanReadable}
 *
 * Checks if the authenticated user owns the requested resource.
 *
 * @example
 * const owns${entity.pascal} = createOwnershipGuard(
 *   async (ctx, input) => {
 *     const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({
 *       where: { id: input.id }
 *     });
 *     return ${entity.camel}?.userId === ctx.user?.id;
 *   }
 * );
 *
 * procedure.guard(owns${entity.pascal}).mutation(...)
 */
export function createOwnershipGuard<TInput = unknown>(
  checkOwnership: (ctx: BaseContext, input: TInput) => Promise<boolean> | boolean
): Guard {
  return async (ctx: BaseContext, input: unknown) => {
    if (!ctx.user) {
      return false;
    }
    return checkOwnership(ctx, input as TInput);
  };
}

/**
 * ${entity.pascal} ownership guard
 *
 * Checks if user owns the ${entity.humanReadable} by matching userId field.
 */
export const owns${entity.pascal} = createOwnershipGuard<{ id: string }>(
  async (ctx, input) => {
    // TODO: Implement ownership check
    // Example:
    // const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({
    //   where: { id: input.id },
    //   select: { userId: true },
    // });
    // return ${entity.camel}?.userId === ctx.user?.id;

    throw new Error('Ownership check not implemented');
  }
);

/**
 * Require authentication AND ownership
 */
export const authenticatedOwner = allOf(authenticated, owns${entity.pascal});

/**
 * Create a guard that allows owners OR admins
 *
 * @example
 * procedure.guard(ownerOrAdmin).mutation(...)
 */
export function ownerOrRole<TInput = unknown>(
  role: string,
  checkOwnership: (ctx: BaseContext, input: TInput) => Promise<boolean> | boolean
): Guard {
  return async (ctx: BaseContext, input: unknown) => {
    if (!ctx.user) {
      return false;
    }

    // Admin bypass
    if (ctx.user.role === role) {
      return true;
    }

    // Check ownership
    return checkOwnership(ctx, input as TInput);
  };
}
`;
}

/**
 * Generate composite guard
 */
function generateCompositeGuard(ctx: TemplateContext<GuardOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Composite Guards
 *
 * Complex guard compositions for sophisticated access control.
 */

import type { BaseContext, Guard } from '@veloxts/router';
import { allOf, anyOf, not, authenticated, hasRole, hasPermission } from '@veloxts/auth';

// ============================================================================
// Guard Composition Utilities
// ============================================================================

/**
 * Create a conditional guard
 *
 * @example
 * const conditionalGuard = when(
 *   ctx => ctx.user?.tier === 'premium',
 *   premiumOnlyGuard,
 *   freeUserGuard
 * );
 */
export function when(
  condition: (ctx: BaseContext) => boolean | Promise<boolean>,
  thenGuard: Guard,
  elseGuard?: Guard
): Guard {
  return async (ctx: BaseContext, input: unknown) => {
    const result = await condition(ctx);
    if (result) {
      return thenGuard(ctx, input);
    }
    return elseGuard ? elseGuard(ctx, input) : true;
  };
}

/**
 * Create a guard that requires N of M conditions
 *
 * @example
 * const twoFactorAuth = requireN(2, [
 *   hasPassword,
 *   hasEmailVerified,
 *   has2FAEnabled,
 * ]);
 */
export function requireN(n: number, guards: Guard[]): Guard {
  return async (ctx: BaseContext, input: unknown) => {
    let passed = 0;
    for (const guard of guards) {
      if (await guard(ctx, input)) {
        passed++;
        if (passed >= n) return true;
      }
    }
    return false;
  };
}

// ============================================================================
// ${entity.pascal} Guards
// ============================================================================

/**
 * ${entity.pascal} access levels
 */
export const ${entity.pascal}Guards = {
  /** Basic authenticated access */
  basic: authenticated,

  /** ${entity.pascal} role required */
  ${entity.camel}: allOf(authenticated, hasRole('${entity.snake}')),

  /** Admin access */
  admin: allOf(authenticated, hasRole('admin')),

  /** ${entity.pascal} or admin */
  ${entity.camel}OrAdmin: allOf(
    authenticated,
    anyOf(hasRole('${entity.snake}'), hasRole('admin'))
  ),

  /** Not banned users only */
  notBanned: allOf(authenticated, not(hasRole('banned'))),

  /** Premium tier access */
  premium: allOf(
    authenticated,
    anyOf(hasRole('premium'), hasRole('admin'))
  ),
} as const;

/**
 * Time-based guard
 *
 * Only allows access during specified hours (server time).
 */
export function duringHours(startHour: number, endHour: number): Guard {
  return async () => {
    const hour = new Date().getHours();
    return hour >= startHour && hour < endHour;
  };
}

/**
 * Rate-aware guard
 *
 * Denies access if user has exceeded rate limit.
 */
export function underRateLimit(
  limit: number,
  getCount: (ctx: BaseContext) => Promise<number>
): Guard {
  return async (ctx: BaseContext) => {
    const count = await getCount(ctx);
    return count < limit;
  };
}

/**
 * Feature flag guard
 *
 * Only allows access when feature is enabled.
 */
export function featureEnabled(
  featureName: string,
  checkFeature: (name: string, ctx: BaseContext) => Promise<boolean>
): Guard {
  return async (ctx: BaseContext) => {
    return checkFeature(featureName, ctx);
  };
}
`;
}

/**
 * Generate simple guard template
 */
function generateSimpleGuard(ctx: TemplateContext<GuardOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Guard
 *
 * Custom authentication guard for VeloxTS procedures.
 */

import type { BaseContext, Guard } from '@veloxts/router';
import { allOf, anyOf, not, authenticated, hasRole, hasPermission } from '@veloxts/auth';

// ============================================================================
// Guard Definitions
// ============================================================================

/**
 * ${entity.pascal} guard - checks if user has ${entity.humanReadable} access
 *
 * @example
 * procedure.guard(${entity.camel}Guard).query(...)
 */
export const ${entity.camel}Guard: Guard = async (ctx: BaseContext, _input: unknown) => {
  // Require authentication first
  if (!ctx.user) {
    return false;
  }

  // TODO: Add your guard logic here
  // Examples:
  // - Check user role: return ctx.user.role === '${entity.snake}';
  // - Check permission: return ctx.user.permissions.includes('${entity.snake}:access');
  // - Check subscription: return ctx.user.subscriptionTier === 'premium';

  return true;
};

/**
 * Authenticated ${entity.pascal} guard
 *
 * Combines authentication check with ${entity.humanReadable} specific logic.
 */
export const authenticated${entity.pascal} = allOf(authenticated, ${entity.camel}Guard);

/**
 * ${entity.pascal} or admin guard
 *
 * Allows access if user is ${entity.humanReadable} OR admin.
 */
export const ${entity.camel}OrAdmin = allOf(
  authenticated,
  anyOf(${entity.camel}Guard, hasRole('admin'))
);

/**
 * Not ${entity.pascal} guard
 *
 * Denies access to ${entity.humanReadable} users (inverted guard).
 */
export const not${entity.pascal} = not(${entity.camel}Guard);

// ============================================================================
// Guard Factory
// ============================================================================

/**
 * Create a custom guard with specific requirements
 *
 * @example
 * const premiumOnly = create${entity.pascal}Guard({
 *   minLevel: 10,
 *   requiredBadges: ['verified'],
 * });
 */
export interface ${entity.pascal}GuardOptions {
  /** Minimum user level required */
  minLevel?: number;
  /** Required badges/achievements */
  requiredBadges?: string[];
  /** Custom check function */
  customCheck?: (ctx: BaseContext) => boolean | Promise<boolean>;
}

export function create${entity.pascal}Guard(options: ${entity.pascal}GuardOptions = {}): Guard {
  return async (ctx: BaseContext, _input: unknown) => {
    if (!ctx.user) {
      return false;
    }

    // Check minimum level
    if (options.minLevel !== undefined) {
      const userLevel = (ctx.user as { level?: number }).level ?? 0;
      if (userLevel < options.minLevel) {
        return false;
      }
    }

    // Check required badges
    if (options.requiredBadges?.length) {
      const userBadges = (ctx.user as { badges?: string[] }).badges ?? [];
      const hasAllBadges = options.requiredBadges.every((badge) =>
        userBadges.includes(badge)
      );
      if (!hasAllBadges) {
        return false;
      }
    }

    // Custom check
    if (options.customCheck) {
      return options.customCheck(ctx);
    }

    return true;
  };
}
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Guard template function
 */
export const guardTemplate: TemplateFunction<GuardOptions> = (ctx) => {
  if (ctx.options.role) {
    return generateRoleGuard(ctx);
  }
  if (ctx.options.permission) {
    return generatePermissionGuard(ctx);
  }
  if (ctx.options.ownership) {
    return generateOwnershipGuard(ctx);
  }
  if (ctx.options.composite) {
    return generateCompositeGuard(ctx);
  }
  return generateSimpleGuard(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getGuardInstructions(entityName: string, options: GuardOptions): string {
  const lines = [`Your ${entityName} guard has been created.`, '', 'Next steps:'];

  lines.push('  1. Import the guard in your procedures:');
  lines.push(`     import { ${entityName}Guard } from '@/guards/${entityName.toLowerCase()}';`);
  lines.push('  2. Apply to procedures:');
  lines.push(`     procedure.guard(${entityName}Guard).query(...)`);

  if (options.role) {
    lines.push('  3. Ensure user roles are set in your auth flow');
  } else if (options.permission) {
    lines.push('  3. Set up permission storage in your user model');
  } else if (options.ownership) {
    lines.push('  3. Implement the ownership check logic');
  } else if (options.composite) {
    lines.push('  3. Customize the guard compositions for your needs');
  }

  return lines.join('\n');
}
