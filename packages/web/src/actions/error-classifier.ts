/**
 * Shared Error Classification Utility
 *
 * Provides consistent error classification across all action handlers.
 * Centralizes the pattern matching logic for converting errors to ActionError.
 *
 * @module @veloxts/web/actions/error-classifier
 */

import type { ActionError, ActionErrorCode } from './types.js';

/**
 * Pattern configuration for error classification.
 * Each pattern maps message substrings to error codes.
 */
export interface ErrorPattern {
  /**
   * Substrings to match against error message (case-insensitive)
   */
  readonly patterns: readonly string[];

  /**
   * The error code to return when pattern matches
   */
  readonly code: ActionErrorCode;
}

/**
 * Default error patterns used by the classifier.
 * Ordered by specificity - more specific patterns first.
 *
 * These patterns cover common error scenarios:
 * - Authentication: unauthorized, unauthenticated
 * - Authorization: forbidden, permission
 * - Resource: not found
 * - Conflict: duplicate, conflict
 * - Rate limiting: rate limit, too many
 * - Validation: validation (caught before handler in most cases)
 */
export const DEFAULT_ERROR_PATTERNS: readonly ErrorPattern[] = [
  // Authentication errors
  {
    patterns: ['unauthorized', 'unauthenticated', 'not authenticated', 'authentication required'],
    code: 'UNAUTHORIZED',
  },
  // Authorization errors
  {
    patterns: ['forbidden', 'permission denied', 'access denied', 'not allowed'],
    code: 'FORBIDDEN',
  },
  // Resource not found
  {
    patterns: ['not found', 'does not exist', 'no such', 'could not find'],
    code: 'NOT_FOUND',
  },
  // Conflict/duplicate
  {
    patterns: ['conflict', 'duplicate', 'already exists', 'unique constraint'],
    code: 'CONFLICT',
  },
  // Rate limiting
  {
    patterns: ['rate limit', 'too many requests', 'throttled', 'quota exceeded'],
    code: 'RATE_LIMITED',
  },
  // Validation (fallback - usually caught by Zod)
  {
    patterns: ['validation', 'invalid', 'malformed'],
    code: 'VALIDATION_ERROR',
  },
  // Bad request
  {
    patterns: ['bad request', 'missing required'],
    code: 'BAD_REQUEST',
  },
] as const;

/**
 * Options for error classification.
 */
export interface ClassifyErrorOptions {
  /**
   * Custom patterns to use instead of defaults.
   * If not provided, uses DEFAULT_ERROR_PATTERNS.
   */
  patterns?: readonly ErrorPattern[];

  /**
   * Additional patterns to merge with defaults.
   * These are checked before default patterns.
   */
  additionalPatterns?: readonly ErrorPattern[];

  /**
   * Default error code when no pattern matches.
   * @default 'INTERNAL_ERROR'
   */
  defaultCode?: ActionErrorCode;

  /**
   * Default message for non-Error exceptions.
   * @default 'An unexpected error occurred'
   */
  defaultMessage?: string;

  /**
   * Whether to log errors in development mode.
   * @default true
   */
  logInDevelopment?: boolean;
}

/**
 * Result of error classification.
 */
export interface ClassificationResult {
  /**
   * The classified error code
   */
  code: ActionErrorCode;

  /**
   * The error message
   */
  message: string;

  /**
   * Whether this was classified from a known pattern
   */
  matched: boolean;
}

/**
 * Classifies an unknown error into an ActionErrorCode.
 *
 * Uses pattern matching against error messages to determine the
 * appropriate error code. Falls back to INTERNAL_ERROR for
 * unrecognized errors.
 *
 * @param error - The error to classify (can be any type)
 * @param options - Classification options
 * @returns Classification result with code, message, and match status
 *
 * @example
 * ```typescript
 * import { classifyError } from './error-classifier';
 *
 * try {
 *   await someOperation();
 * } catch (err) {
 *   const result = classifyError(err);
 *   return {
 *     success: false,
 *     error: { code: result.code, message: result.message }
 *   };
 * }
 * ```
 */
export function classifyError(
  error: unknown,
  options: ClassifyErrorOptions = {}
): ClassificationResult {
  const {
    patterns,
    additionalPatterns,
    defaultCode = 'INTERNAL_ERROR',
    defaultMessage = 'An unexpected error occurred',
    logInDevelopment = true,
  } = options;

  // Build the pattern list
  const effectivePatterns = patterns ?? [...(additionalPatterns ?? []), ...DEFAULT_ERROR_PATTERNS];

  // Handle non-Error values
  if (!(error instanceof Error)) {
    return {
      code: defaultCode,
      message: typeof error === 'string' ? error : defaultMessage,
      matched: false,
    };
  }

  const message = error.message;
  const lowerMessage = message.toLowerCase();

  // Check each pattern
  for (const pattern of effectivePatterns) {
    for (const substring of pattern.patterns) {
      if (lowerMessage.includes(substring.toLowerCase())) {
        return {
          code: pattern.code,
          message,
          matched: true,
        };
      }
    }
  }

  // Log unexpected errors in development
  if (logInDevelopment && process.env.NODE_ENV !== 'production') {
    console.error('[VeloxTS] Unclassified error:', error);
  }

  return {
    code: defaultCode,
    message,
    matched: false,
  };
}

/**
 * Creates an ActionError from an unknown error.
 *
 * Convenience wrapper around classifyError that returns a
 * properly formatted ActionError.
 *
 * @param error - The error to convert
 * @param options - Classification options
 * @returns ActionError ready to return from an action
 *
 * @example
 * ```typescript
 * import { toActionError } from './error-classifier';
 *
 * try {
 *   await someOperation();
 * } catch (err) {
 *   return toActionError(err);
 * }
 * ```
 */
export function toActionError(error: unknown, options: ClassifyErrorOptions = {}): ActionError {
  const result = classifyError(error, options);
  return {
    success: false,
    error: {
      code: result.code,
      message: result.message,
    },
  };
}

/**
 * Creates a custom error classifier with pre-configured options.
 *
 * Useful for creating domain-specific classifiers with custom patterns.
 *
 * @param defaultOptions - Options to use by default
 * @returns A configured classifyError function
 *
 * @example
 * ```typescript
 * // Create a classifier with custom patterns for Prisma errors
 * const classifyPrismaError = createErrorClassifier({
 *   additionalPatterns: [
 *     { patterns: ['P2002', 'Unique constraint'], code: 'CONFLICT' },
 *     { patterns: ['P2025', 'Record to update'], code: 'NOT_FOUND' },
 *   ],
 * });
 *
 * try {
 *   await prisma.user.create({ ... });
 * } catch (err) {
 *   return toActionError(err, classifyPrismaError);
 * }
 * ```
 */
export function createErrorClassifier(
  defaultOptions: ClassifyErrorOptions
): (error: unknown, overrides?: ClassifyErrorOptions) => ClassificationResult {
  return (error: unknown, overrides: ClassifyErrorOptions = {}) => {
    return classifyError(error, { ...defaultOptions, ...overrides });
  };
}

/**
 * Pre-built classifier for Prisma-specific errors.
 *
 * Recognizes common Prisma error codes (P2xxx series) and maps them
 * to appropriate ActionErrorCodes.
 */
export const PRISMA_ERROR_PATTERNS: readonly ErrorPattern[] = [
  // Unique constraint violation
  { patterns: ['P2002', 'Unique constraint failed'], code: 'CONFLICT' },
  // Record not found
  { patterns: ['P2001', 'P2018', 'P2025'], code: 'NOT_FOUND' },
  // Foreign key constraint
  { patterns: ['P2003'], code: 'BAD_REQUEST' },
  // Required relation not found
  { patterns: ['P2015'], code: 'NOT_FOUND' },
  // Query interpretation error
  { patterns: ['P2016'], code: 'BAD_REQUEST' },
] as const;

/**
 * Prisma-aware error classifier.
 */
export const classifyPrismaError = createErrorClassifier({
  additionalPatterns: PRISMA_ERROR_PATTERNS,
});
