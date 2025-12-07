/**
 * Auth Procedures
 *
 * Authentication procedures for user registration, login, and token management.
 *
 * REST Endpoints:
 * - POST /auth/register - Create new account
 * - POST /auth/login    - Authenticate and get tokens
 * - POST /auth/refresh  - Refresh access token
 * - GET  /auth/me       - Get current user (protected)
 */

import {
  authenticated,
  AuthError,
  hashPassword,
  jwtManager,
  verifyPassword,
} from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';
import { z } from 'zod';

import { authConfig } from '../config/index.js';
import { prisma } from '../database/index.js';

// ============================================================================
// Schemas
// ============================================================================

const RegisterInput = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginInput = z.object({
  email: z.string().email('Invalid email address'),
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

// ============================================================================
// JWT Manager Instance
// ============================================================================

const jwt = jwtManager(authConfig.jwt);

// ============================================================================
// Auth Procedures
// ============================================================================

export const authProcedures = defineProcedures('auth', {
  /**
   * Register a new user account
   *
   * REST: POST /auth/register
   */
  register: procedure()
    .rest({ method: 'POST', path: '/auth/register' })
    .input(RegisterInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      // Check if email already exists
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new AuthError('Email already registered', 400, 'EMAIL_EXISTS');
      }

      // Hash password
      const hashedPassword = await hashPassword(input.password);

      // Create user with default role
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
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
   */
  login: procedure()
    .rest({ method: 'POST', path: '/auth/login' })
    .input(LoginInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !user.password) {
        throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isValid = await verifyPassword(input.password, user.password);

      if (!isValid) {
        throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Parse roles
      const roles = user.roles ? JSON.parse(user.roles) : ['user'];

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
   */
  refresh: procedure()
    .rest({ method: 'POST', path: '/auth/refresh' })
    .input(RefreshInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      try {
        // Verify and decode refresh token
        const payload = jwt.verifyToken(input.refreshToken);

        if (payload.type !== 'refresh') {
          throw new AuthError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
        }

        // Fetch fresh user data
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (!user) {
          throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
        }

        const roles = user.roles ? JSON.parse(user.roles) : ['user'];

        // Generate new token pair
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
        name: (user.name as string) || '',
        email: user.email,
        roles: user.roles || ['user'],
      };
    }),
});

export type AuthProcedures = typeof authProcedures;
