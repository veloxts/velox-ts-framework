'use server';

/**
 * User Server Actions
 *
 * Type-safe server actions with built-in security using VeloxTS validated() helper.
 * These can be called directly from client components with full type inference.
 *
 * The validated() helper provides:
 * - Input validation via Zod schemas
 * - Input size limits (DoS protection)
 * - Input sanitization (prototype pollution prevention)
 * - Rate limiting (optional)
 * - Authentication checks (optional)
 * - Authorization via custom callbacks (optional)
 *
 * @example
 * ```tsx
 * // In a client component
 * const result = await createUser({ name: 'John', email: 'john@example.com' });
 *
 * if (result.success) {
 *   console.log('Created user:', result.data);
 * } else {
 *   console.log('Error:', result.error.message);
 * }
 * ```
 */

import { validated, validatedMutation, validatedQuery } from '@veloxts/web/server';
import { z } from 'zod';

import { db } from '@/api/database';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for creating a new user
 */
const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
});

/**
 * Schema for updating a user
 */
const UpdateUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

/**
 * Schema for deleting a user
 */
const DeleteUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

/**
 * Schema for searching users
 */
const SearchUsersSchema = z.object({
  query: z.string().max(100).optional(),
  limit: z.number().min(1).max(100).default(10),
});

// ============================================================================
// Public Actions (no authentication required)
// ============================================================================

/**
 * Search users - public query action
 *
 * Uses validatedQuery() which allows unauthenticated access by default.
 * Includes input sanitization and validation.
 */
export const searchUsers = validatedQuery(SearchUsersSchema, async (input) => {
  const users = await db.user.findMany({
    where: input.query
      ? {
          OR: [{ name: { contains: input.query } }, { email: { contains: input.query } }],
        }
      : undefined,
    take: input.limit,
    orderBy: { createdAt: 'desc' },
  });

  return users;
});

// ============================================================================
// Mutations (with security options)
// ============================================================================

/**
 * Creates a new user.
 *
 * Uses validated() with explicit options:
 * - Rate limiting: max 10 requests per minute
 * - Input size limit: 10KB (prevent large payload DoS)
 * - Input sanitization: enabled by default
 */
export const createUser = validated(
  CreateUserSchema,
  async (input) => {
    const user = await db.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
      },
    });

    return user;
  },
  {
    // Rate limit: 10 requests per minute per IP
    rateLimit: {
      maxRequests: 10,
      windowMs: 60_000,
    },
    // Limit input size to 10KB
    maxInputSize: 10 * 1024,
  }
);

/**
 * Updates a user.
 *
 * Uses validatedMutation() which requires authentication by default.
 * When requireAuth is true, ctx.user is available and typed.
 *
 * Note: In a real app, add authorization to verify the user owns this record.
 */
export const updateUser = validatedMutation(UpdateUserSchema, async (input, ctx) => {
  // ctx.user is available because validatedMutation requires auth
  console.log('User updating record:', ctx.user.id);

  const user = await db.user.update({
    where: { id: input.id },
    data: {
      ...(input.name && { name: input.name.trim() }),
      ...(input.email && { email: input.email.toLowerCase().trim() }),
    },
  });

  return user;
});

/**
 * Deletes a user by ID.
 *
 * Uses validated() with role-based authorization.
 * Only admins can delete users.
 */
export const deleteUser = validated(
  DeleteUserSchema,
  async (input) => {
    await db.user.delete({
      where: { id: input.id },
    });

    return { deleted: true };
  },
  {
    // Require authentication
    requireAuth: true,
    // Role-based authorization (requires 'admin' role)
    requireRoles: ['admin'],
  }
);
