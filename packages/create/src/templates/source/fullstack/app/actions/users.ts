'use server';

/**
 * User Server Actions
 *
 * Server actions for user-related operations.
 * These can be called directly from client components.
 */

import { db } from '@/api/database';

// Input schemas
const CreateUserInput = {
  name: '' as string,
  email: '' as string,
};

const DeleteUserInput = {
  id: '' as string,
};

/**
 * Create a new user
 * Validates input manually since we're in a server action
 */
export async function createUser(input: typeof CreateUserInput) {
  // Basic validation
  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: 'Name is required' };
  }
  if (!input.email || !input.email.includes('@')) {
    return { success: false, error: 'Valid email is required' };
  }

  try {
    const user = await db.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
      },
    });

    return { success: true, user };
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, error: 'Failed to create user' };
  }
}

/**
 * Delete a user by ID
 */
export async function deleteUser(input: typeof DeleteUserInput) {
  if (!input.id) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    await db.user.delete({
      where: { id: input.id },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}
