/**
 * Phantom type tags for context-aware resource projections
 *
 * Provides compile-time only type tags that carry access level information
 * through the type system without any runtime overhead.
 *
 * Additionally provides runtime `__accessLevel` property for auto-projection
 * when using the chained `.output()` method on procedures.
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
 *
 * Widened to `string` to support custom access levels defined via
 * `defineAccessLevels()`. The default 3-level system still uses
 * `'public' | 'authenticated' | 'admin'` at the call site.
 */
export type AccessLevel = string;

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
 * type Tag = LevelToTag<'public'>;        // typeof PUBLIC
 * ```
 */
export type LevelToTag<TLevel extends string> = TLevel extends 'admin'
  ? typeof ADMIN
  : TLevel extends 'authenticated'
    ? typeof AUTHENTICATED
    : typeof PUBLIC;

/**
 * Maps a phantom ContextTag to its corresponding level string
 *
 * Inverse of `LevelToTag`. Used by `FilterFieldsByLevel` to bridge
 * the tag-based system to the set-based visibility model.
 *
 * @example
 * ```typescript
 * type L1 = TagToLevel<typeof ADMIN>;         // 'admin'
 * type L2 = TagToLevel<typeof AUTHENTICATED>; // 'authenticated'
 * type L3 = TagToLevel<typeof PUBLIC>;        // 'public'
 * ```
 */
export type TagToLevel<TTag extends ContextTag> = TTag extends typeof ADMIN
  ? 'admin'
  : TTag extends typeof AUTHENTICATED
    ? 'authenticated'
    : 'public';

// ============================================================================
// Phantom Type Symbols
// ============================================================================

/**
 * Phantom symbol for public (unauthenticated) context
 * @internal Compile-time only - never used at runtime
 */
export declare const PUBLIC: unique symbol;

/** @deprecated Use PUBLIC */
export declare const ANONYMOUS: typeof PUBLIC;

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
export type ContextTag = typeof PUBLIC | typeof AUTHENTICATED | typeof ADMIN;

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
 * It enables automatic resource projection when using `.output()` in
 * the procedure builder chain.
 *
 * @template TTag - The context tag type (defaults to PUBLIC)
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
export interface TaggedContext<TTag extends ContextTag = typeof PUBLIC> {
  /**
   * Phantom field for carrying the context tag
   * @internal Never exists at runtime - purely for type inference
   */
  readonly __tag?: TTag;

  /**
   * Runtime access level set by narrowing guards
   *
   * This field IS present at runtime (unlike __tag) and is used for
   * automatic resource projection when using `.output()` in procedures.
   *
   * Set automatically by guards with `accessLevel` property,
   * or derived from tagged resource view level in `.output()`.
   */
  __accessLevel?: string;
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Extracts the tag from a tagged context type
 *
 * Returns PUBLIC if the context is not tagged or has no tag.
 *
 * @example
 * ```typescript
 * type Tag1 = ExtractTag<TaggedContext<typeof ADMIN>>; // typeof ADMIN
 * type Tag2 = ExtractTag<{ user: User }>; // typeof PUBLIC
 * ```
 */
export type ExtractTag<TContext> =
  TContext extends TaggedContext<infer TTag> ? TTag : typeof PUBLIC;

/**
 * Checks if a context has a specific tag
 *
 * @example
 * ```typescript
 * type IsAdmin = HasTag<AdminContext, typeof ADMIN>; // true
 * type IsAuth = HasTag<AdminContext, typeof AUTHENTICATED>; // false
 * ```
 */
export type HasTag<TContext, TTag extends ContextTag> =
  ExtractTag<TContext> extends TTag ? true : false;

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
