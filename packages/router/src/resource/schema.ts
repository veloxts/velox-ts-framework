/**
 * Resource schema builder
 *
 * Provides a fluent builder API for defining resource schemas with
 * field-level visibility controls. The builder tracks field types
 * at compile time to enable type-safe projections.
 *
 * Supports both the default 3-level system (public/authenticated/admin)
 * and custom access levels defined via `defineAccessLevels()`.
 *
 * @module resource/schema
 */

import type { ZodType } from 'zod';

import type { AccessLevelConfig } from './levels.js';
import { defaultLevelToSet } from './levels.js';
import type { ContextTag, TagToLevel } from './tags.js';
import type { VisibilityLevel } from './visibility.js';

// ============================================================================
// Field Types
// ============================================================================

/**
 * A single field definition in a resource schema
 *
 * The `TLevel` parameter is a union of level strings representing which
 * access levels can see this field. For the default system:
 * - `.public()` → `'public' | 'authenticated' | 'admin'`
 * - `.authenticated()` → `'authenticated' | 'admin'`
 * - `.admin()` → `'admin'`
 *
 * For custom levels, `TLevel` is the union of levels passed to the builder method.
 *
 * @template TName - The field name as a literal type
 * @template TSchema - The Zod schema type for this field
 * @template TLevel - Union of access level strings that can see this field
 */
export interface ResourceField<
  TName extends string = string,
  TSchema extends ZodType = ZodType,
  TLevel extends string = string,
> {
  /** Field name */
  readonly name: TName;
  /** Zod schema for validation */
  readonly schema: TSchema;
  /** Visibility level (union of levels that can see this field) */
  readonly visibility: TLevel;
}

/**
 * A relation field that references a nested resource schema
 *
 * @template TName - The field name as a literal type
 * @template TNestedFields - The nested schema's field definitions
 * @template TLevel - Union of access level strings controlling WHETHER the relation is included
 * @template TCardinality - 'one' for nullable object, 'many' for array
 */
export interface RelationField<
  TName extends string = string,
  TNestedFields extends readonly BuilderField[] = readonly BuilderField[],
  TLevel extends string = string,
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
  /** Set of levels that can see this field (source of truth) */
  readonly visibleTo: ReadonlySet<string>;
  /** Single visibility level string (backward compat, first level in set) */
  readonly visibility: string;
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
 * Created by accessing `.public`, `.authenticated`, or `.admin` on a built schema,
 * or by accessing any custom level property on a custom-level schema.
 *
 * @template TFields - The field definitions from the base schema
 * @template TLevel - The access level for projection (any string for custom levels)
 */
export interface TaggedResourceSchema<
  TFields extends readonly BuilderField[] = readonly BuilderField[],
  TLevel extends string = string,
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
 * A completed custom-level resource schema with tagged views for each level
 *
 * Returned by `resourceSchema(config).build()`. Has one property per
 * defined level, each a TaggedResourceSchema for that level.
 *
 * @template TFields - The field definitions
 * @template TLevels - The tuple of level names
 */
export type CustomResourceSchemaWithViews<
  TFields extends readonly BuilderField[],
  TLevels extends readonly string[],
> = ResourceSchema<TFields> & {
  [K in TLevels[number]]: TaggedResourceSchema<TFields, K>;
} & { readonly _levelConfig: AccessLevelConfig };

// ============================================================================
// Type-Level Output Computation
// ============================================================================

/**
 * Helper to infer the output type of a Zod schema
 */
type InferZodOutput<T> = T extends { parse: (data: unknown) => infer O } ? O : never;

/**
 * Simplifies an intersection type to a cleaner object type
 *
 * Converts `{ a: string } & { b: number }` to `{ a: string; b: number }`
 */
type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

/**
 * Converts a default VisibilityLevel to its union of visible levels
 *
 * Used by the default builder to track which levels can see a field:
 * - `'public'` → `'public' | 'authenticated' | 'admin'`
 * - `'authenticated'` → `'authenticated' | 'admin'`
 * - `'admin'` → `'admin'`
 */
export type LevelToVisibleUnion<TLevel extends VisibilityLevel> = TLevel extends 'public'
  ? 'public' | 'authenticated' | 'admin'
  : TLevel extends 'authenticated'
    ? 'authenticated' | 'admin'
    : 'admin';

/**
 * Filters fields by level using set membership (union extends check)
 *
 * Includes a field if `TTarget extends TFieldLevels` — i.e., the target
 * level string is a member of the field's visibility union.
 *
 * Works for both the default 3-level system and custom levels.
 */
export type FilterFieldsByLevel<
  TFields extends readonly BuilderField[],
  TTarget extends string,
> = TFields extends readonly [infer First, ...infer Rest]
  ? Rest extends readonly BuilderField[]
    ? First extends RelationField<infer Name, infer NestedFields, infer Levels, infer Card>
      ? TTarget extends Levels
        ? {
            [K in Name]: Card extends 'one'
              ? Simplify<FilterFieldsByLevel<NestedFields, TTarget>> | null
              : Array<Simplify<FilterFieldsByLevel<NestedFields, TTarget>>>;
          } & FilterFieldsByLevel<Rest, TTarget>
        : FilterFieldsByLevel<Rest, TTarget>
      : First extends ResourceField<infer Name, infer Schema, infer Levels>
        ? TTarget extends Levels
          ? { [K in Name]: InferZodOutput<Schema> } & FilterFieldsByLevel<Rest, TTarget>
          : FilterFieldsByLevel<Rest, TTarget>
        : FilterFieldsByLevel<Rest, TTarget>
    : unknown
  : unknown;

/**
 * Filters fields by visibility using tag-based access
 *
 * Delegates to `FilterFieldsByLevel` using `TagToLevel` to convert the
 * phantom tag to a level string. Works with the default 3-level system.
 */
type FilterFieldsByTag<
  TFields extends readonly BuilderField[],
  TTag extends ContextTag,
> = FilterFieldsByLevel<TFields, TagToLevel<TTag>>;

/**
 * Computes the output type for a schema at a given context tag
 *
 * @template TSchema - The resource schema type
 * @template TTag - The context tag to compute output for
 */
export type OutputForTag<TSchema extends ResourceSchema, TTag extends ContextTag> =
  TSchema extends ResourceSchema<infer TFields>
    ? Simplify<FilterFieldsByTag<TFields, TTag>>
    : never;

/**
 * Computes the output type for a tagged resource schema
 *
 * Uses `FilterFieldsByLevel` directly, which works for both default
 * and custom access levels.
 *
 * @template TSchema - A tagged resource schema
 */
export type OutputForLevel<TSchema extends TaggedResourceSchema> =
  TSchema extends TaggedResourceSchema<infer TFields, infer TLevel>
    ? Simplify<FilterFieldsByLevel<TFields, TLevel>>
    : never;

/**
 * Convenience type aliases for common tag outputs
 */
export type PublicOutput<TSchema extends ResourceSchema> = OutputForTag<
  TSchema,
  typeof import('./tags.js').PUBLIC
>;

/** @deprecated Use PublicOutput */
export type AnonymousOutput<TSchema extends ResourceSchema> = PublicOutput<TSchema>;
export type AuthenticatedOutput<TSchema extends ResourceSchema> = OutputForTag<
  TSchema,
  typeof import('./tags.js').AUTHENTICATED
>;
export type AdminOutput<TSchema extends ResourceSchema> = OutputForTag<
  TSchema,
  typeof import('./tags.js').ADMIN
>;

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
   */
  public<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<
    readonly [...TFields, ResourceField<TName, TSchema, 'public' | 'authenticated' | 'admin'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        schema,
        visibility: 'public',
        visibleTo: new Set(['public', 'authenticated', 'admin']),
      },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, ResourceField<TName, TSchema, 'public' | 'authenticated' | 'admin'>]
    >;
  }

  /**
   * Adds an authenticated field (visible to authenticated users and admins)
   */
  authenticated<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<
    readonly [...TFields, ResourceField<TName, TSchema, 'authenticated' | 'admin'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        schema,
        visibility: 'authenticated',
        visibleTo: new Set(['authenticated', 'admin']),
      },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, ResourceField<TName, TSchema, 'authenticated' | 'admin'>]
    >;
  }

  /**
   * Adds an admin field (visible only to admins)
   */
  admin<TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ): ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'admin'>]> {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility: 'admin', visibleTo: new Set(['admin']) },
    ]) as ResourceSchemaBuilder<readonly [...TFields, ResourceField<TName, TSchema, 'admin'>]>;
  }

  /**
   * Adds a has-one relation (nullable nested object)
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
    readonly [...TFields, RelationField<TName, TNestedFields, LevelToVisibleUnion<TLevel>, 'one'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        visibility,
        visibleTo: defaultLevelToSet(visibility),
        nestedSchema: nestedSchema as ResourceSchema,
        cardinality: 'one' as const,
      },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, RelationField<TName, TNestedFields, LevelToVisibleUnion<TLevel>, 'one'>]
    >;
  }

  /**
   * Adds a has-many relation (array of nested objects)
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
    readonly [...TFields, RelationField<TName, TNestedFields, LevelToVisibleUnion<TLevel>, 'many'>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      {
        name,
        visibility,
        visibleTo: defaultLevelToSet(visibility),
        nestedSchema: nestedSchema as ResourceSchema,
        cardinality: 'many' as const,
      },
    ]) as ResourceSchemaBuilder<
      readonly [
        ...TFields,
        RelationField<TName, TNestedFields, LevelToVisibleUnion<TLevel>, 'many'>,
      ]
    >;
  }

  /**
   * Adds a field with explicit visibility level
   */
  field<TName extends string, TSchema extends ZodType, TLevel extends VisibilityLevel>(
    name: TName,
    schema: TSchema,
    visibility: TLevel
  ): ResourceSchemaBuilder<
    readonly [...TFields, ResourceField<TName, TSchema, LevelToVisibleUnion<TLevel>>]
  > {
    return new ResourceSchemaBuilder([
      ...this._fields,
      { name, schema, visibility, visibleTo: defaultLevelToSet(visibility) },
    ]) as ResourceSchemaBuilder<
      readonly [...TFields, ResourceField<TName, TSchema, LevelToVisibleUnion<TLevel>>]
    >;
  }

  /**
   * Builds the final resource schema with tagged views
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
// Custom Schema Builder (Proxy-based)
// ============================================================================

/**
 * Resolves a group reference to its union of level strings
 */
type ResolveGroupToUnion<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]>,
  K extends keyof TGroups,
> = TGroups[K] extends '*'
  ? TLevels[number]
  : TGroups[K] extends readonly (infer U extends string)[]
    ? U
    : never;

/**
 * Resolves a group name or levels array to a union of level strings
 */
type ResolveRefToUnion<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]>,
  TRef,
> = TRef extends keyof TGroups
  ? ResolveGroupToUnion<TLevels, TGroups, TRef>
  : TRef extends readonly (infer U extends string)[]
    ? U
    : never;

/**
 * Methods available on the custom schema builder (non-dynamic)
 */
interface CustomSchemaBuilderMethods<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]>,
  TFields extends readonly BuilderField[],
> {
  /** Adds a field visible to an explicit set of levels */
  visibleTo<
    TName extends string,
    TSchema extends ZodType,
    const TSet extends readonly TLevels[number][],
  >(
    name: TName,
    schema: TSchema,
    levels: TSet
  ): CustomSchemaBuilder<
    TLevels,
    TGroups,
    readonly [...TFields, ResourceField<TName, TSchema, TSet[number]>]
  >;

  /** Adds a has-one relation */
  hasOne<
    TName extends string,
    TNestedFields extends readonly BuilderField[],
    TRef extends (keyof TGroups & string) | readonly TLevels[number][],
  >(
    name: TName,
    nestedSchema: ResourceSchema<TNestedFields>,
    visibility: TRef
  ): CustomSchemaBuilder<
    TLevels,
    TGroups,
    readonly [
      ...TFields,
      RelationField<TName, TNestedFields, ResolveRefToUnion<TLevels, TGroups, TRef>, 'one'>,
    ]
  >;

  /** Adds a has-many relation */
  hasMany<
    TName extends string,
    TNestedFields extends readonly BuilderField[],
    TRef extends (keyof TGroups & string) | readonly TLevels[number][],
  >(
    name: TName,
    nestedSchema: ResourceSchema<TNestedFields>,
    visibility: TRef
  ): CustomSchemaBuilder<
    TLevels,
    TGroups,
    readonly [
      ...TFields,
      RelationField<TName, TNestedFields, ResolveRefToUnion<TLevels, TGroups, TRef>, 'many'>,
    ]
  >;

  /** Builds the final schema with one tagged view per level */
  build(): CustomResourceSchemaWithViews<TFields, TLevels>;
}

/**
 * Custom schema builder type with dynamic methods from groups and levels
 *
 * Group names become fluent methods that resolve to the group's level set.
 * Level names (that don't collide with groups) become methods for single-level visibility.
 */
export type CustomSchemaBuilder<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]>,
  TFields extends readonly BuilderField[] = readonly [],
> = {
  [K in keyof TGroups & string]: <TName extends string, TSchema extends ZodType>(
    name: TName,
    schema: TSchema
  ) => CustomSchemaBuilder<
    TLevels,
    TGroups,
    readonly [...TFields, ResourceField<TName, TSchema, ResolveGroupToUnion<TLevels, TGroups, K>>]
  >;
} & {
  [K in TLevels[number] as K extends keyof TGroups ? never : K]: <
    TName extends string,
    TSchema extends ZodType,
  >(
    name: TName,
    schema: TSchema
  ) => CustomSchemaBuilder<
    TLevels,
    TGroups,
    readonly [...TFields, ResourceField<TName, TSchema, K>]
  >;
} & CustomSchemaBuilderMethods<TLevels, TGroups, TFields>;

/**
 * Resolves a visibility reference (group name, level name, or array) to a Set.
 * Group names are resolved via config, level names become single-element sets,
 * and arrays are used directly.
 *
 * @internal
 */
function resolveVisibilityRef(
  visibility: string | readonly string[],
  config: AccessLevelConfig<readonly string[], Record<string, '*' | readonly string[]>>,
  groupNames: Set<string>,
  levelSet: ReadonlySet<string>
): ReadonlySet<string> {
  if (typeof visibility !== 'string') {
    return new Set(visibility);
  }
  if (groupNames.has(visibility)) {
    return config.resolve(visibility);
  }
  if (levelSet.has(visibility)) {
    return new Set([visibility]);
  }
  throw new Error(`Unknown group or level: "${visibility}"`);
}

/**
 * Creates a Proxy-based custom schema builder
 *
 * @internal
 */
function createCustomSchemaBuilder<
  TLevels extends readonly string[],
  TGroups extends Record<string, '*' | readonly string[]>,
  TFields extends readonly BuilderField[],
>(
  config: AccessLevelConfig<TLevels, TGroups>,
  fields: RuntimeField[]
): CustomSchemaBuilder<TLevels, TGroups, TFields> {
  const levelSet = config.allLevels();
  const groupNames = new Set(Object.keys(config.groups));

  const base = {
    visibleTo(name: string, schema: ZodType, levels: readonly string[]) {
      const set = new Set(levels);
      return createCustomSchemaBuilder(config, [
        ...fields,
        { name, schema, visibleTo: set, visibility: levels[0] ?? '' },
      ]);
    },

    hasOne(name: string, nestedSchema: ResourceSchema, visibility: string | readonly string[]) {
      const set = resolveVisibilityRef(visibility, config, groupNames, levelSet);
      return createCustomSchemaBuilder(config, [
        ...fields,
        {
          name,
          nestedSchema,
          visibleTo: set,
          visibility: [...set][0] ?? '',
          cardinality: 'one' as const,
        },
      ]);
    },

    hasMany(name: string, nestedSchema: ResourceSchema, visibility: string | readonly string[]) {
      const set = resolveVisibilityRef(visibility, config, groupNames, levelSet);
      return createCustomSchemaBuilder(config, [
        ...fields,
        {
          name,
          nestedSchema,
          visibleTo: set,
          visibility: [...set][0] ?? '',
          cardinality: 'many' as const,
        },
      ]);
    },

    build() {
      const frozenFields = [...fields];
      const baseSchema = { fields: frozenFields } as ResourceSchema<TFields>;
      const result = Object.assign(baseSchema, { _levelConfig: config }) as unknown as Record<
        string,
        unknown
      >;

      for (const level of config.levels) {
        result[level] = Object.assign(
          { fields: frozenFields },
          { _level: level }
        ) as TaggedResourceSchema<TFields, string>;
      }

      return result as CustomResourceSchemaWithViews<TFields, TLevels>;
    },
  };

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        // Check if it's a group name
        if (groupNames.has(prop)) {
          return (name: string, schema: ZodType) => {
            const set = config.resolve(prop as keyof TGroups & string);
            return createCustomSchemaBuilder(config, [
              ...fields,
              { name, schema, visibleTo: set, visibility: [...set][0] ?? '' },
            ]);
          };
        }
        // Check if it's a level name (not a group)
        if (levelSet.has(prop)) {
          return (name: string, schema: ZodType) => {
            const set = new Set([prop]);
            return createCustomSchemaBuilder(config, [
              ...fields,
              { name, schema, visibleTo: set, visibility: prop },
            ]);
          };
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as CustomSchemaBuilder<TLevels, TGroups, TFields>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new resource schema builder
 *
 * Without arguments, returns the default 3-level builder with
 * `.public()`, `.authenticated()`, `.admin()` methods.
 *
 * With an `AccessLevelConfig` argument (from `defineAccessLevels()`),
 * returns a custom builder whose methods correspond to the defined
 * levels and groups.
 *
 * @example Default (3-level)
 * ```typescript
 * const UserSchema = resourceSchema()
 *   .public('id', z.string())
 *   .authenticated('email', z.string())
 *   .admin('internalNotes', z.string())
 *   .build();
 * ```
 *
 * @example Custom levels
 * ```typescript
 * const access = defineAccessLevels(
 *   ['public', 'reviewer', 'authenticated', 'moderator', 'admin'],
 *   { everyone: '*', staff: ['moderator', 'admin'] }
 * );
 *
 * const ArticleSchema = resourceSchema(access)
 *   .everyone('id', z.string())
 *   .staff('moderationLog', z.string())
 *   .visibleTo('authorEmail', z.string(), ['authenticated', 'admin'])
 *   .build();
 * ```
 */
export function resourceSchema(): ResourceSchemaBuilder<readonly []>;
export function resourceSchema<
  const TLevels extends readonly [string, ...string[]],
  const TGroups extends Record<string, '*' | readonly string[]>,
>(config: AccessLevelConfig<TLevels, TGroups>): CustomSchemaBuilder<TLevels, TGroups, readonly []>;
export function resourceSchema(config?: AccessLevelConfig): unknown {
  if (!config) {
    return ResourceSchemaBuilder.create();
  }
  return createCustomSchemaBuilder(config, []);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a schema is a TaggedResourceSchema (has _level)
 *
 * Accepts any string _level to support custom access levels.
 */
export function isTaggedResourceSchema(value: unknown): value is TaggedResourceSchema {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.fields) && typeof obj._level === 'string';
}

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
