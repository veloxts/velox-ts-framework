/**
 * @veloxts/validation - Zod integration for runtime validation
 *
 * Provides Zod-based validation with automatic type inference for
 * procedure inputs/outputs and request validation.
 *
 * @example
 * ```typescript
 * import { z, parse, InferOutput } from '@veloxts/validation';
 *
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * type User = InferOutput<typeof UserSchema>;
 *
 * const user = parse(UserSchema, data);
 * // user is typed as User
 * ```
 *
 * @module @veloxts/validation
 */

// Re-export Zod for convenience
// Users can import { z } from '@veloxts/validation' instead of installing zod separately
export { ZodError, type ZodType, type ZodTypeDef, z } from 'zod';

// Version constant
export const VALIDATION_VERSION = '0.1.0' as const;

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Schema types
  AnySchema,
  AnyZodSchema,
  InferInput,
  InferOutput,
  NoInput,
  ResolveInput,
  ResolveOutput,
  // Parse result types
  SafeParseError,
  SafeParseResult,
  SafeParseSuccess,
  Schema,
  SchemaLike,
  UnknownOutput,
  ValidationIssue,
} from './types.js';
export { isSchema, isZodSchema, wrapSchema } from './types.js';

// ============================================================================
// Validation Middleware
// ============================================================================

// ============================================================================
// Validation Middleware
// ============================================================================

export type { Validator } from './middleware.js';
// Primary API - parse functions (Zod naming convention)
// Deprecated aliases for backwards compatibility
export {
  assertSchema,
  createTypeGuard,
  createValidator,
  formatZodErrors,
  parse,
  parseAll,
  safeParse,
  safeValidate,
  validate,
  validateAll,
  zodErrorToValidationError,
} from './middleware.js';

// ============================================================================
// Common Schemas
// ============================================================================

export type { BaseEntity, IdParam, TimestampFields } from './schemas/common.js';
export {
  baseEntitySchema,
  booleanStringSchema,
  createIdSchema,
  datetimeSchema,
  emailSchema,
  idParamSchema,
  integerStringSchema,
  makePartial,
  nonEmptyStringSchema,
  numberStringSchema,
  omitFields,
  partialExcept,
  pickFields,
  timestampFieldsSchema,
  urlSchema,
  uuidSchema,
} from './schemas/common.js';

// ============================================================================
// Pagination Schemas
// ============================================================================

export type {
  CursorPaginatedResponse,
  CursorPaginationInput,
  CursorPaginationMeta,
  PaginatedResponse,
  PaginationInput,
  PaginationMeta,
} from './schemas/pagination.js';
export {
  calculateOffset,
  calculatePaginationMeta,
  createCursorPaginatedResponseSchema,
  createPaginatedResponse,
  createPaginatedResponseSchema,
  createPaginationSchema,
  cursorPaginationSchema,
  PAGINATION_DEFAULTS,
  paginationInputSchema,
} from './schemas/pagination.js';
