/**
 * Auth Template
 *
 * Full authentication template with JWT auth, guards, rate limiting,
 * token rotation, and secure password hashing.
 */

import { generateSharedFiles, VELOXTS_VERSION } from './shared.js';
import type { TemplateConfig, TemplateFile } from './types.js';

// ============================================================================
// Package.json
// ============================================================================

function generatePackageJson(config: TemplateConfig): string {
  return JSON.stringify(
    {
      name: config.projectName,
      version: '0.0.1',
      description: 'A VeloxTS application with full authentication',
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsup',
        start: 'node dist/index.js',
        dev: 'tsx watch src/index.ts',
        'type-check': 'tsc --noEmit',
        clean: 'rm -rf dist tsconfig.tsbuildinfo',
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
        postinstall: 'prisma generate',
      },
      dependencies: {
        '@fastify/static': '^8.3.0',
        '@prisma/adapter-better-sqlite3': '^7.1.0',
        '@prisma/client': '^7.1.0',
        '@veloxts/velox': `^${VELOXTS_VERSION}`,
        bcrypt: '^5.1.1',
        'better-sqlite3': '^12.5.0',
        dotenv: '^17.2.3',
        zod: '^3.24.4',
      },
      devDependencies: {
        '@types/bcrypt': '^5.0.2',
        prisma: '^7.1.0',
        tsup: '^8.5.1',
        tsx: '^4.21.0',
        typescript: '^5.9.3',
      },
    },
    null,
    2
  );
}

// ============================================================================
// Environment Files
// ============================================================================

function generateEnvExample(): string {
  return `# Database URL
# SQLite (local development):
DATABASE_URL="file:./dev.db"
# PostgreSQL (production):
# DATABASE_URL="postgresql://user:password@localhost:5432/myapp"

# Server Configuration
PORT=3210
HOST=0.0.0.0
NODE_ENV=development

# API Configuration
API_PREFIX=/api

# ============================================================================
# Authentication (REQUIRED for production)
# ============================================================================
# Generate secrets with: openssl rand -base64 64
#
# JWT_SECRET=<your-access-token-secret>
# JWT_REFRESH_SECRET=<your-refresh-token-secret>
#
# NOTE: In development mode, temporary secrets will be generated with a warning.
# Always set these in production!
`;
}

// ============================================================================
// Prisma Schema (with password field)
// ============================================================================

function generatePrismaSchema(): string {
  return `// Prisma Schema
//
// This schema defines the database structure with authentication support.
// Using SQLite for simplicity - easily swap to PostgreSQL for production.

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// ============================================================================
// User Model
// ============================================================================

/// User model with authentication support
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String?  // Hashed password (optional for social auth)
  roles     String   @default("[\\"user\\"]") // JSON array of roles
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
`;
}

// ============================================================================
// Auth Config
// ============================================================================

function generateAuthConfig(): string {
  return `/**
 * Authentication Configuration
 *
 * JWT-based authentication configuration.
 *
 * SECURITY: JWT secrets are required from environment variables.
 * The app will fail to start in production without them.
 */

import type { AuthPluginOptions } from '@veloxts/velox';

import { prisma } from '../database/index.js';

// ============================================================================
// Environment Variable Validation
// ============================================================================

/**
 * Gets required JWT secrets from environment variables.
 * Throws a clear error in production if secrets are not configured.
 */
function getRequiredSecrets(): { jwtSecret: string; refreshSecret: string } {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!jwtSecret || !refreshSecret) {
    if (isDevelopment) {
      console.warn(
        '\\n' +
          '='.repeat(70) +
          '\\n' +
          '  WARNING: JWT secrets not configured!\\n' +
          '  Using temporary development secrets. DO NOT USE IN PRODUCTION!\\n' +
          '\\n' +
          '  To configure secrets, add to .env:\\n' +
          '    JWT_SECRET=<generate with: openssl rand -base64 64>\\n' +
          '    JWT_REFRESH_SECRET=<generate with: openssl rand -base64 64>\\n' +
          '='.repeat(70) +
          '\\n'
      );
      return {
        jwtSecret:
          jwtSecret || \`dev-only-jwt-secret-\${Math.random().toString(36).substring(2).repeat(4)}\`,
        refreshSecret:
          refreshSecret ||
          \`dev-only-refresh-secret-\${Math.random().toString(36).substring(2).repeat(4)}\`,
      };
    }

    throw new Error(
      '\\n' +
        'CRITICAL: JWT secrets are required but not configured.\\n' +
        '\\n' +
        'Required environment variables:\\n' +
        '  - JWT_SECRET: Secret for signing access tokens (64+ characters)\\n' +
        '  - JWT_REFRESH_SECRET: Secret for signing refresh tokens (64+ characters)\\n' +
        '\\n' +
        'Generate secure secrets with:\\n' +
        '  openssl rand -base64 64\\n' +
        '\\n' +
        'Add them to your environment or .env file before starting the server.\\n'
    );
  }

  return { jwtSecret, refreshSecret };
}

// ============================================================================
// Token Revocation Store
// ============================================================================

/**
 * In-memory token revocation store.
 *
 * PRODUCTION NOTE: Replace with Redis or database-backed store for:
 * - Persistence across server restarts
 * - Horizontal scaling (multiple server instances)
 */
class InMemoryTokenStore {
  private revokedTokens: Map<string, number> = new Map();
  private usedRefreshTokens: Map<string, string> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  revoke(jti: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): void {
    this.revokedTokens.set(jti, Date.now() + expiresInMs);
  }

  isRevoked(jti: string): boolean {
    const expiry = this.revokedTokens.get(jti);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.revokedTokens.delete(jti);
      return false;
    }
    return true;
  }

  markRefreshTokenUsed(jti: string, userId: string): void {
    this.usedRefreshTokens.set(jti, userId);
    setTimeout(() => this.usedRefreshTokens.delete(jti), 7 * 24 * 60 * 60 * 1000);
  }

  isRefreshTokenUsed(jti: string): string | undefined {
    return this.usedRefreshTokens.get(jti);
  }

  revokeAllUserTokens(userId: string): void {
    console.warn(
      \`[Security] Token reuse detected for user \${userId}. \` +
        'All tokens should be revoked. Implement proper user->token mapping for production.'
    );
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiry] of this.revokedTokens.entries()) {
      if (now > expiry) {
        this.revokedTokens.delete(jti);
      }
    }
  }
}

export const tokenStore = new InMemoryTokenStore();

// ============================================================================
// Role Parsing
// ============================================================================

const ALLOWED_ROLES = ['user', 'admin', 'moderator', 'editor'] as const;

export function parseUserRoles(rolesJson: string | null): string[] {
  if (!rolesJson) return ['user'];

  try {
    const parsed: unknown = JSON.parse(rolesJson);

    if (!Array.isArray(parsed)) {
      return ['user'];
    }

    const validRoles = parsed
      .filter((role): role is string => typeof role === 'string')
      .filter((role) => ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]));

    return validRoles.length > 0 ? validRoles : ['user'];
  } catch {
    return ['user'];
  }
}

// ============================================================================
// User Loader
// ============================================================================

async function userLoader(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: parseUserRoles(user.roles),
  };
}

// ============================================================================
// Auth Configuration
// ============================================================================

export function createAuthConfig(): AuthPluginOptions {
  const { jwtSecret, refreshSecret } = getRequiredSecrets();

  return {
    jwt: {
      secret: jwtSecret,
      refreshSecret: refreshSecret,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'velox-app',
      audience: 'velox-app-client',
    },
    userLoader,
    isTokenRevoked: async (jti: string) => tokenStore.isRevoked(jti),
    rateLimit: {
      max: 100,
      windowMs: 60000,
    },
  };
}

export const authConfig = createAuthConfig();
`;
}

function generateConfigIndexWithAuth(): string {
  return `/**
 * Configuration Exports
 */

export * from './app.js';
export * from './auth.js';
`;
}

// ============================================================================
// Auth Procedures
// ============================================================================

function generateAuthProcedures(): string {
  return `/**
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
  hashPassword,
  jwtManager,
  verifyPassword,
  defineProcedures,
  procedure,
  z,
} from '@veloxts/velox';

import { authConfig, parseUserRoles, tokenStore } from '../config/index.js';
import { prisma } from '../database/index.js';

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
// Password Blacklist
// ============================================================================

const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789',
  'qwerty123', 'letmein', 'welcome', 'admin123',
]);

// ============================================================================
// Schemas
// ============================================================================

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

const EmailSchema = z
  .string()
  .email('Invalid email address')
  .transform((email) => email.toLowerCase().trim());

const RegisterInput = z.object({
  name: z.string().min(2).max(100).trim(),
  email: EmailSchema,
  password: PasswordSchema,
});

const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1),
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
// JWT Manager
// ============================================================================

const jwt = jwtManager(authConfig.jwt);

// Dummy hash for timing attack prevention
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.uy7dPSSXB5G6Uy';

// ============================================================================
// Auth Procedures
// ============================================================================

export const authProcedures = defineProcedures('auth', {
  register: procedure()
    .rest({ method: 'POST', path: '/auth/register' })
    .use(rateLimiter.register())
    .input(RegisterInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      const existing = await prisma.user.findUnique({
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

      const user = await prisma.user.create({
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

  login: procedure()
    .rest({ method: 'POST', path: '/auth/login' })
    .use(
      rateLimiter.login((ctx) => {
        const input = ctx.input as { email?: string } | undefined;
        return input?.email?.toLowerCase() ?? '';
      })
    )
    .input(LoginInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      const user = await prisma.user.findUnique({
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

  refresh: procedure()
    .rest({ method: 'POST', path: '/auth/refresh' })
    .use(rateLimiter.refresh())
    .input(RefreshInput)
    .output(TokenResponse)
    .mutation(async ({ input }) => {
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

        const user = await prisma.user.findUnique({
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

  logout: procedure()
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
`;
}

// ============================================================================
// User Procedures (with guards)
// ============================================================================

function generateUserProceduresWithAuth(): string {
  return `/**
 * User Procedures
 *
 * CRUD procedures for user management with authentication guards.
 */

import {
  AuthError,
  authenticated,
  hasRole,
  defineProcedures,
  GuardError,
  procedure,
  paginationInputSchema,
  z,
} from '@veloxts/velox';

import {
  CreateUserInput,
  UpdateUserInput,
  type User,
  UserSchema,
} from '../schemas/user.js';

// ============================================================================
// Database Types
// ============================================================================

interface DbUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DbClient {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<DbUser | null>;
    findMany: (args?: { skip?: number; take?: number }) => Promise<DbUser[]>;
    create: (args: { data: { name: string; email: string } }) => Promise<DbUser>;
    update: (args: { where: { id: string }; data: { name?: string; email?: string } }) => Promise<DbUser>;
    delete: (args: { where: { id: string } }) => Promise<DbUser>;
    count: () => Promise<number>;
  };
}

function getDb(ctx: { db: unknown }): DbClient {
  return ctx.db as DbClient;
}

function toUserResponse(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    createdAt: dbUser.createdAt instanceof Date ? dbUser.createdAt.toISOString() : dbUser.createdAt,
    updatedAt: dbUser.updatedAt instanceof Date ? dbUser.updatedAt.toISOString() : dbUser.updatedAt,
  };
}

// ============================================================================
// User Procedures
// ============================================================================

export const userProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserSchema.nullable())
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.findUnique({ where: { id: input.id } });
      return user ? toUserResponse(user) : null;
    }),

  listUsers: procedure()
    .input(paginationInputSchema.optional())
    .output(
      z.object({
        data: z.array(UserSchema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [dbUsers, total] = await Promise.all([
        db.user.findMany({ skip, take: limit }),
        db.user.count(),
      ]);

      return {
        data: dbUsers.map(toUserResponse),
        meta: { page, limit, total },
      };
    }),

  createUser: procedure()
    .guard(authenticated)
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const user = await db.user.create({ data: input });
      return toUserResponse(user);
    }),

  updateUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  patchUser: procedure()
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }).merge(UpdateUserInput))
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      const { id, ...data } = input;

      if (!ctx.user) {
        throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      const isOwner = ctx.user.id === id;
      const isAdmin = Array.isArray(ctx.user.roles) && ctx.user.roles.includes('admin');

      if (!isOwner && !isAdmin) {
        throw new GuardError('ownership', 'You can only update your own profile', 403);
      }

      const updated = await db.user.update({ where: { id }, data });
      return toUserResponse(updated);
    }),

  deleteUser: procedure()
    .guard(hasRole('admin'))
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb(ctx);
      await db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
`;
}

// ============================================================================
// Entry Point (with auth plugin)
// ============================================================================

function generateIndexTs(): string {
  return `/**
 * Application Entry Point
 */

import 'dotenv/config';

import path from 'node:path';

import fastifyStatic from '@fastify/static';
import {
  veloxApp,
  VELOX_VERSION,
  databasePlugin,
  authPlugin,
  rest,
  getRouteSummary,
} from '@veloxts/velox';

import { authConfig, config } from './config/index.js';
import { prisma } from './database/index.js';
import { authProcedures, healthProcedures, userProcedures } from './procedures/index.js';

// ============================================================================
// Application Bootstrap
// ============================================================================

async function createApp() {
  const app = await veloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  await app.register(databasePlugin({ client: prisma }));

  // Register auth plugin
  await app.register(authPlugin(authConfig));
  console.log('[Auth] JWT authentication enabled');

  // Register static file serving
  await app.server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Register REST API routes
  const collections = [authProcedures, userProcedures, healthProcedures];
  app.routes(rest(collections, { prefix: config.apiPrefix }));

  return { app, collections };
}

function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(\`\\n\${divider}\`);
  console.log(\`  VeloxTS Application v\${VELOX_VERSION}\`);
  console.log(\`  Environment: \${config.env}\`);
  console.log(divider);

  const routes = getRouteSummary(collections);
  console.log('\\n📍 Registered Routes:\\n');

  for (const route of routes) {
    const method = route.method.padEnd(6);
    const path = route.path.padEnd(25);
    console.log(\`   \${method} \${path} → \${route.namespace}.\${route.procedure}\`);
  }

  console.log(\`\\n\${divider}\`);
  console.log(\`  Frontend: http://localhost:\${config.port}\`);
  console.log(\`  REST API: http://localhost:\${config.port}\${config.apiPrefix}\`);
  console.log(\`\${divider}\\n\`);

  console.log('📝 Example requests:\\n');
  console.log('   # Register');
  console.log(\`   curl -X POST http://localhost:\${config.port}\${config.apiPrefix}/auth/register \\\\\`);
  console.log('        -H "Content-Type: application/json" \\\\');
  console.log('        -d \\'{"name":"John Doe","email":"john@example.com","password":"SecurePass123"}\\'');
  console.log('');
  console.log('   # Login');
  console.log(\`   curl -X POST http://localhost:\${config.port}\${config.apiPrefix}/auth/login \\\\\`);
  console.log('        -H "Content-Type: application/json" \\\\');
  console.log('        -d \\'{"email":"john@example.com","password":"SecurePass123"}\\'');
  console.log('');
  console.log('   # Protected endpoint');
  console.log(\`   curl http://localhost:\${config.port}\${config.apiPrefix}/auth/me \\\\\`);
  console.log('        -H "Authorization: Bearer <your-access-token>"');
  console.log('');
}

async function main() {
  try {
    const { app, collections } = await createApp();
    await app.start();
    printBanner(collections);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
`;
}

function generateDatabaseIndex(): string {
  return `/**
 * Database Client (Prisma 7.x)
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
`;
}

function generateProceduresIndex(): string {
  return `/**
 * Procedure Exports
 */

export * from './auth.js';
export * from './health.js';
export * from './users.js';
`;
}

function generateSchemasIndex(): string {
  return `/**
 * Schema Exports
 */

export * from './user.js';
`;
}

function generateUserSchema(): string {
  return `/**
 * User Schemas
 */

import { createIdSchema, emailSchema, z } from '@veloxts/velox';

export const UserSchema = z.object({
  id: createIdSchema('uuid'),
  name: z.string().min(1).max(100),
  email: emailSchema,
  createdAt: z.coerce.date().transform((d) => d.toISOString()),
  updatedAt: z.coerce.date().transform((d) => d.toISOString()),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
});

export type CreateUserData = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserInput>;
`;
}

// ============================================================================
// CLAUDE.md for Auth
// ============================================================================

function generateClaudeMd(config: TemplateConfig): string {
  return `# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants when working with this VeloxTS project.

## Project Overview

**${config.projectName}** is a VeloxTS application with full JWT authentication.

**Features:**
- JWT authentication with access/refresh tokens
- Rate limiting on auth endpoints
- Token rotation with reuse detection
- Role-based authorization guards
- Strong password requirements

## Commands

\`\`\`bash
${config.packageManager} dev          # Start development server
${config.packageManager} build        # Build for production
${config.packageManager} db:push      # Push database schema
${config.packageManager} db:studio    # Open Prisma Studio
\`\`\`

## Authentication

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/auth/register\` | POST | Create new account |
| \`/auth/login\` | POST | Login and get tokens |
| \`/auth/refresh\` | POST | Refresh access token |
| \`/auth/logout\` | POST | Revoke current token |
| \`/auth/me\` | GET | Get current user (protected) |

### Usage

1. **Register/Login** to get tokens
2. **Include token** in Authorization header: \`Bearer <accessToken>\`
3. **Refresh token** when access token expires

### Security Features

- **Rate Limiting**: Login 5/15min, Register 3/hour
- **Token Rotation**: Refresh tokens are single-use
- **Reuse Detection**: Token reuse triggers security alert
- **Password Policy**: 12+ chars, uppercase, lowercase, number

## Guards

\`\`\`typescript
// Require authentication
procedure().guard(authenticated)

// Require specific role
procedure().guard(hasRole('admin'))

// Custom owner-or-admin check
if (!isOwner && !isAdmin) {
  throw new GuardError('ownership', 'Access denied', 403);
}
\`\`\`

## Environment Variables

\`\`\`bash
# Required for production
JWT_SECRET=<64+ chars>
JWT_REFRESH_SECRET=<64+ chars>

# Generate with: openssl rand -base64 64
\`\`\`

## Project Structure

\`\`\`
src/
├── config/
│   ├── app.ts         # App configuration
│   └── auth.ts        # Auth configuration + token store
├── procedures/
│   ├── auth.ts        # Auth endpoints
│   ├── users.ts       # User CRUD with guards
│   └── health.ts      # Health check
├── schemas/
│   └── user.ts        # Zod schemas
└── index.ts           # Entry point
\`\`\`
`;
}

// ============================================================================
// Auth Template Generator
// ============================================================================

export function generateAuthTemplate(config: TemplateConfig): TemplateFile[] {
  const files: TemplateFile[] = [
    // Root files
    { path: 'package.json', content: generatePackageJson(config) },
    { path: '.env.example', content: generateEnvExample() },
    { path: '.env', content: generateEnvExample() },
    { path: 'CLAUDE.md', content: generateClaudeMd(config) },

    // Prisma
    { path: 'prisma/schema.prisma', content: generatePrismaSchema() },

    // Source files
    { path: 'src/index.ts', content: generateIndexTs() },
    { path: 'src/config/index.ts', content: generateConfigIndexWithAuth() },
    { path: 'src/config/auth.ts', content: generateAuthConfig() },
    { path: 'src/database/index.ts', content: generateDatabaseIndex() },
    { path: 'src/procedures/index.ts', content: generateProceduresIndex() },
    { path: 'src/procedures/auth.ts', content: generateAuthProcedures() },
    { path: 'src/procedures/users.ts', content: generateUserProceduresWithAuth() },
    { path: 'src/schemas/index.ts', content: generateSchemasIndex() },
    { path: 'src/schemas/user.ts', content: generateUserSchema() },
  ];

  // Add shared files, but filter out config/index.ts since auth template has its own
  const sharedFiles = generateSharedFiles(config).filter(
    (file) => file.path !== 'src/config/index.ts'
  );

  return [...files, ...sharedFiles];
}
