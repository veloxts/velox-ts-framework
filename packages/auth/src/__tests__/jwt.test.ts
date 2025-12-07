/**
 * Tests for JWT authentication
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateTokenId, JwtManager, parseTimeToSeconds } from '../jwt.js';
import type { User } from '../types.js';

describe('JWT Authentication', () => {
  const validSecret = 'this-is-a-very-long-secret-key-for-testing-purposes';
  let jwt: JwtManager;

  beforeEach(() => {
    jwt = new JwtManager({ secret: validSecret });
  });

  describe('parseTimeToSeconds', () => {
    it('should parse seconds', () => {
      expect(parseTimeToSeconds('30s')).toBe(30);
      expect(parseTimeToSeconds('1s')).toBe(1);
    });

    it('should parse minutes', () => {
      expect(parseTimeToSeconds('15m')).toBe(15 * 60);
      expect(parseTimeToSeconds('1m')).toBe(60);
    });

    it('should parse hours', () => {
      expect(parseTimeToSeconds('1h')).toBe(60 * 60);
      expect(parseTimeToSeconds('24h')).toBe(24 * 60 * 60);
    });

    it('should parse days', () => {
      expect(parseTimeToSeconds('7d')).toBe(7 * 24 * 60 * 60);
      expect(parseTimeToSeconds('1d')).toBe(24 * 60 * 60);
    });

    it('should throw for invalid format', () => {
      expect(() => parseTimeToSeconds('invalid')).toThrow('Invalid time format');
      expect(() => parseTimeToSeconds('15')).toThrow('Invalid time format');
      expect(() => parseTimeToSeconds('15x')).toThrow('Invalid time format');
    });
  });

  describe('generateTokenId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTokenId();
      const id2 = generateTokenId();
      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(32); // 16 bytes = 32 hex chars
    });
  });

  describe('JwtManager', () => {
    describe('constructor', () => {
      it('should throw if secret is too short', () => {
        expect(() => new JwtManager({ secret: 'short' })).toThrow(
          'JWT secret must be at least 32 characters long'
        );
      });

      it('should use default expiry values', () => {
        const manager = new JwtManager({ secret: validSecret });
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = manager.createTokenPair(user);

        expect(tokens.expiresIn).toBe(15 * 60); // 15 minutes default
      });

      it('should accept custom expiry values', () => {
        const manager = new JwtManager({
          secret: validSecret,
          accessTokenExpiry: '30m',
          refreshTokenExpiry: '14d',
        });
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = manager.createTokenPair(user);

        expect(tokens.expiresIn).toBe(30 * 60); // 30 minutes
      });
    });

    describe('createTokenPair', () => {
      it('should create access and refresh tokens', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        expect(tokens.accessToken).toBeDefined();
        expect(tokens.refreshToken).toBeDefined();
        expect(tokens.tokenType).toBe('Bearer');
        expect(tokens.expiresIn).toBe(15 * 60);
      });

      it('should include additional claims', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user, { role: 'admin' });

        const payload = jwt.verifyToken(tokens.accessToken);
        expect(payload.role).toBe('admin');
      });

      it('should include issuer and audience if configured', () => {
        const manager = new JwtManager({
          secret: validSecret,
          issuer: 'test-app',
          audience: 'test-audience',
        });
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = manager.createTokenPair(user);

        const payload = manager.verifyToken(tokens.accessToken);
        expect(payload.iss).toBe('test-app');
        expect(payload.aud).toBe('test-audience');
      });
    });

    describe('verifyToken', () => {
      it('should verify a valid token', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        const payload = jwt.verifyToken(tokens.accessToken);
        expect(payload.sub).toBe('user-1');
        expect(payload.email).toBe('test@example.com');
        expect(payload.type).toBe('access');
      });

      it('should throw for invalid token format', () => {
        expect(() => jwt.verifyToken('invalid')).toThrow('Invalid token format');
        expect(() => jwt.verifyToken('a.b')).toThrow('Invalid token format');
      });

      it('should throw for invalid signature', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        // Tamper with the signature
        const parts = tokens.accessToken.split('.');
        parts[2] = 'invalidsignature';
        const tamperedToken = parts.join('.');

        expect(() => jwt.verifyToken(tamperedToken)).toThrow('Invalid token signature');
      });

      it('should throw for expired token', () => {
        vi.useFakeTimers();

        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        // Advance time past expiration (15 minutes + 1 second)
        vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

        expect(() => jwt.verifyToken(tokens.accessToken)).toThrow('Token has expired');

        vi.useRealTimers();
      });

      it('should throw for invalid issuer', () => {
        const manager1 = new JwtManager({
          secret: validSecret,
          issuer: 'issuer-1',
        });
        const manager2 = new JwtManager({
          secret: validSecret,
          issuer: 'issuer-2',
        });

        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = manager1.createTokenPair(user);

        expect(() => manager2.verifyToken(tokens.accessToken)).toThrow('Invalid token issuer');
      });

      it('should throw for invalid audience', () => {
        const manager1 = new JwtManager({
          secret: validSecret,
          audience: 'audience-1',
        });
        const manager2 = new JwtManager({
          secret: validSecret,
          audience: 'audience-2',
        });

        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = manager1.createTokenPair(user);

        expect(() => manager2.verifyToken(tokens.accessToken)).toThrow('Invalid token audience');
      });
    });

    describe('refreshTokens', () => {
      it('should create new tokens from refresh token', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        const newTokens = jwt.refreshTokens(tokens.refreshToken);
        expect(newTokens.accessToken).toBeDefined();
        expect(newTokens.refreshToken).toBeDefined();
        expect(newTokens.accessToken).not.toBe(tokens.accessToken);
      });

      it('should throw for access token used as refresh', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        expect(() => jwt.refreshTokens(tokens.accessToken)).toThrow(
          'Invalid token type: expected refresh token'
        );
      });

      it('should call userLoader if provided', async () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        const updatedUser: User = { id: 'user-1', email: 'updated@example.com' };
        const userLoader = vi.fn().mockResolvedValue(updatedUser);

        const newTokens = await jwt.refreshTokens(tokens.refreshToken, userLoader);
        expect(userLoader).toHaveBeenCalledWith('user-1');

        const payload = jwt.verifyToken(newTokens.accessToken);
        expect(payload.email).toBe('updated@example.com');
      });

      it('should throw if userLoader returns null', async () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        const userLoader = vi.fn().mockResolvedValue(null);

        await expect(jwt.refreshTokens(tokens.refreshToken, userLoader)).rejects.toThrow(
          'User not found'
        );
      });
    });

    describe('decodeToken', () => {
      it('should decode token without verification', () => {
        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        const payload = jwt.decodeToken(tokens.accessToken);
        expect(payload?.sub).toBe('user-1');
        expect(payload?.email).toBe('test@example.com');
      });

      it('should decode expired token', () => {
        vi.useFakeTimers();

        const user: User = { id: 'user-1', email: 'test@example.com' };
        const tokens = jwt.createTokenPair(user);

        // Advance time past expiration
        vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

        // verifyToken would throw, but decodeToken should work
        expect(() => jwt.verifyToken(tokens.accessToken)).toThrow('Token has expired');
        const payload = jwt.decodeToken(tokens.accessToken);
        expect(payload?.sub).toBe('user-1');

        vi.useRealTimers();
      });

      it('should return null for invalid token', () => {
        expect(jwt.decodeToken('invalid')).toBeNull();
        expect(jwt.decodeToken('a.b')).toBeNull();
      });
    });

    describe('extractFromHeader', () => {
      it('should extract token from Bearer header', () => {
        const token = jwt.extractFromHeader('Bearer my-token-here');
        expect(token).toBe('my-token-here');
      });

      it('should be case-insensitive for Bearer', () => {
        expect(jwt.extractFromHeader('bearer my-token')).toBe('my-token');
        expect(jwt.extractFromHeader('BEARER my-token')).toBe('my-token');
      });

      it('should return null for missing header', () => {
        expect(jwt.extractFromHeader(undefined)).toBeNull();
        expect(jwt.extractFromHeader('')).toBeNull();
      });

      it('should return null for invalid format', () => {
        expect(jwt.extractFromHeader('Basic my-token')).toBeNull();
        expect(jwt.extractFromHeader('Bearer')).toBeNull();
        expect(jwt.extractFromHeader('my-token')).toBeNull();
      });
    });
  });
});
