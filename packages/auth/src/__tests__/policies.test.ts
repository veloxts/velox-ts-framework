/**
 * Tests for resource policies
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authorize,
  can,
  cannot,
  clearPolicies,
  createAdminOnlyPolicy,
  createOwnerOrAdminPolicy,
  createPolicyBuilder,
  createReadOnlyPolicy,
  definePolicy,
  getPolicy,
  registerPolicy,
} from '../policies.js';
import type { User } from '../types.js';

describe('Resource Policies', () => {
  // Clear policies after each test
  afterEach(() => {
    clearPolicies();
  });

  describe('registerPolicy and getPolicy', () => {
    it('should register and retrieve a policy', () => {
      const policy = { view: () => true };
      registerPolicy('Post', policy);

      expect(getPolicy('Post')).toBe(policy);
    });

    it('should return undefined for unregistered policy', () => {
      expect(getPolicy('Unknown')).toBeUndefined();
    });
  });

  describe('definePolicy', () => {
    it('should create a typed policy definition', () => {
      interface Post {
        id: string;
        authorId: string;
      }

      const PostPolicy = definePolicy<User, Post>({
        view: () => true,
        update: (user, post) => user.id === post.authorId,
      });

      expect(PostPolicy.view).toBeDefined();
      expect(PostPolicy.update).toBeDefined();
    });
  });

  describe('can and cannot', () => {
    it('should return true when action is allowed', async () => {
      registerPolicy('Post', {
        view: () => true,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      const result = await can(user, 'view', 'Post');

      expect(result).toBe(true);
    });

    it('should return false when action is denied', async () => {
      registerPolicy('Post', {
        view: () => false,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      const result = await can(user, 'view', 'Post');

      expect(result).toBe(false);
    });

    it('should check against resource', async () => {
      interface Post {
        id: string;
        authorId: string;
      }

      registerPolicy<User, Post>('Post', {
        update: (user, post) => user.id === post.authorId,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      const ownPost: Post = { id: 'post-1', authorId: '1' };
      const otherPost: Post = { id: 'post-2', authorId: '2' };

      expect(await can(user, 'update', 'Post', ownPost)).toBe(true);
      expect(await can(user, 'update', 'Post', otherPost)).toBe(false);
    });

    it('should deny if no user', async () => {
      registerPolicy('Post', {
        view: () => true,
      });

      expect(await can(null, 'view', 'Post')).toBe(false);
      expect(await can(undefined, 'view', 'Post')).toBe(false);
    });

    it('should deny if no policy registered', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const user: User = { id: '1', email: 'test@example.com' };
      const result = await can(user, 'view', 'UnknownResource');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('No policy registered for resource: UnknownResource');

      consoleSpy.mockRestore();
    });

    it('should deny if action not defined', async () => {
      registerPolicy('Post', {
        view: () => true,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      const result = await can(user, 'delete', 'Post');

      expect(result).toBe(false);
    });

    it('cannot should return inverse of can', async () => {
      registerPolicy('Post', {
        view: () => true,
        delete: () => false,
      });

      const user: User = { id: '1', email: 'test@example.com' };

      expect(await cannot(user, 'view', 'Post')).toBe(false);
      expect(await cannot(user, 'delete', 'Post')).toBe(true);
    });
  });

  describe('authorize', () => {
    it('should not throw when authorized', async () => {
      registerPolicy('Post', {
        view: () => true,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      await expect(authorize(user, 'view', 'Post')).resolves.toBeUndefined();
    });

    it('should throw when not authorized', async () => {
      registerPolicy('Post', {
        delete: () => false,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      await expect(authorize(user, 'delete', 'Post')).rejects.toThrow(
        'Unauthorized: cannot delete Post'
      );
    });

    it('should include resource id in error message', async () => {
      registerPolicy('Post', {
        delete: () => false,
      });

      const user: User = { id: '1', email: 'test@example.com' };
      const post = { id: 'post-123' };

      await expect(authorize(user, 'delete', 'Post', post)).rejects.toThrow(
        'Unauthorized: cannot delete Post (id: post-123)'
      );
    });
  });

  describe('createPolicyBuilder', () => {
    it('should build a policy with allow', () => {
      const policy = createPolicyBuilder<User>()
        .allow('view', () => true)
        .allow('create', (user) => user.id !== '')
        .build();

      expect(policy.view).toBeDefined();
      expect(policy.create).toBeDefined();
    });

    it('should build a policy with deny', async () => {
      const policy = createPolicyBuilder<User>().deny('delete').build();

      registerPolicy('Resource', policy);
      const user: User = { id: '1', email: 'test@example.com' };

      expect(await can(user, 'delete', 'Resource')).toBe(false);
    });

    it('should build a policy with allowOwner', async () => {
      interface Post {
        id: string;
        userId: string;
      }

      const policy = createPolicyBuilder<User, Post>().allowOwner('update').build();

      registerPolicy('Post', policy);
      const user: User = { id: '1', email: 'test@example.com' };
      const ownPost: Post = { id: 'p1', userId: '1' };
      const otherPost: Post = { id: 'p2', userId: '2' };

      expect(await can(user, 'update', 'Post', ownPost)).toBe(true);
      expect(await can(user, 'update', 'Post', otherPost)).toBe(false);
    });

    it('should build a policy with allowOwnerOr', async () => {
      interface Post {
        id: string;
        userId: string;
      }

      const policy = createPolicyBuilder<User & { role?: string }, Post>()
        .allowOwnerOr('delete', ['admin'])
        .build();

      registerPolicy('Post', policy);

      const admin = { id: '99', email: 'admin@example.com', role: 'admin' };
      const owner = { id: '1', email: 'owner@example.com', role: 'user' };
      const other = { id: '2', email: 'other@example.com', role: 'user' };
      const post: Post = { id: 'p1', userId: '1' };

      expect(await can(admin, 'delete', 'Post', post)).toBe(true);
      expect(await can(owner, 'delete', 'Post', post)).toBe(true);
      expect(await can(other, 'delete', 'Post', post)).toBe(false);
    });

    it('should register policy with register()', () => {
      createPolicyBuilder<User>()
        .allow('view', () => true)
        .register('TestResource');

      expect(getPolicy('TestResource')).toBeDefined();
    });
  });

  describe('common policy patterns', () => {
    describe('createOwnerOrAdminPolicy', () => {
      it('should allow admins all actions', async () => {
        interface Post {
          userId: string;
        }

        registerPolicy('Post', createOwnerOrAdminPolicy<Post>());

        const admin = { id: '99', email: 'admin@example.com', role: 'admin' };
        const post: Post = { userId: '1' };

        expect(await can(admin, 'view', 'Post', post)).toBe(true);
        expect(await can(admin, 'update', 'Post', post)).toBe(true);
        expect(await can(admin, 'delete', 'Post', post)).toBe(true);
      });

      it('should allow owner to modify their resources', async () => {
        interface Post {
          userId: string;
        }

        registerPolicy('Post', createOwnerOrAdminPolicy<Post>());

        const owner = { id: '1', email: 'owner@example.com', role: 'user' };
        const post: Post = { userId: '1' };

        expect(await can(owner, 'update', 'Post', post)).toBe(true);
        expect(await can(owner, 'delete', 'Post', post)).toBe(true);
      });

      it('should deny non-owners modifying resources', async () => {
        interface Post {
          userId: string;
        }

        registerPolicy('Post', createOwnerOrAdminPolicy<Post>());

        const other = { id: '2', email: 'other@example.com', role: 'user' };
        const post: Post = { userId: '1' };

        expect(await can(other, 'view', 'Post', post)).toBe(true); // view is always allowed
        expect(await can(other, 'update', 'Post', post)).toBe(false);
        expect(await can(other, 'delete', 'Post', post)).toBe(false);
      });
    });

    describe('createReadOnlyPolicy', () => {
      it('should allow only view', async () => {
        registerPolicy('Config', createReadOnlyPolicy());

        const user: User = { id: '1', email: 'test@example.com' };

        expect(await can(user, 'view', 'Config')).toBe(true);
        expect(await can(user, 'create', 'Config')).toBe(false);
        expect(await can(user, 'update', 'Config')).toBe(false);
        expect(await can(user, 'delete', 'Config')).toBe(false);
      });
    });

    describe('createAdminOnlyPolicy', () => {
      it('should allow only admins', async () => {
        registerPolicy('SystemSetting', createAdminOnlyPolicy());

        const admin = { id: '1', email: 'admin@example.com', role: 'admin' };
        const user = { id: '2', email: 'user@example.com', role: 'user' };

        expect(await can(admin, 'view', 'SystemSetting')).toBe(true);
        expect(await can(admin, 'create', 'SystemSetting')).toBe(true);
        expect(await can(admin, 'update', 'SystemSetting')).toBe(true);
        expect(await can(admin, 'delete', 'SystemSetting')).toBe(true);

        expect(await can(user, 'view', 'SystemSetting')).toBe(false);
        expect(await can(user, 'create', 'SystemSetting')).toBe(false);
      });
    });
  });
});
