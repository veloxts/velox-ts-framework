/**
 * User Schemas
 *
 * BROWSER-SAFE: This file imports ONLY from 'zod'.
 * Never import from @veloxts/* packages here.
 */

import { z } from 'zod';

// ============================================================================
// Timestamp Helper
// ============================================================================

/**
 * Schema that accepts Date or string and outputs ISO string.
 * Handles Prisma Date objects → JSON-safe strings.
 */
const dateToString = z
  .union([z.date(), z.string()])
  .transform((val) => (val instanceof Date ? val.toISOString() : val));

// ============================================================================
// User Schema
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  createdAt: dateToString,
  updatedAt: dateToString,
});

export type User = z.infer<typeof UserSchema>;

// ============================================================================
// Input Schemas
// ============================================================================

export const GetUserInput = z.object({
  id: z.string().uuid(),
});

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export type CreateUserData = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserInput>;

export const DeleteUserInput = z.object({
  id: z.string().uuid(),
});

export const ListUsersInput = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .optional();

export type ListUsersData = z.infer<typeof ListUsersInput>;

// ============================================================================
// Response Schemas
// ============================================================================

export const PaginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export const ListUsersResponse = z.object({
  data: z.array(UserSchema),
  meta: PaginationMeta,
});
