/**
 * Tests for enhanced definePolicy API (v0.9)
 *
 * Validates:
 * - definePolicy('ResourceName', actions) accepts resource name as first arg
 * - PolicyObject exposes actions as PolicyActionRef with actionName, resourceName, check
 * - Action check works correctly (owner check, role check)
 * - Action-level check works without resource (create)
 * - resourceName is accessible on the policy object
 * - registerPolicy accepts PolicyObject directly
 * - PolicyActionRef.check integrates with can/authorize
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  authorize,
  can,
  clearPolicies,
  definePolicy,
  getPolicy,
  registerPolicy,
} from '../policies.js';
import type { PolicyActionRef, User } from '../types.js';

interface Post {
  id: string;
  authorId: string;
  status: string;
}

type UserWithRole = User & { role: string };

describe('Enhanced definePolicy (v0.9)', () => {
  afterEach(() => {
    clearPolicies();
  });

  describe('definePolicy with resource name', () => {
    it('should accept resource name as first argument', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        view: () => true,
        update: ({ user, resource }) => user.id === resource.authorId,
      });

      expect(PostPolicy).toBeDefined();
      expect(PostPolicy.resourceName).toBe('Post');
    });

    it('should expose each action as a PolicyActionRef', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        create: ({ user }) => user.role === 'admin',
        update: ({ user, resource }) => resource.authorId === user.id,
        delete: ({ user, resource }) => resource.authorId === user.id || user.role === 'admin',
      });

      // Verify create action ref
      const createRef = PostPolicy.create as PolicyActionRef<UserWithRole, Post>;
      expect(createRef.actionName).toBe('create');
      expect(createRef.resourceName).toBe('Post');
      expect(typeof createRef.check).toBe('function');

      // Verify update action ref
      const updateRef = PostPolicy.update as PolicyActionRef<UserWithRole, Post>;
      expect(updateRef.actionName).toBe('update');
      expect(updateRef.resourceName).toBe('Post');
      expect(typeof updateRef.check).toBe('function');

      // Verify delete action ref
      const deleteRef = PostPolicy.delete as PolicyActionRef<UserWithRole, Post>;
      expect(deleteRef.actionName).toBe('delete');
      expect(deleteRef.resourceName).toBe('Post');
      expect(typeof deleteRef.check).toBe('function');
    });

    it('should have working check on action refs (owner check)', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        update: ({ user, resource }) => resource.authorId === user.id,
      });

      const owner: UserWithRole = { id: 'u1', email: 'owner@test.com', role: 'user' };
      const other: UserWithRole = { id: 'u2', email: 'other@test.com', role: 'user' };
      const post: Post = { id: 'p1', authorId: 'u1', status: 'published' };

      const updateRef = PostPolicy.update as PolicyActionRef<UserWithRole, Post>;

      expect(updateRef.check(owner, post)).toBe(true);
      expect(updateRef.check(other, post)).toBe(false);
    });

    it('should have working check on action refs (role check)', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        create: ({ user }) => user.role === 'admin',
      });

      const admin: UserWithRole = { id: 'u1', email: 'admin@test.com', role: 'admin' };
      const regularUser: UserWithRole = { id: 'u2', email: 'user@test.com', role: 'user' };

      const createRef = PostPolicy.create as PolicyActionRef<UserWithRole, Post>;

      expect(createRef.check(admin)).toBe(true);
      expect(createRef.check(regularUser)).toBe(false);
    });

    it('should work without resource argument for create-like actions', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        create: ({ user }) => user.role === 'editor' || user.role === 'admin',
      });

      const editor: UserWithRole = { id: 'u1', email: 'editor@test.com', role: 'editor' };
      const viewer: UserWithRole = { id: 'u2', email: 'viewer@test.com', role: 'viewer' };

      const createRef = PostPolicy.create as PolicyActionRef<UserWithRole, Post>;

      // Calling check without resource
      expect(createRef.check(editor)).toBe(true);
      expect(createRef.check(viewer)).toBe(false);
    });

    it('should expose resourceName on the policy object', () => {
      const PostPolicy = definePolicy<User, Post>('Post', {
        view: () => true,
      });

      expect(PostPolicy.resourceName).toBe('Post');

      const CommentPolicy = definePolicy<User, { id: string }>('Comment', {
        view: () => true,
      });

      expect(CommentPolicy.resourceName).toBe('Comment');
    });
  });

  describe('registerPolicy with PolicyObject', () => {
    it('should register a PolicyObject and make it usable with can()', async () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        view: () => true,
        update: ({ user, resource }) => resource.authorId === user.id,
        delete: ({ user, resource }) => resource.authorId === user.id || user.role === 'admin',
      });

      registerPolicy(PostPolicy);

      const owner: UserWithRole = { id: 'u1', email: 'owner@test.com', role: 'user' };
      const admin: UserWithRole = { id: 'u99', email: 'admin@test.com', role: 'admin' };
      const other: UserWithRole = { id: 'u2', email: 'other@test.com', role: 'user' };
      const post: Post = { id: 'p1', authorId: 'u1', status: 'draft' };

      // Owner can update and delete
      expect(await can(owner, 'update', 'Post', post)).toBe(true);
      expect(await can(owner, 'delete', 'Post', post)).toBe(true);

      // Admin can delete (not owner)
      expect(await can(admin, 'delete', 'Post', post)).toBe(true);
      expect(await can(admin, 'update', 'Post', post)).toBe(false);

      // Other user cannot update or delete
      expect(await can(other, 'update', 'Post', post)).toBe(false);
      expect(await can(other, 'delete', 'Post', post)).toBe(false);

      // Anyone can view
      expect(await can(other, 'view', 'Post', post)).toBe(true);
    });

    it('should work with authorize() after registration', async () => {
      const PostPolicy = definePolicy<User, Post>('Post', {
        view: () => true,
        delete: () => false,
      });

      registerPolicy(PostPolicy);

      const user: User = { id: '1', email: 'test@test.com' };

      await expect(authorize(user, 'view', 'Post')).resolves.toBeUndefined();
      await expect(authorize(user, 'delete', 'Post')).rejects.toThrow(
        'Unauthorized: cannot delete Post'
      );
    });

    it('should store policy under the correct resource name', () => {
      const PostPolicy = definePolicy<User, Post>('Post', {
        view: () => true,
      });

      registerPolicy(PostPolicy);

      expect(getPolicy('Post')).toBeDefined();
      expect(getPolicy('Comment')).toBeUndefined();
    });
  });

  describe('async policy actions', () => {
    it('should support async check functions', async () => {
      const PostPolicy = definePolicy<User, Post>('Post', {
        update: async ({ user, resource }) => {
          // Simulate async check (e.g., database lookup)
          await Promise.resolve();
          return resource.authorId === user.id;
        },
      });

      const updateRef = PostPolicy.update as PolicyActionRef<User, Post>;
      const user: User = { id: 'u1', email: 'test@test.com' };
      const post: Post = { id: 'p1', authorId: 'u1', status: 'draft' };

      const result = await updateRef.check(user, post);
      expect(result).toBe(true);
    });

    it('should support async checks via can() with registered PolicyObject', async () => {
      const PostPolicy = definePolicy<User, Post>('Post', {
        update: async ({ user, resource }) => {
          await Promise.resolve();
          return resource.authorId === user.id;
        },
      });

      registerPolicy(PostPolicy);

      const user: User = { id: 'u1', email: 'test@test.com' };
      const post: Post = { id: 'p1', authorId: 'u1', status: 'draft' };

      expect(await can(user, 'update', 'Post', post)).toBe(true);
    });
  });

  describe('custom action names', () => {
    it('should support custom action names beyond CRUD', () => {
      const PostPolicy = definePolicy<UserWithRole, Post>('Post', {
        publish: ({ user, resource }) => resource.authorId === user.id && user.role !== 'viewer',
        archive: ({ user }) => user.role === 'admin',
        restore: ({ user }) => user.role === 'admin',
      });

      expect(PostPolicy.publish).toBeDefined();
      expect(PostPolicy.archive).toBeDefined();
      expect(PostPolicy.restore).toBeDefined();

      const publishRef = PostPolicy.publish as PolicyActionRef<UserWithRole, Post>;
      expect(publishRef.actionName).toBe('publish');
      expect(publishRef.resourceName).toBe('Post');

      const author: UserWithRole = { id: 'u1', email: 'author@test.com', role: 'author' };
      const post: Post = { id: 'p1', authorId: 'u1', status: 'draft' };

      expect(publishRef.check(author, post)).toBe(true);
    });
  });
});
