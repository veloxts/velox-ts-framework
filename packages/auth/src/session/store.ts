/**
 * Session storage backends
 *
 * Provides pluggable session storage interfaces and implementations.
 *
 * @module session/store
 */

import type { StoredSession } from './types.js';

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
export function inMemorySessionStore(): SessionStore {
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
