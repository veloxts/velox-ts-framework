# @veloxts/auth

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Authentication and authorization system for VeloxTS Framework.

## Features

- **Session Management** - Cookie-based sessions with pluggable storage backends
- **JWT Authentication** - Stateless token-based authentication with refresh tokens
- **Password Hashing** - Secure bcrypt hashing with configurable cost factors
- **CSRF Protection** - Signed double-submit cookie pattern
- **Guards and Policies** - Declarative authorization for procedures
- **Rate Limiting** - Built-in request rate limiting middleware

## Table of Contents

- [Installation](#installation)
- [Authentication Strategies](#authentication-strategies)
- [Session Management](#session-management)
- [JWT Authentication](#jwt-authentication)
- [CSRF Protection](#csrf-protection)
- [Guards and Policies](#guards-and-policies)
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
import { createSessionMiddleware, createInMemorySessionStore } from '@veloxts/auth';
import { defineProcedures, procedure } from '@veloxts/router';

// Create session middleware
const session = createSessionMiddleware({
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
const session = createSessionMiddleware(config);

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
const session = createSessionMiddleware({
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

Coming soon in v1.1.0. For now, use session-based authentication.

## CSRF Protection

CSRF protection is already implemented using the signed double-submit cookie pattern with timing-safe comparison and entropy validation.

```typescript
import { createCsrfMiddleware } from '@veloxts/auth';

const csrf = createCsrfMiddleware({
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

```typescript
import { authenticated, hasRole, definePolicy } from '@veloxts/auth';

// Use built-in guards
const adminOnly = procedure
  .use(session.requireAuth())
  .use(guard(hasRole('admin')))
  .query(async ({ ctx }) => {
    // Only admins can access
  });

// Define custom policies
const postPolicy = definePolicy<{ postId: string }>('post', {
  view: async (user, { postId }) => {
    // Anyone can view public posts
    return true;
  },
  edit: async (user, { postId }) => {
    const post = await db.post.findUnique({ where: { id: postId } });
    return post?.authorId === user.id;
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

Coming soon.

## Related Packages

- [@veloxts/core](../core) - Application framework
- [@veloxts/router](../router) - Procedure definitions and routing
- [@veloxts/orm](../orm) - Database integration

## License

[MIT](../../LICENSE)
