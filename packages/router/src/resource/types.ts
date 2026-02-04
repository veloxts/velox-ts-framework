/**
 * Resource API type utilities
 *
 * Provides additional type utilities for working with resource schemas
 * and phantom-tagged contexts.
 *
 * @module resource/types
 */

import type {
  AdminOutput,
  AnonymousOutput,
  AuthenticatedOutput,
  OutputForTag,
  ResourceSchema,
} from './schema.js';
import type {
  ADMIN,
  ANONYMOUS,
  AUTHENTICATED,
  ContextTag,
  ExtractTag,
  TaggedContext,
} from './tags.js';

// ============================================================================
// Infer Types from Schema
// ============================================================================

/**
 * Infers the full data shape from a resource schema
 *
 * This represents all fields in the schema, regardless of visibility.
 * Useful for typing the raw data input to resource().
 *
 * @example
 * ```typescript
 * type UserData = InferResourceData<typeof UserSchema>;
 * // Result: { id: string; name: string; email: string; internalNotes: string | null }
 * ```
 */
export type InferResourceData<TSchema extends ResourceSchema> = AdminOutput<TSchema>;

/**
 * Infers the output type for a schema based on a context type
 *
 * This is a convenience type that combines OutputForTag with ExtractTag
 * to infer the output directly from a context type.
 *
 * @example
 * ```typescript
 * type Output = InferResourceOutput<typeof UserSchema, MyAuthenticatedContext>;
 * // Result: { id: string; name: string; email: string }
 * ```
 */
export type InferResourceOutput<
  TSchema extends ResourceSchema,
  TContext extends TaggedContext<ContextTag>,
> = OutputForTag<TSchema, ExtractTag<TContext>>;

// ============================================================================
// Context Level Helpers
// ============================================================================

/**
 * Type that represents any anonymous-level tagged context
 *
 * This is a minimal tagged context type. For auth-specific contexts with
 * user and auth properties, use the types from @veloxts/auth.
 */
export type AnonymousTaggedContext = TaggedContext<typeof ANONYMOUS>;

/**
 * Type that represents any authenticated-level tagged context
 *
 * This is a minimal tagged context type. For auth-specific contexts with
 * user and auth properties, use `AuthenticatedContext` from @veloxts/auth.
 */
export type AuthenticatedTaggedContext = TaggedContext<typeof AUTHENTICATED>;

/**
 * Type that represents any admin-level tagged context
 *
 * This is a minimal tagged context type. For auth-specific contexts with
 * user and auth properties, use `AdminContext` from @veloxts/auth.
 */
export type AdminTaggedContext = TaggedContext<typeof ADMIN>;

// ============================================================================
// Resource Output Union Types
// ============================================================================

/**
 * Union of all possible outputs for a schema
 *
 * Useful when you need to handle any possible output type.
 *
 * @example
 * ```typescript
 * function processUser(user: AnyResourceOutput<typeof UserSchema>) {
 *   // user has: id, name (always present)
 *   // user may have: email (if authenticated)
 *   // user may have: internalNotes (if admin)
 * }
 * ```
 */
export type AnyResourceOutput<TSchema extends ResourceSchema> =
  | AnonymousOutput<TSchema>
  | AuthenticatedOutput<TSchema>
  | AdminOutput<TSchema>;

// ============================================================================
// Conditional Output Types
// ============================================================================

/**
 * Returns the output type if the context has at least authenticated access
 *
 * @example
 * ```typescript
 * type MaybeAuthOutput = IfAuthenticated<MyContext, typeof UserSchema>;
 * // If MyContext is authenticated: { id, name, email }
 * // If MyContext is anonymous: never
 * ```
 */
export type IfAuthenticated<
  TContext extends TaggedContext<ContextTag>,
  TSchema extends ResourceSchema,
> = ExtractTag<TContext> extends typeof ANONYMOUS
  ? never
  : OutputForTag<TSchema, ExtractTag<TContext>>;

/**
 * Returns the output type if the context has admin access
 *
 * @example
 * ```typescript
 * type MaybeAdminOutput = IfAdmin<MyContext, typeof UserSchema>;
 * // If MyContext is admin: { id, name, email, internalNotes }
 * // Otherwise: never
 * ```
 */
export type IfAdmin<
  TContext extends TaggedContext<ContextTag>,
  TSchema extends ResourceSchema,
> = ExtractTag<TContext> extends typeof ADMIN ? AdminOutput<TSchema> : never;

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type {
  AdminOutput,
  AnonymousOutput,
  AuthenticatedOutput,
  OutputForTag,
  ResourceSchema,
} from './schema.js';
export type {
  ADMIN,
  ANONYMOUS,
  AUTHENTICATED,
  ContextTag,
  ExtractTag,
  HasTag,
  TaggedContext,
  WithTag,
} from './tags.js';
