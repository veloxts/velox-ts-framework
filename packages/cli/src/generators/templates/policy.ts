/**
 * Policy Template
 *
 * Generates authorization policy files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface PolicyOptions {
  /** Generate CRUD policy */
  crud: boolean;
  /** Generate resource-based policy */
  resource: boolean;
  /** Include soft delete policies */
  softDelete: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a policy file
 */
export function getPolicyPath(entityName: string, _project: ProjectContext): string {
  return `src/policies/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate CRUD policy
 */
function generateCrudPolicy(ctx: TemplateContext<PolicyOptions>): string {
  const { entity, options } = ctx;

  const softDeleteMethods = options.softDelete
    ? `
  /**
   * Can user restore this ${entity.humanReadable}?
   */
  async restore(user: User, ${entity.camel}: ${entity.pascal}): Promise<boolean> {
    // Only admins can restore
    return user.role === 'admin';
  }

  /**
   * Can user force delete this ${entity.humanReadable}?
   */
  async forceDelete(user: User, ${entity.camel}: ${entity.pascal}): Promise<boolean> {
    // Only admins can force delete
    return user.role === 'admin';
  }
`
    : '';

  return `/**
 * ${entity.pascal} Policy
 *
 * Authorization rules for ${entity.humanReadable} operations.
 */

import type { BaseContext } from '@veloxts/core';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  role: string;
  permissions?: string[];
}

interface ${entity.pascal} {
  id: string;
  userId: string;
  // TODO: Add more fields
}

// ============================================================================
// Policy Class
// ============================================================================

/**
 * ${entity.pascal} authorization policy
 *
 * Centralizes authorization logic for ${entity.humanReadable} resources.
 *
 * @example
 * const policy = new ${entity.pascal}Policy();
 * if (await policy.update(user, ${entity.camel})) {
 *   // Allow update
 * }
 */
export class ${entity.pascal}Policy {
  /**
   * Can user view any ${entity.humanReadable}?
   */
  async viewAny(user: User): Promise<boolean> {
    // All authenticated users can list
    return true;
  }

  /**
   * Can user view this ${entity.humanReadable}?
   */
  async view(user: User, ${entity.camel}: ${entity.pascal}): Promise<boolean> {
    // Owner or admin can view
    return ${entity.camel}.userId === user.id || user.role === 'admin';
  }

  /**
   * Can user create ${entity.humanReadable}?
   */
  async create(user: User): Promise<boolean> {
    // All authenticated users can create
    return true;
  }

  /**
   * Can user update this ${entity.humanReadable}?
   */
  async update(user: User, ${entity.camel}: ${entity.pascal}): Promise<boolean> {
    // Only owner or admin can update
    return ${entity.camel}.userId === user.id || user.role === 'admin';
  }

  /**
   * Can user delete this ${entity.humanReadable}?
   */
  async delete(user: User, ${entity.camel}: ${entity.pascal}): Promise<boolean> {
    // Only owner or admin can delete
    return ${entity.camel}.userId === user.id || user.role === 'admin';
  }
${softDeleteMethods}}

// ============================================================================
// Policy Instance
// ============================================================================

/**
 * Singleton policy instance
 */
export const ${entity.camel}Policy = new ${entity.pascal}Policy();

// ============================================================================
// Guard Integration
// ============================================================================

/**
 * Create a guard from a policy method
 *
 * @example
 * procedure.guard(policyGuard('update')).mutation(...)
 */
export function ${entity.camel}PolicyGuard(
  action: keyof ${entity.pascal}Policy
) {
  return async (ctx: BaseContext, input: unknown) => {
    if (!ctx.user) return false;

    const policy = new ${entity.pascal}Policy();
    const method = policy[action] as (user: User, resource?: ${entity.pascal}) => Promise<boolean>;

    // For methods that require a resource
    if (action === 'view' || action === 'update' || action === 'delete') {
      // TODO: Fetch the resource
      // const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({ where: { id: (input as { id: string }).id } });
      // return method.call(policy, ctx.user as User, ${entity.camel});
      throw new Error('Resource fetch not implemented');
    }

    // For methods that don't require a resource
    return method.call(policy, ctx.user as User);
  };
}
`;
}

/**
 * Generate resource-based policy
 */
function generateResourcePolicy(ctx: TemplateContext<PolicyOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Resource Policy
 *
 * Attribute-based access control for ${entity.humanReadable} resources.
 */

import type { BaseContext } from '@veloxts/core';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  role: string;
  teamId?: string;
  permissions?: string[];
}

interface ${entity.pascal} {
  id: string;
  userId: string;
  teamId?: string;
  visibility: 'public' | 'private' | 'team';
  status: 'draft' | 'published' | 'archived';
}

type Action = 'view' | 'create' | 'update' | 'delete' | 'publish' | 'archive';

// ============================================================================
// Policy Definition
// ============================================================================

/**
 * Policy rules for ${entity.humanReadable}
 */
interface PolicyRule {
  /** Actions this rule applies to */
  actions: Action[];
  /** Condition that must be true */
  condition: (user: User, resource?: ${entity.pascal}) => boolean;
  /** Description for debugging */
  description: string;
}

const ${entity.camel}Rules: PolicyRule[] = [
  // Admin can do anything
  {
    actions: ['view', 'create', 'update', 'delete', 'publish', 'archive'],
    condition: (user) => user.role === 'admin',
    description: 'Admins have full access',
  },

  // Owners can manage their own resources
  {
    actions: ['view', 'update', 'delete'],
    condition: (user, resource) => resource?.userId === user.id,
    description: 'Owners can manage their resources',
  },

  // Team members can view team resources
  {
    actions: ['view'],
    condition: (user, resource) =>
      resource?.visibility === 'team' && resource?.teamId === user.teamId,
    description: 'Team members can view team resources',
  },

  // Anyone can view public resources
  {
    actions: ['view'],
    condition: (_, resource) =>
      resource?.visibility === 'public' && resource?.status === 'published',
    description: 'Public published resources are viewable by all',
  },

  // Authenticated users can create
  {
    actions: ['create'],
    condition: (user) => !!user.id,
    description: 'Authenticated users can create resources',
  },

  // Only owners can publish
  {
    actions: ['publish'],
    condition: (user, resource) =>
      resource?.userId === user.id && resource?.status === 'draft',
    description: 'Owners can publish draft resources',
  },
];

// ============================================================================
// Policy Evaluation
// ============================================================================

/**
 * Check if user can perform action on ${entity.humanReadable}
 */
export function can${entity.pascal}(
  user: User,
  action: Action,
  resource?: ${entity.pascal}
): boolean {
  for (const rule of ${entity.camel}Rules) {
    if (rule.actions.includes(action) && rule.condition(user, resource)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all allowed actions for user on ${entity.humanReadable}
 */
export function allowed${entity.pascal}Actions(
  user: User,
  resource?: ${entity.pascal}
): Action[] {
  const allActions: Action[] = ['view', 'create', 'update', 'delete', 'publish', 'archive'];
  return allActions.filter((action) => can${entity.pascal}(user, action, resource));
}

/**
 * Policy guard for procedures
 */
export function ${entity.camel}PolicyGuard(action: Action) {
  return async (ctx: BaseContext, input: unknown) => {
    if (!ctx.user) return false;

    // For resource-specific actions, fetch the resource
    if (action !== 'create') {
      // TODO: Fetch resource and check
      // const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({ where: { id: (input as { id: string }).id } });
      // return can${entity.pascal}(ctx.user as User, action, ${entity.camel});
    }

    return can${entity.pascal}(ctx.user as User, action);
  };
}

/**
 * Assert user can perform action, throw if not
 */
export function assert${entity.pascal}(
  user: User,
  action: Action,
  resource?: ${entity.pascal}
): void {
  if (!can${entity.pascal}(user, action, resource)) {
    throw new Error(\`Unauthorized: cannot \${action} ${entity.humanReadable}\`);
  }
}
`;
}

/**
 * Generate simple policy template
 */
function generateSimplePolicy(ctx: TemplateContext<PolicyOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Policy
 *
 * Authorization rules for ${entity.humanReadable} operations.
 */

import type { BaseContext } from '@veloxts/core';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  role: string;
  permissions?: string[];
}

interface ${entity.pascal} {
  id: string;
  userId: string;
  // TODO: Add your ${entity.humanReadable} fields
}

// ============================================================================
// Policy Functions
// ============================================================================

/**
 * Can user view ${entity.humanReadable}?
 */
export function canView${entity.pascal}(user: User, ${entity.camel}: ${entity.pascal}): boolean {
  // TODO: Implement view authorization
  return ${entity.camel}.userId === user.id || user.role === 'admin';
}

/**
 * Can user create ${entity.humanReadable}?
 */
export function canCreate${entity.pascal}(user: User): boolean {
  // TODO: Implement create authorization
  return true;
}

/**
 * Can user update ${entity.humanReadable}?
 */
export function canUpdate${entity.pascal}(user: User, ${entity.camel}: ${entity.pascal}): boolean {
  // TODO: Implement update authorization
  return ${entity.camel}.userId === user.id || user.role === 'admin';
}

/**
 * Can user delete ${entity.humanReadable}?
 */
export function canDelete${entity.pascal}(user: User, ${entity.camel}: ${entity.pascal}): boolean {
  // TODO: Implement delete authorization
  return ${entity.camel}.userId === user.id || user.role === 'admin';
}

// ============================================================================
// Guard Integration
// ============================================================================

/**
 * Policy guard factory
 *
 * Creates guards from policy functions for use with procedures.
 *
 * @example
 * procedure.guard(${entity.camel}Guard('update')).mutation(...)
 */
export function ${entity.camel}Guard(action: 'view' | 'create' | 'update' | 'delete') {
  return async (ctx: BaseContext, input: unknown) => {
    if (!ctx.user) return false;

    const user = ctx.user as User;

    switch (action) {
      case 'create':
        return canCreate${entity.pascal}(user);

      case 'view':
      case 'update':
      case 'delete': {
        // TODO: Fetch the ${entity.humanReadable} from database
        // const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({
        //   where: { id: (input as { id: string }).id }
        // });
        // if (!${entity.camel}) return false;

        // Placeholder - implement resource fetching
        const ${entity.camel} = input as ${entity.pascal};

        if (action === 'view') return canView${entity.pascal}(user, ${entity.camel});
        if (action === 'update') return canUpdate${entity.pascal}(user, ${entity.camel});
        if (action === 'delete') return canDelete${entity.pascal}(user, ${entity.camel});
        return false;
      }

      default:
        return false;
    }
  };
}

/**
 * Assert policy, throw if unauthorized
 */
export function authorize${entity.pascal}(
  action: 'view' | 'create' | 'update' | 'delete',
  user: User,
  ${entity.camel}?: ${entity.pascal}
): void {
  let allowed = false;

  switch (action) {
    case 'create':
      allowed = canCreate${entity.pascal}(user);
      break;
    case 'view':
      allowed = ${entity.camel} ? canView${entity.pascal}(user, ${entity.camel}) : false;
      break;
    case 'update':
      allowed = ${entity.camel} ? canUpdate${entity.pascal}(user, ${entity.camel}) : false;
      break;
    case 'delete':
      allowed = ${entity.camel} ? canDelete${entity.pascal}(user, ${entity.camel}) : false;
      break;
  }

  if (!allowed) {
    throw new Error(\`Unauthorized: cannot \${action} ${entity.humanReadable}\`);
  }
}
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Policy template function
 */
export const policyTemplate: TemplateFunction<PolicyOptions> = (ctx) => {
  if (ctx.options.crud) {
    return generateCrudPolicy(ctx);
  }
  if (ctx.options.resource) {
    return generateResourcePolicy(ctx);
  }
  return generateSimplePolicy(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getPolicyInstructions(entityName: string, options: PolicyOptions): string {
  const lines = [`Your ${entityName} policy has been created.`, '', 'Next steps:'];

  lines.push('  1. Update the policy functions with your authorization logic');
  lines.push('  2. Import and use in your procedures:');
  lines.push(`     import { ${entityName}Guard } from '@/policies/${entityName.toLowerCase()}';`);
  lines.push(`     procedure.guard(${entityName}Guard('update')).mutation(...)`);

  if (options.crud) {
    lines.push('  3. Implement resource fetching in the guard');
  } else if (options.resource) {
    lines.push('  3. Customize the policy rules for your use case');
  }

  return lines.join('\n');
}
