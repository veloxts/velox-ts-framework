/**
 * Resource schema builder
 *
 * Provides a fluent builder API for defining resource schemas with
 * field-level visibility controls. The builder tracks field types
 * at compile time to enable type-safe projections.
 *
 * @module resource/schema
 */

import type { ZodType, ZodTypeDef } from 'zod';

import type {
  AccessLevel,
  ADMIN,
  ANONYMOUS,
  AUTHENTICATED,
  ContextTag,
  LevelToTag,
} from './tags.js';
import type { IsVisibleToTag, VisibilityLevel } from './visibility.js';

// ============================================================================
// Field Types
// ============================================================================

/**
 * A single field definition in a resource schema
 *
 * @template TName - The field name as a literal type
 * @template TSchema - The Zod schema type for this field
 * @template TLevel - The visibility level for this field
 */
export interface ResourceField<
  TName extends string = string,
  TSchema extends ZodType = ZodType,
  TLevel extends VisibilityLevel = VisibilityLevel,
> {
  /** Field name */
  readonly name: TName;
  /** Zod schema for validation */
  readonly schema: TSchema;
  /** Visibility level */
  readonly visibility: TLevel;
}

/**
 * A relation field that references a nested resource schema
 *
 * @template TName - The field name as a literal type
 * @template TNestedFields - The nested schema's field definitions
 * @template TLevel - The visibility level controlling WHETHER the relation is included
 * @template TCardinality - 'one' for nullable object, 'many' for array
 */
export interface RelationField<
  TName extends string = string,
  TNestedFields extends readonly BuilderField[] = readonly BuilderField[],
  TLevel extends VisibilityLevel = VisibilityLevel,
  TCardinality extends 'one' | 'many' = 'one' | 'many',
> {
  readonly name: TName;
  readonly nestedSchema: ResourceSchema<TNestedFields>;
  readonly visibility: TLevel;
  readonly cardinality: TCardinality;
  /** Brand discriminator — distinguishes from ResourceField */
  readonly _relation: true;
}

/**
 * Union of scalar and relation fields in a resource schema
 */
export type BuilderField = ResourceField | RelationField;

/**
 * Runtime representation of a field (without generics for storage)
 */
export interface RuntimeField {
  readonly name: string;
  readonly schema?: ZodType;
  readonly visibility: VisibilityLevel;
  readonly nestedSchema?: ResourceSchema;
  readonly cardinality?: 'one' | 'many';
}

// ============================================================================
// Schema Types
// ============================================================================

/**
 * A completed resource schema with all field definitions
 *
 * The `__fields` phantom type carries the full field type information
 * for compile-time output computation.
 *
 * @template TFields - Tuple of ResourceField types
 */
export interface ResourceSchema<TFields extends readonly BuilderField[] = readonly BuilderField[]> {
  /** Runtime field definitions */
  readonly fields: readonly RuntimeField[];
  /** Phantom type for field type information */
  readonly __fields?: TFields;
}

// ============================================================================
// Tagged Resource Schema
// ============================================================================

/**
 * A resource schema tagged with an explicit access level
 *
 * Created by accessing `.public`, `.authenticated`, or `.admin` on a built schema.
 * Used in both procedure definitions (auto-projection) and handler-level
 * projection via `resource(data, Schema.authenticated)`.
 *
 * @template TFields - The field definitions from the base schema
 * @template TLevel - The access level for projection
 *
 * @example
 * ```typescript
 * const UserSchema = resourceSchema()
 *   .public('id', z.string())
 *   .authenticated('email', z.string())
 *   .build();
 *
 * // Tagged views
 * UserSchema.public        // TaggedResourceSchema<..., 'public'>
 * UserSchema.authenticated  // TaggedResourceSchema<..., 'authenticated'>
 * UserSchema.admin          // TaggedResourceSchema<..., 'admin'>
 * ```
 */
export interface TaggedResourceSchema<
  TFields extends readonly BuilderField[] = readonly BuilderField[],
  TLevel extends AccessLevel = AccessLevel,
> extends ResourceSchema<TFields> {
  readonly _level: TLevel;
}

/**
 * A completed resource schema with pre-built tagged views
 *
 * Returned by `resourceSchema().build()`. Extends `ResourceSchema` (backward
 * compatible) and adds `.public`, `.authenticated`, `.admin` properties
 * for declarative projection.
 *
 * @template TFields - The field definitions
 */
export interface ResourceSchemaWithViews<
  TFields extends readonly BuilderField[] = readonly BuilderField[],
> extends ResourceSchema<TFields> {
  readonly public: TaggedResourceSchema<TFields, 'public'>;
  readonly authenticated: TaggedResourceSchema<TFields, 'authenticated'>;
  readonly admin: TaggedResourceSchema<TFields, 'admin'>;
}

/**
 * Computes the output type for a tagged resource schema
 *
 * Maps the access level to the corresponding phantom tag and
 * computes the projected output type.
 *
 * @template TSchema - A tagged resource schema
 */
export type OutputForLevel<TSchema extends TaggedResourceSchema> =
  TSchema extends TaggedResourceSchema<infer TFields, infer TLevel>
    ? OutputForTag<ResourceSchema<TFields>, LevelToTag<TLevel>>
    : never;

/**
 * Type guard to check if a schema is a TaggedResourceSchema (has _level)
 */
export function isTaggedResourceSchema(value: unknown): value is TaggedResourceSchema {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.fields) &&
    typeof obj._level === 'string' &&
    (obj._level === 'public' || obj._level === 'authenticated' || obj._level === 'admin')
  );
}

// ============================================================================
// Type-Level Output Computation
// ============================================================================

/**
 * Helper to infer the output type of a Zod schema
 */
type InferZodOutput<T> = T extends ZodType<infer O, ZodTypeDef, unknown> ? O : never;

/**
 * Filters fields by visibility and extracts their types
 *
 * This type iterates over the fields tuple and includes only those
 * that are visible to the given context tag. RelationField entries
 * are recursively projected using the same tag.
 */
type FilterFieldsByTag<
  TFields extends readonly BuilderField[],
  TTag extends ContextTag,
> = TFields extends readonly [infer First, ...infer Rest]
  ? Rest extends readonly BuilderField[]
    ? First extends RelationField<infer Name, infer NestedFields, infer Level, infer Card>
      ? IsVisibleToTag<Level, TTag> extends true
        ? {
            [K in Name]: Card extends 'one'
              ? Simplify<FilterFieldsByTag<NestedFields, TTag>> | null
              : Array<Simplify<FilterFieldsByTag<NestedFields, TTag>>>;
          } & FilterFieldsByTag<Rest, TTag>
        : FilterFieldsByTag<Rest, TTag>
      : First extends ResourceField<infer Name, infer Schema, infer Level>
        ? IsVisibleToTag<Level, TTag> extends true
          ? { [K in Name]: InferZodOutput<Schema> } & FilterFieldsByTag<Rest, TTag>
          : FilterFieldsByTag<Rest, TTag>
        : FilterFieldsByTag<Rest, TTag>
    : unknown
  : unknown;

/**
 * Simplifies an intersection type to a cleaner object type
 *
 * Converts `{ a: string } & { b: number }` to `{ a: string; b: number }`
 */
type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

/**
 * Computes the output type for a schema at a given context tag
 *
 * @template TSchema - The resource schema type
 * @template TTag - The context tag to compute output for
 *
 * @example
 * ```typescript
 * type PublicOutput = OutputForTag<UserSchema, typeof ANONYMOUS>;
 * // Result: { id: string; name: string }
 *
 * type AuthOutput = OutputForTag<UserSchema, typeof AUTHENTICATED>;
 * // Result: { id: string; name: string; email: string }
 * ```
 */
export type OutputForTag<
  TSchema extends ResourceSchema,
  TTag extends ContextTag,
> = TSchema extends ResourceSchema<infer TFields>
  ? Simplify<FilterFieldsByTag<TFields, TTag>>
  : never;

/**
 * Convenience type aliases for common tag outputs
 */
export type AnonymousOutput<TSchema extends ResourceSchema> = OutputForTag<
  TSchema,
  typeof ANONYMOUS
>;
export type AuthenticatedOutput<TSchema extends ResourceSchema> = OutputForTag<
  TSchema,
  typeof AUTHENTICATED
>;
export type AdminOutput<TSchema extends ResourceSchema> = OutputForTag<TSchema, typeof ADMIN>;

// ============================================================================
// Schema Builder
// ============================================================================

/**
 * Fluent builder for constructing resource schemas
 *
 * Each method adds a field with a specific visibility level and returns
 * a new builder with the updated field types tracked at compile time.
 *
 * @template TFields - Accumulated field types as a tuple
 *
 * @example
 * ```typescript
 * const UserSchema = resourceSchema()
 *   .public('id', z.string())
 *   .public('name', z.string())
 *   .authenticated('email', z.string())
 *   .admin('internalNotes', z.string().nullable())
 *   .build();
 * ```
 */
export class ResourceSchemaBuilder<TFields extends readonly BuilderField[] = readonly []> {
  private readonly _fields: RuntimeField[];

  private constructor(fields: RuntimeField[] = []) {
    this._fields = fields;
  }

  /**
   * Creates a new empty schema builder
   */
  static create(): ResourceSchemaBuilder<readonly []> {
    return new ResourceSchemaBuilder([]);
  }

  /**
   * Adds a public field (visible to everyone)
   *
   * @param name - Field name
   * @param schema - Zod schema for the field
   * @returns New builder with the field added
   */
  public<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'public'>]> {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility: 'public' },
    ]) as ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'public'>]>;
  }

  /**
   * Adds an authenticated field (visible to authenticated users and admins)
   *
   * @param name - Field name
   * @param schema - Zod schema for the field
   * @returns New builder with the field added
   */
  authenticated<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'authenticated'>]> {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility: 'authenticated' },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, ResourceField<TName, TSchema, 'authenticated'>]
    >;
  }

  /**
   * Adds an admin field (visible only to admins)
   *
   * @param name - Field name
   * @param schema - Zod schema for the field
   * @returns New builder with the field added
   */
  admin<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'admin'>]> {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility: 'admin' },
    ]) as ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'admin'>]>;
  }

  /**
   * Adds a has-one relation (nullable nested object)
   *
   * The relation's visibility controls WHETHER it appears in the output.
   * The parent's projection level controls WHAT fields of the nested schema are shown.
   *
   * **Note:** The nested schema's generic field types are tracked at compile time
   * for output type computation, but the runtime field stores an untyped
   * `ResourceSchema` reference. Always pass the direct result of `.build()`
   * to ensure the compile-time and runtime schemas stay in sync.
   *
   * @param name - Relation field name
   * @param nestedSchema - The nested resource schema (result of `.build()`)
   * @param visibility - Visibility level for this relation
   * @returns New builder with the relation added
   *
   * @example
   * ```typescript
   * const UserSchema = resourceSchema()
   *   .public('id', z.string())
   *   .hasOne('organization', OrgSchema, 'public')
   *   .build();
   * ```
   */
  hasOne<
    TName extends string,
    TNestedFields extends readonly BuilderField[],
    TLevel extends VisibilityLevel,
  >(
    name: TName,
    nestedSchema: ResourceSchema<TNestedFields>,
    visibility: TLevel
  ): ResourceSchemaBuilder<
    readonly [...TFields, RelationField<TName, TNestedFields, TLevel, 'one'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        visibility,
        nestedSchema: nestedSchema as ResourceSchema,
        cardinality: 'one' as const,
      },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, RelationField<TName, TNestedFields, TLevel, 'one'>]
    >;
  }

  /**
   * Adds a has-many relation (array of nested objects)
   *
   * The relation's visibility controls WHETHER it appears in the output.
   * The parent's projection level controls WHAT fields of the nested schema are shown.
   *
   * **Note:** The nested schema's generic field types are tracked at compile time
   * for output type computation, but the runtime field stores an untyped
   * `ResourceSchema` reference. Always pass the direct result of `.build()`
   * to ensure the compile-time and runtime schemas stay in sync.
   *
   * @param name - Relation field name
   * @param nestedSchema - The nested resource schema (result of `.build()`)
   * @param visibility - Visibility level for this relation
   * @returns New builder with the relation added
   *
   * @example
   * ```typescript
   * const UserSchema = resourceSchema()
   *   .public('id', z.string())
   *   .hasMany('posts', PostSchema, 'authenticated')
   *   .build();
   * ```
   */
  hasMany<
    TName extends string,
    TNestedFields extends readonly BuilderField[],
    TLevel extends VisibilityLevel,
  >(
    name: TName,
    nestedSchema: ResourceSchema<TNestedFields>,
    visibility: TLevel
  ): ResourceSchemaBuilder<
    readonly [...TFields, RelationField<TName, TNestedFields, TLevel, 'many'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        visibility,
        nestedSchema: nestedSchema as ResourceSchema,
        cardinality: 'many' as const,
      },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, RelationField<TName, TNestedFields, TLevel, 'many'>]
    >;
  }

  /**
   * Adds a field with explicit visibility level
   *
   * @param name - Field name
   * @param schema - Zod schema for the field
   * @param visibility - Visibility level
   * @returns New builder with the field added
   */
  field<TName extends string, TSchema extends ZodType, TLevel extends VisibilityLevel>(
    name: TName,
    schema: TSchema,
    visibility: TLevel
  ): ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, TLevel>]> {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility },
    ]) as ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, TLevel>]>;
  }

  /**
   * Builds the final resource schema with tagged views
   *
   * Returns a schema with `.public`, `.authenticated`, and `.admin`
   * properties for declarative projection in procedures.
   *
   * @returns Completed resource schema with tagged views
   *
   * @example
   * ```typescript
   * const UserSchema = resourceSchema()
   *   .public('id', z.string())
   *   .authenticated('email', z.string())
   *   .build();
   *
   * // Use tagged views in procedures
   * procedure().resource(UserSchema.authenticated).query(handler);
   *
   * // Or in handlers
   * resource(data, UserSchema.authenticated);
   * ```
   */
  build(): ResourceSchemaWithViews<TFields> {
    const fields = [...this._fields];
    const base = { fields } as ResourceSchema<TFields>;
    return Object.assign(base, {
      public: Object.assign({ fields }, { _level: 'public' as const }) as TaggedResourceSchema<
        TFields,
        'public'
      >,
      authenticated: Object.assign(
        { fields },
        { _level: 'authenticated' as const }
      ) as TaggedResourceSchema<TFields, 'authenticated'>,
      admin: Object.assign({ fields }, { _level: 'admin' as const }) as TaggedResourceSchema<
        TFields,
        'admin'
      >,
    }) as ResourceSchemaWithViews<TFields>;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new resource schema builder
 *
 * This is the primary entry point for defining resource schemas with
 * field-level visibility controls.
 *
 * @returns New empty schema builder
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { resourceSchema } from '@veloxts/router';
 *
 * const UserSchema = resourceSchema()
 *   .public('id', z.string().uuid())
 *   .public('name', z.string())
 *   .public('avatarUrl', z.string().url().nullable())
 *   .authenticated('email', z.string().email())
 *   .authenticated('createdAt', z.date())
 *   .admin('internalNotes', z.string().nullable())
 *   .admin('lastLoginIp', z.string().nullable())
 *   .build();
 *
 * // Type inference:
 * // AnonymousOutput<typeof UserSchema> = { id: string; name: string; avatarUrl: string | null }
 * // AuthenticatedOutput<typeof UserSchema> = { id: string; name: string; avatarUrl: string | null; email: string; createdAt: Date }
 * // AdminOutput<typeof UserSchema> = { id: string; name: string; avatarUrl: string | null; email: string; createdAt: Date; internalNotes: string | null; lastLoginIp: string | null }
 * ```
 */
export function resourceSchema(): ResourceSchemaBuilder<readonly []> {
  return ResourceSchemaBuilder.create();
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a ResourceSchema
 */
export function isResourceSchema(value: unknown): value is ResourceSchema {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.fields);
}
