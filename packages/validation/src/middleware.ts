/**
 * Validation middleware for VeloxTS procedures and routes
 *
 * Provides middleware utilities for validating request data
 * with proper error handling and type inference.
 *
 * @module middleware
 */

import { ValidationError } from '@veloxts/core';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';

import type { AnySchema, AnyZodSchema, SafeParseResult } from './types.js';
import { isSchema, isZodSchema } from './types.js';

// ============================================================================
// Error Transformation
// ============================================================================

/**
 * Transforms Zod validation issues into a field-error map
 *
 * @param issues - Array of Zod validation issues
 * @returns Record mapping field paths to error messages
 */
export function formatZodErrors(
  issues: readonly { path: readonly (string | number)[]; message: string }[]
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of issues) {
    const path = issue.path.join('.') || '_root';
    // Only keep the first error for each field
    if (!(path in fields)) {
      fields[path] = issue.message;
    }
  }

  return fields;
}

/**
 * Transforms a ZodError into a VeloxTSValidationError
 *
 * @param error - ZodError from failed validation
 * @param customMessage - Optional custom error message
 * @returns ValidationError with field-specific errors
 */
export function zodErrorToValidationError(
  error: ZodError,
  customMessage?: string
): ValidationError {
  const fields = formatZodErrors(error.issues);
  const message = customMessage ?? 'Validation failed';
  return new ValidationError(message, fields);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Parses and validates data against a schema, throwing ValidationError on failure
 *
 * Follows Zod's naming convention for consistency with the ecosystem.
 *
 * @template T - The validated output type
 * @param schema - Zod schema or Schema wrapper
 * @param data - Data to validate
 * @param errorMessage - Optional custom error message
 * @returns Validated data with proper type
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({ name: z.string(), email: z.string().email() });
 *
 * const user = parse(UserSchema, request.body);
 * // user is typed as { name: string; email: string }
 * ```
 */
export function parse<T>(
  schema: ZodType<T, ZodTypeDef, unknown> | AnySchema,
  data: unknown,
  errorMessage?: string
): T {
  try {
    if (isSchema(schema)) {
      const result = schema.safeParse(data);
      if (result.success) {
        return result.data as T;
      }
      throw new ValidationError(errorMessage ?? 'Validation failed', formatZodErrors(result.error));
    }

    if (isZodSchema(schema)) {
      return (schema as ZodType<T, ZodTypeDef, unknown>).parse(data);
    }

    throw new Error('Invalid schema provided to parse()');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof ZodError) {
      throw zodErrorToValidationError(error, errorMessage);
    }
    throw error;
  }
}

/**
 * @deprecated Use `parse` instead. This alias will be removed in v1.0.
 */
export const validate = parse;

/**
 * Safely parses data without throwing
 *
 * Follows Zod's naming convention for consistency with the ecosystem.
 *
 * @template T - The validated output type
 * @param schema - Zod schema or Schema wrapper
 * @param data - Data to validate
 * @returns Safe parse result with success discriminator
 *
 * @example
 * ```typescript
 * const result = safeParse(UserSchema, request.body);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function safeParse<T>(
  schema: ZodType<T, ZodTypeDef, unknown> | AnySchema,
  data: unknown
): SafeParseResult<T> {
  if (isSchema(schema)) {
    return schema.safeParse(data) as SafeParseResult<T>;
  }

  if (isZodSchema(schema)) {
    const zodSchema = schema as ZodType<T, ZodTypeDef, unknown>;
    const result = zodSchema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      error: result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  return {
    success: false,
    error: [{ path: [], message: 'Invalid schema provided', code: 'custom' }],
  };
}

/**
 * @deprecated Use `safeParse` instead. This alias will be removed in v1.0.
 */
export const safeValidate = safeParse;

// ============================================================================
// Schema Validators
// ============================================================================

/**
 * Creates a reusable validator function from a schema
 *
 * @template TOutput - The validated output type
 * @template TInput - The input type (defaults to unknown)
 * @param schema - Zod schema for validation
 * @returns Object with parse and safeParse methods
 *
 * @example
 * ```typescript
 * const userValidator = createValidator(UserSchema);
 *
 * // In a handler
 * const user = userValidator.parse(request.body);
 * ```
 */
export function createValidator<TOutput, TInput = unknown>(
  schema: ZodType<TOutput, ZodTypeDef, TInput>
): Validator<TOutput> {
  return {
    parse(data: unknown): TOutput {
      return parse(schema, data);
    },

    safeParse(data: unknown): SafeParseResult<TOutput> {
      return safeParse(schema, data);
    },

    // Deprecated aliases
    validate(data: unknown): TOutput {
      return parse(schema, data);
    },

    safeValidate(data: unknown): SafeParseResult<TOutput> {
      return safeParse(schema, data);
    },

    schema,
  };
}

/**
 * Validator interface for type-safe validation
 */
export interface Validator<T> {
  /** Parses data, throwing ValidationError on failure */
  parse(data: unknown): T;
  /** Safely parses data without throwing */
  safeParse(data: unknown): SafeParseResult<T>;
  /** @deprecated Use `parse` instead */
  validate(data: unknown): T;
  /** @deprecated Use `safeParse` instead */
  safeValidate(data: unknown): SafeParseResult<T>;
  /** The underlying Zod schema */
  schema: AnyZodSchema;
}

// ============================================================================
// Request Validation Helpers
// ============================================================================

/**
 * Parses multiple data sources at once
 *
 * Useful for validating body, query, and params together.
 *
 * @param validations - Object mapping names to schema/data pairs
 * @returns Object with validated data for each key
 * @throws ValidationError with combined errors if any validation fails
 *
 * @example
 * ```typescript
 * const { body, query, params } = parseAll({
 *   body: [CreateUserSchema, request.body],
 *   query: [PaginationSchema, request.query],
 *   params: [IdParamSchema, request.params],
 * });
 * ```
 */
export function parseAll<T extends Record<string, [AnyZodSchema, unknown]>>(
  validations: T
): { [K in keyof T]: T[K][0] extends ZodType<infer O, ZodTypeDef, unknown> ? O : never } {
  const results: Record<string, unknown> = {};
  const allErrors: Record<string, string> = {};

  for (const [key, [schema, data]] of Object.entries(validations)) {
    const result = safeParse(schema, data);

    if (result.success) {
      results[key] = result.data;
    } else {
      for (const issue of result.error) {
        const path = issue.path.length > 0 ? `${key}.${issue.path.join('.')}` : key;
        if (!(path in allErrors)) {
          allErrors[path] = issue.message;
        }
      }
    }
  }

  if (Object.keys(allErrors).length > 0) {
    throw new ValidationError('Validation failed', allErrors);
  }

  return results as {
    [K in keyof T]: T[K][0] extends ZodType<infer O, ZodTypeDef, unknown> ? O : never;
  };
}

/**
 * @deprecated Use `parseAll` instead. This alias will be removed in v1.0.
 */
export const validateAll = parseAll;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Creates a type guard from a Zod schema
 *
 * @template T - The validated type
 * @param schema - Zod schema to use for checking
 * @returns Type predicate function
 *
 * @example
 * ```typescript
 * const isUser = createTypeGuard(UserSchema);
 *
 * if (isUser(data)) {
 *   // data is typed as User
 *   console.log(data.name);
 * }
 * ```
 */
export function createTypeGuard<T>(
  schema: ZodType<T, ZodTypeDef, unknown>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    const result = schema.safeParse(value);
    return result.success;
  };
}

/**
 * Asserts that a value matches a schema, narrowing the type
 *
 * @template T - The validated type
 * @param schema - Zod schema to validate against
 * @param value - Value to assert
 * @param errorMessage - Optional custom error message
 * @throws ValidationError if assertion fails
 *
 * @example
 * ```typescript
 * function processUser(data: unknown) {
 *   assertSchema(UserSchema, data);
 *   // data is now typed as User
 *   console.log(data.name);
 * }
 * ```
 */
export function assertSchema<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  value: unknown,
  errorMessage?: string
): asserts value is T {
  validate(schema, value, errorMessage);
}
