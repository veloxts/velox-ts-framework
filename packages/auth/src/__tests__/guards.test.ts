/**
 * Tests for authorization guards
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  allOf,
  anyOf,
  authenticated,
  defineGuard,
  emailVerified,
  executeGuard,
  executeGuards,
  guard,
  hasAnyPermission,
  hasPermission,
  hasRole,
  not,
  userCan,
} from '../guards.js';
import type { AuthContext, User } from '../types.js';

describe('Authorization Guards', () => {
  // Mock request and reply
  const mockRequest = {} as FastifyRequest;
  const mockReply = {} as FastifyReply;

  describe('defineGuard', () => {
    it('should create a guard with default status code', () => {
      const testGuard = defineGuard({
        name: 'test',
        check: () => true,
      });

      expect(testGuard.name).toBe('test');
      expect(testGuard.statusCode).toBe(403);
    });

    it('should allow custom status code', () => {
      const testGuard = defineGuard({
        name: 'test',
        check: () => true,
        statusCode: 401,
      });

      expect(testGuard.statusCode).toBe(401);
    });

    it('should allow custom message', () => {
      const testGuard = defineGuard({
        name: 'test',
        check: () => true,
        message: 'Custom message',
      });

      expect(testGuard.message).toBe('Custom message');
    });
  });

  describe('guard helper', () => {
    it('should create a guard with name and check function', () => {
      const testGuard = guard('myGuard', () => true);

      expect(testGuard.name).toBe('myGuard');
      expect(testGuard.statusCode).toBe(403);
    });
  });

  describe('authenticated guard', () => {
    it('should pass for authenticated user', async () => {
      const ctx = { auth: { isAuthenticated: true } as AuthContext };
      const result = await executeGuard(authenticated, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail for unauthenticated user', async () => {
      const ctx = { auth: { isAuthenticated: false } as AuthContext };
      const result = await executeGuard(authenticated, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Authentication required');
    });

    it('should fail when auth context is missing', async () => {
      const ctx = {};
      const result = await executeGuard(authenticated, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });
  });

  describe('emailVerified guard', () => {
    it('should pass for verified email', async () => {
      const ctx = { user: { id: '1', email: 'test@example.com', emailVerified: true } as User };
      const result = await executeGuard(emailVerified, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail for unverified email', async () => {
      const ctx = { user: { id: '1', email: 'test@example.com', emailVerified: false } as User };
      const result = await executeGuard(emailVerified, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Email verification required');
    });
  });

  describe('hasRole guard', () => {
    it('should pass when user has the role', async () => {
      const roleGuard = hasRole('admin');
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['admin'] } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should pass when user has one of multiple required roles', async () => {
      const roleGuard = hasRole(['admin', 'moderator']);
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['moderator'] } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should pass when user has multiple roles and one matches', async () => {
      const roleGuard = hasRole('editor');
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['user', 'editor'] } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when user lacks the role', async () => {
      const roleGuard = hasRole('admin');
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['user'] } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    it('should fail when user has no roles', async () => {
      const roleGuard = hasRole('admin');
      const ctx = { user: { id: '1', email: 'test@example.com', roles: [] } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    it('should fail when roles is undefined', async () => {
      const roleGuard = hasRole('admin');
      const ctx = { user: { id: '1', email: 'test@example.com' } };
      const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    describe('multiple roles use cases', () => {
      it('should pass when user has all required roles among their roles', async () => {
        // User is both admin and editor, checking for admin
        const roleGuard = hasRole('admin');
        const ctx = { user: { id: '1', email: 'test@example.com', roles: ['admin', 'editor'] } };
        const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

        expect(result.passed).toBe(true);
      });

      it('should pass when user has subset of allowed roles', async () => {
        // Allow admin, moderator, or editor - user has moderator and editor
        const roleGuard = hasRole(['admin', 'moderator', 'editor']);
        const ctx = {
          user: { id: '1', email: 'test@example.com', roles: ['moderator', 'editor'] },
        };
        const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

        expect(result.passed).toBe(true);
      });

      it('should pass when user has exactly one matching role among many', async () => {
        // User has viewer, commenter, editor - only editor is allowed
        const roleGuard = hasRole('editor');
        const ctx = {
          user: { id: '1', email: 'test@example.com', roles: ['viewer', 'commenter', 'editor'] },
        };
        const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

        expect(result.passed).toBe(true);
      });

      it('should fail when user has many roles but none match', async () => {
        // User has many roles but none are admin
        const roleGuard = hasRole('admin');
        const ctx = {
          user: { id: '1', email: 'test@example.com', roles: ['user', 'editor', 'viewer'] },
        };
        const result = await executeGuard(roleGuard, ctx, mockRequest, mockReply);

        expect(result.passed).toBe(false);
      });

      it('should work with role hierarchy pattern', async () => {
        // Simulating super-admin who has all roles
        const superAdmin = {
          id: '1',
          email: 'super@example.com',
          roles: ['super-admin', 'admin', 'moderator', 'user'],
        };

        const adminGuard = hasRole('admin');
        const modGuard = hasRole('moderator');
        const userGuard = hasRole('user');

        expect(
          (await executeGuard(adminGuard, { user: superAdmin }, mockRequest, mockReply)).passed
        ).toBe(true);
        expect(
          (await executeGuard(modGuard, { user: superAdmin }, mockRequest, mockReply)).passed
        ).toBe(true);
        expect(
          (await executeGuard(userGuard, { user: superAdmin }, mockRequest, mockReply)).passed
        ).toBe(true);
      });
    });
  });

  describe('hasPermission guard', () => {
    it('should pass when user has all permissions', async () => {
      const permGuard = hasPermission(['posts.read', 'posts.write']);
      const ctx = {
        user: {
          id: '1',
          email: 'test@example.com',
          permissions: ['posts.read', 'posts.write', 'users.read'],
        },
      };
      const result = await executeGuard(permGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when user lacks some permissions', async () => {
      const permGuard = hasPermission(['posts.read', 'posts.delete']);
      const ctx = {
        user: { id: '1', email: 'test@example.com', permissions: ['posts.read'] },
      };
      const result = await executeGuard(permGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    it('should fail when user has no permissions', async () => {
      const permGuard = hasPermission('posts.read');
      const ctx = { user: { id: '1', email: 'test@example.com' } };
      const result = await executeGuard(permGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });
  });

  describe('hasAnyPermission guard', () => {
    it('should pass when user has at least one permission', async () => {
      const permGuard = hasAnyPermission(['posts.read', 'posts.delete']);
      const ctx = {
        user: { id: '1', email: 'test@example.com', permissions: ['posts.read'] },
      };
      const result = await executeGuard(permGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when user has none of the permissions', async () => {
      const permGuard = hasAnyPermission(['posts.read', 'posts.delete']);
      const ctx = {
        user: { id: '1', email: 'test@example.com', permissions: ['users.read'] },
      };
      const result = await executeGuard(permGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });
  });

  describe('userCan guard', () => {
    it('should pass when custom check returns true', async () => {
      const customGuard = userCan((user) => user.id === '1', 'isUserOne');
      const ctx = { user: { id: '1', email: 'test@example.com' } as User };
      const result = await executeGuard(customGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when custom check returns false', async () => {
      const customGuard = userCan((user) => user.id === '1');
      const ctx = { user: { id: '2', email: 'test@example.com' } as User };
      const result = await executeGuard(customGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    it('should work with async check', async () => {
      const asyncGuard = userCan(async (user) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return user.id === '1';
      });
      const ctx = { user: { id: '1', email: 'test@example.com' } as User };
      const result = await executeGuard(asyncGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });
  });

  describe('allOf combinator', () => {
    it('should pass when all guards pass', async () => {
      const combined = allOf([hasRole('admin'), hasPermission('users.delete')]);
      const ctx = {
        user: {
          id: '1',
          email: 'test@example.com',
          roles: ['admin'],
          permissions: ['users.delete'],
        },
      };
      const result = await executeGuard(combined, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when any guard fails', async () => {
      const combined = allOf([hasRole('admin'), hasPermission('users.delete')]);
      const ctx = {
        user: { id: '1', email: 'test@example.com', roles: ['admin'], permissions: [] },
      };
      const result = await executeGuard(combined, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });
  });

  describe('anyOf combinator', () => {
    it('should pass when any guard passes', async () => {
      const combined = anyOf([hasRole('admin'), hasRole('moderator')]);
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['moderator'] } };
      const result = await executeGuard(combined, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });

    it('should fail when all guards fail', async () => {
      const combined = anyOf([hasRole('admin'), hasRole('moderator')]);
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['user'] } };
      const result = await executeGuard(combined, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });
  });

  describe('not combinator', () => {
    it('should invert passing guard', async () => {
      const notAdmin = not(hasRole('admin'));
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['admin'] } };
      const result = await executeGuard(notAdmin, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
    });

    it('should invert failing guard', async () => {
      const notAdmin = not(hasRole('admin'));
      const ctx = { user: { id: '1', email: 'test@example.com', roles: ['user'] } };
      const result = await executeGuard(notAdmin, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
    });
  });

  describe('executeGuards', () => {
    it('should pass when all guards pass', async () => {
      const guards = [hasRole('admin'), hasPermission('users.delete')];
      const ctx = {
        user: {
          id: '1',
          email: 'test@example.com',
          roles: ['admin'],
          permissions: ['users.delete'],
        },
      };
      const result = await executeGuards(guards, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(true);
      expect(result.failedGuard).toBeUndefined();
    });

    it('should fail on first failing guard', async () => {
      const guards = [hasRole('admin'), hasPermission('users.delete')];
      const ctx = {
        user: {
          id: '1',
          email: 'test@example.com',
          roles: ['user'],
          permissions: ['users.delete'],
        },
      };
      const result = await executeGuards(guards, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
      expect(result.failedGuard).toBe('hasRole:admin');
    });

    it('should handle guard throwing error', async () => {
      const throwingGuard = defineGuard({
        name: 'throwing',
        check: () => {
          throw new Error('Test error');
        },
      });

      const ctx = {};
      const result = await executeGuard(throwingGuard, ctx, mockRequest, mockReply);

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Test error');
      expect(result.statusCode).toBe(500);
    });
  });
});
