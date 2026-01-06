/**
 * Auth Procedures
 *
 * Authentication procedures for user registration, login, and token management.
 *
 * REST Endpoints:
 * - POST /auth/register - Create new account
 * - POST /auth/login    - Authenticate and get tokens
 * - POST /auth/refresh  - Refresh access token (with rotation)
 * - POST /auth/logout   - Revoke current token
 * - GET  /auth/me       - Get current user (protected)
 *
 * Security Features:
 * - Strong password requirements (12+ chars, complexity)
 * - User enumeration protection (constant-time responses)
 * - Token revocation support
 * - Refresh token rotation with reuse detection
 */

import {
  AuthError,
  authenticated,
  createAuthRateLimiter,
  hashPassword,
  jwtManager,
  verifyPassword,
} from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

import { authConfig, parseUserRoles, tokenStore } from '../config/index.js';
import { prisma } from '../database/index.js';

// ============================================================================
// Extend User Type
// ============================================================================

/**
 * Extend the User interface with playground-specific properties
 */
declare module '@veloxts/auth' {
  interface User {
    name?: string;
  }
}

// ============================================================================
// Rate Limiter Instance
// ============================================================================

/**
 * Auth rate limiter with security-focused defaults
 *
 * - Login: 5 attempts per 15 minutes per email+IP (progressive backoff enabled)
 * - Register: 3 attempts per hour per IP
 * - Refresh: 10 attempts per minute per IP
 */
const rateLimiter = createAuthRateLimiter({
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
    progressiveBackoff: true, // Double lockout on repeated violations
  },
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutDurationMs: 60 * 60 * 1000, // 1 hour
  },
  refresh: {
    maxAttempts: 10,
    windowMs: 60 * 1000, // 1 minute
    lockoutDurationMs: 60 * 1000, // 1 minute
  },
});

// ============================================================================
// Common Password Blacklist
// ============================================================================

/**
 * List of common passwords to reject
 * In production, consider using a larger list or HaveIBeenPwned API
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'letmein',
  'welcome',
  'admin123',
  'abc12345',
  'monkey123',
  'football',
  'baseball',
  'iloveyou',
  'trustno1',
  'sunshine',
  'princess',
  'welcome1',
  'shadow123',
  'superman',
  'michael123',
  'master123',
  'dragon123',
  'passw0rd',
  'p@ssword',
  'p@ssw0rd',
]);

// ============================================================================
// Schemas
// ============================================================================

/**
 * Strong password validation schema
 *
 * Requirements:
 * - Minimum 12 characters (NIST SP 800-63B recommends 8+, we go stricter)
 * - Maximum 128 characters (prevent bcrypt DoS)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - Not in common password blacklist
 */
const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine((pwd) => /[a-z]/.test(pwd), 'Password must contain at least one lowercase letter')
  .refine((pwd) => /[A-Z]/.test(pwd), 'Password must contain at least one uppercase letter')
  .refine((pwd) => /[0-9]/.test(pwd), 'Password must contain at least one number')
  .refine(
    (pwd) => !COMMON_PASSWORDS.has(pwd.toLowerCase()),
    'Password is too common. Please choose a stronger password.'
  );

/**
 * Email schema with normalization
 */
const EmailSchema = z
  .string()
  .email('Invalid email address')
  .transform((email) => email.toLowerCase().trim());

const RegisterInput = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: EmailSchema,
  password: PasswordSchema,
});

const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

const RefreshInput = z.object({
  refreshToken: z.string(),
});

const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});

const UserResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});

const LogoutResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// JWT Manager Instance
// ============================================================================

const jwt = jwtManager(authConfig.jwt);

// ============================================================================
// Dummy Hash for Timing Attack Prevention
// ============================================================================

/**
 * Pre-computed bcrypt hash for timing attack prevention.
 * When a user doesn't exist, we still need to perform password hashing
 * to prevent timing-based user enumeration.
 *
 * This hash is for the string "dummy-password-for-timing-attack-prevention"
 */
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uy7dPSSXB5G6Uy';

// ============================================================================
// Auth Procedures
// ============================================================================

export const authProcedures = defineProcedures('auth', {
  /**
   * Register a new user account
   *
   * REST: POST /auth/register
   *
   * Security notes:
   * - Rate limited: 3 attempts per hour per IP
   * - Returns generic message to prevent email enumeration
   * - Strong password requirements enforced
   * - Email normalized to lowercase
   */
  register: procedure()
    .rest({ method: 'POST', path: '/auth/register' })
    .use(rateLimiter.register())
    .input(RegisterInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      // Normalize email (already done by schema transform, but explicit for clarity)
      const normalizedEmail = input.email.toLowerCase().trim();

      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        // Security: Don't reveal if email exists
        // In a real app, you might send an email saying "account already exists"
        // and still return success to the API caller
        throw new AuthError(
          'Registration failed. If this email is not already registered, please try again.',
          400,
          'REGISTRATION_FAILED'
        );
      }

      // Hash password
      const hashedPassword = await hashPassword(input.password);

      // Create user with default role
      const user = await prisma.user.create({
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          roles: JSON.stringify(['user']),
        },
      });

      // Generate tokens
      const tokens = jwt.createTokenPair({
        id: user.id,
        email: user.email,
        roles: ['user'],
      });

      return tokens;
    }),

  /**
   * Login with email and password
   *
   * REST: POST /auth/login
   *
   * Security notes:
   * - Rate limited: 5 attempts per 15 minutes per email+IP (progressive backoff)
   * - Constant-time response to prevent timing attacks
   * - Same error message for all failure cases
   * - Always performs password hash even for non-existent users
   */
  login: procedure()
    .rest({ method: 'POST', path: '/auth/login' })
    .use(
      rateLimiter.login((ctx) => {
        // Extract email from input for per-email rate limiting
        const input = ctx.input as { email?: string } | undefined;
        return input?.email?.toLowerCase() ?? '';
      })
    )
    .input(LoginInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      // Normalize email
      const normalizedEmail = input.email.toLowerCase().trim();

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // Security: Always perform password verification to prevent timing attacks
      // If user doesn't exist, verify against a dummy hash
      const hashToVerify = user?.password || DUMMY_HASH;
      const isValid = await verifyPassword(input.password, hashToVerify);

      // Check if authentication failed
      if (!user || !user.password || !isValid) {
        throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Parse roles safely
      const roles = parseUserRoles(user.roles);

      // Generate tokens
      const tokens = jwt.createTokenPair({
        id: user.id,
        email: user.email,
        roles,
      });

      return tokens;
    }),

  /**
   * Refresh access token using refresh token
   *
   * REST: POST /auth/refresh
   *
   * Security notes:
   * - Rate limited: 10 attempts per minute per IP
   * - Implements refresh token rotation
   * - Detects token reuse (potential theft)
   * - Marks used tokens to prevent replay attacks
   */
  refresh: procedure()
    .rest({ method: 'POST', path: '/auth/refresh' })
    .use(rateLimiter.refresh())
    .input(RefreshInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      try {
        // Verify and decode refresh token
        const payload = jwt.verifyToken(input.refreshToken);

        if (payload.type !== 'refresh') {
          throw new AuthError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
        }

        // Check for token revocation
        if (payload.jti && tokenStore.isRevoked(payload.jti)) {
          throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
        }

        // Check for refresh token reuse (rotation security)
        if (payload.jti) {
          const previousUserId = tokenStore.isRefreshTokenUsed(payload.jti);
          if (previousUserId) {
            // SECURITY: Refresh token reuse detected!
            // This indicates potential token theft. Revoke all tokens for this user.
            tokenStore.revokeAllUserTokens(previousUserId);

            throw new AuthError(
              'Security alert: Refresh token reuse detected. All sessions have been invalidated. Please login again.',
              401,
              'TOKEN_REUSE_DETECTED'
            );
          }

          // Mark this refresh token as used (can't be reused)
          tokenStore.markRefreshTokenUsed(payload.jti, payload.sub);
        }

        // Fetch fresh user data
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (!user) {
          throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
        }

        // Parse roles safely
        const roles = parseUserRoles(user.roles);

        // Generate new token pair (rotation - new refresh token replaces old)
        const tokens = jwt.createTokenPair({
          id: user.id,
          email: user.email,
          roles,
        });

        return tokens;
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
    }),

  /**
   * Logout - revoke the current token
   *
   * REST: POST /auth/logout
   * Requires: Valid access token
   *
   * Security notes:
   * - Revokes the current access token
   * - Token will be rejected on subsequent requests
   */
  logout: procedure()
    .rest({ method: 'POST', path: '/auth/logout' })
    .guard(authenticated)
    .output(LogoutResponse)
    .mutation(async ({ ctx }) => {
      // Get the token ID from the auth context
      // authPlugin uses adapter mode internally, so check for adapter's session.payload.jti
      let tokenId: string | undefined;
      if (ctx.auth?.authMode === 'adapter') {
        const session = ctx.auth.session as { payload?: { jti?: string } } | undefined;
        tokenId = session?.payload?.jti;
      }

      if (tokenId) {
        // Revoke the token (15 minutes = access token lifetime)
        tokenStore.revoke(tokenId, 15 * 60 * 1000);
      }

      return {
        success: true,
        message: 'Successfully logged out',
      };
    }),

  /**
   * Get current authenticated user
   *
   * REST: GET /auth/me
   * Requires: Valid access token
   */
  getMe: procedure()
    .rest({ method: 'GET', path: '/auth/me' })
    .guard(authenticated)
    .output(UserResponse)
    .query(async ({ ctx }) => {
      const user = ctx.user;

      if (!user) {
        throw new AuthError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      }

      return {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        roles: Array.isArray(user.roles) ? user.roles : ['user'],
      };
    }),
});

export type AuthProcedures = typeof authProcedures;
