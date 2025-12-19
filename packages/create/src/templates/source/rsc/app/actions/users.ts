'use server';

/**
 * User Server Actions
 *
 * Type-safe server actions for user operations using the VeloxTS action() helper.
 * These can be called directly from client components with full type inference.
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

import { action } from '@veloxts/web';
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
 * Schema for deleting a user
 */
const DeleteUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Creates a new user.
 *
 * Input is automatically validated against CreateUserSchema.
 * Returns a discriminated union for type-safe error handling.
 */
export const createUser = action(CreateUserSchema, async (input) => {
  // Input is fully typed as { name: string; email: string }
  // Validation has already been performed by the action() helper

  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
    },
  });

  return user;
});

/**
 * Deletes a user by ID.
 *
 * Input is automatically validated to ensure a valid ID is provided.
 */
export const deleteUser = action(DeleteUserSchema, async (input) => {
  // Input is fully typed as { id: string }

  await db.user.delete({
    where: { id: input.id },
  });

  return { deleted: true };
});
