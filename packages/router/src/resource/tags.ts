/**
 * Phantom type tags for context-aware resource projections
 *
 * Provides compile-time only type tags that carry access level information
 * through the type system without any runtime overhead.
 *
 * Additionally provides runtime `__accessLevel` property for auto-projection
 * when using the chained `.resource()` method on procedures.
 *
 * @module resource/tags
 */

// ============================================================================
// Runtime Access Level
// ============================================================================

/**
 * Runtime access level values
 *
 * These values are set by narrowing guards at runtime and used for
 * automatic resource projection in the procedure builder.
 */
export type AccessLevel = 'public' | 'authenticated' | 'admin';

/**
 * Maps an AccessLevel string to its corresponding phantom ContextTag
 *
 * Used to bridge the runtime level declarations (e.g., `UserSchema.authenticated`)
 * to the compile-time phantom type system for output type computation.
 *
 * @example
 * ```typescript
 * type Tag = LevelToTag<'authenticated'>; // typeof AUTHENTICATED
 * type Tag = LevelToTag<'admin'>;         // typeof ADMIN
 * type Tag = LevelToTag<'public'>;        // typeof ANONYMOUS
 * ```
 */
export type LevelToTag<TLevel extends AccessLevel> = TLevel extends 'admin'
  ? typeof ADMIN
  : TLevel extends 'authenticated'
    ? typeof AUTHENTICATED
    : typeof ANONYMOUS;

// ============================================================================
// Phantom Type Symbols
// ============================================================================

/**
 * Phantom symbol for anonymous (unauthenticated) context
 * @internal Compile-time only - never used at runtime
 */
export declare const ANONYMOUS: unique symbol;

/**
 * Phantom symbol for authenticated user context
 * @internal Compile-time only - never used at runtime
 */
export declare const AUTHENTICATED: unique symbol;

/**
 * Phantom symbol for admin user context
 * @internal Compile-time only - never used at runtime
 */
export declare const ADMIN: unique symbol;

// ============================================================================
// Context Tag Type
// ============================================================================

/**
 * Union of all possible context tags
 *
 * Used to constrain generic type parameters that represent access levels.
 */
export type ContextTag = typeof ANONYMOUS | typeof AUTHENTICATED | typeof ADMIN;

// ============================================================================
// Tagged Context Interface
// ============================================================================

/**
 * Interface for contexts tagged with an access level
 *
 * The `__tag` field is a phantom field - it exists only in the type system
 * and is never present at runtime. This allows us to carry type information
 * without any memory overhead.
 *
 * The `__accessLevel` field is a runtime field set by narrowing guards.
 * It enables automatic resource projection when using `.resource()` in
 * the procedure builder chain.
 *
 * @template TTag - The context tag type (defaults to ANONYMOUS)
 *
 * @example
 * ```typescript
 * // Type-only: signals authenticated context
 * interface AuthenticatedCtx extends TaggedContext<typeof AUTHENTICATED> {
 *   user: User;
 * }
 *
 * // Type-only: signals admin context
 * interface AdminCtx extends TaggedContext<typeof ADMIN> {
 *   user: User & { isAdmin: true };
 * }
 * ```
 */
export interface TaggedContext<TTag extends ContextTag = typeof ANONYMOUS> {
  /**
   * Phantom field for carrying the context tag
   * @internal Never exists at runtime - purely for type inference
   */
  readonly __tag?: TTag;

  /**
   * Runtime access level set by narrowing guards
   *
   * This field IS present at runtime (unlike __tag) and is used for
   * automatic resource projection when using `.resource()` in procedures.
   *
   * Set automatically by:
   * - `authenticatedNarrow` → 'authenticated'
   * - `adminNarrow` → 'admin'
   * - No guard → 'public' (default)
   */
  __accessLevel?: AccessLevel;
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Extracts the tag from a tagged context type
 *
 * Returns ANONYMOUS if the context is not tagged or has no tag.
 *
 * @example
 * ```typescript
 * type Tag1 = ExtractTag<TaggedContext<typeof ADMIN>>; // typeof ADMIN
 * type Tag2 = ExtractTag<{ user: User }>; // typeof ANONYMOUS
 * ```
 */
export type ExtractTag<TContext> =
  TContext extends TaggedContext<infer TTag> ? TTag : typeof ANONYMOUS;

/**
 * Checks if a context has a specific tag
 *
 * @example
 * ```typescript
 * type IsAdmin = HasTag<AdminContext, typeof ADMIN>; // true
 * type IsAuth = HasTag<AdminContext, typeof AUTHENTICATED>; // false
 * ```
 */
export type HasTag<TContext, TTag extends ContextTag> = ExtractTag<TContext> extends TTag
  ? true
  : false;

/**
 * Creates a tagged context type by combining a base context with a tag
 *
 * @example
 * ```typescript
 * type AuthCtx = WithTag<BaseContext, typeof AUTHENTICATED>;
 * // Result: BaseContext & TaggedContext<typeof AUTHENTICATED>
 * ```
 */
export type WithTag<TContext, TTag extends ContextTag> = TContext & TaggedContext<TTag>;
