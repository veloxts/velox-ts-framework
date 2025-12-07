/**
 * Resource-level authorization policies for @veloxts/auth
 * @module auth/policies
 */

import type { PolicyAction, PolicyDefinition, User } from './types.js';

// ============================================================================
// Policy Registry
// ============================================================================

/**
 * Global policy registry
 * Maps resource names to their policy definitions
 */
const policyRegistry = new Map<string, PolicyDefinition>();

/**
 * Registers a policy for a resource type
 *
 * @example
 * ```typescript
 * registerPolicy('Post', {
 *   view: (user, post) => true, // Anyone can view
 *   update: (user, post) => user.id === post.authorId,
 *   delete: (user, post) => user.id === post.authorId || user.role === 'admin',
 * });
 * ```
 */
export function registerPolicy<TUser = User, TResource = unknown>(
  resourceName: string,
  policy: PolicyDefinition<TUser, TResource>
): void {
  policyRegistry.set(resourceName, policy as PolicyDefinition);
}

/**
 * Gets a registered policy by resource name
 */
export function getPolicy(resourceName: string): PolicyDefinition | undefined {
  return policyRegistry.get(resourceName);
}

/**
 * Clears all registered policies (useful for testing)
 */
export function clearPolicies(): void {
  policyRegistry.clear();
}

// ============================================================================
// Policy Definition Helper
// ============================================================================

/**
 * Defines a policy for a resource type
 *
 * @example
 * ```typescript
 * const PostPolicy = definePolicy<User, Post>({
 *   view: () => true,
 *   create: (user) => user.emailVerified,
 *   update: (user, post) => user.id === post.authorId,
 *   delete: (user, post) => user.id === post.authorId || user.role === 'admin',
 *   publish: (user, post) => user.role === 'editor' && user.id === post.authorId,
 * });
 *
 * // Register it
 * registerPolicy('Post', PostPolicy);
 * ```
 */
export function definePolicy<TUser = User, TResource = unknown>(
  actions: PolicyDefinition<TUser, TResource>
): PolicyDefinition<TUser, TResource> {
  return actions;
}

// ============================================================================
// Authorization Checks
// ============================================================================

/**
 * Checks if a user can perform an action on a resource
 *
 * @example
 * ```typescript
 * const canEdit = await can(user, 'update', 'Post', post);
 * if (!canEdit) {
 *   throw new ForbiddenError('Cannot edit this post');
 * }
 * ```
 */
export async function can<TResource = unknown>(
  user: User | null | undefined,
  action: string,
  resourceName: string,
  resource?: TResource
): Promise<boolean> {
  // No user = no permission
  if (!user) {
    return false;
  }

  const policy = policyRegistry.get(resourceName);
  if (!policy) {
    // No policy registered = deny by default
    console.warn(`No policy registered for resource: ${resourceName}`);
    return false;
  }

  const actionHandler = policy[action] as PolicyAction<User, TResource> | undefined;
  if (!actionHandler) {
    // Action not defined = deny by default
    return false;
  }

  return actionHandler(user, resource as TResource);
}

/**
 * Checks if a user cannot perform an action (inverse of can)
 */
export async function cannot<TResource = unknown>(
  user: User | null | undefined,
  action: string,
  resourceName: string,
  resource?: TResource
): Promise<boolean> {
  return !(await can(user, action, resourceName, resource));
}

/**
 * Throws an error if user cannot perform action
 *
 * @example
 * ```typescript
 * await authorize(ctx.user, 'delete', 'Post', post);
 * // If we get here, user is authorized
 * await db.post.delete({ where: { id: post.id } });
 * ```
 */
export async function authorize<TResource = unknown>(
  user: User | null | undefined,
  action: string,
  resourceName: string,
  resource?: TResource
): Promise<void> {
  const allowed = await can(user, action, resourceName, resource);
  if (!allowed) {
    const error = new Error(
      `Unauthorized: cannot ${action} ${resourceName}${resource ? ` (id: ${(resource as { id?: string }).id ?? 'unknown'})` : ''}`
    );
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

// ============================================================================
// Policy Builder
// ============================================================================

/**
 * Fluent policy builder for complex policies
 *
 * @example
 * ```typescript
 * const CommentPolicy = createPolicyBuilder<User, Comment>()
 *   .allow('view', () => true)
 *   .allow('create', (user) => user.emailVerified)
 *   .allow('update', (user, comment) => user.id === comment.authorId)
 *   .allow('delete', (user, comment) =>
 *     user.id === comment.authorId || user.role === 'admin'
 *   )
 *   .build();
 * ```
 */
export function createPolicyBuilder<TUser = User, TResource = unknown>(): PolicyBuilder<
  TUser,
  TResource
> {
  return new PolicyBuilder<TUser, TResource>();
}

class PolicyBuilder<TUser = User, TResource = unknown> {
  private actions: PolicyDefinition<TUser, TResource> = {};

  /**
   * Allows an action based on the check function
   */
  allow(action: string, check: PolicyAction<TUser, TResource>): this {
    this.actions[action] = check;
    return this;
  }

  /**
   * Denies an action (always returns false)
   */
  deny(action: string): this {
    this.actions[action] = () => false;
    return this;
  }

  /**
   * Allows action only for resource owner
   * Assumes resource has a userId or authorId field
   */
  allowOwner(action: string, ownerField: keyof TResource = 'userId' as keyof TResource): this {
    this.actions[action] = (user, resource) => {
      const ownerId = resource?.[ownerField];
      return ownerId === (user as User).id;
    };
    return this;
  }

  /**
   * Allows action for owner OR users with specific role
   */
  allowOwnerOr(
    action: string,
    roles: string[],
    ownerField: keyof TResource = 'userId' as keyof TResource
  ): this {
    this.actions[action] = (user, resource) => {
      const ownerId = resource?.[ownerField];
      const userRole = (user as User & { role?: string }).role;
      const isOwner = ownerId === (user as User).id;
      const hasRole = typeof userRole === 'string' && roles.includes(userRole);
      return isOwner || hasRole;
    };
    return this;
  }

  /**
   * Builds the final policy definition
   */
  build(): PolicyDefinition<TUser, TResource> {
    return { ...this.actions };
  }

  /**
   * Builds and registers the policy
   */
  register(resourceName: string): PolicyDefinition<TUser, TResource> {
    const policy = this.build();
    registerPolicy(resourceName, policy);
    return policy;
  }
}

// ============================================================================
// Common Policy Patterns
// ============================================================================

/**
 * Creates a policy that allows all actions for admins
 * and owner-only for regular users
 */
export function createOwnerOrAdminPolicy<TResource extends { userId?: string; authorId?: string }>(
  ownerField: 'userId' | 'authorId' = 'userId'
): PolicyDefinition<User & { role?: string }, TResource> {
  const isOwnerOrAdmin = (user: User & { role?: string }, resource: TResource): boolean => {
    if (user.role === 'admin') {
      return true;
    }
    const ownerId = resource[ownerField];
    return ownerId === user.id;
  };

  return {
    view: () => true,
    create: () => true,
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  };
}

/**
 * Creates a read-only policy (only view allowed)
 */
export function createReadOnlyPolicy<TResource>(): PolicyDefinition<User, TResource> {
  return {
    view: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  };
}

/**
 * Creates a policy for admin-only resources
 */
export function createAdminOnlyPolicy<TResource>(): PolicyDefinition<
  User & { role?: string },
  TResource
> {
  const isAdmin = (user: User & { role?: string }): boolean => user.role === 'admin';

  return {
    view: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  };
}
