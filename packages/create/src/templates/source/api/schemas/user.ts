/**
 * User Schemas
 *
 * BROWSER-SAFE: This file imports ONLY from 'zod'.
 * Never import from @veloxts/* packages here.
 */

import { z } from 'zod';

// ============================================================================
// User Schema
// ============================================================================

/**
 * User response schema.
 * Uses z.coerce.date() to safely handle both:
 * - Date objects from Prisma (output)
 * - ISO strings from JSON (input validation)
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
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
