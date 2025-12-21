/**
 * Cookie-based Session Management for @veloxts/auth
 *
 * Provides server-side session storage with pluggable backends,
 * secure session ID generation, and automatic session lifecycle management.
 *
 * Alternative to JWT authentication - users choose one or the other.
 *
 * @module auth/session
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { BaseContext } from '@veloxts/core';
import type { MiddlewareFunction } from '@veloxts/router';

import type { User } from './types.js';
import { AuthError } from './types.js';
import {
  type FastifyReplyWithCookies,
  type FastifyRequestWithCookies,
  getValidatedCookieContext,
} from './utils/cookie-support.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Session ID entropy in bytes (32 bytes = 256 bits)
 * Provides sufficient entropy to prevent brute-force attacks
 */
const SESSION_ID_BYTES = 32;

/**
 * Minimum secret length for session ID signing (32 characters)
 */
const MIN_SECRET_LENGTH = 32;

/**
 * Default session TTL (24 hours in seconds)
 */
const DEFAULT_SESSION_TTL = 86400;

/**
 * Default cookie name
 */
const DEFAULT_COOKIE_NAME = 'velox.session';

// ============================================================================
// Session Data Types
// ============================================================================

/**
 * Base session data interface
 *
 * Applications should extend this via declaration merging:
 * @example
 * ```typescript
 * declare module '@veloxts/auth' {
 *   interface SessionData {
 *     cart: CartItem[];
 *     preferences: UserPreferences;
 *   }
 * }
 * ```
 */
export interface SessionData {
  /** User ID if authenticated */
  userId?: string;
  /** User email if authenticated */
  userEmail?: string;
  /** Flash data - persists for one request only */
  _flash?: Record<string, unknown>;
  /** Previous flash data being read */
  _flashOld?: Record<string, unknown>;
  /** Session creation timestamp (Unix ms) */
  _createdAt: number;
  /** Last access timestamp (Unix ms) */
  _lastAccessedAt: number;
  /** Allow extension via declaration merging */
  [key: string]: unknown;
}

/**
 * Stored session entry in the session store
 */
export interface StoredSession {
  /** Session ID (signed) */
  id: string;
  /** Session data */
  data: SessionData;
  /** Expiration timestamp (Unix ms) */
  expiresAt: number;
}

// ============================================================================
// Session Store Interface
// ============================================================================

/**
 * Pluggable session storage backend interface
 *
 * Implementations:
 * - InMemorySessionStore (default, for development)
 * - RedisSessionStore (production, distributed)
 * - DatabaseSessionStore (production, audit trail)
 *
 * @example
 * ```typescript
 * // Custom Redis implementation
 * class RedisSessionStore implements SessionStore {
 *   constructor(private redis: Redis) {}
 *
 *   async get(sessionId: string): Promise<StoredSession | null> {
 *     const data = await this.redis.get(`session:${sessionId}`);
 *     return data ? JSON.parse(data) : null;
 *   }
 *
 *   async set(sessionId: string, session: StoredSession): Promise<void> {
 *     const ttl = Math.ceil((session.expiresAt - Date.now()) / 1000);
 *     await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
 *   }
 *
 *   async delete(sessionId: string): Promise<void> {
 *     await this.redis.del(`session:${sessionId}`);
 *   }
 *
 *   async touch(sessionId: string, expiresAt: number): Promise<void> {
 *     const session = await this.get(sessionId);
 *     if (session) {
 *       session.expiresAt = expiresAt;
 *       session.data._lastAccessedAt = Date.now();
 *       await this.set(sessionId, session);
 *     }
 *   }
 *
 *   async clear(): Promise<void> {
 *     const keys = await this.redis.keys('session:*');
 *     if (keys.length > 0) {
 *       await this.redis.del(...keys);
 *     }
 *   }
 * }
 * ```
 */
export interface SessionStore {
  /**
   * Retrieve a session by ID
   * @param sessionId - The session ID to look up
   * @returns The stored session or null if not found/expired
   */
  get(sessionId: string): Promise<StoredSession | null> | StoredSession | null;

  /**
   * Store or update a session
   * @param sessionId - The session ID
   * @param session - The session data to store
   */
  set(sessionId: string, session: StoredSession): Promise<void> | void;

  /**
   * Delete a session
   * @param sessionId - The session ID to delete
   */
  delete(sessionId: string): Promise<void> | void;

  /**
   * Refresh session TTL without modifying data
   * Used for sliding expiration
   * @param sessionId - The session ID to touch
   * @param expiresAt - New expiration timestamp (Unix ms)
   */
  touch(sessionId: string, expiresAt: number): Promise<void> | void;

  /**
   * Clear all sessions (useful for testing and maintenance)
   */
  clear(): Promise<void> | void;

  /**
   * Get all active session IDs for a user (optional)
   * Useful for "logout from all devices" functionality
   * @param userId - The user ID to look up
   * @returns Array of session IDs for the user
   */
  getSessionsByUser?(userId: string): Promise<string[]> | string[];

  /**
   * Delete all sessions for a user (optional)
   * Useful for "logout from all devices" functionality
   * @param userId - The user ID whose sessions to delete
   */
  deleteSessionsByUser?(userId: string): Promise<void> | void;
}

// ============================================================================
// In-Memory Session Store
// ============================================================================

/**
 * In-memory session store for development and testing
 *
 * WARNING: NOT suitable for production!
 * - Sessions are lost on server restart
 * - Does not work across multiple server instances
 * - No persistence mechanism
 *
 * For production, use Redis or database-backed storage.
 *
 * @deprecated Use `inMemorySessionStore()` instead for Laravel-style API.
 *
 * @example
 * ```typescript
 * const store = inMemorySessionStore();
 *
 * const manager = sessionManager({
 *   store,
 *   secret: process.env.SESSION_SECRET!,
 * });
 * ```
 */
export function createInMemorySessionStore(): SessionStore {
  const sessions = new Map<string, StoredSession>();
  const userSessions = new Map<string, Set<string>>();

  /**
   * Clean up expired sessions
   */
  function cleanup(): void {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) {
        // Remove from user index
        const userId = session.data.userId;
        if (userId) {
          const userSessionSet = userSessions.get(userId);
          if (userSessionSet) {
            userSessionSet.delete(id);
            if (userSessionSet.size === 0) {
              userSessions.delete(userId);
            }
          }
        }
        sessions.delete(id);
      }
    }
  }

  // Run cleanup periodically (every 5 minutes)
  const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
  // Don't prevent process exit
  cleanupInterval.unref();

  return {
    get(sessionId: string): StoredSession | null {
      const session = sessions.get(sessionId);
      if (!session) {
        return null;
      }

      // Check expiration
      if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
      }

      return session;
    },

    set(sessionId: string, session: StoredSession): void {
      // Track user sessions for getSessionsByUser
      const existingSession = sessions.get(sessionId);
      const oldUserId = existingSession?.data.userId;
      const newUserId = session.data.userId;

      // Update user index if userId changed
      if (oldUserId && oldUserId !== newUserId) {
        const oldSet = userSessions.get(oldUserId);
        if (oldSet) {
          oldSet.delete(sessionId);
          if (oldSet.size === 0) {
            userSessions.delete(oldUserId);
          }
        }
      }

      if (newUserId) {
        let userSet = userSessions.get(newUserId);
        if (!userSet) {
          userSet = new Set();
          userSessions.set(newUserId, userSet);
        }
        userSet.add(sessionId);
      }

      sessions.set(sessionId, session);
    },

    delete(sessionId: string): void {
      const session = sessions.get(sessionId);
      if (session?.data.userId) {
        const userSet = userSessions.get(session.data.userId);
        if (userSet) {
          userSet.delete(sessionId);
          if (userSet.size === 0) {
            userSessions.delete(session.data.userId);
          }
        }
      }
      sessions.delete(sessionId);
    },

    touch(sessionId: string, expiresAt: number): void {
      const session = sessions.get(sessionId);
      if (session) {
        session.expiresAt = expiresAt;
        session.data._lastAccessedAt = Date.now();
      }
    },

    clear(): void {
      sessions.clear();
      userSessions.clear();
    },

    getSessionsByUser(userId: string): string[] {
      const userSet = userSessions.get(userId);
      return userSet ? [...userSet] : [];
    },

    deleteSessionsByUser(userId: string): void {
      const userSet = userSessions.get(userId);
      if (userSet) {
        for (const sessionId of userSet) {
          sessions.delete(sessionId);
        }
        userSessions.delete(userId);
      }
    },
  };
}

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Cookie configuration for sessions
 */
export interface SessionCookieConfig {
  /**
   * Cookie name
   * @default 'velox.session'
   */
  name?: string;

  /**
   * Cookie path
   * @default '/'
   */
  path?: string;

  /**
   * Cookie domain (optional)
   */
  domain?: string;

  /**
   * Require HTTPS
   * @default process.env.NODE_ENV === 'production'
   */
  secure?: boolean;

  /**
   * HttpOnly flag - prevents JavaScript access
   * @default true
   */
  httpOnly?: boolean;

  /**
   * SameSite policy
   * @default 'lax'
   */
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Session expiration configuration
 */
export interface SessionExpirationConfig {
  /**
   * Session time-to-live in seconds
   * @default 86400 (24 hours)
   */
  ttl?: number;

  /**
   * Enable sliding expiration
   * When true, session TTL is refreshed on each request
   * @default true
   */
  sliding?: boolean;

  /**
   * Absolute expiration in seconds (optional)
   * If set, session cannot extend beyond this time from creation
   * Useful for requiring periodic re-authentication
   */
  absoluteTimeout?: number;
}

/**
 * Complete session manager configuration
 */
export interface SessionConfig {
  /**
   * Session store backend
   * @default InMemorySessionStore
   */
  store?: SessionStore;

  /**
   * Secret key for signing session IDs
   * Minimum 32 characters
   */
  secret: string;

  /**
   * Cookie configuration
   */
  cookie?: SessionCookieConfig;

  /**
   * Expiration configuration
   */
  expiration?: SessionExpirationConfig;

  /**
   * User loader function (optional)
   * Called to populate ctx.user from session data
   */
  userLoader?: (userId: string) => Promise<User | null>;
}

// ============================================================================
// Session Manager Interface
// ============================================================================

/**
 * Session handle for accessing and modifying session data
 */
export interface Session {
  /** Session ID */
  readonly id: string;

  /** Whether this is a new session */
  readonly isNew: boolean;

  /** Whether the session has been modified */
  readonly isModified: boolean;

  /** Whether the session has been destroyed */
  readonly isDestroyed: boolean;

  /** Session data */
  readonly data: SessionData;

  /**
   * Get a session value
   */
  get<K extends keyof SessionData>(key: K): SessionData[K];

  /**
   * Set a session value
   */
  set<K extends keyof SessionData>(key: K, value: SessionData[K]): void;

  /**
   * Delete a session value
   */
  delete<K extends keyof SessionData>(key: K): void;

  /**
   * Check if a key exists
   */
  has<K extends keyof SessionData>(key: K): boolean;

  /**
   * Set flash data (persists for one request only)
   */
  flash(key: string, value: unknown): void;

  /**
   * Get flash data (clears after read)
   */
  getFlash<T = unknown>(key: string): T | undefined;

  /**
   * Get all flash data
   */
  getAllFlash(): Record<string, unknown>;

  /**
   * Regenerate session ID (for security after privilege change)
   * Preserves session data with new ID
   */
  regenerate(): Promise<void>;

  /**
   * Destroy the session completely
   */
  destroy(): Promise<void>;

  /**
   * Save session changes
   * Called automatically by middleware, but can be called manually
   */
  save(): Promise<void>;

  /**
   * Reload session data from store
   */
  reload(): Promise<void>;

  // ============================================================================
  // Authentication Methods (Laravel-style fluent API)
  // ============================================================================

  /**
   * Log in a user to the session
   *
   * Regenerates the session ID to prevent session fixation attacks,
   * then stores the user's ID and email in the session.
   *
   * @example
   * ```typescript
   * const login = procedure()
   *   .input(LoginSchema)
   *   .mutation(async ({ input, ctx }) => {
   *     const user = await verifyCredentials(input.email, input.password);
   *     await ctx.session.login(user);
   *     return { success: true };
   *   });
   * ```
   */
  login(user: User): Promise<void>;

  /**
   * Log out the current user by destroying the session
   *
   * @example
   * ```typescript
   * const logout = procedure()
   *   .use(session.requireAuth())
   *   .mutation(async ({ ctx }) => {
   *     await ctx.session.logout();
   *     return { success: true };
   *   });
   * ```
   */
  logout(): Promise<void>;

  /**
   * Check if the session is authenticated (has a logged-in user)
   *
   * @returns true if a user is logged in, false otherwise
   *
   * @example
   * ```typescript
   * if (ctx.session.check()) {
   *   // User is authenticated
   *   console.log('User ID:', ctx.session.get('userId'));
   * }
   * ```
   */
  check(): boolean;
}

/**
 * Session manager for creating and managing sessions
 */
export interface SessionManager {
  /**
   * Create a new session
   */
  createSession(reply: FastifyReplyWithCookies): Session;

  /**
   * Load existing session from request
   * @returns Session if found and valid, null otherwise
   */
  loadSession(request: FastifyRequestWithCookies): Promise<Session | null>;

  /**
   * Load or create session
   */
  getOrCreateSession(
    request: FastifyRequestWithCookies,
    reply: FastifyReplyWithCookies
  ): Promise<Session>;

  /**
   * Destroy a session by ID
   */
  destroySession(sessionId: string): Promise<void>;

  /**
   * Destroy all sessions for a user
   */
  destroyUserSessions(userId: string): Promise<void>;

  /**
   * Clear the session cookie
   */
  clearCookie(reply: FastifyReplyWithCookies): void;

  /**
   * Get the underlying session store
   */
  readonly store: SessionStore;
}

// ============================================================================
// Session ID Generation and Signing
// ============================================================================

/**
 * Generate a cryptographically secure session ID
 */
function generateSessionId(): string {
  const bytes = randomBytes(SESSION_ID_BYTES);
  // Use base64url encoding for URL-safe session IDs
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Sign a session ID with HMAC-SHA256
 */
function signSessionId(sessionId: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(sessionId);
  const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${sessionId}.${signature}`;
}

/**
 * Verify and extract session ID from signed value
 * Uses timing-safe comparison to prevent timing attacks
 */
function verifySessionId(signedId: string, secret: string): string | null {
  const dotIndex = signedId.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const sessionId = signedId.slice(0, dotIndex);
  const signature = signedId.slice(dotIndex + 1);

  // Recompute expected signature
  const hmac = createHmac('sha256', secret);
  hmac.update(sessionId);
  const expectedSignature = hmac
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Timing-safe comparison
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

/**
 * Validate session ID entropy (prevent weak session IDs)
 */
function validateSessionIdEntropy(sessionId: string): boolean {
  // Session ID should be at least 32 bytes when decoded
  // Our base64url encoding produces ~43 characters for 32 bytes
  if (sessionId.length < 40) {
    return false;
  }

  // Check for sufficient character variety (basic entropy check)
  const uniqueChars = new Set(sessionId).size;
  return uniqueChars >= 16;
}

// ============================================================================
// Session Manager Implementation
// ============================================================================

/**
 * Creates a session manager
 *
 * @deprecated Use `sessionManager()` instead for Laravel-style API.
 *
 * @example
 * ```typescript
 * const manager = sessionManager({
 *   secret: process.env.SESSION_SECRET!,
 *   cookie: {
 *     name: 'myapp.session',
 *     secure: true,
 *     sameSite: 'strict',
 *   },
 *   expiration: {
 *     ttl: 3600, // 1 hour
 *     sliding: true,
 *   },
 * });
 * ```
 */
export function createSessionManager(config: SessionConfig): SessionManager {
  // Validate secret
  if (!config.secret || config.secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Session secret must be at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate with: openssl rand -base64 32'
    );
  }

  // Validate secret entropy
  const uniqueChars = new Set(config.secret).size;
  if (uniqueChars < 16) {
    throw new Error(
      `Session secret has insufficient entropy (only ${uniqueChars} unique characters). ` +
        'Use cryptographically random data with at least 16 unique characters.'
    );
  }

  // Initialize store
  const store = config.store ?? createInMemorySessionStore();

  // Cookie configuration
  const cookieName = config.cookie?.name ?? DEFAULT_COOKIE_NAME;
  const cookiePath = config.cookie?.path ?? '/';
  const cookieDomain = config.cookie?.domain;
  const cookieSecure = config.cookie?.secure ?? process.env.NODE_ENV === 'production';
  const cookieHttpOnly = config.cookie?.httpOnly ?? true;
  const cookieSameSite = config.cookie?.sameSite ?? 'lax';

  // Expiration configuration
  const ttl = config.expiration?.ttl ?? DEFAULT_SESSION_TTL;
  const sliding = config.expiration?.sliding ?? true;
  const absoluteTimeout = config.expiration?.absoluteTimeout;

  // Security validation: SameSite=none requires Secure
  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error(
      'Session cookie with SameSite=none requires Secure flag. ' +
        'Set cookie.secure: true or use a different SameSite policy.'
    );
  }

  /**
   * Set session cookie
   */
  function setCookie(reply: FastifyReplyWithCookies, signedId: string): void {
    reply.cookie(cookieName, signedId, {
      path: cookiePath,
      domain: cookieDomain,
      secure: cookieSecure,
      httpOnly: cookieHttpOnly,
      sameSite: cookieSameSite,
      maxAge: ttl,
    });
  }

  /**
   * Clear session cookie
   */
  function clearCookie(reply: FastifyReplyWithCookies): void {
    reply.clearCookie(cookieName, {
      path: cookiePath,
      domain: cookieDomain,
    });
  }

  /**
   * Create a Session handle
   */
  function createSessionHandle(
    sessionId: string,
    data: SessionData,
    expiresAt: number,
    isNew: boolean,
    reply: FastifyReplyWithCookies
  ): Session {
    let modified = isNew;
    let destroyed = false;
    let currentId = sessionId;
    let currentData = { ...data };
    let currentExpiresAt = expiresAt;

    // Move flash data to old flash for reading
    if (currentData._flash) {
      currentData._flashOld = currentData._flash;
      delete currentData._flash;
      modified = true;
    }

    const session: Session = {
      get id() {
        return currentId;
      },
      get isNew() {
        return isNew;
      },
      get isModified() {
        return modified;
      },
      get isDestroyed() {
        return destroyed;
      },
      get data() {
        return currentData;
      },

      get<K extends keyof SessionData>(key: K): SessionData[K] {
        return currentData[key] as SessionData[K];
      },

      set<K extends keyof SessionData>(key: K, value: SessionData[K]): void {
        if (destroyed) {
          throw new AuthError('Cannot modify destroyed session', 400, 'SESSION_DESTROYED');
        }
        currentData[key] = value;
        modified = true;
      },

      delete<K extends keyof SessionData>(key: K): void {
        if (destroyed) {
          throw new AuthError('Cannot modify destroyed session', 400, 'SESSION_DESTROYED');
        }
        delete currentData[key];
        modified = true;
      },

      has<K extends keyof SessionData>(key: K): boolean {
        return key in currentData;
      },

      flash(key: string, value: unknown): void {
        if (destroyed) {
          throw new AuthError('Cannot modify destroyed session', 400, 'SESSION_DESTROYED');
        }
        if (!currentData._flash) {
          currentData._flash = {};
        }
        currentData._flash[key] = value;
        modified = true;
      },

      getFlash<T = unknown>(key: string): T | undefined {
        const value = currentData._flashOld?.[key] as T | undefined;
        return value;
      },

      getAllFlash(): Record<string, unknown> {
        return currentData._flashOld ?? {};
      },

      async regenerate(): Promise<void> {
        if (destroyed) {
          throw new AuthError('Cannot regenerate destroyed session', 400, 'SESSION_DESTROYED');
        }

        // Delete old session
        await store.delete(currentId);

        // Generate new ID
        const newSessionId = generateSessionId();
        const newSignedId = signSessionId(newSessionId, config.secret);

        // Update tracking
        currentId = newSessionId;
        currentData._lastAccessedAt = Date.now();
        modified = true;

        // Set new cookie
        setCookie(reply, newSignedId);

        // Save with new ID
        await store.set(currentId, {
          id: currentId,
          data: currentData,
          expiresAt: currentExpiresAt,
        });
      },

      async destroy(): Promise<void> {
        await store.delete(currentId);
        clearCookie(reply);
        destroyed = true;
        currentData = {} as SessionData;
      },

      async save(): Promise<void> {
        if (destroyed) {
          return;
        }

        // Clear old flash data after it's been read
        delete currentData._flashOld;

        // Update last accessed time
        currentData._lastAccessedAt = Date.now();

        // Check absolute timeout
        if (absoluteTimeout) {
          const absoluteExpiresAt = currentData._createdAt + absoluteTimeout * 1000;
          if (Date.now() >= absoluteExpiresAt) {
            await session.destroy();
            throw new AuthError('Session has reached absolute timeout', 401, 'SESSION_EXPIRED');
          }
          // Cap expiration at absolute timeout
          currentExpiresAt = Math.min(currentExpiresAt, absoluteExpiresAt);
        }

        // Update sliding expiration
        if (sliding) {
          currentExpiresAt = Date.now() + ttl * 1000;
        }

        await store.set(currentId, {
          id: currentId,
          data: currentData,
          expiresAt: currentExpiresAt,
        });

        // Refresh cookie with new expiration
        const signedId = signSessionId(currentId, config.secret);
        setCookie(reply, signedId);

        modified = false;
      },

      async reload(): Promise<void> {
        if (destroyed) {
          throw new AuthError('Cannot reload destroyed session', 400, 'SESSION_DESTROYED');
        }

        const stored = await store.get(currentId);
        if (!stored) {
          throw new AuthError('Session not found', 401, 'SESSION_NOT_FOUND');
        }

        currentData = { ...stored.data };
        currentExpiresAt = stored.expiresAt;
        modified = false;
      },

      // Authentication Methods (Laravel-style fluent API)

      async login(user: User): Promise<void> {
        // Regenerate session ID to prevent session fixation
        await session.regenerate();

        // Store user info in session
        session.set('userId', user.id);
        session.set('userEmail', user.email);

        // Save immediately
        await session.save();
      },

      async logout(): Promise<void> {
        await session.destroy();
      },

      check(): boolean {
        return !!session.get('userId');
      },
    };

    return session;
  }

  return {
    store,

    createSession(reply: FastifyReplyWithCookies): Session {
      const sessionId = generateSessionId();
      const signedId = signSessionId(sessionId, config.secret);
      const now = Date.now();
      const expiresAt = now + ttl * 1000;

      const data: SessionData = {
        _createdAt: now,
        _lastAccessedAt: now,
      };

      // Set cookie
      setCookie(reply, signedId);

      return createSessionHandle(sessionId, data, expiresAt, true, reply);
    },

    async loadSession(request: FastifyRequestWithCookies): Promise<Session | null> {
      const signedId = request.cookies[cookieName];
      if (!signedId) {
        return null;
      }

      // Verify signature and extract session ID
      const sessionId = verifySessionId(signedId, config.secret);
      if (!sessionId) {
        return null;
      }

      // Validate session ID entropy
      if (!validateSessionIdEntropy(sessionId)) {
        return null;
      }

      // Load from store
      const stored = await store.get(sessionId);
      if (!stored) {
        return null;
      }

      // Check expiration
      if (stored.expiresAt <= Date.now()) {
        await store.delete(sessionId);
        return null;
      }

      // We need reply for the session handle, but loadSession doesn't have it
      // This is intentional - loadSession is for checking only
      // Use getOrCreateSession for full session handling
      return null;
    },

    async getOrCreateSession(
      request: FastifyRequestWithCookies,
      reply: FastifyReplyWithCookies
    ): Promise<Session> {
      const signedId = request.cookies[cookieName];

      if (signedId) {
        // Verify signature
        const sessionId = verifySessionId(signedId, config.secret);

        if (sessionId && validateSessionIdEntropy(sessionId)) {
          // Load from store
          const stored = await store.get(sessionId);

          if (stored && stored.expiresAt > Date.now()) {
            // Check absolute timeout before returning
            if (absoluteTimeout) {
              const absoluteExpiresAt = stored.data._createdAt + absoluteTimeout * 1000;
              if (Date.now() >= absoluteExpiresAt) {
                await store.delete(sessionId);
                clearCookie(reply);
                // Create new session
                return this.createSession(reply);
              }
            }

            return createSessionHandle(sessionId, stored.data, stored.expiresAt, false, reply);
          }
        }
      }

      // Create new session
      return this.createSession(reply);
    },

    async destroySession(sessionId: string): Promise<void> {
      await store.delete(sessionId);
    },

    async destroyUserSessions(userId: string): Promise<void> {
      if (store.deleteSessionsByUser) {
        await store.deleteSessionsByUser(userId);
      } else if (store.getSessionsByUser) {
        const sessions = await store.getSessionsByUser(userId);
        for (const sessionId of sessions) {
          await store.delete(sessionId);
        }
      }
      // If store doesn't support user session tracking, silently skip
    },

    clearCookie,
  };
}

// ============================================================================
// Session Context Types
// ============================================================================

/**
 * Session context added to request context
 */
export interface SessionContext {
  /** Current session */
  session: Session;
}

/**
 * Extended context with session and optional user
 */
export interface SessionAuthContext extends SessionContext {
  /** Authenticated user (if logged in) */
  user?: User;
  /** Whether user is authenticated via session */
  isAuthenticated: boolean;
}

// ============================================================================
// Context Declaration Merging
// ============================================================================

declare module '@veloxts/core' {
  interface BaseContext {
    /** Session context - available when session middleware is used */
    session?: Session;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Session on request */
    session?: Session;
  }
}

// ============================================================================
// Session Middleware Options
// ============================================================================

/**
 * Options for session middleware
 */
export interface SessionMiddlewareOptions {
  /**
   * Create session lazily (only when data is set)
   * @default false
   */
  lazy?: boolean;

  /**
   * Require authentication (session with userId)
   * @default false
   */
  requireAuth?: boolean;
}

// ============================================================================
// Session Middleware Factory
// ============================================================================

/**
 * Creates session middleware for procedures (succinct API)
 *
 * @example
 * ```typescript
 * const session = sessionMiddleware({
 *   secret: process.env.SESSION_SECRET!,
 *   cookie: { secure: true },
 * });
 *
 * // Use in procedures
 * const getCart = procedure()
 *   .use(session.middleware())
 *   .query(async ({ ctx }) => {
 *     return ctx.session.get('cart') ?? [];
 *   });
 *
 * // Require authentication
 * const getProfile = procedure()
 *   .use(session.requireAuth())
 *   .query(async ({ ctx }) => {
 *     return ctx.user;
 *   });
 * ```
 */
export function sessionMiddleware(config: SessionConfig) {
  const manager = createSessionManager(config);

  /**
   * Base session middleware
   */
  function middleware<TInput, TContext extends BaseContext, TOutput>(
    options: SessionMiddlewareOptions = {}
  ): MiddlewareFunction<TInput, TContext, TContext & SessionContext, TOutput> {
    return async ({ ctx, next }) => {
      // Validate @fastify/cookie plugin is registered and get typed context
      const { request, reply } = getValidatedCookieContext(ctx.request, ctx.reply, {
        middlewareName: 'Session middleware',
      });

      let session: Session;

      if (options.lazy) {
        // Lazy mode: only create session if accessed
        // This requires a proxy to detect access
        let realSession: Session | null = null;

        const lazySession = new Proxy({} as Session, {
          get(_target, prop) {
            if (!realSession) {
              // Create session on first access
              // Note: This is synchronous, so we can't use getOrCreateSession
              // For lazy mode, we create a new session
              realSession = manager.createSession(reply);
            }
            const value = realSession[prop as keyof Session];
            if (typeof value === 'function') {
              return value.bind(realSession);
            }
            return value;
          },
        });

        session = lazySession;
      } else {
        session = await manager.getOrCreateSession(request, reply);
      }

      // Attach to request for hooks
      request.session = session;

      try {
        const result = await next({
          ctx: {
            ...ctx,
            session,
          },
        });

        // Auto-save session if modified
        if (session.isModified && !session.isDestroyed) {
          await session.save();
        }

        return result;
      } catch (error) {
        // Still try to save session on error
        if (session.isModified && !session.isDestroyed) {
          try {
            await session.save();
          } catch {
            // Ignore save errors during error handling
          }
        }
        throw error;
      }
    };
  }

  /**
   * Middleware that requires authentication
   */
  function requireAuth<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & SessionAuthContext,
    TOutput
  > {
    return async ({ ctx, next }) => {
      // Validate @fastify/cookie plugin is registered and get typed context
      const { request, reply } = getValidatedCookieContext(ctx.request, ctx.reply, {
        middlewareName: 'Session middleware',
      });

      const session = await manager.getOrCreateSession(request, reply);

      // Check if session has userId
      const userId = session.get('userId');
      if (!userId) {
        throw new AuthError('Authentication required', 401, 'SESSION_UNAUTHORIZED');
      }

      // Load user if userLoader provided
      let user: User | undefined;
      if (config.userLoader) {
        const loadedUser = await config.userLoader(userId);
        if (!loadedUser) {
          // User no longer exists - destroy session
          await session.destroy();
          throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
        }
        user = loadedUser;
      } else {
        // Create minimal user from session
        user = {
          id: userId,
          email: session.get('userEmail') ?? '',
        };
      }

      request.session = session;

      try {
        const result = await next({
          ctx: {
            ...ctx,
            session,
            user,
            isAuthenticated: true,
          },
        });

        if (session.isModified && !session.isDestroyed) {
          await session.save();
        }

        return result;
      } catch (error) {
        if (session.isModified && !session.isDestroyed) {
          try {
            await session.save();
          } catch {
            // Ignore
          }
        }
        throw error;
      }
    };
  }

  /**
   * Middleware for optional authentication
   */
  function optionalAuth<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & SessionAuthContext,
    TOutput
  > {
    return async ({ ctx, next }) => {
      // Validate @fastify/cookie plugin is registered and get typed context
      const { request, reply } = getValidatedCookieContext(ctx.request, ctx.reply, {
        middlewareName: 'Session middleware',
      });

      const session = await manager.getOrCreateSession(request, reply);
      const userId = session.get('userId');

      let user: User | undefined;
      let isAuthenticated = false;

      if (userId) {
        if (config.userLoader) {
          const loadedUser = await config.userLoader(userId);
          if (loadedUser) {
            user = loadedUser;
            isAuthenticated = true;
          }
        } else {
          user = {
            id: userId,
            email: session.get('userEmail') ?? '',
          };
          isAuthenticated = true;
        }
      }

      request.session = session;

      try {
        const result = await next({
          ctx: {
            ...ctx,
            session,
            user,
            isAuthenticated,
          },
        });

        if (session.isModified && !session.isDestroyed) {
          await session.save();
        }

        return result;
      } catch (error) {
        if (session.isModified && !session.isDestroyed) {
          try {
            await session.save();
          } catch {
            // Ignore
          }
        }
        throw error;
      }
    };
  }

  return {
    /** Session manager instance */
    manager,
    /** Base session middleware */
    middleware,
    /** Authentication required middleware */
    requireAuth,
    /** Optional authentication middleware */
    optionalAuth,
  };
}

// ============================================================================
// Session Helper Functions (Deprecated - use Session methods instead)
// ============================================================================

/**
 * Login helper - sets user in session and regenerates ID
 *
 * @deprecated Use `session.login(user)` instead for a more fluent API.
 *
 * @example
 * ```typescript
 * // Old way (deprecated)
 * await loginSession(ctx.session, user);
 *
 * // New way (preferred)
 * await ctx.session.login(user);
 * ```
 */
export async function loginSession(session: Session, user: User): Promise<void> {
  await session.login(user);
}

/**
 * Logout helper - destroys session
 *
 * @deprecated Use `session.logout()` instead for a more fluent API.
 *
 * @example
 * ```typescript
 * // Old way (deprecated)
 * await logoutSession(ctx.session);
 *
 * // New way (preferred)
 * await ctx.session.logout();
 * ```
 */
export async function logoutSession(session: Session): Promise<void> {
  await session.logout();
}

/**
 * Check if session is authenticated
 *
 * @deprecated Use `session.check()` instead for a more fluent API.
 *
 * @example
 * ```typescript
 * // Old way (deprecated)
 * if (isSessionAuthenticated(ctx.session)) { ... }
 *
 * // New way (preferred)
 * if (ctx.session.check()) { ... }
 * ```
 */
export function isSessionAuthenticated(session: Session): boolean {
  return session.check();
}

// ============================================================================
// Succinct Aliases (Laravel-style)
// ============================================================================

/**
 * Creates a session manager (succinct alias)
 *
 * @example
 * ```typescript
 * const manager = sessionManager({
 *   secret: process.env.SESSION_SECRET!,
 *   cookie: {
 *     name: 'myapp.session',
 *     secure: true,
 *     sameSite: 'strict',
 *   },
 *   expiration: {
 *     ttl: 3600, // 1 hour
 *     sliding: true,
 *   },
 * });
 * ```
 */
export const sessionManager = createSessionManager;

/**
 * In-memory session store for development and testing (succinct alias)
 *
 * WARNING: NOT suitable for production!
 * - Sessions are lost on server restart
 * - Does not work across multiple server instances
 * - No persistence mechanism
 *
 * For production, use Redis or database-backed storage.
 *
 * @example
 * ```typescript
 * const store = inMemorySessionStore();
 *
 * const manager = sessionManager({
 *   store,
 *   secret: process.env.SESSION_SECRET!,
 * });
 * ```
 */
export const inMemorySessionStore = createInMemorySessionStore;
