/**
 * Core type definitions for @veloxts/validation
 *
 * Provides type-safe Zod integration with automatic type inference
 * for procedure inputs/outputs.
 *
 * @module types
 */

import type { ZodType, ZodTypeDef } from 'zod';

// ============================================================================
// Schema Types
// ============================================================================

/**
 * Type-safe validator interface that wraps Zod schemas
 *
 * This abstraction allows the framework to work with Zod while maintaining
 * the flexibility to support other validation libraries in the future.
 *
 * @template TOutput - The validated output type
 * @template TInput - The raw input type (defaults to TOutput)
 */
export interface Schema<TOutput = unknown, _TInput = TOutput> {
  /**
   * Parses input and returns validated data
   * Throws ZodError on validation failure
   */
  readonly parse: (input: unknown) => TOutput;

  /**
   * Safely parses input without throwing
   * Returns discriminated union with success/error
   */
  readonly safeParse: (input: unknown) => SafeParseResult<TOutput>;

  /**
   * Brand to identify Schema instances
   * @internal
   */
  readonly _schema: true;
}

/**
 * Result type for safe parsing operations
 */
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseError;

/**
 * Successful parse result
 */
export interface SafeParseSuccess<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * Failed parse result with error details
 */
export interface SafeParseError {
  readonly success: false;
  readonly error: ValidationIssue[];
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Dot-notation path to the invalid field */
  readonly path: readonly (string | number)[];
  /** Human-readable error message */
  readonly message: string;
  /** Zod error code */
  readonly code: string;
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Infers the output type from a Schema or ZodType
 *
 * Works with both wrapped Schema instances and raw Zod schemas,
 * enabling seamless type inference in procedure chains.
 *
 * @template T - Schema or ZodType to infer from
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * type User = InferOutput<typeof UserSchema>;
 * // User = { id: string; name: string }
 * ```
 */
export type InferOutput<T> =
  T extends Schema<infer O, infer _I>
    ? O
    : T extends ZodType<infer O, ZodTypeDef, infer _I>
      ? O
      : never;

/**
 * Infers the input type from a Schema or ZodType
 *
 * For schemas with transforms, this returns the pre-transform type.
 *
 * @template T - Schema or ZodType to infer from
 *
 * @example
 * ```typescript
 * const DateSchema = z.string().transform((s) => new Date(s));
 * type DateInput = InferInput<typeof DateSchema>;
 * // DateInput = string (not Date)
 * ```
 */
export type InferInput<T> =
  T extends Schema<infer _O, infer I>
    ? I
    : T extends ZodType<infer _O, ZodTypeDef, infer I>
      ? I
      : never;

// ============================================================================
// Schema Type Guards
// ============================================================================

/**
 * Type constraint for any Zod schema
 *
 * Used in generic constraints to accept any valid Zod schema.
 */
export type AnyZodSchema = ZodType<unknown, ZodTypeDef, unknown>;

/**
 * Type constraint for any Schema wrapper
 */
export type AnySchema = Schema<unknown, unknown>;

/**
 * Union type accepting both raw Zod schemas and wrapped Schema instances
 */
export type SchemaLike = AnyZodSchema | AnySchema;

/**
 * Type guard to check if a value is a Schema instance
 */
export function isSchema(value: unknown): value is AnySchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_schema' in value &&
    (value as { _schema: unknown })._schema === true
  );
}

/**
 * Type guard to check if a value is a Zod schema
 */
export function isZodSchema(value: unknown): value is AnyZodSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    'parse' in value &&
    'safeParse' in value &&
    '_def' in value
  );
}

// ============================================================================
// Schema Wrapper Factory
// ============================================================================

/**
 * Wraps a Zod schema in the framework's Schema interface
 *
 * This provides a consistent API and transforms Zod errors into
 * a framework-friendly format.
 *
 * @template TOutput - The validated output type
 * @template TInput - The raw input type
 * @param zodSchema - The Zod schema to wrap
 * @returns Wrapped Schema instance
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { wrapSchema } from '@veloxts/validation';
 *
 * const UserSchema = wrapSchema(z.object({
 *   id: z.string().uuid(),
 *   name: z.string().min(1),
 * }));
 * ```
 */
export function wrapSchema<TOutput, TInput = TOutput>(
  zodSchema: ZodType<TOutput, ZodTypeDef, TInput>
): Schema<TOutput, TInput> {
  return {
    _schema: true as const,

    parse(input: unknown): TOutput {
      return zodSchema.parse(input);
    },

    safeParse(input: unknown): SafeParseResult<TOutput> {
      const result = zodSchema.safeParse(input);

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        success: false,
        error: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      };
    },
  };
}

// ============================================================================
// Utility Types for Procedures
// ============================================================================

/**
 * Represents no input (undefined) for procedures without input schemas
 */
export type NoInput = undefined;

/**
 * Represents unknown output for procedures without output schemas
 */
export type UnknownOutput = unknown;

/**
 * Utility type to resolve the effective input type
 * Returns NoInput if undefined, otherwise the inferred type
 */
export type ResolveInput<T> = T extends undefined ? NoInput : InferOutput<T>;

/**
 * Utility type to resolve the effective output type
 * Returns UnknownOutput if undefined, otherwise the inferred type
 */
export type ResolveOutput<T> = T extends undefined ? UnknownOutput : InferOutput<T>;
