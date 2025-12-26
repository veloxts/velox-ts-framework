'use server';

/**
 * User Server Actions with Authentication
 *
 * Type-safe server actions with built-in security using VeloxTS validated() helper.
 * These demonstrate authenticated actions with role-based authorization.
 *
 * Security features included:
 * - Input validation via Zod schemas
 * - Input size limits (DoS protection)
 * - Input sanitization (prototype pollution prevention)
 * - Rate limiting (sliding window)
 * - Authentication checks
 * - Role-based authorization
 *
 * @example
 * ```tsx
 * // In a client component
 * const result = await updateProfile({ name: 'John' });
 *
 * if (result.success) {
 *   console.log('Updated:', result.data);
 * } else {
 *   if (result.error.code === 'AUTHENTICATION_REQUIRED') {
 *     redirect('/auth/login');
 *   }
 *   console.log('Error:', result.error.message);
 * }
 * ```
 */

import { validated, validatedMutation, validatedQuery } from '@veloxts/web';
import { z } from 'zod';

import { db } from '@/api/database';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for updating own profile (authenticated users)
 */
const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  email: z.string().email('Invalid email address').optional(),
});

/**
 * Schema for admin user creation
 */
const AdminCreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  roles: z.array(z.string()).default(['user']),
});

/**
 * Schema for admin user deletion
 */
const AdminDeleteUserSchema = z.object({
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
 * Only returns public user information (no sensitive fields).
 */
export const searchUsers = validatedQuery(
  SearchUsersSchema,
  async (input) => {
    const users = await db.user.findMany({
      where: input.query
        ? {
            OR: [
              { name: { contains: input.query } },
              { email: { contains: input.query } },
            ],
          }
        : undefined,
      take: input.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        // Exclude password, roles, etc.
      },
    });

    return users;
  }
);

// ============================================================================
// Authenticated Actions (require login)
// ============================================================================

/**
 * Get current user's profile
 *
 * Uses validatedMutation() which requires authentication by default.
 * Returns the authenticated user's full profile.
 */
export const getProfile = validatedMutation(
  z.object({}), // No input needed
  async (_input, ctx) => {
    // ctx.user is available because validatedMutation requires auth
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
);

/**
 * Update current user's profile
 *
 * Users can only update their own profile.
 * Includes rate limiting to prevent abuse.
 */
export const updateProfile = validated(
  UpdateProfileSchema,
  async (input, ctx) => {
    const user = await db.user.update({
      where: { id: ctx.user.id },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.email && { email: input.email.toLowerCase().trim() }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        updatedAt: true,
      },
    });

    return user;
  },
  {
    requireAuth: true,
    rateLimit: {
      maxRequests: 10,
      windowMs: 60_000, // 10 updates per minute
    },
  }
);

// ============================================================================
// Admin Actions (require admin role)
// ============================================================================

/**
 * Admin: Create a new user
 *
 * Only administrators can create users directly.
 * Regular users must go through the registration flow.
 */
export const adminCreateUser = validated(
  AdminCreateUserSchema,
  async (input) => {
    const user = await db.user.create({
      data: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        roles: JSON.stringify(input.roles),
        // Note: No password - admin-created users need to set password via reset flow
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        createdAt: true,
      },
    });

    return user;
  },
  {
    requireAuth: true,
    requireRoles: ['admin'],
    rateLimit: {
      maxRequests: 20,
      windowMs: 60_000,
    },
  }
);

/**
 * Admin: Delete a user
 *
 * Only administrators can delete users.
 * Cannot delete own account (safety measure).
 */
export const adminDeleteUser = validated(
  AdminDeleteUserSchema,
  async (input, ctx) => {
    // Prevent self-deletion
    if (input.id === ctx.user.id) {
      throw new Error('Cannot delete your own account');
    }

    await db.user.delete({
      where: { id: input.id },
    });

    return { deleted: true, id: input.id };
  },
  {
    requireAuth: true,
    requireRoles: ['admin'],
    rateLimit: {
      maxRequests: 10,
      windowMs: 60_000,
    },
  }
);

/**
 * Admin: List all users with full details
 *
 * Returns all user data including roles.
 * Only accessible to administrators.
 */
export const adminListUsers = validated(
  z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }),
  async (input) => {
    const skip = (input.page - 1) * input.limit;

    const [users, total] = await Promise.all([
      db.user.findMany({
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.user.count(),
    ]);

    return {
      users,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        pages: Math.ceil(total / input.limit),
      },
    };
  },
  {
    requireAuth: true,
    requireRoles: ['admin'],
  }
);
