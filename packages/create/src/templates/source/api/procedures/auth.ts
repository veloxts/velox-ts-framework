/**
 * Auth Procedures
 *
 * Authentication procedures for user registration, login, and token management.
 *
 * REST Endpoints:
 * - POST /auth/register - Create new account
 * - POST /auth/login    - Authenticate and get tokens
 * - POST /auth/refresh  - Refresh access token
 * - POST /auth/logout   - Revoke current token
 * - GET  /auth/me       - Get current user (protected)
 */

import {
  AuthError,
  authenticated,
  createAuthRateLimiter,
  defineProcedures,
  hashPassword,
  jwtManager,
  procedure,
  verifyPassword,
} from '@veloxts/velox';

import {
  LoginInput,
  LogoutResponse,
  RefreshInput,
  RegisterInput,
  TokenResponse,
  UserResponse,
} from '../schemas/auth.js';
import { getJwtSecrets, parseUserRoles, tokenStore } from '../utils/auth.js';

// ============================================================================
// Rate Limiter
// ============================================================================

const rateLimiter = createAuthRateLimiter({
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    lockoutDurationMs: 15 * 60 * 1000,
    progressiveBackoff: true,
  },
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
    lockoutDurationMs: 60 * 60 * 1000,
  },
  refresh: {
    maxAttempts: 10,
    windowMs: 60 * 1000,
    lockoutDurationMs: 60 * 1000,
  },
});

// ============================================================================
// Password Blacklist (runtime-only, not in type chain)
// ============================================================================

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'letmein',
  'welcome',
  'admin123',
]);

// Enhanced password validation with common password check
const EnhancedRegisterInput = RegisterInput.extend({
  password: RegisterInput.shape.password
    .refine((pwd) => /[a-z]/.test(pwd), 'Password must contain at least one lowercase letter')
    .refine((pwd) => /[A-Z]/.test(pwd), 'Password must contain at least one uppercase letter')
    .refine((pwd) => /[0-9]/.test(pwd), 'Password must contain at least one number')
    .refine(
      (pwd) => !COMMON_PASSWORDS.has(pwd.toLowerCase()),
      'Password is too common. Please choose a stronger password.'
    ),
});

// ============================================================================
// JWT Manager
// ============================================================================

const { jwtSecret, refreshSecret } = getJwtSecrets();

const jwt = jwtManager({
  secret: jwtSecret,
  refreshSecret: refreshSecret,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'velox-app',
  audience: 'velox-app-client',
});

// Dummy hash for timing attack prevention
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uy7dPSSXB5G6Uy';

// ============================================================================
// Auth Procedures
// ============================================================================

export const authProcedures = defineProcedures('auth', {
  createAccount: procedure()
    .rest({ method: 'POST', path: '/auth/register' })
    .use(rateLimiter.register())
    .input(EnhancedRegisterInput)
    .output(TokenResponse)
    .mutation(async ({ input, ctx }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      const existing = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        throw new AuthError(
          'Registration failed. If this email is not already registered, please try again.',
          400,
          'REGISTRATION_FAILED'
        );
      }

      const hashedPassword = await hashPassword(input.password);

      const user = await ctx.db.user.create({
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          roles: JSON.stringify(['user']),
        },
      });

      return jwt.createTokenPair({
        id: user.id,
        email: user.email,
        roles: ['user'],
      });
    }),

  createSession: procedure()
    .rest({ method: 'POST', path: '/auth/login' })
    .use(
      rateLimiter.login((ctx) => {
        const input = ctx.input as { email?: string } | undefined;
        return input?.email?.toLowerCase() ?? '';
      })
    )
    .input(LoginInput)
    .output(TokenResponse)
    .mutation(async ({ input, ctx }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      const user = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
      });

      const hashToVerify = user?.password || DUMMY_HASH;
      const isValid = await verifyPassword(input.password, hashToVerify);

      if (!user || !user.password || !isValid) {
        throw new AuthError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const roles = parseUserRoles(user.roles);

      return jwt.createTokenPair({
        id: user.id,
        email: user.email,
        roles,
      });
    }),

  createRefresh: procedure()
    .rest({ method: 'POST', path: '/auth/refresh' })
    .use(rateLimiter.refresh())
    .input(RefreshInput)
    .output(TokenResponse)
    .mutation(async ({ input, ctx }) => {
      try {
        const payload = jwt.verifyToken(input.refreshToken);

        if (payload.type !== 'refresh') {
          throw new AuthError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
        }

        if (payload.jti && tokenStore.isRevoked(payload.jti)) {
          throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
        }

        if (payload.jti) {
          const previousUserId = tokenStore.isRefreshTokenUsed(payload.jti);
          if (previousUserId) {
            tokenStore.revokeAllUserTokens(previousUserId);
            throw new AuthError(
              'Security alert: Refresh token reuse detected.',
              401,
              'TOKEN_REUSE_DETECTED'
            );
          }
          tokenStore.markRefreshTokenUsed(payload.jti, payload.sub);
        }

        const user = await ctx.db.user.findUnique({
          where: { id: payload.sub },
        });

        if (!user) {
          throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
        }

        return jwt.createTokenPair({
          id: user.id,
          email: user.email,
          roles: parseUserRoles(user.roles),
        });
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
    }),

  deleteSession: procedure()
    .rest({ method: 'POST', path: '/auth/logout' })
    .guard(authenticated)
    .output(LogoutResponse)
    .mutation(async ({ ctx }) => {
      const tokenId = ctx.auth?.token?.jti;

      if (tokenId) {
        tokenStore.revoke(tokenId, 15 * 60 * 1000);
      }

      return {
        success: true,
        message: 'Successfully logged out',
      };
    }),

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
        roles: Array.isArray(user.roles) ? user.roles : ['user'],
      };
    }),
});
