/**
 * Resource instance and collection classes
 *
 * Provides runtime projection functionality for resource data,
 * filtering fields based on visibility levels.
 *
 * @module resource/instance
 */

import type { OutputForTag, ResourceSchema, RuntimeField } from './schema.js';
import type {
  ADMIN,
  ANONYMOUS,
  AUTHENTICATED,
  ContextTag,
  ExtractTag,
  TaggedContext,
} from './tags.js';
import { isVisibleAtLevel, type VisibilityLevel } from './visibility.js';

// ============================================================================
// Security Constants
// ============================================================================

/**
 * Property names that could be exploited for prototype pollution attacks.
 * These are skipped during field projection to prevent security vulnerabilities.
 */
const DANGEROUS_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// ============================================================================
// Resource Instance
// ============================================================================

/**
 * A resource instance that can project data based on access level
 *
 * The Resource class wraps raw data and a schema, providing typed
 * projection methods that return only the fields visible to each
 * access level.
 *
 * @template TSchema - The resource schema type
 *
 * @example
 * ```typescript
 * const user = await db.user.findUnique({ where: { id } });
 * const resource = new Resource(user, UserSchema);
 *
 * // Returns only public fields: { id, name }
 * const publicData = resource.forAnonymous();
 *
 * // Returns public + authenticated fields: { id, name, email }
 * const authData = resource.forAuthenticated();
 *
 * // Returns all fields: { id, name, email, internalNotes }
 * const adminData = resource.forAdmin();
 * ```
 */
export class Resource<TSchema extends ResourceSchema> {
  private readonly _data: Record<string, unknown>;
  private readonly _schema: TSchema;

  constructor(data: Record<string, unknown>, schema: TSchema) {
    this._data = data;
    this._schema = schema;
  }

  /**
   * Projects data for anonymous (unauthenticated) access
   *
   * Returns only fields marked as 'public'.
   */
  forAnonymous(): OutputForTag<TSchema, typeof ANONYMOUS> {
    return this._project('public') as OutputForTag<TSchema, typeof ANONYMOUS>;
  }

  /**
   * Projects data for authenticated user access
   *
   * Returns fields marked as 'public' or 'authenticated'.
   */
  forAuthenticated(): OutputForTag<TSchema, typeof AUTHENTICATED> {
    return this._project('authenticated') as OutputForTag<TSchema, typeof AUTHENTICATED>;
  }

  /**
   * Projects data for admin access
   *
   * Returns all fields (public, authenticated, and admin).
   */
  forAdmin(): OutputForTag<TSchema, typeof ADMIN> {
    return this._project('admin') as OutputForTag<TSchema, typeof ADMIN>;
  }

  /**
   * Projects data based on a tagged context
   *
   * Automatically determines the access level from the context's phantom tag.
   *
   * @param ctx - A context with a phantom tag indicating access level
   * @returns Projected data with fields visible to the context's tag
   *
   * @example
   * ```typescript
   * // In a procedure with guardNarrow(authenticatedNarrow)
   * const profile = resource(user, UserSchema).for(ctx);
   * // Type is automatically inferred based on ctx's tag
   * ```
   */
  for<TContext extends TaggedContext<ContextTag>>(
    ctx: TContext
  ): OutputForTag<TSchema, ExtractTag<TContext>> {
    // At runtime, we need to determine the level from context properties
    // Since the tag is phantom (doesn't exist at runtime), we use heuristics
    const level = this._inferLevelFromContext(ctx);
    return this._project(level) as OutputForTag<TSchema, ExtractTag<TContext>>;
  }

  /**
   * Projects data for an explicit visibility level
   *
   * This is a runtime method that filters fields based on the given level.
   * Uses Object.create(null) and filters dangerous property names to prevent
   * prototype pollution attacks.
   *
   * @param level - The visibility level to project for
   * @returns Object with only the visible fields
   */
  private _project(level: VisibilityLevel): Record<string, unknown> {
    // Use null prototype to prevent prototype pollution
    const result: Record<string, unknown> = Object.create(null);

    for (const field of this._schema.fields as readonly RuntimeField[]) {
      if (isVisibleAtLevel(field.visibility, level)) {
        // Skip dangerous prototype properties to prevent pollution attacks
        if (DANGEROUS_PROPERTIES.has(field.name)) {
          continue;
        }

        const value = this._data[field.name];
        if (value !== undefined) {
          result[field.name] = value;
        }
      }
    }

    return result;
  }

  /**
   * Infers the visibility level from a context object
   *
   * Since phantom tags don't exist at runtime, we use context properties
   * to determine the appropriate level.
   *
   * @internal
   */
  private _inferLevelFromContext(ctx: TaggedContext<ContextTag>): VisibilityLevel {
    // Check for common context patterns
    const ctxRecord = ctx as Record<string, unknown>;

    // Check for admin indicators
    if (ctxRecord.isAdmin === true) {
      return 'admin';
    }

    // Check for user with admin role
    const user = ctxRecord.user as Record<string, unknown> | undefined;
    if (user?.roles && Array.isArray(user.roles)) {
      if (user.roles.includes('admin')) {
        return 'admin';
      }
    }

    // Check for authenticated user
    if (ctxRecord.user !== undefined && ctxRecord.user !== null) {
      return 'authenticated';
    }

    // Check auth context
    const auth = ctxRecord.auth as Record<string, unknown> | undefined;
    if (auth?.isAuthenticated === true) {
      return 'authenticated';
    }

    // Default to public/anonymous
    return 'public';
  }
}

// ============================================================================
// Resource Collection
// ============================================================================

/**
 * A collection of resource instances with batch projection
 *
 * Provides the same projection methods as Resource but operates on arrays,
 * returning an array of projected objects.
 *
 * @template TSchema - The resource schema type
 *
 * @example
 * ```typescript
 * const users = await db.user.findMany();
 * const collection = new ResourceCollection(users, UserSchema);
 *
 * // Returns array of public views
 * const publicList = collection.forAnonymous();
 *
 * // Returns array with authenticated fields
 * const authList = collection.forAuthenticated();
 * ```
 */
export class ResourceCollection<TSchema extends ResourceSchema> {
  private readonly _items: Array<Record<string, unknown>>;
  private readonly _schema: TSchema;

  constructor(items: Array<Record<string, unknown>>, schema: TSchema) {
    this._items = items;
    this._schema = schema;
  }

  /**
   * Projects all items for anonymous access
   */
  forAnonymous(): Array<OutputForTag<TSchema, typeof ANONYMOUS>> {
    return this._items.map((item) => new Resource(item, this._schema).forAnonymous());
  }

  /**
   * Projects all items for authenticated user access
   */
  forAuthenticated(): Array<OutputForTag<TSchema, typeof AUTHENTICATED>> {
    return this._items.map((item) => new Resource(item, this._schema).forAuthenticated());
  }

  /**
   * Projects all items for admin access
   */
  forAdmin(): Array<OutputForTag<TSchema, typeof ADMIN>> {
    return this._items.map((item) => new Resource(item, this._schema).forAdmin());
  }

  /**
   * Projects all items based on a tagged context
   */
  for<TContext extends TaggedContext<ContextTag>>(
    ctx: TContext
  ): Array<OutputForTag<TSchema, ExtractTag<TContext>>> {
    return this._items.map((item) => new Resource(item, this._schema).for(ctx));
  }

  /**
   * Returns the number of items in the collection
   */
  get length(): number {
    return this._items.length;
  }

  /**
   * Checks if the collection is empty
   */
  isEmpty(): boolean {
    return this._items.length === 0;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a Resource instance for a single data object
 *
 * @param data - The raw data object
 * @param schema - The resource schema defining field visibility
 * @returns Resource instance with projection methods
 *
 * @example
 * ```typescript
 * const user = await db.user.findUnique({ where: { id } });
 * if (!user) throw new NotFoundError();
 *
 * // In a public endpoint
 * return resource(user, UserSchema).forAnonymous();
 *
 * // In an authenticated endpoint
 * return resource(user, UserSchema).forAuthenticated();
 *
 * // In an admin endpoint
 * return resource(user, UserSchema).forAdmin();
 * ```
 */
export function resource<TSchema extends ResourceSchema>(
  data: Record<string, unknown>,
  schema: TSchema
): Resource<TSchema> {
  return new Resource(data, schema);
}

/**
 * Creates a ResourceCollection for an array of data objects
 *
 * @param items - Array of raw data objects
 * @param schema - The resource schema defining field visibility
 * @returns ResourceCollection instance with batch projection methods
 *
 * @example
 * ```typescript
 * const users = await db.user.findMany({ take: 10 });
 *
 * // In a public endpoint
 * return resourceCollection(users, UserSchema).forAnonymous();
 *
 * // In an authenticated endpoint
 * return resourceCollection(users, UserSchema).forAuthenticated();
 * ```
 */
export function resourceCollection<TSchema extends ResourceSchema>(
  items: Array<Record<string, unknown>>,
  schema: TSchema
): ResourceCollection<TSchema> {
  return new ResourceCollection(items, schema);
}
