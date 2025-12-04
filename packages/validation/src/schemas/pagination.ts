/**
 * Pagination schema utilities
 *
 * Provides standardized pagination input/output schemas for list endpoints.
 *
 * @module schemas/pagination
 */

import { z } from 'zod';

// ============================================================================
// Pagination Constants
// ============================================================================

/**
 * Default pagination configuration
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  page: 1,
  /** Default items per page */
  limit: 20,
  /** Maximum allowed items per page */
  maxLimit: 100,
} as const;

// ============================================================================
// Pagination Input Schemas
// ============================================================================

/**
 * Creates a pagination input schema with configurable defaults
 *
 * @param options - Pagination configuration options
 * @returns Zod schema for pagination input
 *
 * @example
 * ```typescript
 * // Use defaults
 * const PaginationSchema = createPaginationSchema();
 *
 * // Custom configuration
 * const CustomPaginationSchema = createPaginationSchema({
 *   defaultLimit: 10,
 *   maxLimit: 50,
 * });
 * ```
 */
export function createPaginationSchema(
  options: { defaultPage?: number; defaultLimit?: number; maxLimit?: number } = {}
) {
  const {
    defaultPage = PAGINATION_DEFAULTS.page,
    defaultLimit = PAGINATION_DEFAULTS.limit,
    maxLimit = PAGINATION_DEFAULTS.maxLimit,
  } = options;

  return z.object({
    /** Current page number (1-indexed) */
    page: z.coerce.number().int().positive().default(defaultPage),
    /** Number of items per page */
    limit: z.coerce.number().int().positive().max(maxLimit).default(defaultLimit),
  });
}

/**
 * Default pagination input schema
 *
 * Accepts page (default 1) and limit (default 20, max 100)
 */
export const paginationInputSchema = createPaginationSchema();

/**
 * Type for pagination input
 */
export type PaginationInput = z.infer<typeof paginationInputSchema>;

/**
 * Pagination with cursor-based navigation
 *
 * For more efficient pagination of large datasets
 */
export const cursorPaginationSchema = z.object({
  /** Cursor for the current position */
  cursor: z.string().optional(),
  /** Number of items to fetch */
  limit: z.coerce.number().int().positive().max(100).default(20),
  /** Direction to fetch (forward/backward from cursor) */
  direction: z.enum(['forward', 'backward']).default('forward'),
});

/**
 * Type for cursor-based pagination input
 */
export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;

// ============================================================================
// Pagination Output Types
// ============================================================================

/**
 * Creates a paginated response schema for a given item schema
 *
 * @param itemSchema - Zod schema for individual items
 * @returns Zod schema for paginated response
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const PaginatedUsersSchema = createPaginatedResponseSchema(UserSchema);
 *
 * type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>;
 * // { data: User[]; meta: { page, limit, total, totalPages, hasMore } }
 * ```
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    /** Array of items for the current page */
    data: z.array(itemSchema),
    /** Pagination metadata */
    meta: z.object({
      /** Current page number */
      page: z.number().int().positive(),
      /** Items per page */
      limit: z.number().int().positive(),
      /** Total number of items across all pages */
      total: z.number().int().nonnegative(),
      /** Total number of pages */
      totalPages: z.number().int().nonnegative(),
      /** Whether there are more pages after this one */
      hasMore: z.boolean(),
    }),
  });
}

/**
 * Type helper to infer paginated response type from item schema
 */
export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

/**
 * Pagination metadata type
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Creates a cursor-based paginated response schema
 *
 * @param itemSchema - Zod schema for individual items
 * @returns Zod schema for cursor-paginated response
 */
export function createCursorPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    /** Array of items */
    data: z.array(itemSchema),
    /** Cursor pagination metadata */
    meta: z.object({
      /** Cursor for the next page (null if no more) */
      nextCursor: z.string().nullable(),
      /** Cursor for the previous page (null if at start) */
      prevCursor: z.string().nullable(),
      /** Whether there are more items after this page */
      hasMore: z.boolean(),
    }),
  });
}

/**
 * Type for cursor-paginated response
 */
export type CursorPaginatedResponse<T> = {
  data: T[];
  meta: CursorPaginationMeta;
};

/**
 * Cursor pagination metadata type
 */
export interface CursorPaginationMeta {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

// ============================================================================
// Pagination Utilities
// ============================================================================

/**
 * Calculates pagination metadata from total count
 *
 * @param options - Pagination calculation options
 * @returns Pagination metadata
 *
 * @example
 * ```typescript
 * const meta = calculatePaginationMeta({
 *   page: 2,
 *   limit: 20,
 *   total: 55,
 * });
 * // { page: 2, limit: 20, total: 55, totalPages: 3, hasMore: true }
 * ```
 */
export function calculatePaginationMeta(options: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const { page, limit, total } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Calculates offset for database queries
 *
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @returns Offset for database skip
 *
 * @example
 * ```typescript
 * const offset = calculateOffset(3, 20);
 * // offset = 40 (skip first 40 items for page 3)
 * ```
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Creates a paginated response from items and total count
 *
 * @param items - Array of items for current page
 * @param pagination - Pagination input parameters
 * @param total - Total count of items
 * @returns Paginated response object
 *
 * @example
 * ```typescript
 * const users = await db.user.findMany({ skip: 20, take: 20 });
 * const total = await db.user.count();
 *
 * return createPaginatedResponse(users, { page: 2, limit: 20 }, total);
 * ```
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: PaginationInput,
  total: number
): PaginatedResponse<T> {
  return {
    data: items,
    meta: calculatePaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}
