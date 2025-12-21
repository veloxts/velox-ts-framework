/**
 * Tests for CSRF protection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCsrfManager,
  type CsrfConfig,
  CsrfError,
  type CsrfManager,
  csrfMiddleware,
} from '../csrf.js';

describe('CSRF Protection', () => {
  // 64+ character secret for security requirements
  const validSecret = 'this-is-a-very-long-csrf-secret-key-for-testing-purposes-with-extra-chars';

  const defaultConfig: CsrfConfig = {
    token: { secret: validSecret },
  };

  // Mock FastifyReply
  function createMockReply() {
    const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
    return {
      cookie: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
        cookies[name] = { value, options };
      }),
      clearCookie: vi.fn(),
      _cookies: cookies,
    };
  }

  // Mock FastifyRequest
  function createMockRequest(
    options: {
      method?: string;
      url?: string;
      headers?: Record<string, string | undefined>;
      cookies?: Record<string, string>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      protocol?: string;
    } = {}
  ) {
    return {
      method: options.method ?? 'POST',
      url: options.url ?? '/api/submit',
      headers: options.headers ?? {},
      cookies: options.cookies ?? {},
      body: options.body,
      query: options.query,
      protocol: options.protocol ?? 'https',
    };
  }

  describe('createCsrfManager', () => {
    describe('constructor', () => {
      it('should throw if secret is too short', () => {
        expect(() =>
          createCsrfManager({
            token: { secret: 'short' },
          })
        ).toThrow('CSRF secret must be at least 32 characters');
      });

      it('should create manager with valid config', () => {
        const manager = createCsrfManager(defaultConfig);
        expect(manager).toBeDefined();
        expect(manager.generateToken).toBeDefined();
        expect(manager.validateToken).toBeDefined();
      });
    });

    describe('generateToken', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager(defaultConfig);
      });

      it('should generate a valid token', () => {
        const reply = createMockReply();
        const result = manager.generateToken(reply as never);

        expect(result.token).toBeDefined();
        expect(result.token.split('.')).toHaveLength(4);
        expect(result.expiresAt).toBeGreaterThan(0);
      });

      it('should set cookie with correct options', () => {
        const reply = createMockReply();
        manager.generateToken(reply as never);

        expect(reply.cookie).toHaveBeenCalledWith(
          'velox.csrf',
          expect.any(String),
          expect.objectContaining({
            path: '/',
            sameSite: 'lax',
            httpOnly: false,
          })
        );
      });

      it('should generate unique tokens', () => {
        const reply1 = createMockReply();
        const reply2 = createMockReply();

        const result1 = manager.generateToken(reply1 as never);
        const result2 = manager.generateToken(reply2 as never);

        expect(result1.token).not.toBe(result2.token);
      });

      it('should use custom cookie options', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          cookie: {
            name: 'custom-csrf',
            sameSite: 'strict',
            secure: true,
            httpOnly: true,
            path: '/app',
            domain: 'example.com',
          },
        });

        const reply = createMockReply();
        customManager.generateToken(reply as never);

        expect(reply.cookie).toHaveBeenCalledWith(
          'custom-csrf',
          expect.any(String),
          expect.objectContaining({
            path: '/app',
            sameSite: 'strict',
            secure: true,
            httpOnly: true,
            domain: 'example.com',
          })
        );
      });
    });

    describe('parseToken', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager(defaultConfig);
      });

      it('should parse valid token', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const parsed = manager.parseToken(token);

        expect(parsed).not.toBeNull();
        expect(parsed?.value).toBeDefined();
        expect(parsed?.issuedAt).toBeGreaterThan(0);
        expect(parsed?.expiresAt).toBeGreaterThan(0);
        expect(parsed?.signature).toBeDefined();
      });

      it('should return null for invalid token format', () => {
        expect(manager.parseToken('invalid')).toBeNull();
        expect(manager.parseToken('a.b.c')).toBeNull();
        expect(manager.parseToken('a.b.c.d.e')).toBeNull();
      });

      it('should return null for non-numeric timestamps', () => {
        expect(manager.parseToken('value.notanumber.123.sig')).toBeNull();
        expect(manager.parseToken('value.123.notanumber.sig')).toBeNull();
      });
    });

    describe('verifySignature', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager(defaultConfig);
      });

      it('should verify valid signature', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        expect(manager.verifySignature(token)).toBe(true);
      });

      it('should reject tampered token value', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const parts = token.split('.');
        parts[0] = 'tamperedvalue';
        const tamperedToken = parts.join('.');

        expect(manager.verifySignature(tamperedToken)).toBe(false);
      });

      it('should reject tampered timestamp', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const parts = token.split('.');
        parts[1] = '9999999999';
        const tamperedToken = parts.join('.');

        expect(manager.verifySignature(tamperedToken)).toBe(false);
      });

      it('should reject tampered signature', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const parts = token.split('.');
        parts[3] = 'invalidsignature';
        const tamperedToken = parts.join('.');

        expect(manager.verifySignature(tamperedToken)).toBe(false);
      });
    });

    describe('extractToken', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager(defaultConfig);
      });

      it('should extract token from header', () => {
        const request = createMockRequest({
          headers: { 'x-csrf-token': 'my-token' },
        });

        expect(manager.extractToken(request as never)).toBe('my-token');
      });

      it('should extract token from body', () => {
        const request = createMockRequest({
          body: { _csrf: 'my-token' },
        });

        expect(manager.extractToken(request as never)).toBe('my-token');
      });

      it('should prefer header over body', () => {
        const request = createMockRequest({
          headers: { 'x-csrf-token': 'header-token' },
          body: { _csrf: 'body-token' },
        });

        expect(manager.extractToken(request as never)).toBe('header-token');
      });

      it('should extract from query when enabled', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          validation: { queryFieldName: 'csrf' },
        });

        const request = createMockRequest({
          query: { csrf: 'query-token' },
        });

        expect(customManager.extractToken(request as never)).toBe('query-token');
      });

      it('should return null when no token found', () => {
        const request = createMockRequest({});
        expect(manager.extractToken(request as never)).toBeNull();
      });

      it('should use custom header name', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          validation: { headerName: 'x-custom-csrf' },
        });

        const request = createMockRequest({
          headers: { 'x-custom-csrf': 'custom-token' },
        });

        expect(customManager.extractToken(request as never)).toBe('custom-token');
      });
    });

    describe('validateToken', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager(defaultConfig);
      });

      it('should skip GET requests', () => {
        const request = createMockRequest({ method: 'GET' });
        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should skip HEAD requests', () => {
        const request = createMockRequest({ method: 'HEAD' });
        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should skip OPTIONS requests', () => {
        const request = createMockRequest({ method: 'OPTIONS' });
        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should validate POST requests', () => {
        const request = createMockRequest({ method: 'POST' });

        expect(() => manager.validateToken(request as never)).toThrow(CsrfError);
      });

      it('should validate PUT requests', () => {
        const request = createMockRequest({ method: 'PUT' });

        expect(() => manager.validateToken(request as never)).toThrow(CsrfError);
      });

      it('should validate PATCH requests', () => {
        const request = createMockRequest({ method: 'PATCH' });

        expect(() => manager.validateToken(request as never)).toThrow(CsrfError);
      });

      it('should validate DELETE requests', () => {
        const request = createMockRequest({ method: 'DELETE' });

        expect(() => manager.validateToken(request as never)).toThrow(CsrfError);
      });

      it('should throw CSRF_MISSING_COOKIE when no cookie', () => {
        const request = createMockRequest({
          method: 'POST',
          headers: { 'x-csrf-token': 'some-token' },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_MISSING_COOKIE');
        }
      });

      it('should throw CSRF_MISSING_TOKEN when no header/body token', () => {
        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': 'cookie-token' },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_MISSING_TOKEN');
        }
      });

      it('should throw CSRF_TOKEN_MISMATCH when tokens differ', () => {
        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': 'cookie-token' },
          headers: { 'x-csrf-token': 'different-token' },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_TOKEN_MISMATCH');
        }
      });

      it('should throw CSRF_INVALID_SIGNATURE for tampered token', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        // Tamper with the signature
        const parts = token.split('.');
        parts[3] = 'invalidsig';
        const tamperedToken = parts.join('.');

        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': tamperedToken },
          headers: { 'x-csrf-token': tamperedToken },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_INVALID_SIGNATURE');
        }
      });

      it('should throw CSRF_TOKEN_EXPIRED for expired token', () => {
        vi.useFakeTimers();

        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        // Advance time past expiration (1 hour + 1 second)
        vi.advanceTimersByTime(3600 * 1000 + 1000);

        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': token },
          headers: { 'x-csrf-token': token },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_TOKEN_EXPIRED');
        }

        vi.useRealTimers();
      });

      it('should pass validation for valid token', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': token },
          headers: { 'x-csrf-token': token },
        });

        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should skip excluded paths (string)', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          validation: { excludePaths: ['/health', '/webhooks'] },
        });

        const request = createMockRequest({
          method: 'POST',
          url: '/health',
        });

        expect(() => customManager.validateToken(request as never)).not.toThrow();
      });

      it('should skip excluded paths (regex)', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          validation: { excludePaths: [/^\/api\/webhooks\//] },
        });

        const request = createMockRequest({
          method: 'POST',
          url: '/api/webhooks/stripe',
        });

        expect(() => customManager.validateToken(request as never)).not.toThrow();
      });
    });

    describe('origin validation', () => {
      let manager: CsrfManager;

      beforeEach(() => {
        manager = createCsrfManager({
          token: { secret: validSecret },
          validation: { checkOrigin: true },
        });
      });

      it('should pass when no origin/referer headers', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          cookies: { 'velox.csrf': token },
          headers: {
            'x-csrf-token': token,
            host: 'example.com',
          },
        });

        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should pass for same-origin requests', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          protocol: 'https',
          cookies: { 'velox.csrf': token },
          headers: {
            'x-csrf-token': token,
            host: 'example.com',
            origin: 'https://example.com',
          },
        });

        expect(() => manager.validateToken(request as never)).not.toThrow();
      });

      it('should throw for cross-origin requests', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          protocol: 'https',
          cookies: { 'velox.csrf': token },
          headers: {
            'x-csrf-token': token,
            host: 'example.com',
            origin: 'https://evil.com',
          },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
        }
      });

      it('should allow configured origins', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          validation: {
            checkOrigin: true,
            allowedOrigins: ['https://trusted.com'],
          },
        });

        const reply = createMockReply();
        const { token } = customManager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          protocol: 'https',
          cookies: { 'velox.csrf': token },
          headers: {
            'x-csrf-token': token,
            host: 'example.com',
            origin: 'https://trusted.com',
          },
        });

        expect(() => customManager.validateToken(request as never)).not.toThrow();
      });

      it('should check referer when origin is missing', () => {
        const reply = createMockReply();
        const { token } = manager.generateToken(reply as never);

        const request = createMockRequest({
          method: 'POST',
          protocol: 'https',
          cookies: { 'velox.csrf': token },
          headers: {
            'x-csrf-token': token,
            host: 'example.com',
            referer: 'https://evil.com/page',
          },
        });

        try {
          manager.validateToken(request as never);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(CsrfError);
          expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
        }
      });
    });

    describe('clearCookie', () => {
      it('should clear the CSRF cookie', () => {
        const manager = createCsrfManager(defaultConfig);
        const reply = createMockReply();

        manager.clearCookie(reply as never);

        expect(reply.clearCookie).toHaveBeenCalledWith('velox.csrf', {
          path: '/',
          domain: undefined,
        });
      });

      it('should use custom cookie name', () => {
        const customManager = createCsrfManager({
          token: { secret: validSecret },
          cookie: { name: 'custom-csrf', path: '/app', domain: 'example.com' },
        });
        const reply = createMockReply();

        customManager.clearCookie(reply as never);

        expect(reply.clearCookie).toHaveBeenCalledWith('custom-csrf', {
          path: '/app',
          domain: 'example.com',
        });
      });
    });
  });

  describe('csrfMiddleware', () => {
    it('should create middleware with protect and provide methods', () => {
      const csrf = csrfMiddleware(defaultConfig);

      expect(csrf.protect).toBeDefined();
      expect(csrf.provide).toBeDefined();
      expect(csrf.manager).toBeDefined();
      expect(csrf.generateToken).toBeDefined();
      expect(csrf.validateToken).toBeDefined();
      expect(csrf.clearCookie).toBeDefined();
    });

    it('should expose manager instance', () => {
      const csrf = csrfMiddleware(defaultConfig);

      expect(csrf.manager.generateToken).toBeDefined();
      expect(csrf.manager.validateToken).toBeDefined();
    });
  });

  describe('CsrfError', () => {
    it('should have correct properties', () => {
      const error = new CsrfError('Test error', 'CSRF_MISSING_TOKEN');

      expect(error.name).toBe('CsrfError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('CSRF_MISSING_TOKEN');
      expect(error.statusCode).toBe(403);
    });

    it('should be instanceof Error', () => {
      const error = new CsrfError('Test', 'CSRF_MISSING_COOKIE');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CsrfError);
    });
  });

  describe('token expiration configuration', () => {
    it('should respect custom expiration', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret, expiresIn: 300 }, // 5 minutes
      });

      const reply = createMockReply();
      const { expiresAt } = manager.generateToken(reply as never);

      const now = Math.floor(Date.now() / 1000);
      expect(expiresAt).toBeGreaterThan(now);
      expect(expiresAt).toBeLessThanOrEqual(now + 300 + 1);
    });

    it('should allow no expiration', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret, expiresIn: 0 },
      });

      const reply = createMockReply();
      const { token, expiresAt } = manager.generateToken(reply as never);

      expect(expiresAt).toBe(0);

      // Token should still be valid
      const parsed = manager.parseToken(token);
      expect(parsed?.expiresAt).toBe(0);
    });
  });

  describe('security validations', () => {
    it('should throw when SameSite=none without Secure flag', () => {
      expect(() =>
        createCsrfManager({
          token: { secret: validSecret },
          cookie: {
            sameSite: 'none',
            secure: false,
          },
        })
      ).toThrow('SameSite=none requires Secure flag');
    });

    it('should allow SameSite=none with Secure flag', () => {
      expect(() =>
        createCsrfManager({
          token: { secret: validSecret },
          cookie: {
            sameSite: 'none',
            secure: true,
          },
        })
      ).not.toThrow();
    });

    it('should reject tokens with different lengths in double-submit', () => {
      const manager = createCsrfManager(defaultConfig);
      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        cookies: { 'velox.csrf': token },
        headers: { 'x-csrf-token': `${token}extra` },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_TOKEN_MISMATCH');
      }
    });
  });

  describe('origin validation edge cases', () => {
    it('should reject malformed origin headers', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com',
          origin: 'not-a-valid-url',
        },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
      }
    });

    it('should use strict case-sensitive origin matching for security', () => {
      // NOTE: While RFC 3986 says hostnames are case-insensitive,
      // strict matching is the safer default for CSRF protection.
      // Users needing case-insensitive matching can add origins to allowedOrigins.
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com',
          origin: 'https://EXAMPLE.COM',
        },
      });

      // Strict matching rejects case differences - safer default
      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
      }
    });

    it('should treat subdomain as different origin', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com',
          origin: 'https://sub.example.com',
        },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
      }
    });

    it('should handle origin with explicit port number', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com:443',
          origin: 'https://example.com:443',
        },
      });

      expect(() => manager.validateToken(request as never)).not.toThrow();
    });

    it('should reject when port differs', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com:443',
          origin: 'https://example.com:8443',
        },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
      }
    });

    it('should reject protocol downgrade attack (http vs https)', () => {
      const manager = createCsrfManager({
        token: { secret: validSecret },
        validation: { checkOrigin: true },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      const request = createMockRequest({
        method: 'POST',
        protocol: 'https',
        cookies: { 'velox.csrf': token },
        headers: {
          'x-csrf-token': token,
          host: 'example.com',
          origin: 'http://example.com',
        },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_ORIGIN_MISMATCH');
      }
    });
  });

  describe('token replay protection', () => {
    it('should reject expired tokens even if signature is valid', () => {
      vi.useFakeTimers();

      const manager = createCsrfManager({
        token: { secret: validSecret, expiresIn: 60 }, // 1 minute expiry
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      // Advance time past expiration
      vi.advanceTimersByTime(61 * 1000);

      const request = createMockRequest({
        method: 'POST',
        cookies: { 'velox.csrf': token },
        headers: { 'x-csrf-token': token },
      });

      try {
        manager.validateToken(request as never);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CsrfError);
        expect((error as CsrfError).code).toBe('CSRF_TOKEN_EXPIRED');
      }

      vi.useRealTimers();
    });

    it('should accept token just before expiration', () => {
      vi.useFakeTimers();

      const manager = createCsrfManager({
        token: { secret: validSecret, expiresIn: 60 },
      });

      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      // Advance time to just before expiration
      vi.advanceTimersByTime(59 * 1000);

      const request = createMockRequest({
        method: 'POST',
        cookies: { 'velox.csrf': token },
        headers: { 'x-csrf-token': token },
      });

      expect(() => manager.validateToken(request as never)).not.toThrow();

      vi.useRealTimers();
    });
  });

  describe('signature security', () => {
    it('should reject token with wrong secret', () => {
      const manager1 = createCsrfManager({
        token: { secret: validSecret },
      });
      const manager2 = createCsrfManager({
        token: { secret: `${validSecret}-different` },
      });

      const reply = createMockReply();
      const { token } = manager1.generateToken(reply as never);

      // Token from manager1 should be invalid for manager2
      expect(manager2.verifySignature(token)).toBe(false);
    });

    it('should reject token with modified expiration time', () => {
      const manager = createCsrfManager(defaultConfig);
      const reply = createMockReply();
      const { token } = manager.generateToken(reply as never);

      // Tamper with expiration time
      const parts = token.split('.');
      parts[2] = '9999999999'; // Far future
      const tamperedToken = parts.join('.');

      expect(manager.verifySignature(tamperedToken)).toBe(false);
    });

    it('should reject token with empty signature', () => {
      const manager = createCsrfManager(defaultConfig);

      expect(manager.verifySignature('value.123.456.')).toBe(false);
    });
  });
});
