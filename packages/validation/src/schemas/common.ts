/**
 * Common schema utilities and pre-built schemas
 *
 * Provides commonly used validation patterns with proper type inference.
 *
 * @module schemas/common
 */

import { z } from 'zod';

// ============================================================================
// Common String Schemas
// ============================================================================

/**
 * UUID v4 string schema
 *
 * @example
 * ```typescript
 * const id = uuidSchema.parse('123e4567-e89b-12d3-a456-426614174000');
 * // id: string (validated UUID)
 * ```
 */
export const uuidSchema = z.string().uuid();

/**
 * Email address schema
 */
export const emailSchema = z.string().email();

/**
 * Non-empty string schema
 */
export const nonEmptyStringSchema = z.string().min(1);

/**
 * URL string schema
 */
export const urlSchema = z.string().url();

/**
 * ISO 8601 datetime string schema
 */
export const datetimeSchema = z.string().datetime();

// ============================================================================
// Common ID Schemas
// ============================================================================

/**
 * Generic ID parameter schema (UUID)
 * Commonly used for route parameters like `/users/:id`
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Type for id parameter objects
 */
export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Creates an ID schema that accepts either UUID or integer string
 *
 * @param type - Type of ID to accept ('uuid' | 'integer' | 'string')
 * @returns Zod schema for the specified ID type
 */
export function createIdSchema<T extends 'uuid' | 'integer' | 'string'>(
  type: T
): T extends 'uuid'
  ? typeof uuidSchema
  : T extends 'integer'
    ? z.ZodType<number, unknown>
    : z.ZodString {
  switch (type) {
    case 'uuid':
      return uuidSchema as ReturnType<typeof createIdSchema<T>>;
    case 'integer':
      return z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().positive()) as unknown as ReturnType<typeof createIdSchema<T>>;
    default:
      return z.string().min(1) as ReturnType<typeof createIdSchema<T>>;
  }
}

// ============================================================================
// Common Object Schemas
// ============================================================================

/**
 * Timestamp fields commonly added to database records
 */
export const timestampFieldsSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Type for timestamp fields
 */
export type TimestampFields = z.infer<typeof timestampFieldsSchema>;

/**
 * Base entity schema with ID and timestamps
 */
export const baseEntitySchema = z.object({
  id: uuidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Type for base entity
 */
export type BaseEntity = z.infer<typeof baseEntitySchema>;

// ============================================================================
// Schema Composition Utilities
// ============================================================================

/**
 * Builds a `{ key: true }` mask from an array of string keys.
 *
 * Zod 4's `.partial()`, `.omit()`, and `.pick()` accept a mask object whose
 * exact type is derived from the schema's shape. We build a plain
 * `Record<string, true>` at runtime and cast it to the schema-specific mask
 * type at each call-site via `Parameters<typeof schema.method>[0]`.
 */
function buildMask(keys: readonly string[]): Record<string, true> {
  const mask: Record<string, true> = {};
  for (const key of keys) mask[key] = true;
  return mask;
}

/**
 * Makes all fields in a schema optional
 *
 * @param schema - Zod object schema
 * @returns Schema with all fields optional
 *
 * @example
 * ```typescript
 * const UpdateUserSchema = makePartial(UserSchema);
 * // All fields are now optional
 * ```
 */
export function makePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}

/**
 * Makes specific fields required in a partial schema
 *
 * @param schema - Zod object schema
 * @param keys - Array of keys to make required
 * @returns Schema with specified fields required, others optional
 *
 * @example
 * ```typescript
 * const UpdateUserSchema = partialExcept(UserSchema, ['id'] as const);
 * // id is required, all other fields are optional
 * ```
 */
export function partialExcept<T extends z.ZodRawShape, K extends keyof T & string>(
  schema: z.ZodObject<T>,
  keys: readonly K[]
): z.ZodObject<
  {
    [P in K]: T[P];
  } & {
    [P in Exclude<keyof T, K>]: z.ZodOptional<T[P]>;
  }
> {
  type PartialMask = Parameters<typeof schema.partial>[0];
  const keysToOptional = Object.keys(schema.shape).filter((k) => !keys.includes(k as K));

  return schema.partial(buildMask(keysToOptional) as PartialMask) as z.ZodObject<
    {
      [P in K]: T[P];
    } & {
      [P in Exclude<keyof T, K>]: z.ZodOptional<T[P]>;
    }
  >;
}

/**
 * Omits specified fields from a schema
 *
 * @param schema - Zod object schema
 * @param keys - Array of keys to omit
 * @returns Schema without the specified fields
 *
 * @example
 * ```typescript
 * const UserWithoutPassword = omitFields(UserSchema, ['password'] as const);
 * ```
 */
export function omitFields<T extends z.ZodRawShape, K extends keyof T & string>(
  schema: z.ZodObject<T>,
  keys: readonly K[]
): z.ZodObject<Omit<T, K>> {
  type OmitMask = Parameters<typeof schema.omit>[0];
  return schema.omit(buildMask(keys) as OmitMask) as z.ZodObject<Omit<T, K>>;
}

/**
 * Picks specified fields from a schema
 *
 * @param schema - Zod object schema
 * @param keys - Array of keys to pick
 * @returns Schema with only the specified fields
 *
 * @example
 * ```typescript
 * const UserIdAndName = pickFields(UserSchema, ['id', 'name'] as const);
 * ```
 */
export function pickFields<T extends z.ZodRawShape, K extends keyof T & string>(
  schema: z.ZodObject<T>,
  keys: readonly K[]
): z.ZodObject<Pick<T, K>> {
  type PickMask = Parameters<typeof schema.pick>[0];
  return schema.pick(buildMask(keys) as PickMask) as z.ZodObject<Pick<T, K>>;
}

// ============================================================================
// Coercion Utilities
// ============================================================================

/**
 * String that coerces to boolean
 * Accepts 'true', '1', 'yes' as true; 'false', '0', 'no' as false
 */
export const booleanStringSchema = z
  .string()
  .transform((val) => {
    const lower = val.toLowerCase();
    if (['true', '1', 'yes'].includes(lower)) return true;
    if (['false', '0', 'no'].includes(lower)) return false;
    return undefined;
  })
  .pipe(z.boolean());

/**
 * String that coerces to number
 * Useful for query parameters
 */
export const numberStringSchema = z
  .string()
  .transform((val) => Number(val))
  .pipe(z.number());

/**
 * String that coerces to integer
 * Useful for pagination parameters
 */
export const integerStringSchema = z
  .string()
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().int());
