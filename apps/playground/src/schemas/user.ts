/**
 * User Schemas
 *
 * Zod schemas for user validation and type inference.
 * Following Laravel-inspired conventions: schemas define the shape of data.
 */

import { createIdSchema, emailSchema } from '@veloxts/validation';
import { z } from 'zod';

// ============================================================================
// User Schema
// ============================================================================

/**
 * Full user schema for responses
 *
 * Matches the Prisma User model structure.
 * Dates are transformed to ISO strings for JSON serialization.
 */
export const UserSchema = z.object({
  id: createIdSchema('uuid'),
  name: z.string().min(1).max(100),
  email: emailSchema,
  createdAt: z.coerce.date().transform((d) => d.toISOString()),
  updatedAt: z.coerce.date().transform((d) => d.toISOString()),
});

/**
 * User type inferred from schema
 */
export type User = z.infer<typeof UserSchema>;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Schema for creating a new user
 */
export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
});

export type CreateUserData = z.infer<typeof CreateUserInput>;

/**
 * Schema for updating an existing user
 */
export const UpdateUserInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserInput>;

/**
 * Schema for user search
 */
export const SearchUserInput = z.object({
  q: z.string().min(1),
});

export type SearchUserQuery = z.infer<typeof SearchUserInput>;
