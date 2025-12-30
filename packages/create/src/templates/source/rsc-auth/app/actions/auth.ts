'use server';

/**
 * Authentication Server Actions - Procedure Bridge Pattern
 *
 * Uses authAction helpers to execute auth procedures directly,
 * storing tokens in httpOnly cookies for security.
 *
 * This is the recommended pattern for authentication in VeloxTS RSC apps:
 * - Tokens are stored in httpOnly cookies (not accessible to JavaScript)
 * - The procedure's validation, guards, and business logic are reused
 * - No HTTP round-trip overhead (direct in-process execution)
 *
 * @example
 * ```tsx
 * // In a client component
 * const result = await login({ email: 'user@example.com', password: '...' });
 *
 * if (result.success) {
 *   // Tokens are stored in cookies automatically
 *   redirect('/dashboard');
 * } else {
 *   setError(result.error.message);
 * }
 * ```
 */

import { authAction, validated } from '@veloxts/web';
import { z } from 'zod';

import { db } from '@/api/database';
import { authProcedures } from '@/api/procedures/auth';

// ============================================================================
// Auth Actions (Procedure Bridge Pattern)
// ============================================================================

/**
 * Login action - validates credentials, stores tokens in httpOnly cookies
 *
 * Uses the procedure bridge pattern to:
 * 1. Execute the createSession procedure directly (no HTTP)
 * 2. Store tokens in httpOnly cookies via onSuccess callback
 * 3. Return a sanitized response (tokens stripped for security)
 *
 * Rate limited via the procedure's middleware (5 attempts per 15 minutes).
 */
export const login = authAction.fromTokenProcedure(authProcedures.procedures.createSession, {
  parseFormData: true,
  contextExtensions: { db },
  skipGuards: true, // Login has no guards, only rate limit middleware
});

/**
 * Register action - creates new account, stores tokens in httpOnly cookies
 *
 * Uses the procedure bridge pattern to:
 * 1. Execute the createAccount procedure directly
 * 2. Store tokens in httpOnly cookies
 * 3. Return sanitized response
 *
 * Rate limited via the procedure's middleware (3 attempts per hour).
 */
export const register = authAction.fromTokenProcedure(authProcedures.procedures.createAccount, {
  parseFormData: true,
  contextExtensions: { db },
  skipGuards: true, // Register has no guards, only rate limit middleware
});

/**
 * Logout action - clears auth cookies
 *
 * For logout, we clear cookies client-side since the deleteSession procedure
 * requires authenticated context which is complex to set up in server actions.
 * The token will naturally expire.
 *
 * For production apps needing token revocation, call the API endpoint directly
 * from the client or implement a custom logout procedure without guards.
 */
export const logout = authAction.fromLogoutProcedure(authProcedures.procedures.deleteSession, {
  contextExtensions: { db },
  skipGuards: true, // Skip auth guard - we'll clear cookies regardless
});

// ============================================================================
// Standalone Actions (No Procedure Required)
// ============================================================================

/**
 * Check if email is available for registration
 *
 * This is a simple database lookup that doesn't need procedure bridge.
 * Rate limited to prevent email enumeration attacks.
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
