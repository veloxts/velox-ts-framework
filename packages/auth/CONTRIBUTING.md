# Contributing to @veloxts/auth

This guide covers how to contribute to the VeloxTS authentication package, with a focus on **creating auth adapters** for external providers like Clerk, Auth0, Lucia, Supabase Auth, etc.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Creating an Auth Adapter](#creating-an-auth-adapter)
- [Complete Example: Clerk Adapter](#complete-example-clerk-adapter)
- [Testing Your Adapter](#testing-your-adapter)
- [Submitting Your Adapter](#submitting-your-adapter)

---

## Architecture Overview

The `@veloxts/auth` package provides two authentication modes:

### Mode 1: VeloxTS Native JWT

Built-in JWT-based auth using `authPlugin` and `JwtManager`. Best for:
- Simple apps with custom auth requirements
- Self-hosted deployments
- Full control over token handling

### Mode 2: External Provider Adapters

Pluggable adapters for external auth providers. Best for:
- Managed auth services (Clerk, Auth0)
- OAuth/social login requirements
- Enterprise SSO needs

**This guide focuses on Mode 2 - creating adapters.**

### What Adapters Do

```
┌─────────────────────────────────────────────────────────────┐
│                    External Auth Provider                    │
│                  (Clerk, Auth0, BetterAuth)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Auth Adapter                            │
│  1. Converts provider session → VeloxTS format              │
│  2. Mounts provider routes (OAuth callbacks, etc.)          │
│  3. Handles Web API ↔ Fastify conversion                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   VeloxTS Auth System                        │
│  - ctx.user populated automatically                         │
│  - Guards work (authenticated, hasRole)                     │
│  - Policies work                                            │
│  - CSRF protection works                                    │
└─────────────────────────────────────────────────────────────┘
```

### Provider-Agnostic Components

These work with ANY adapter automatically:

| Component | Description |
|-----------|-------------|
| Guards | `authenticated`, `hasRole()`, `hasPermission()` |
| Policies | Resource-level authorization |
| CSRF | Cross-site request forgery protection |
| Context | `ctx.user`, `ctx.auth` decoration |

---

## Creating an Auth Adapter

### Step 1: Define Your Config Interface

Extend `AuthAdapterConfig` with provider-specific options:

```typescript
import type { AuthAdapterConfig } from '@veloxts/auth';

// Your provider's client type (from their SDK)
interface ClerkClient {
  verifyToken(token: string): Promise<ClerkSession | null>;
  // ... other methods
}

// Adapter configuration
export interface ClerkAdapterConfig extends AuthAdapterConfig {
  /** Clerk client instance */
  client: ClerkClient;

  /** Clerk publishable key */
  publishableKey: string;

  /** Routes where Clerk middleware applies */
  publicRoutes?: string[];
}
```

### Step 2: Implement the Adapter Interface

There are 3 required methods:

```typescript
interface AuthAdapter<TConfig> {
  // Metadata
  readonly name: string;
  readonly version: string;

  // Required methods
  initialize(fastify, config): Promise<void> | void;
  getSession(request): Promise<AdapterSessionResult | null>;
  getRoutes(): AdapterRoute[];

  // Optional methods
  cleanup?(): Promise<void> | void;
  validateSession?(session): Promise<boolean> | boolean;
  refreshSession?(request, session): Promise<AdapterSessionResult | null>;
  handleCallback?(request, reply, type): Promise<unknown>;
}
```

### Step 3: Use the Base Class (Recommended)

Extend `BaseAuthAdapter` to reduce boilerplate:

```typescript
import { BaseAuthAdapter, type AdapterSessionResult } from '@veloxts/auth';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export class ClerkAdapter extends BaseAuthAdapter<ClerkAdapterConfig> {
  private client: ClerkClient | null = null;

  constructor() {
    super('clerk', '1.0.0');
  }

  async initialize(fastify: FastifyInstance, config: ClerkAdapterConfig): Promise<void> {
    await super.initialize(fastify, config);
    this.client = config.client;
    this.debug('Clerk adapter initialized');
  }

  async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    // Implementation here
  }

  getRoutes() {
    return []; // Clerk typically doesn't need mounted routes
  }
}
```

### Step 4: Implement getSession()

This is the core method - extract and normalize session data:

```typescript
async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
  if (!this.client) {
    throw new AuthAdapterError(
      'Clerk client not initialized',
      500,
      'ADAPTER_NOT_CONFIGURED'
    );
  }

  // 1. Extract token from request
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null; // No token = unauthenticated
  }
  const token = authHeader.slice(7);

  // 2. Verify with provider
  try {
    const session = await this.client.verifyToken(token);
    if (!session) {
      return null;
    }

    // 3. Normalize to VeloxTS format
    return {
      user: {
        id: session.userId,
        email: session.email,
        name: session.firstName + ' ' + session.lastName,
        emailVerified: session.emailVerified,
        image: session.imageUrl,
        providerData: {
          clerkId: session.userId,
          orgId: session.orgId,
          orgRole: session.orgRole,
        },
      },
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        expiresAt: session.exp * 1000, // Convert to ms
        isActive: true,
      },
    };
  } catch (error) {
    this.error('Session verification failed', error as Error);
    throw new AuthAdapterError(
      'Failed to verify Clerk session',
      500,
      'ADAPTER_SESSION_ERROR',
      error as Error
    );
  }
}
```

### Step 5: Implement getRoutes() (If Needed)

Some providers need mounted routes for OAuth callbacks:

```typescript
getRoutes(): AdapterRoute[] {
  return [
    {
      path: '/api/auth/clerk/webhook',
      methods: ['POST'],
      handler: async (request, reply) => {
        // Handle Clerk webhooks (user created, updated, deleted)
        const payload = request.body;
        // Process webhook...
        return reply.status(200).send({ received: true });
      },
      description: 'Clerk webhook handler',
    },
  ];
}
```

### Step 6: Create Factory Function

Export a convenient factory:

```typescript
export function createClerkAdapter(config: ClerkAdapterConfig): ClerkAdapter {
  const adapter = new ClerkAdapter();
  // Store config for later initialization
  (adapter as { config: ClerkAdapterConfig }).config = config;
  return adapter;
}
```

---

## Complete Example: Clerk Adapter

Here's a full, production-ready Clerk adapter implementation:

```typescript
// src/adapters/clerk.ts

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type {
  AdapterRoute,
  AdapterSessionResult,
  AuthAdapterConfig,
} from '../adapter.js';
import { AuthAdapterError, BaseAuthAdapter } from '../adapter.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Clerk session claims (from JWT)
 */
export interface ClerkSessionClaims {
  sub: string;           // User ID
  sid: string;           // Session ID
  email: string;
  email_verified: boolean;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  org_id?: string;
  org_role?: string;
  exp: number;           // Expiration (Unix seconds)
  iat: number;           // Issued at
}

/**
 * Clerk SDK interface (minimal - users provide their own instance)
 */
export interface ClerkSDK {
  verifyToken(token: string): Promise<ClerkSessionClaims | null>;
}

/**
 * Clerk adapter configuration
 */
export interface ClerkAdapterConfig extends AuthAdapterConfig {
  /** Clerk SDK instance */
  clerk: ClerkSDK;

  /** Routes that don't require authentication */
  publicRoutes?: string[];

  /** Header name for session token */
  tokenHeader?: string;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

/**
 * Clerk authentication adapter for VeloxTS
 *
 * Integrates Clerk (https://clerk.com) with VeloxTS's auth system.
 *
 * @example
 * ```typescript
 * import { createClerkAdapter, createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createClerkClient } from '@clerk/backend';
 *
 * const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
 *
 * const adapter = createClerkAdapter({
 *   name: 'clerk',
 *   clerk: {
 *     verifyToken: (token) => clerk.verifyToken(token),
 *   },
 *   publicRoutes: ['/api/health', '/api/public/*'],
 * });
 *
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 *
 * app.use(authPlugin);
 * ```
 */
export class ClerkAdapter extends BaseAuthAdapter<ClerkAdapterConfig> {
  private clerk: ClerkSDK | null = null;
  private publicRoutes: string[] = [];
  private tokenHeader = 'authorization';

  constructor() {
    super('clerk', '1.0.0');
  }

  /**
   * Initialize the adapter with Clerk SDK
   */
  async initialize(fastify: FastifyInstance, config: ClerkAdapterConfig): Promise<void> {
    await super.initialize(fastify, config);

    if (!config.clerk) {
      throw new AuthAdapterError(
        'Clerk SDK instance is required',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    this.clerk = config.clerk;
    this.publicRoutes = config.publicRoutes ?? [];
    this.tokenHeader = config.tokenHeader ?? 'authorization';

    this.info('Clerk adapter initialized');
  }

  /**
   * Load session from Clerk token
   */
  async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    if (!this.clerk) {
      throw new AuthAdapterError(
        'Clerk adapter not initialized',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    // Check if route is public
    if (this.isPublicRoute(request.url)) {
      this.debug(`Skipping auth for public route: ${request.url}`);
      return null;
    }

    // Extract token from header
    const authHeader = request.headers[this.tokenHeader];
    if (!authHeader || typeof authHeader !== 'string') {
      this.debug('No authorization header found');
      return null;
    }

    // Support both "Bearer <token>" and raw token
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return null;
    }

    // Verify token with Clerk
    try {
      const claims = await this.clerk.verifyToken(token);

      if (!claims) {
        this.debug('Token verification returned null');
        return null;
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        this.debug('Token has expired');
        return null;
      }

      // Build normalized session result
      return {
        user: {
          id: claims.sub,
          email: claims.email,
          name: [claims.first_name, claims.last_name].filter(Boolean).join(' ') || undefined,
          emailVerified: claims.email_verified,
          image: claims.image_url,
          providerData: {
            clerkUserId: claims.sub,
            sessionId: claims.sid,
            orgId: claims.org_id,
            orgRole: claims.org_role,
          },
        },
        session: {
          sessionId: claims.sid,
          userId: claims.sub,
          expiresAt: claims.exp * 1000, // Convert to milliseconds
          isActive: true,
          providerData: {
            issuedAt: claims.iat * 1000,
          },
        },
      };
    } catch (error) {
      this.error('Token verification failed', error as Error);

      // Don't throw - return null to allow unauthenticated access
      // Guards will handle authorization
      return null;
    }
  }

  /**
   * Get routes to mount
   *
   * Clerk doesn't require server-side routes for basic auth,
   * but you might add webhook handlers here.
   */
  getRoutes(): AdapterRoute[] {
    // Add webhook route if you need to handle Clerk webhooks
    return [];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await super.cleanup();
    this.clerk = null;
    this.info('Clerk adapter cleaned up');
  }

  /**
   * Check if a route is public (no auth required)
   */
  private isPublicRoute(url: string): boolean {
    for (const pattern of this.publicRoutes) {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1);
        if (url.startsWith(prefix)) {
          return true;
        }
      } else if (url === pattern) {
        return true;
      }
    }
    return false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a Clerk adapter instance
 *
 * @param config - Adapter configuration
 * @returns Configured Clerk adapter
 *
 * @example
 * ```typescript
 * const adapter = createClerkAdapter({
 *   name: 'clerk',
 *   clerk: clerkSDK,
 *   debug: process.env.NODE_ENV === 'development',
 * });
 * ```
 */
export function createClerkAdapter(
  config: Omit<ClerkAdapterConfig, 'name'> & { name?: string }
): ClerkAdapter & { config: ClerkAdapterConfig } {
  const adapter = new ClerkAdapter();
  const fullConfig: ClerkAdapterConfig = {
    name: config.name ?? 'clerk',
    ...config,
  };

  return Object.assign(adapter, { config: fullConfig });
}
```

### Usage

```typescript
// src/index.ts
import { createApp } from '@veloxts/core';
import { createAuthAdapterPlugin } from '@veloxts/auth';
import { createClerkAdapter } from '@veloxts/auth/adapters/clerk';
import { createClerkClient } from '@clerk/backend';

// Initialize Clerk
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// Create adapter
const clerkAdapter = createClerkAdapter({
  clerk: {
    verifyToken: async (token) => {
      try {
        return await clerkClient.verifyToken(token);
      } catch {
        return null;
      }
    },
  },
  publicRoutes: ['/api/health'],
  debug: process.env.NODE_ENV === 'development',
});

// Create auth plugin
const authPlugin = createAuthAdapterPlugin({
  adapter: clerkAdapter,
  config: clerkAdapter.config,
});

// Create app and register
const app = await createApp();
app.use(authPlugin);

// Your procedures now have ctx.user populated automatically!
```

---

## Testing Your Adapter

### Unit Tests

Test the adapter in isolation with mocks:

```typescript
// src/adapters/__tests__/clerk.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClerkAdapter, createClerkAdapter } from '../clerk.js';

describe('ClerkAdapter', () => {
  const mockClerk = {
    verifyToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return null when no auth header', async () => {
      const adapter = createClerkAdapter({
        clerk: mockClerk,
      });

      await adapter.initialize({} as any, adapter.config);

      const request = {
        headers: {},
        url: '/api/users',
      } as any;

      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should return session for valid token', async () => {
      mockClerk.verifyToken.mockResolvedValue({
        sub: 'user_123',
        sid: 'sess_456',
        email: 'test@example.com',
        email_verified: true,
        first_name: 'John',
        last_name: 'Doe',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const adapter = createClerkAdapter({
        clerk: mockClerk,
      });

      await adapter.initialize({} as any, adapter.config);

      const request = {
        headers: { authorization: 'Bearer valid_token' },
        url: '/api/users',
      } as any;

      const result = await adapter.getSession(request);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe('user_123');
      expect(result?.user.email).toBe('test@example.com');
      expect(result?.session.sessionId).toBe('sess_456');
    });

    it('should return null for expired token', async () => {
      mockClerk.verifyToken.mockResolvedValue({
        sub: 'user_123',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        iat: Math.floor(Date.now() / 1000) - 7200,
      });

      const adapter = createClerkAdapter({
        clerk: mockClerk,
      });

      await adapter.initialize({} as any, adapter.config);

      const request = {
        headers: { authorization: 'Bearer expired_token' },
        url: '/api/users',
      } as any;

      const result = await adapter.getSession(request);
      expect(result).toBeNull();
    });

    it('should skip public routes', async () => {
      const adapter = createClerkAdapter({
        clerk: mockClerk,
        publicRoutes: ['/api/health', '/api/public/*'],
      });

      await adapter.initialize({} as any, adapter.config);

      const request = {
        headers: { authorization: 'Bearer token' },
        url: '/api/health',
      } as any;

      const result = await adapter.getSession(request);
      expect(result).toBeNull();
      expect(mockClerk.verifyToken).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

Test with a real (or mocked) Fastify server:

```typescript
// src/adapters/__tests__/clerk.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { createAuthAdapterPlugin } from '../../adapter.js';
import { createClerkAdapter } from '../clerk.js';

describe('ClerkAdapter Integration', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    const adapter = createClerkAdapter({
      clerk: {
        verifyToken: async (token) => {
          if (token === 'valid_token') {
            return {
              sub: 'user_123',
              sid: 'sess_456',
              email: 'test@example.com',
              email_verified: true,
              exp: Math.floor(Date.now() / 1000) + 3600,
              iat: Math.floor(Date.now() / 1000),
            };
          }
          return null;
        },
      },
    });

    app = Fastify();

    await app.register(
      createAuthAdapterPlugin({
        adapter,
        config: adapter.config,
      }).register,
      { adapter, config: adapter.config }
    );

    app.get('/api/me', async (request) => {
      return { user: request.user ?? null };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should populate request.user for valid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer valid_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).not.toBeNull();
    expect(body.user.id).toBe('user_123');
  });

  it('should not populate request.user for invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer invalid_token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeNull();
  });
});
```

---

## Submitting Your Adapter

### File Structure

```
packages/auth/
├── src/
│   ├── adapters/
│   │   ├── better-auth.ts      # Reference implementation
│   │   ├── clerk.ts            # Your new adapter
│   │   └── index.ts            # Re-exports
│   └── index.ts                # Package exports
└── CONTRIBUTING.md             # This file
```

### Checklist

Before submitting a PR:

- [ ] Adapter extends `BaseAuthAdapter` or implements `AuthAdapter` interface
- [ ] All required methods implemented: `initialize`, `getSession`, `getRoutes`
- [ ] Types are fully defined (no `any`)
- [ ] Config interface extends `AuthAdapterConfig`
- [ ] Factory function exported for easy creation
- [ ] Unit tests with >80% coverage
- [ ] Integration test with Fastify
- [ ] JSDoc comments on public API
- [ ] Added to `src/adapters/index.ts` exports
- [ ] Added to `src/index.ts` exports (if first-party)
- [ ] Updated ROADMAP.md to mark adapter as complete

### Export Pattern

```typescript
// src/adapters/index.ts
export * from './better-auth.js';
export * from './clerk.js';
// Add your adapter here

// src/index.ts
// First-party adapters
export {
  createBetterAuthAdapter,
  type BetterAuthAdapterConfig,
} from './adapters/better-auth.js';

export {
  createClerkAdapter,
  type ClerkAdapterConfig,
} from './adapters/clerk.js';
```

---

## Questions?

- Check existing adapters in `src/adapters/` for patterns
- Open a discussion on GitHub for architecture questions
- See `adapter.ts` for the full interface documentation
