/**
 * Resource instance and collection classes
 *
 * Provides runtime projection functionality for resource data,
 * filtering fields based on visibility levels.
 *
 * @module resource/instance
 */

import type {
  OutputForLevel,
  OutputForTag,
  ResourceSchema,
  RuntimeField,
  TaggedResourceSchema,
} from './schema.js';
import { isTaggedResourceSchema } from './schema.js';
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
const DANGEROUS_PROPERTIES: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// ============================================================================
// Recursive Projection
// ============================================================================

/**
 * Recursively projects data through a resource schema, including nested relations
 *
 * @internal
 * @param data - The raw data object
 * @param schema - The resource schema to project against
 * @param level - The visibility level to project for
 * @returns Projected object with null prototype
 */
function projectData(
  data: Record<string, unknown>,
  schema: ResourceSchema,
  level: VisibilityLevel
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);

  for (const field of schema.fields as readonly RuntimeField[]) {
    if (!isVisibleAtLevel(field.visibility, level)) continue;
    if (DANGEROUS_PROPERTIES.has(field.name)) continue;

    const value = data[field.name];

    if (field.nestedSchema && field.cardinality) {
      // Relation field — recursive projection
      if (field.cardinality === 'one') {
        if (value != null && typeof value === 'object' && !Array.isArray(value)) {
          result[field.name] = projectData(
            value as Record<string, unknown>,
            field.nestedSchema,
            level
          );
        } else {
          result[field.name] = null;
        }
      } else {
        // 'many'
        if (Array.isArray(value)) {
          const nested = field.nestedSchema;
          result[field.name] = value.map((item) =>
            item != null && typeof item === 'object'
              ? projectData(item as Record<string, unknown>, nested, level)
              : item
          );
        } else {
          result[field.name] = [];
        }
      }
    } else if (value !== undefined) {
      // Scalar field — existing behavior
      result[field.name] = value;
    }
  }

  return result;
}

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
   * Delegates to the standalone `projectData()` function which supports
   * recursive projection of nested relations.
   *
   * @param level - The visibility level to project for
   * @returns Object with only the visible fields (null prototype)
   */
  private _project(level: VisibilityLevel): Record<string, unknown> {
    return projectData(this._data, this._schema, level);
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
 * Creates a projected view or Resource instance for a single data object
 *
 * When called with a tagged schema (e.g., `UserSchema.authenticated`),
 * returns the projected data directly. When called with an untagged schema,
 * returns a Resource instance with `.forAnonymous()`, `.forAuthenticated()`,
 * `.forAdmin()` methods.
 *
 * @param data - The raw data object
 * @param schema - Resource schema (tagged for direct projection, untagged for Resource instance)
 * @returns Projected data or Resource instance
 *
 * @example
 * ```typescript
 * const user = await db.user.findUnique({ where: { id } });
 *
 * // Tagged schema → returns projected data directly
 * return resource(user, UserSchema.authenticated);
 * // → { id, name, email }
 *
 * // Untagged schema → returns Resource with projection methods
 * return resource(user, UserSchema).forAuthenticated();
 * // → { id, name, email }
 * ```
 */
export function resource<TSchema extends TaggedResourceSchema>(
  data: Record<string, unknown>,
  schema: TSchema
): OutputForLevel<TSchema>;
export function resource<TSchema extends ResourceSchema>(
  data: Record<string, unknown>,
  schema: TSchema
): Resource<TSchema>;
export function resource(
  data: Record<string, unknown>,
  schema: ResourceSchema | TaggedResourceSchema
): unknown {
  if (isTaggedResourceSchema(schema)) {
    const r = new Resource(data, schema);
    switch (schema._level) {
      case 'admin':
        return r.forAdmin();
      case 'authenticated':
        return r.forAuthenticated();
      default:
        return r.forAnonymous();
    }
  }
  return new Resource(data, schema);
}

/**
 * Creates a projected array or ResourceCollection for an array of data objects
 *
 * When called with a tagged schema (e.g., `UserSchema.authenticated`),
 * returns the projected array directly. When called with an untagged schema,
 * returns a ResourceCollection with projection methods.
 *
 * @param items - Array of raw data objects
 * @param schema - Resource schema (tagged for direct projection, untagged for collection)
 * @returns Projected array or ResourceCollection instance
 *
 * @example
 * ```typescript
 * const users = await db.user.findMany({ take: 10 });
 *
 * // Tagged schema → returns projected array directly
 * return resourceCollection(users, UserSchema.authenticated);
 *
 * // Untagged schema → returns ResourceCollection with methods
 * return resourceCollection(users, UserSchema).forAuthenticated();
 * ```
 */
export function resourceCollection<TSchema extends TaggedResourceSchema>(
  items: Array<Record<string, unknown>>,
  schema: TSchema
): Array<OutputForLevel<TSchema>>;
export function resourceCollection<TSchema extends ResourceSchema>(
  items: Array<Record<string, unknown>>,
  schema: TSchema
): ResourceCollection<TSchema>;
export function resourceCollection(
  items: Array<Record<string, unknown>>,
  schema: ResourceSchema | TaggedResourceSchema
): unknown {
  if (isTaggedResourceSchema(schema)) {
    return items.map((item) => {
      const r = new Resource(item, schema);
      switch (schema._level) {
        case 'admin':
          return r.forAdmin();
        case 'authenticated':
          return r.forAuthenticated();
        default:
          return r.forAnonymous();
      }
    });
  }
  return new ResourceCollection(items, schema);
}
