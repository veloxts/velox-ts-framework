/**
 * Session type definitions
 *
 * Core types for cookie-based session management.
 *
 * @module session/types
 */

import type { User } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Session ID entropy in bytes (32 bytes = 256 bits)
 * Provides sufficient entropy to prevent brute-force attacks
 */
export const SESSION_ID_BYTES = 32;

/**
 * Minimum secret length for session ID signing (32 characters)
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * Default session TTL (24 hours in seconds)
 */
export const DEFAULT_SESSION_TTL = 86400;

/**
 * Default cookie name
 */
export const DEFAULT_COOKIE_NAME = 'velox.session';

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
// Session Handle Interface
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
