/**
 * Query Parameter Coercion Helpers
 *
 * Provides type-safe coercion utilities for query string parameters.
 * Query parameters arrive as strings; these helpers provide automatic
 * conversion to appropriate types with sensible defaults.
 *
 * @module schemas/query
 */

import { z } from 'zod';

// ============================================================================
// Number Helpers
// ============================================================================

/**
 * Creates a number schema that coerces from query string
 *
 * @param defaultValue - Default when undefined/empty (optional)
 * @returns Zod schema that parses string to number
 *
 * @example Required number
 * ```typescript
 * .input(z.object({
 *   userId: queryNumber(), // Required, no default
 * }))
 * ```
 *
 * @example With default value
 * ```typescript
 * .input(z.object({
 *   page: queryNumber(1),   // Defaults to 1
 *   limit: queryNumber(20), // Defaults to 20
 * }))
 * ```
 */
export function queryNumber(): z.ZodNumber;
export function queryNumber(defaultValue: number): z.ZodDefault<z.ZodNumber>;
export function queryNumber(defaultValue?: number): z.ZodNumber | z.ZodDefault<z.ZodNumber> {
  const base = z.coerce.number();
  return defaultValue !== undefined ? base.default(defaultValue) : base;
}

/**
 * Creates an integer schema that coerces from query string
 *
 * @param defaultValue - Default when undefined/empty (optional)
 * @returns Zod schema that parses string to integer
 *
 * @example
 * ```typescript
 * .input(z.object({
 *   page: queryInt(1),      // Defaults to 1
 *   userId: queryInt(),     // Required integer
 * }))
 * ```
 */
export function queryInt(): z.ZodNumber;
export function queryInt(defaultValue: number): z.ZodDefault<z.ZodNumber>;
export function queryInt(defaultValue?: number): z.ZodNumber | z.ZodDefault<z.ZodNumber> {
  const base = z.coerce.number().int();
  return defaultValue !== undefined ? base.default(defaultValue) : base;
}

// ============================================================================
// Boolean Helper
// ============================================================================

/**
 * Creates a boolean schema that coerces from query string
 *
 * Accepts common truthy/falsy string values:
 * - Truthy: 'true', '1', 'yes', 'on'
 * - Falsy: 'false', '0', 'no', 'off'
 *
 * @param defaultValue - Default when undefined/empty (optional)
 * @returns Zod schema that parses string to boolean
 *
 * @example
 * ```typescript
 * .input(z.object({
 *   active: queryBoolean(true),   // Defaults to true
 *   deleted: queryBoolean(false), // Defaults to false
 *   verified: queryBoolean(),     // Optional, undefined if not provided
 * }))
 *
 * // Accepts: ?active=true, ?active=1, ?active=yes, ?active=on
 * // Accepts: ?deleted=false, ?deleted=0, ?deleted=no, ?deleted=off
 * ```
 */
export function queryBoolean(): z.ZodOptional<z.ZodBoolean>;
export function queryBoolean(defaultValue: boolean): z.ZodDefault<z.ZodBoolean>;
export function queryBoolean(
  defaultValue?: boolean
): z.ZodOptional<z.ZodBoolean> | z.ZodDefault<z.ZodBoolean> {
  // Use preprocess to handle string-to-boolean conversion with query string conventions.
  //
  // NOTE: Type casting is required here because z.preprocess() wraps the inner schema
  // in ZodEffects, but our public API promises ZodDefault<ZodBoolean> / ZodOptional<ZodBoolean>
  // for better consumer type inference. The runtime behavior is correct; we cast to
  // maintain the cleaner public type signature.
  const booleanSchema = z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
    }
    return undefined;
  }, z.boolean());

  if (defaultValue !== undefined) {
    return booleanSchema.default(defaultValue) as unknown as z.ZodDefault<z.ZodBoolean>;
  }
  return booleanSchema.optional() as unknown as z.ZodOptional<z.ZodBoolean>;
}

// ============================================================================
// String Array Helper
// ============================================================================

/**
 * Creates a string array schema that coerces from comma-separated query string
 *
 * @param options - Configuration options
 * @returns Zod schema that parses comma-separated string to array
 *
 * @example Basic usage
 * ```typescript
 * .input(z.object({
 *   tags: queryArray(),           // 'a,b,c' -> ['a', 'b', 'c']
 *   ids: queryArray({ min: 1 }),  // At least one item required
 *   categories: queryArray({ max: 5 }), // Max 5 items
 * }))
 *
 * // GET /api/products?tags=electronics,sale,featured
 * // Result: { tags: ['electronics', 'sale', 'featured'] }
 * ```
 *
 * @example Edge cases
 * ```typescript
 * // Empty string results in empty array (whitespace-only items filtered)
 * queryArray().parse('')          // []
 * queryArray().parse('  ,  ')     // []
 *
 * // With min constraint, empty string will fail validation
 * queryArray({ min: 1 }).parse('')  // throws: "Array must have at least 1 item(s)"
 *
 * // If you want "no parameter = no filter", combine with optional:
 * .input(z.object({
 *   tags: queryArray({ min: 1 }).optional(),  // undefined or non-empty array
 * }))
 * ```
 *
 * @remarks
 * Empty strings and whitespace-only values are automatically filtered out.
 * This means `?tags=` (empty) and `?tags=,,` (only separators) both result
 * in an empty array `[]`. If you have a `min: 1` constraint, these will fail
 * validation. Use `.optional()` if the parameter should be omittable.
 */
export function queryArray(
  options: {
    /** Minimum number of items required */
    min?: number;
    /** Maximum number of items allowed */
    max?: number;
    /** Separator character (default: ',') */
    separator?: string;
  } = {}
): z.ZodType<string[], z.ZodTypeDef, string> {
  const { min, max, separator = ',' } = options;

  // Split by separator, trim whitespace, and filter out empty strings.
  // Note: Empty input ('') results in [], which may fail min constraint.
  const baseSchema = z.string().transform((val) =>
    val
      .split(separator)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  // Apply min/max constraints via refinement if needed
  if (min !== undefined || max !== undefined) {
    return baseSchema.refine(
      (arr) => {
        if (min !== undefined && arr.length < min) return false;
        if (max !== undefined && arr.length > max) return false;
        return true;
      },
      {
        message:
          min !== undefined && max !== undefined
            ? `Array must have ${min}-${max} items`
            : min !== undefined
              ? `Array must have at least ${min} item(s)`
              : `Array must have at most ${max} item(s)`,
      }
    );
  }

  return baseSchema;
}

// ============================================================================
// Enum Helper
// ============================================================================

/**
 * Creates an enum schema that validates against allowed values
 *
 * @param values - Array of allowed string values (use `as const` for type inference)
 * @param defaultValue - Default value when undefined/empty (optional)
 * @returns Zod schema that validates against enum values
 *
 * @example
 * ```typescript
 * .input(z.object({
 *   sort: queryEnum(['asc', 'desc'] as const, 'asc'),
 *   status: queryEnum(['active', 'pending', 'archived'] as const),
 * }))
 *
 * // GET /api/users?sort=desc&status=active
 * // Result: { sort: 'desc', status: 'active' }
 * ```
 */
export function queryEnum<T extends readonly [string, ...string[]]>(
  values: T
): z.ZodEnum<[T[number], ...T[number][]]>;
export function queryEnum<T extends readonly [string, ...string[]]>(
  values: T,
  defaultValue: T[number]
): z.ZodDefault<z.ZodEnum<[T[number], ...T[number][]]>>;
export function queryEnum<T extends readonly [string, ...string[]]>(
  values: T,
  defaultValue?: T[number]
): z.ZodEnum<[T[number], ...T[number][]]> | z.ZodDefault<z.ZodEnum<[T[number], ...T[number][]]>> {
  // Cast to mutable tuple type that Zod expects
  const mutableValues = [...values] as [T[number], ...T[number][]];
  const base = z.enum(mutableValues);
  return defaultValue !== undefined ? base.default(defaultValue) : base;
}

// ============================================================================
// Pagination Shorthand
// ============================================================================

/**
 * Pre-built pagination schema for common use cases
 *
 * This is a shorthand for creating pagination input schemas.
 * For more customization, use `createPaginationSchema` from pagination.js.
 *
 * @param options - Pagination configuration
 * @returns Zod schema for pagination input
 *
 * @example Default offset-based pagination
 * ```typescript
 * .input(pagination())
 * // { page: number, limit: number }
 * ```
 *
 * @example With custom limits
 * ```typescript
 * .input(pagination({ defaultLimit: 10, maxLimit: 50 }))
 * ```
 *
 * @example Extended with filters
 * ```typescript
 * .input(pagination().extend({
 *   search: z.string().optional(),
 *   status: queryEnum(['active', 'archived'] as const),
 * }))
 * ```
 */
export function pagination(
  options: {
    /** Default page number (default: 1) */
    defaultPage?: number;
    /** Default items per page (default: 20) */
    defaultLimit?: number;
    /** Maximum allowed items per page (default: 100) */
    maxLimit?: number;
  } = {}
) {
  const { defaultPage = 1, defaultLimit = 20, maxLimit = 100 } = options;

  return z.object({
    page: z.coerce.number().int().positive().default(defaultPage),
    limit: z.coerce.number().int().positive().max(maxLimit).default(defaultLimit),
  });
}
