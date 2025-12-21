/**
 * Tests for Cookie-based Session Management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  inMemorySessionStore,
  isSessionAuthenticated,
  type Session,
  type SessionConfig,
  type SessionStore,
  type StoredSession,
  sessionManager,
  sessionMiddleware,
} from '../session.js';

describe('Session Management', () => {
  // 64+ character secret for security requirements
  const validSecret =
    'this-is-a-very-long-session-secret-key-for-testing-purposes-with-extra-chars';

  const defaultConfig: SessionConfig = {
    secret: validSecret,
  };

  // Mock FastifyReply
  function createMockReply() {
    const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
    const mockReply = {
      cookie: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
        cookies[name] = { value, options };
        return mockReply;
      }),
      clearCookie: vi.fn((name: string, _options: Record<string, unknown>) => {
        delete cookies[name];
        return mockReply;
      }),
      _cookies: cookies,
    };
    return mockReply;
  }

  // Mock FastifyRequest
  function createMockRequest(options: { cookies?: Record<string, string> } = {}) {
    return {
      cookies: options.cookies ?? {},
    };
  }

  describe('inMemorySessionStore', () => {
    let store: SessionStore;

    beforeEach(() => {
      store = inMemorySessionStore();
    });

    it('should create a store with all required methods', () => {
      expect(store.get).toBeDefined();
      expect(store.set).toBeDefined();
      expect(store.delete).toBeDefined();
      expect(store.touch).toBeDefined();
      expect(store.clear).toBeDefined();
      expect(store.getSessionsByUser).toBeDefined();
      expect(store.deleteSessionsByUser).toBeDefined();
    });

    it('should store and retrieve session data', async () => {
      const now = Date.now();
      const sessionData: StoredSession = {
        id: 'session-1',
        data: {
          userId: 'user-123',
          _createdAt: now,
          _lastAccessedAt: now,
        },
        expiresAt: now + 3600000, // 1 hour
      };

      await store.set('session-1', sessionData);
      const retrieved = await store.get('session-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.data.userId).toBe('user-123');
    });

    it('should return null for non-existent session', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete sessions', async () => {
      const now = Date.now();
      const sessionData: StoredSession = {
        id: 'session-1',
        data: { _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      };

      await store.set('session-1', sessionData);
      await store.delete('session-1');

      const result = await store.get('session-1');
      expect(result).toBeNull();
    });

    it('should touch (refresh) session TTL', async () => {
      const now = Date.now();
      const sessionData: StoredSession = {
        id: 'session-1',
        data: { _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      };

      await store.set('session-1', sessionData);
      await store.touch('session-1', now + 7200000); // Extend to 2 hours

      const result = await store.get('session-1');
      expect(result).not.toBeNull();
      expect(result?.expiresAt).toBe(now + 7200000);
    });

    it('should clear all sessions', async () => {
      const now = Date.now();

      await store.set('session-1', {
        id: 'session-1',
        data: { _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });
      await store.set('session-2', {
        id: 'session-2',
        data: { _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });
      await store.clear();

      expect(await store.get('session-1')).toBeNull();
      expect(await store.get('session-2')).toBeNull();
    });

    it('should track user sessions', async () => {
      const now = Date.now();

      await store.set('session-1', {
        id: 'session-1',
        data: { userId: 'user-123', _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });
      await store.set('session-2', {
        id: 'session-2',
        data: { userId: 'user-123', _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });
      await store.set('session-3', {
        id: 'session-3',
        data: { userId: 'user-456', _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });

      const userSessions = await store.getSessionsByUser?.('user-123');
      expect(userSessions).toHaveLength(2);
      expect(userSessions).toContain('session-1');
      expect(userSessions).toContain('session-2');
    });

    it('should delete all sessions for a user', async () => {
      const now = Date.now();

      await store.set('session-1', {
        id: 'session-1',
        data: { userId: 'user-123', _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });
      await store.set('session-2', {
        id: 'session-2',
        data: { userId: 'user-123', _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 3600000,
      });

      await store.deleteSessionsByUser?.('user-123');

      expect(await store.get('session-1')).toBeNull();
      expect(await store.get('session-2')).toBeNull();
    });

    it('should expire sessions after TTL', async () => {
      vi.useFakeTimers();

      const now = Date.now();
      await store.set('session-1', {
        id: 'session-1',
        data: { _createdAt: now, _lastAccessedAt: now },
        expiresAt: now + 1000, // 1 second TTL
      });

      // Advance time past expiration
      vi.advanceTimersByTime(2000);

      const result = await store.get('session-1');
      expect(result).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('sessionManager', () => {
    describe('constructor', () => {
      it('should throw if secret is too short', () => {
        expect(() =>
          sessionManager({
            secret: 'short',
          })
        ).toThrow('Session secret must be at least 32 characters');
      });

      it('should create manager with valid config', () => {
        const manager = sessionManager(defaultConfig);
        expect(manager).toBeDefined();
        expect(manager.createSession).toBeDefined();
        expect(manager.loadSession).toBeDefined();
        expect(manager.getOrCreateSession).toBeDefined();
      });

      it('should accept custom store', () => {
        const customStore = inMemorySessionStore();
        const manager = sessionManager({
          ...defaultConfig,
          store: customStore,
        });
        expect(manager).toBeDefined();
      });
    });

    describe('createSession', () => {
      it('should create a new session', () => {
        const manager = sessionManager(defaultConfig);
        const reply = createMockReply();

        const session = manager.createSession(reply as never);

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.id.length).toBeGreaterThan(0);
        expect(session.isNew).toBe(true);
        expect(session.isDestroyed).toBe(false);
      });

      it('should set session cookie', () => {
        const manager = sessionManager(defaultConfig);
        const reply = createMockReply();

        manager.createSession(reply as never);

        expect(reply.cookie).toHaveBeenCalledWith(
          'velox.session',
          expect.any(String),
          expect.objectContaining({
            httpOnly: true,
            path: '/',
          })
        );
      });

      it('should use custom cookie options', () => {
        const manager = sessionManager({
          ...defaultConfig,
          cookie: {
            name: 'custom.session',
            secure: true,
            sameSite: 'strict',
            path: '/app',
            domain: 'example.com',
          },
        });
        const reply = createMockReply();

        manager.createSession(reply as never);

        expect(reply.cookie).toHaveBeenCalledWith(
          'custom.session',
          expect.any(String),
          expect.objectContaining({
            secure: true,
            sameSite: 'strict',
            path: '/app',
            domain: 'example.com',
          })
        );
      });

      it('should generate unique session IDs', () => {
        const manager = sessionManager(defaultConfig);
        const reply1 = createMockReply();
        const reply2 = createMockReply();

        const session1 = manager.createSession(reply1 as never);
        const session2 = manager.createSession(reply2 as never);

        expect(session1.id).not.toBe(session2.id);
      });
    });

    describe('loadSession', () => {
      it('should return null when no cookie', async () => {
        const manager = sessionManager(defaultConfig);
        const request = createMockRequest({});

        const session = await manager.loadSession(request as never);

        expect(session).toBeNull();
      });

      it('should return null for invalid session ID', async () => {
        const manager = sessionManager(defaultConfig);
        const request = createMockRequest({
          cookies: { 'velox.session': 'invalid-session-id' },
        });

        const session = await manager.loadSession(request as never);

        expect(session).toBeNull();
      });

      it('should load valid session via getOrCreateSession', async () => {
        const manager = sessionManager(defaultConfig);
        const reply = createMockReply();

        // Create session
        const createdSession = manager.createSession(reply as never);
        createdSession.set('userId', 'user-123');
        await createdSession.save();

        // Get the signed session ID from cookie
        const signedId = reply._cookies['velox.session'].value;

        // Load session via getOrCreateSession (requires reply for full session handling)
        const request = createMockRequest({
          cookies: { 'velox.session': signedId },
        });
        const loadedSession = await manager.getOrCreateSession(request as never, reply as never);

        expect(loadedSession).not.toBeNull();
        expect(loadedSession.id).toBe(createdSession.id);
        expect(loadedSession.get('userId')).toBe('user-123');
      });
    });

    describe('getOrCreateSession', () => {
      it('should create session when none exists', async () => {
        const manager = sessionManager(defaultConfig);
        const request = createMockRequest({});
        const reply = createMockReply();

        const session = await manager.getOrCreateSession(request as never, reply as never);

        expect(session).toBeDefined();
        expect(session.isNew).toBe(true);
      });

      it('should load existing session', async () => {
        const manager = sessionManager(defaultConfig);
        const reply = createMockReply();

        // Create session first
        const createdSession = manager.createSession(reply as never);
        createdSession.set('userId', 'user-123');
        await createdSession.save();

        const signedId = reply._cookies['velox.session'].value;

        // Get or create should load existing
        const request = createMockRequest({
          cookies: { 'velox.session': signedId },
        });
        const loadedSession = await manager.getOrCreateSession(request as never, reply as never);

        expect(loadedSession.id).toBe(createdSession.id);
        expect(loadedSession.isNew).toBe(false);
      });
    });

    describe('destroySession', () => {
      it('should destroy session by ID', async () => {
        const manager = sessionManager(defaultConfig);
        const reply = createMockReply();

        const session = manager.createSession(reply as never);
        await session.save();

        await manager.destroySession(session.id);

        // Session should no longer exist
        const signedId = reply._cookies['velox.session'].value;
        const request = createMockRequest({
          cookies: { 'velox.session': signedId },
        });
        const loadedSession = await manager.loadSession(request as never);

        expect(loadedSession).toBeNull();
      });
    });

    describe('destroyUserSessions', () => {
      it('should destroy all sessions for a user', async () => {
        const manager = sessionManager(defaultConfig);
        const reply1 = createMockReply();
        const reply2 = createMockReply();

        // Create two sessions for same user
        const session1 = manager.createSession(reply1 as never);
        session1.set('userId', 'user-123');
        await session1.save();

        const session2 = manager.createSession(reply2 as never);
        session2.set('userId', 'user-123');
        await session2.save();

        // Destroy all user sessions
        await manager.destroyUserSessions('user-123');

        // Both sessions should be gone
        const signedId1 = reply1._cookies['velox.session'].value;
        const request1 = createMockRequest({ cookies: { 'velox.session': signedId1 } });
        expect(await manager.loadSession(request1 as never)).toBeNull();

        const signedId2 = reply2._cookies['velox.session'].value;
        const request2 = createMockRequest({ cookies: { 'velox.session': signedId2 } });
        expect(await manager.loadSession(request2 as never)).toBeNull();
      });
    });
  });

  describe('Session', () => {
    let manager: ReturnType<typeof sessionManager>;
    let session: Session;
    let reply: ReturnType<typeof createMockReply>;

    beforeEach(() => {
      manager = sessionManager(defaultConfig);
      reply = createMockReply();
      session = manager.createSession(reply as never);
    });

    describe('get/set/delete/has', () => {
      it('should set and get values', () => {
        session.set('userId', 'user-123');
        expect(session.get('userId')).toBe('user-123');
      });

      it('should mark session as modified after set', () => {
        session.set('userId', 'user-123');
        expect(session.isModified).toBe(true);
      });

      it('should delete values', () => {
        session.set('userId', 'user-123');
        session.delete('userId');
        expect(session.get('userId')).toBeUndefined();
      });

      it('should check if key exists', () => {
        expect(session.has('userId')).toBe(false);
        session.set('userId', 'user-123');
        expect(session.has('userId')).toBe(true);
      });
    });

    describe('flash data', () => {
      it('should set flash data', () => {
        session.flash('message', 'Hello!');
        // Flash data is stored in _flash, read from _flashOld on next request
        expect(session.data._flash?.message).toBe('Hello!');
      });

      it('should get flash data from previous request', async () => {
        // Set flash
        session.flash('message', 'Hello!');
        await session.save();

        // Load session (simulates new request) via getOrCreateSession
        const signedId = reply._cookies['velox.session'].value;
        const request = createMockRequest({
          cookies: { 'velox.session': signedId },
        });
        const loadedSession = await manager.getOrCreateSession(request as never, reply as never);

        // Flash data should now be available
        expect(loadedSession.getFlash('message')).toBe('Hello!');
      });

      it('should clear flash data after save', async () => {
        // Flash data pattern:
        // 1. Set flash in current request (_flash)
        // 2. On next request, _flash moves to _flashOld
        // 3. After save(), _flashOld is cleared
        session.flash('message', 'Hello!');
        await session.save();

        const signedId = reply._cookies['velox.session'].value;
        const request = createMockRequest({
          cookies: { 'velox.session': signedId },
        });

        // Load session - _flash moves to _flashOld
        const loadedSession = await manager.getOrCreateSession(request as never, reply as never);

        // Flash is available
        expect(loadedSession.getFlash('message')).toBe('Hello!');

        // Save clears _flashOld
        await loadedSession.save();

        // Load again - should have no flash data
        const loadedSession2 = await manager.getOrCreateSession(request as never, reply as never);
        expect(loadedSession2.getFlash('message')).toBeUndefined();
      });
    });

    describe('regenerate', () => {
      it('should create new session ID', async () => {
        const oldId = session.id;
        session.set('userId', 'user-123');
        await session.regenerate();

        expect(session.id).not.toBe(oldId);
        expect(session.get('userId')).toBe('user-123'); // Data preserved
      });

      it('should update cookie with new ID', async () => {
        await session.regenerate();
        // Cookie should be set with new value
        expect(reply.cookie).toHaveBeenCalledTimes(2); // Initial + regenerate
      });
    });

    describe('destroy', () => {
      it('should mark session as destroyed', async () => {
        await session.destroy();
        expect(session.isDestroyed).toBe(true);
      });

      it('should clear session cookie', async () => {
        await session.destroy();
        expect(reply.clearCookie).toHaveBeenCalledWith('velox.session', expect.any(Object));
      });
    });

    describe('save', () => {
      it('should persist session to store', async () => {
        session.set('userId', 'user-123');
        await session.save();

        // Load in new request via getOrCreateSession
        const signedId = reply._cookies['velox.session'].value;
        const request = createMockRequest({ cookies: { 'velox.session': signedId } });
        const loaded = await manager.getOrCreateSession(request as never, reply as never);

        expect(loaded.get('userId')).toBe('user-123');
      });
    });

    describe('reload', () => {
      it('should reload data from store', async () => {
        session.set('userId', 'user-123');
        await session.save();

        // Now we need to simulate an external modification to the store
        // Since the session handle maintains internal state, reload should
        // fetch fresh data from the store.

        // Get the store and directly modify the stored session
        const store = manager.store;
        const storedSession = await store.get(session.id);

        if (storedSession) {
          // Create a new object to avoid reference sharing
          const modifiedSession = {
            id: storedSession.id,
            data: { ...storedSession.data, userId: 'externally-modified' },
            expiresAt: storedSession.expiresAt,
          };
          await store.set(session.id, modifiedSession);
        }

        // Local data is unchanged (verify session handle still has old value)
        expect(session.get('userId')).toBe('user-123');

        // Reload from store - should get externally modified data
        await session.reload();
        expect(session.get('userId')).toBe('externally-modified');
      });
    });
  });

  describe('sessionMiddleware', () => {
    it('should create middleware with required methods', () => {
      const middleware = sessionMiddleware(defaultConfig);

      expect(middleware.middleware).toBeDefined();
      expect(middleware.requireAuth).toBeDefined();
      expect(middleware.optionalAuth).toBeDefined();
      expect(middleware.manager).toBeDefined();
    });

    it('should expose manager instance', () => {
      const middleware = sessionMiddleware(defaultConfig);

      expect(middleware.manager.createSession).toBeDefined();
      expect(middleware.manager.loadSession).toBeDefined();
    });
  });

  describe('isSessionAuthenticated', () => {
    it('should return true for session with userId', () => {
      const manager = sessionManager(defaultConfig);
      const reply = createMockReply();
      const session = manager.createSession(reply as never);

      session.set('userId', 'user-123');

      expect(isSessionAuthenticated(session)).toBe(true);
    });

    it('should return false for session without userId', () => {
      const manager = sessionManager(defaultConfig);
      const reply = createMockReply();
      const session = manager.createSession(reply as never);

      expect(isSessionAuthenticated(session)).toBe(false);
    });
  });

  describe('security', () => {
    it('should sign session ID with HMAC', () => {
      const manager = sessionManager(defaultConfig);
      const reply = createMockReply();

      manager.createSession(reply as never);

      const signedId = reply._cookies['velox.session'].value;
      expect(signedId).toContain('.'); // Format: sessionId.signature
    });

    it('should reject tampered session ID', async () => {
      const manager = sessionManager(defaultConfig);
      const reply = createMockReply();

      const session = manager.createSession(reply as never);
      await session.save();

      const signedId = reply._cookies['velox.session'].value;
      const [sessionId, _signature] = signedId.split('.');

      // Tamper with session ID
      const tamperedId = `${sessionId}x.invalidsignature`;

      const request = createMockRequest({
        cookies: { 'velox.session': tamperedId },
      });
      const loaded = await manager.loadSession(request as never);

      expect(loaded).toBeNull();
    });

    it('should reject session from different secret', async () => {
      const manager1 = sessionManager({ secret: validSecret });
      const manager2 = sessionManager({ secret: `${validSecret}-different` });

      const reply = createMockReply();
      const session = manager1.createSession(reply as never);
      await session.save();

      const signedId = reply._cookies['velox.session'].value;
      const request = createMockRequest({
        cookies: { 'velox.session': signedId },
      });

      // Manager with different secret should not load
      const loaded = await manager2.loadSession(request as never);
      expect(loaded).toBeNull();
    });

    it('should handle sliding expiration', async () => {
      vi.useFakeTimers();

      const store = inMemorySessionStore();
      const manager = sessionManager({
        ...defaultConfig,
        store,
        expiration: {
          ttl: 60, // 1 minute
          sliding: true,
        },
      });

      const reply = createMockReply();
      const session = manager.createSession(reply as never);
      session.set('userId', 'test');
      await session.save();

      const signedId = reply._cookies['velox.session'].value;

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      // Load session (should refresh TTL) via getOrCreateSession
      const request = createMockRequest({
        cookies: { 'velox.session': signedId },
      });
      const loaded = await manager.getOrCreateSession(request as never, reply as never);
      expect(loaded).not.toBeNull();
      // Save to trigger sliding expiration update
      await loaded.save();

      // Advance another 45 seconds (would be expired without sliding)
      vi.advanceTimersByTime(45000);

      // Should still be valid due to sliding expiration
      const loaded2 = await manager.getOrCreateSession(request as never, reply as never);
      expect(loaded2).not.toBeNull();

      vi.useRealTimers();
    });

    it('should enforce absolute timeout', async () => {
      vi.useFakeTimers();

      const store = inMemorySessionStore();
      const manager = sessionManager({
        ...defaultConfig,
        store,
        expiration: {
          ttl: 3600, // 1 hour
          absoluteTimeout: 120, // 2 minute absolute timeout
          sliding: true,
        },
      });

      const reply = createMockReply();
      const session = manager.createSession(reply as never);
      session.set('userId', 'test');
      await session.save();

      const signedId = reply._cookies['velox.session'].value;

      // Advance past absolute timeout
      vi.advanceTimersByTime(130000); // 2+ minutes

      // Session should be expired
      const request = createMockRequest({
        cookies: { 'velox.session': signedId },
      });
      const loaded = await manager.loadSession(request as never);
      expect(loaded).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('SameSite=none validation', () => {
    it('should throw when SameSite=none without Secure flag', () => {
      expect(() =>
        sessionManager({
          secret: validSecret,
          cookie: {
            sameSite: 'none',
            secure: false,
          },
        })
      ).toThrow('SameSite=none requires Secure flag');
    });

    it('should allow SameSite=none with Secure flag', () => {
      expect(() =>
        sessionManager({
          secret: validSecret,
          cookie: {
            sameSite: 'none',
            secure: true,
          },
        })
      ).not.toThrow();
    });
  });
});
