# @veloxts/auth

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Authentication and authorization system for VeloxTS Framework.

## Features

- **Pluggable Auth Adapters** - Integrate external providers like BetterAuth, Clerk, Auth0
- **Session Management** - Cookie-based sessions with pluggable storage backends
- **JWT Authentication** - Stateless token-based authentication with refresh tokens
- **Password Hashing** - Secure bcrypt/argon2 hashing with configurable cost factors
- **Password Policy** - Configurable strength requirements and breach detection
- **CSRF Protection** - Signed double-submit cookie pattern with timing-safe validation
- **Guards and Policies** - Declarative authorization for procedures
- **Rate Limiting** - Auth-specific rate limiting with progressive backoff and lockout detection

## Table of Contents

- [Installation](#installation)
- [Auth Adapters](#auth-adapters)
- [Authentication Strategies](#authentication-strategies)
- [Session Management](#session-management)
- [JWT Authentication](#jwt-authentication)
- [CSRF Protection](#csrf-protection)
- [Guards and Policies](#guards-and-policies)
  - [User Roles and Permissions](#user-roles-and-permissions)
  - [Role-Based Guards](#role-based-guards)
  - [Permission-Based Guards](#permission-based-guards)
  - [Combining Guards](#combining-guards)
  - [Custom Guards](#custom-guards)
  - [Policies](#policies)
- [Password Hashing](#password-hashing)
- [Rate Limiting](#rate-limiting)

## Installation

```bash
npm install @veloxts/auth
```

Required peer dependencies:

```bash
npm install @veloxts/core @veloxts/router fastify @fastify/cookie
```

## Auth Adapters

Auth adapters allow you to integrate external authentication providers like BetterAuth, Clerk, or Auth0 with VeloxTS. Instead of building authentication from scratch, you can leverage battle-tested auth solutions.

### BetterAuth Adapter

[BetterAuth](https://better-auth.com) is a comprehensive, framework-agnostic TypeScript authentication library. The BetterAuth adapter seamlessly integrates it with VeloxTS.

#### Installation

```bash
npm install better-auth @veloxts/auth
```

#### Basic Setup

```typescript
import { veloxApp } from '@veloxts/core';
import { createAuthAdapterPlugin, createBetterAuthAdapter } from '@veloxts/auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create BetterAuth instance
const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or 'mysql', 'sqlite'
  }),
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
});

// Create the adapter
const betterAuthAdapter = createBetterAuthAdapter({
  name: 'better-auth',
  auth,
  debug: process.env.NODE_ENV === 'development',
});

// Create the plugin
const authAdapterPlugin = createAuthAdapterPlugin({
  adapter: betterAuthAdapter,
  config: betterAuthAdapter.config,
});

// Create app and register plugin
const app = await veloxApp();
await app.register(authAdapterPlugin);
```

#### Using Authentication in Procedures

```typescript
import { createAdapterAuthMiddleware } from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';

const authMiddleware = createAdapterAuthMiddleware();

export const userProcedures = defineProcedures('users', {
  // Require authentication - throws 401 if not logged in
  getProfile: procedure
    .use(authMiddleware.requireAuth())
    .query(async ({ ctx }) => {
      // ctx.user is guaranteed to exist
      return {
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
      };
    }),

  // Optional authentication - user may or may not be logged in
  getPublicPosts: procedure
    .use(authMiddleware.optionalAuth())
    .query(async ({ ctx }) => {
      const posts = await db.post.findMany({ where: { published: true } });
      return {
        posts,
        isAuthenticated: ctx.isAuthenticated,
        userId: ctx.user?.id,
      };
    }),
});
```

#### BetterAuth Configuration Options

```typescript
const adapter = createBetterAuthAdapter({
  // Required: Adapter name (for logging)
  name: 'better-auth',

  // Required: BetterAuth instance
  auth: betterAuth({ ... }),

  // Optional: Base path for auth routes (default: '/api/auth')
  basePath: '/api/auth',

  // Optional: Enable debug logging
  debug: true,

  // Optional: Handle all HTTP methods (default: GET, POST only)
  handleAllMethods: true,

  // Optional: Routes to exclude from session loading
  excludeRoutes: ['/api/health', '/api/public/*'],

  // Optional: Custom user transformation
  transformUser: (adapterUser) => ({
    id: adapterUser.id,
    email: adapterUser.email,
    role: adapterUser.providerData?.role as string ?? 'user',
    permissions: adapterUser.providerData?.permissions as string[] ?? [],
  }),
});
```

#### Auth Routes

BetterAuth automatically mounts its routes at the configured base path. Common routes include:

- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in/email` - Email/password login
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/magic-link` - Send magic link (if enabled)
- `GET /api/auth/callback/:provider` - OAuth callbacks

See the [BetterAuth documentation](https://better-auth.com/docs) for all available routes and configuration options.

### Creating Custom Adapters

You can create adapters for other authentication providers by implementing the `AuthAdapter` interface:

```typescript
import {
  AuthAdapter,
  AuthAdapterConfig,
  AdapterSessionResult,
  BaseAuthAdapter,
  defineAuthAdapter,
} from '@veloxts/auth';
import type { FastifyInstance, FastifyRequest } from 'fastify';

// Define your adapter-specific config
interface MyAuthConfig extends AuthAdapterConfig {
  apiKey: string;
  domain: string;
}

// Option 1: Use defineAuthAdapter helper
export const myAuthAdapter = defineAuthAdapter<MyAuthConfig>({
  name: 'my-auth',
  version: '1.0.0',

  async initialize(fastify: FastifyInstance, config: MyAuthConfig) {
    // Initialize your auth client
    this.client = new MyAuthClient({
      apiKey: config.apiKey,
      domain: config.domain,
    });
  },

  async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const session = await this.client.verifySession(token);
    if (!session) return null;

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      session: {
        sessionId: session.id,
        userId: session.user.id,
        expiresAt: session.expiresAt,
        isActive: true,
      },
    };
  },

  getRoutes() {
    return [
      {
        path: '/api/auth/*',
        methods: ['GET', 'POST'],
        handler: async (request, reply) => {
          // Forward to your auth provider
        },
      },
    ];
  },
});

// Option 2: Extend BaseAuthAdapter class
class MyAuthAdapter extends BaseAuthAdapter<MyAuthConfig> {
  private client: MyAuthClient | null = null;

  constructor() {
    super('my-auth', '1.0.0');
  }

  override async initialize(fastify: FastifyInstance, config: MyAuthConfig) {
    await super.initialize(fastify, config);
    this.client = new MyAuthClient(config);
  }

  override async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    // Implementation...
  }

  override getRoutes() {
    return [];
  }
}
```

### Adapter Type Utilities

```typescript
import {
  isAuthAdapter,
  InferAdapterConfig,
  AuthAdapterError,
} from '@veloxts/auth';

// Type guard to check if value is a valid adapter
if (isAuthAdapter(maybeAdapter)) {
  const plugin = createAuthAdapterPlugin({
    adapter: maybeAdapter,
    config: maybeAdapter.config,
  });
}

// Infer config type from adapter
type BetterAuthConfig = InferAdapterConfig<typeof betterAuthAdapter>;

// Handle adapter errors
try {
  const session = await adapter.getSession(request);
} catch (error) {
  if (error instanceof AuthAdapterError) {
    console.error(`Adapter error: ${error.code} - ${error.message}`);
    console.error(`Cause:`, error.cause);
  }
}
```

## Authentication Strategies

VeloxTS Auth provides two primary authentication strategies. Choose the one that fits your architecture:

### Session-Based Authentication

**Use when:**
- Building traditional server-rendered applications
- You need server-side state and fine-grained session control
- Single-server or shared session store architecture (Redis, database)
- You want Laravel-style flash data and session management

**Advantages:**
- Server controls session lifecycle (can revoke sessions immediately)
- No token storage needed on client
- Easy "logout all devices" functionality
- Built-in flash data support

**Trade-offs:**
- Requires session store (Redis, database, etc. for production)
- Slightly more server load (session lookups)
- Requires sticky sessions or shared storage for horizontal scaling

### JWT-Based Authentication

**Use when:**
- Building stateless APIs for mobile apps or SPAs
- Microservices architecture with distributed authentication
- You need cross-domain authentication
- Horizontal scaling without shared state

**Advantages:**
- Stateless (no server-side storage required)
- Works seamlessly across multiple servers
- Can include custom claims and metadata

**Trade-offs:**
- Cannot revoke tokens before expiration (without additional infrastructure)
- Requires secure client-side token storage
- Larger payload size (tokens in every request)

## Session Management

Cookie-based session management with secure defaults and pluggable storage backends.

### Quick Start

```typescript
import { sessionMiddleware, createInMemorySessionStore } from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';

// Create session middleware
const session = sessionMiddleware({
  secret: process.env.SESSION_SECRET!, // Min 32 characters
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  expiration: {
    ttl: 86400, // 24 hours
    sliding: true, // Refresh on each request
  },
});

// Use in procedures
export const userProcedures = defineProcedures('users', {
  // Get shopping cart from session
  getCart: procedure
    .use(session.middleware())
    .query(async ({ ctx }) => {
      return ctx.session.get('cart') ?? [];
    }),

  // Add item to cart
  addToCart: procedure
    .use(session.middleware())
    .input(AddToCartSchema)
    .mutation(async ({ input, ctx }) => {
      const cart = ctx.session.get('cart') ?? [];
      cart.push(input.item);
      ctx.session.set('cart', cart);
      return { success: true };
    }),
});
```

### Configuration Options

```typescript
import { createSessionManager, createInMemorySessionStore } from '@veloxts/auth';

const sessionManager = createSessionManager({
  // Required: Cryptographically secure secret (min 32 chars)
  // Generate with: openssl rand -base64 32
  secret: process.env.SESSION_SECRET!,

  // Optional: Storage backend (default: InMemorySessionStore)
  store: createInMemorySessionStore(),

  // Optional: Cookie configuration
  cookie: {
    name: 'myapp.session',        // Cookie name (default: 'velox.session')
    path: '/',                     // Cookie path (default: '/')
    domain: 'example.com',         // Cookie domain (optional)
    secure: true,                  // HTTPS only (default: NODE_ENV === 'production')
    httpOnly: true,                // Prevent JS access (default: true)
    sameSite: 'strict',            // CSRF protection (default: 'lax')
  },

  // Optional: Expiration configuration
  expiration: {
    ttl: 3600,                     // Session TTL in seconds (default: 86400)
    sliding: true,                 // Refresh TTL on each request (default: true)
    absoluteTimeout: 604800,       // Max session lifetime (7 days), forces re-auth
  },

  // Optional: User loader function
  userLoader: async (userId) => {
    return db.user.findUnique({ where: { id: userId } });
  },
});
```

### Middleware Variants

```typescript
const session = sessionMiddleware(config);

// Basic session middleware - creates session for all requests
const getPreferences = procedure
  .use(session.middleware())
  .query(async ({ ctx }) => {
    return ctx.session.get('theme') ?? 'light';
  });

// Require authentication - throws 401 if no userId in session
const getProfile = procedure
  .use(session.requireAuth())
  .query(async ({ ctx }) => {
    // ctx.user is guaranteed to exist
    return ctx.user;
  });

// Optional authentication - user may or may not be logged in
const getHomePage = procedure
  .use(session.optionalAuth())
  .query(async ({ ctx }) => {
    if (ctx.isAuthenticated) {
      return { greeting: `Welcome back, ${ctx.user.email}!` };
    }
    return { greeting: 'Welcome, guest!' };
  });
```

### Login and Logout

```typescript
import { loginSession, logoutSession } from '@veloxts/auth';
import { hashPassword, verifyPassword } from '@veloxts/auth';

export const authProcedures = defineProcedures('auth', {
  // Login procedure
  login: procedure
    .use(session.middleware())
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Find user
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (!user) {
        throw new AuthError('Invalid credentials', 401);
      }

      // Verify password
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new AuthError('Invalid credentials', 401);
      }

      // Login - regenerates session ID to prevent fixation attacks
      await loginSession(ctx.session, user);

      return { success: true, user };
    }),

  // Logout procedure
  logout: procedure
    .use(session.requireAuth())
    .mutation(async ({ ctx }) => {
      await logoutSession(ctx.session);
      return { success: true };
    }),

  // Logout from all devices
  logoutAll: procedure
    .use(session.requireAuth())
    .mutation(async ({ ctx }) => {
      await session.manager.destroyUserSessions(ctx.user.id);
      return { success: true };
    }),
});
```

### Flash Data

Flash data persists for exactly one request - perfect for success messages after redirects.

```typescript
// Set flash data
const createPost = procedure
  .use(session.middleware())
  .input(CreatePostSchema)
  .mutation(async ({ input, ctx }) => {
    const post = await db.post.create({ data: input });

    // Flash message for next request
    ctx.session.flash('success', 'Post created successfully!');

    return post;
  });

// Read flash data (automatically cleared after this request)
const getFlashMessages = procedure
  .use(session.middleware())
  .query(async ({ ctx }) => {
    const messages = ctx.session.getAllFlash();
    return messages;
  });
```

### Session Handle API

```typescript
// Get value
const theme = session.get('theme');

// Set value (marks session as modified)
session.set('theme', 'dark');

// Delete value
session.delete('theme');

// Check if key exists
if (session.has('cart')) {
  // ...
}

// Flash data
session.flash('message', 'Success!');
const message = session.getFlash('message');

// Regenerate session ID (security: call after privilege changes)
await session.regenerate();

// Destroy session completely
await session.destroy();

// Save session manually (auto-saved by middleware)
await session.save();

// Reload session from store
await session.reload();

// Session metadata
session.id;           // Session ID
session.isNew;        // True for new sessions
session.isModified;   // True if data changed
session.isDestroyed;  // True after destroy()
```

### Custom Session Storage

For production, implement a custom store backed by Redis, PostgreSQL, or other persistent storage.

```typescript
import { SessionStore, StoredSession } from '@veloxts/auth';
import { Redis } from 'ioredis';

class RedisSessionStore implements SessionStore {
  constructor(private redis: Redis) {}

  async get(sessionId: string): Promise<StoredSession | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async set(sessionId: string, session: StoredSession): Promise<void> {
    const ttl = Math.ceil((session.expiresAt - Date.now()) / 1000);
    await this.redis.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(session)
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  async touch(sessionId: string, expiresAt: number): Promise<void> {
    const session = await this.get(sessionId);
    if (session) {
      session.expiresAt = expiresAt;
      session.data._lastAccessedAt = Date.now();
      await this.set(sessionId, session);
    }
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getSessionsByUser(userId: string): Promise<string[]> {
    return this.redis.smembers(`user:${userId}:sessions`);
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    const sessions = await this.getSessionsByUser(userId);
    if (sessions.length > 0) {
      await this.redis.del(...sessions.map(id => `session:${id}`));
      await this.redis.del(`user:${userId}:sessions`);
    }
  }
}

// Use custom store
const redisStore = new RedisSessionStore(redisClient);
const session = sessionMiddleware({
  secret: process.env.SESSION_SECRET!,
  store: redisStore,
});
```

### Security Best Practices

**1. Always regenerate session ID after login**

```typescript
// loginSession() does this automatically
await loginSession(ctx.session, user);
```

**2. Destroy sessions on logout**

```typescript
await logoutSession(ctx.session);
```

**3. Use strong, random secrets**

```bash
# Generate a secure secret
openssl rand -base64 32
```

**4. Enable secure cookies in production**

```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict', // or 'lax'
}
```

**5. Set absolute timeout for sensitive operations**

```typescript
expiration: {
  absoluteTimeout: 3600, // Force re-auth after 1 hour
}
```

**6. Use environment variables for secrets**

```typescript
// NEVER hardcode secrets
secret: process.env.SESSION_SECRET!,
```

**7. Implement CSRF protection for state-changing operations**

See [CSRF Protection](#csrf-protection) section below.

**Built-in Security Features:**

The session implementation includes several security protections by default:

- **HMAC-SHA256 signing** - All session IDs are cryptographically signed to prevent tampering
- **Timing-safe comparison** - Session ID verification uses constant-time comparison to prevent timing attacks
- **Entropy validation** - Session IDs are validated for sufficient randomness (32 bytes, 256 bits)
- **Session fixation protection** - `loginSession()` automatically regenerates session IDs
- **SameSite enforcement** - `SameSite=none` requires `Secure` flag per RFC 6265bis

### When to Use Sessions vs JWT

**Choose Sessions when:**
- You need immediate session revocation (logout all devices)
- Building server-rendered applications with traditional workflows
- Flash data and server-side state are important to your application
- You have infrastructure for shared session storage (Redis, etc.)

**Choose JWT when:**
- Building stateless APIs for mobile apps or microservices
- You need cross-domain authentication
- Horizontal scaling without shared state is critical
- You prefer client-side session storage

## JWT Authentication

Stateless token-based authentication using HMAC-SHA256 signed JWTs.

### Quick Start

```typescript
import { jwtManager, authMiddleware } from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';

// Create JWT manager
const jwt = jwtManager({
  secret: process.env.JWT_SECRET!, // Min 64 characters
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'my-app',
  audience: 'my-app-users',
});

// Create auth middleware
const auth = authMiddleware({
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  userLoader: async (userId) => {
    return db.user.findUnique({ where: { id: userId } });
  },
});

// Use in procedures
export const authProcedures = defineProcedures('auth', {
  // Login - return tokens
  login: procedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({ where: { email: input.email } });
      if (!user || !await verifyPassword(input.password, user.passwordHash)) {
        throw new AuthError('Invalid credentials', 401);
      }
      return jwt.createTokenPair(user);
    }),

  // Protected route
  getProfile: procedure
    .use(auth.requireAuth())
    .query(async ({ ctx }) => {
      return ctx.user; // Guaranteed to exist
    }),

  // Refresh tokens
  refresh: procedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      return jwt.refreshTokens(input.refreshToken);
    }),
});
```

### Configuration Options

```typescript
import { jwtManager } from '@veloxts/auth';

const jwt = jwtManager({
  // Required: Secret for signing tokens (min 64 chars)
  // Generate with: openssl rand -base64 64
  secret: process.env.JWT_SECRET!,

  // Optional: Token expiration times
  accessTokenExpiry: '15m',    // Default: 15 minutes
  refreshTokenExpiry: '7d',    // Default: 7 days

  // Optional: Token claims
  issuer: 'my-app',            // iss claim
  audience: 'my-app-users',    // aud claim
});
```

### Token Operations

```typescript
// Create token pair for user
const tokens = jwt.createTokenPair(user);
// Returns: { accessToken, refreshToken, expiresIn, tokenType }

// Add custom claims (cannot override reserved claims)
const tokens = jwt.createTokenPair(user, {
  role: 'admin',
  permissions: ['read', 'write'],
});

// Verify access token
const payload = jwt.verifyToken(accessToken);
// Returns: { sub, email, iat, exp, type, jti, ... }

// Refresh tokens using refresh token
const newTokens = jwt.refreshTokens(refreshToken);

// Extract token from Authorization header
const token = jwt.extractFromHeader(request.headers.authorization);
```

### Token Revocation

For security-critical applications, implement token revocation:

```typescript
import { createInMemoryTokenStore } from '@veloxts/auth';

// Development/testing (NOT for production!)
const tokenStore = createInMemoryTokenStore();

// Configure auth to check revocation
const auth = authMiddleware({
  jwt: { secret: process.env.JWT_SECRET! },
  isTokenRevoked: tokenStore.isRevoked,
});

// Revoke on logout
const logout = procedure
  .use(auth.requireAuth())
  .mutation(async ({ ctx }) => {
    if (ctx.auth.token?.jti) {
      tokenStore.revoke(ctx.auth.token.jti);
    }
    return { success: true };
  });
```

For production, use Redis or database-backed storage instead of the in-memory store.

### Auth Middleware Options

```typescript
const auth = authMiddleware(config);

// Require authentication (throws 401 if no valid token)
const getProfile = procedure
  .use(auth.requireAuth())
  .query(({ ctx }) => ctx.user);

// Optional authentication (user may be undefined)
const getPosts = procedure
  .use(auth.optionalAuth())
  .query(({ ctx }) => {
    if (ctx.user) {
      return getPrivatePosts(ctx.user.id);
    }
    return getPublicPosts();
  });

// With guards (after authentication)
const adminOnly = procedure
  .use(auth.middleware({ guards: [hasRole('admin')] }))
  .query(({ ctx }) => getAdminData());
```

### Security Features

The JWT implementation includes several security protections:

- **HS256 algorithm enforcement** - Rejects `none`, RS256, and other algorithms to prevent confusion attacks
- **Timing-safe signature verification** - Prevents timing attacks on token validation
- **Secret entropy validation** - Requires at least 64 characters with 16+ unique characters
- **Reserved claim protection** - Prevents overriding `sub`, `exp`, `iat`, etc. via custom claims
- **Token expiration** - Access and refresh tokens have separate expiration times
- **Not-before claim support** - Optionally delay token validity

## CSRF Protection

CSRF protection is already implemented using the signed double-submit cookie pattern with timing-safe comparison and entropy validation.

```typescript
import { csrfMiddleware } from '@veloxts/auth';

const csrf = csrfMiddleware({
  secret: process.env.CSRF_SECRET!,
});

// Use in procedures that modify state
const deletePost = procedure
  .use(csrf.middleware())
  .mutation(async ({ ctx }) => {
    // CSRF token validated automatically
  });
```

See the CSRF documentation for complete details on configuration and usage.

## Guards and Policies

Guards and policies provide declarative authorization for procedures.

### User Roles and Permissions

Users can have multiple roles and permissions:

```typescript
import type { User } from '@veloxts/auth';

// User with multiple roles
const user: User = {
  id: '1',
  email: 'admin@example.com',
  roles: ['admin', 'editor'],           // Multiple roles
  permissions: ['posts.read', 'posts.write', 'users.manage'],
};
```

### Role-Based Guards

The `hasRole` guard checks if the user has ANY of the specified roles:

```typescript
import { hasRole, hasPermission, allOf, anyOf } from '@veloxts/auth';

// Require a single role
const adminOnly = procedure
  .use(auth.middleware({ guards: [hasRole('admin')] }))
  .query(async ({ ctx }) => {
    // Only users with 'admin' role can access
  });

// Require ANY of multiple roles (OR logic)
const staffAccess = procedure
  .use(auth.middleware({ guards: [hasRole(['admin', 'moderator', 'editor'])] }))
  .query(async ({ ctx }) => {
    // Users with 'admin', 'moderator', OR 'editor' role can access
  });

// User with roles: ['editor', 'reviewer'] passes hasRole(['admin', 'editor'])
// because they have the 'editor' role
```

### Permission-Based Guards

```typescript
// Require ALL specified permissions (AND logic)
const canManagePosts = procedure
  .use(auth.middleware({ guards: [hasPermission(['posts.read', 'posts.write'])] }))
  .query(async ({ ctx }) => {
    // User must have BOTH permissions
  });

// Require ANY of the permissions (OR logic)
const canViewPosts = procedure
  .use(auth.middleware({ guards: [hasAnyPermission(['posts.read', 'posts.admin'])] }))
  .query(async ({ ctx }) => {
    // User needs at least one of these permissions
  });
```

### Combining Guards

```typescript
// Require BOTH role AND permission (AND logic)
const adminWithPermission = procedure
  .use(auth.middleware({
    guards: [hasRole('admin'), hasPermission('users.delete')]
  }))
  .mutation(async ({ ctx }) => {
    // Must be admin AND have users.delete permission
  });

// Using allOf for explicit AND
const strictAccess = procedure
  .use(auth.middleware({
    guards: [allOf([hasRole('admin'), hasPermission('sensitive.access')])]
  }))
  .query(async ({ ctx }) => {
    // Both conditions must pass
  });

// Using anyOf for explicit OR
const flexibleAccess = procedure
  .use(auth.middleware({
    guards: [anyOf([hasRole('admin'), hasPermission('special.access')])]
  }))
  .query(async ({ ctx }) => {
    // Either condition can pass
  });
```

### Custom Guards

```typescript
import { guard, defineGuard } from '@veloxts/auth';

// Simple custom guard
const isVerifiedEmail = guard('isVerifiedEmail', (ctx) => {
  return ctx.user?.emailVerified === true;
});

// Guard with configuration
const isPremiumUser = defineGuard({
  name: 'isPremiumUser',
  check: (ctx) => ctx.user?.subscription === 'premium',
  message: 'Premium subscription required',
  statusCode: 403,
});

// Use in procedures
const premiumContent = procedure
  .use(auth.middleware({ guards: [isPremiumUser] }))
  .query(async ({ ctx }) => {
    return getPremiumContent();
  });
```

### Policies

Define resource-specific authorization logic:

```typescript
import { definePolicy } from '@veloxts/auth';

const postPolicy = definePolicy<{ postId: string }>('post', {
  view: async (user, { postId }) => {
    // Anyone can view public posts
    return true;
  },
  edit: async (user, { postId }) => {
    const post = await db.post.findUnique({ where: { id: postId } });
    // Only author or admin can edit
    return post?.authorId === user.id || user.roles?.includes('admin');
  },
  delete: async (user, { postId }) => {
    const post = await db.post.findUnique({ where: { id: postId } });
    // Only admin can delete
    return user.roles?.includes('admin') ?? false;
  },
});
```

## Password Hashing

Secure password hashing with bcrypt:

```typescript
import { hashPassword, verifyPassword } from '@veloxts/auth';

// Hash password
const hash = await hashPassword('user-password', { cost: 12 });

// Verify password
const valid = await verifyPassword('user-password', hash);
```

## Rate Limiting

Protect your endpoints from abuse with request rate limiting.

### Quick Start

```typescript
import { rateLimitMiddleware } from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';

// Create rate limit middleware
const rateLimit = rateLimitMiddleware({
  max: 100,           // Maximum requests per window
  windowMs: 60000,    // Window size in milliseconds (1 minute)
});

// Stricter limit for auth endpoints
const authRateLimit = rateLimitMiddleware({
  max: 5,
  windowMs: 60000,
  message: 'Too many login attempts, please try again later',
});

export const authProcedures = defineProcedures('auth', {
  // Protected with stricter rate limit
  login: procedure
    .use(authRateLimit)
    .input(LoginSchema)
    .mutation(async ({ input }) => {
      // Login logic
    }),

  // Normal rate limit
  getProfile: procedure
    .use(rateLimit)
    .use(auth.requireAuth())
    .query(({ ctx }) => ctx.user),
});
```

### Configuration Options

```typescript
const rateLimit = rateLimitMiddleware({
  // Maximum requests allowed in window
  max: 100,               // Default: 100

  // Time window in milliseconds
  windowMs: 60000,        // Default: 60000 (1 minute)

  // Custom key generator (default: request IP)
  keyGenerator: (ctx) => {
    // Rate limit by user ID if authenticated
    return ctx.user?.id ?? ctx.request.ip ?? 'anonymous';
  },

  // Custom error message
  message: 'Rate limit exceeded',
});
```

### Response Headers

Rate limit info is included in response headers:

```
X-RateLimit-Limit: 100        # Max requests allowed
X-RateLimit-Remaining: 95     # Remaining requests in window
X-RateLimit-Reset: 1234567890 # Unix timestamp when window resets
```

### Production Considerations

The built-in rate limiter uses in-memory storage, which:
- Does **not** persist across server restarts
- Does **not** work across multiple server instances

For production, implement a custom middleware using Redis:

```typescript
import { Redis } from 'ioredis';
import type { MiddlewareFunction } from '@veloxts/router';
import { AuthError } from '@veloxts/auth';

const redis = new Redis();

function redisRateLimitMiddleware(options: {
  max: number;
  windowMs: number;
  prefix?: string;
}): MiddlewareFunction {
  const { max, windowMs, prefix = 'ratelimit:' } = options;

  return async ({ ctx, next }) => {
    const key = `${prefix}${ctx.request.ip}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    const remaining = Math.max(0, max - current);

    ctx.reply.header('X-RateLimit-Limit', String(max));
    ctx.reply.header('X-RateLimit-Remaining', String(remaining));
    ctx.reply.header('X-RateLimit-Reset', String(Math.ceil((Date.now() + ttl) / 1000)));

    if (current > max) {
      throw new AuthError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
    }

    return next();
  };
}
```

## Related Packages

- [@veloxts/core](../core) - Application framework
- [@veloxts/router](../router) - Procedure definitions and routing
- [@veloxts/orm](../orm) - Database integration

## License

[MIT](../../LICENSE)
