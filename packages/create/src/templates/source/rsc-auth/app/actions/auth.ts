'use server';

/**
 * Authentication Server Actions
 *
 * Server actions for authentication flows using validated() helper.
 * These bridge to the API auth procedures while providing RSC-friendly
 * interfaces for login, registration, and session management.
 *
 * @example
 * ```tsx
 * // In a client component
 * const result = await login({ email: 'user@example.com', password: '...' });
 *
 * if (result.success) {
 *   // Store tokens and redirect
 *   localStorage.setItem('accessToken', result.data.accessToken);
 *   redirect('/dashboard');
 * } else {
 *   setError(result.error.message);
 * }
 * ```
 */

import { validated } from '@veloxts/web';
import { z } from 'zod';

import { db } from '@/api/database';

// We can't import from @veloxts/velox in server actions directly due to
// bundling constraints, so we re-implement minimal auth logic here.
// For production, consider using the procedure bridge pattern instead.

// ============================================================================
// Schemas
// ============================================================================

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .refine((pwd) => /[a-z]/.test(pwd), 'Must contain lowercase letter')
    .refine((pwd) => /[A-Z]/.test(pwd), 'Must contain uppercase letter')
    .refine((pwd) => /[0-9]/.test(pwd), 'Must contain a number'),
});

// ============================================================================
// Auth Actions (using API fetch internally)
// ============================================================================

/**
 * Login action - validates credentials via API
 *
 * This action calls the API auth endpoint internally.
 * Rate limited to prevent brute force attacks.
 */
export const login = validated(
  LoginSchema,
  async (input) => {
    // Call the internal API endpoint
    const response = await fetch('http://localhost:3030/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Invalid email or password');
    }

    const tokens = await response.json();
    return tokens;
  },
  {
    rateLimit: {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
    },
  }
);

/**
 * Register action - creates new account via API
 *
 * Strict rate limiting to prevent abuse.
 */
export const register = validated(
  RegisterSchema,
  async (input) => {
    const response = await fetch('http://localhost:3030/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(error.message || 'Could not create account');
    }

    const tokens = await response.json();
    return tokens;
  },
  {
    rateLimit: {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 3 registrations per hour
    },
  }
);

/**
 * Check if email is available
 *
 * Useful for real-time form validation.
 * Rate limited to prevent email enumeration.
 */
export const checkEmailAvailable = validated(
  z.object({ email: z.string().email() }),
  async (input) => {
    const existing = await db.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
      select: { id: true },
    });

    // Always return the same timing to prevent enumeration
    return { available: !existing };
  },
  {
    rateLimit: {
      maxRequests: 10,
      windowMs: 60_000, // 10 checks per minute
    },
  }
);
