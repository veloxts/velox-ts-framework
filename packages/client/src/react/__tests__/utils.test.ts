/**
 * Unit tests for React hook utilities
 */

import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildQueryKey,
  getQueryData,
  invalidateNamespace,
  invalidateProcedure,
  invalidateQuery,
  setQueryData,
} from '../utils.js';

// ============================================================================
// buildQueryKey Tests
// ============================================================================

describe('buildQueryKey', () => {
  describe('without input', () => {
    it('returns [namespace, procedureName] when input is undefined', () => {
      const key = buildQueryKey('users', 'listUsers', undefined);
      expect(key).toEqual(['users', 'listUsers']);
    });

    it('returns [namespace, procedureName] when input is null', () => {
      const key = buildQueryKey('users', 'listUsers', null);
      expect(key).toEqual(['users', 'listUsers']);
    });
  });

  describe('with object input', () => {
    it('includes object input directly in the key', () => {
      const input = { id: '123' };
      const key = buildQueryKey('users', 'getUser', input);
      expect(key).toEqual(['users', 'getUser', { id: '123' }]);
    });

    it('handles complex object input', () => {
      const input = { page: 1, limit: 10, filters: { active: true } };
      const key = buildQueryKey('users', 'listUsers', input);
      expect(key).toEqual([
        'users',
        'listUsers',
        { page: 1, limit: 10, filters: { active: true } },
      ]);
    });

    it('handles empty object input', () => {
      const key = buildQueryKey('users', 'listUsers', {});
      expect(key).toEqual(['users', 'listUsers', {}]);
    });
  });

  describe('with primitive input', () => {
    it('wraps string input in { value } object', () => {
      const key = buildQueryKey('users', 'getByEmail', 'test@example.com');
      expect(key).toEqual(['users', 'getByEmail', { value: 'test@example.com' }]);
    });

    it('wraps number input in { value } object', () => {
      const key = buildQueryKey('users', 'getByCount', 42);
      expect(key).toEqual(['users', 'getByCount', { value: 42 }]);
    });

    it('wraps boolean input in { value } object', () => {
      const key = buildQueryKey('users', 'getActive', true);
      expect(key).toEqual(['users', 'getActive', { value: true }]);
    });
  });

  describe('key stability', () => {
    it('produces identical keys for identical inputs', () => {
      const key1 = buildQueryKey('users', 'getUser', { id: '123' });
      const key2 = buildQueryKey('users', 'getUser', { id: '123' });
      expect(key1).toEqual(key2);
    });

    it('produces different keys for different namespaces', () => {
      const key1 = buildQueryKey('users', 'getItem', { id: '123' });
      const key2 = buildQueryKey('posts', 'getItem', { id: '123' });
      expect(key1).not.toEqual(key2);
    });

    it('produces different keys for different procedures', () => {
      const key1 = buildQueryKey('users', 'getUser', { id: '123' });
      const key2 = buildQueryKey('users', 'findUser', { id: '123' });
      expect(key1).not.toEqual(key2);
    });
  });
});

// ============================================================================
// Cache Invalidation Tests
// ============================================================================

describe('cache invalidation helpers', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('invalidateNamespace', () => {
    it('invalidates all queries in a namespace', async () => {
      // Set up some cached data
      queryClient.setQueryData(['users', 'getUser', { id: '1' }], { id: '1', name: 'User 1' });
      queryClient.setQueryData(['users', 'getUser', { id: '2' }], { id: '2', name: 'User 2' });
      queryClient.setQueryData(['users', 'listUsers'], [{ id: '1' }, { id: '2' }]);
      queryClient.setQueryData(['posts', 'listPosts'], [{ id: 'p1' }]);

      // Invalidate users namespace
      await invalidateNamespace(queryClient, 'users');

      // Check that users queries are invalidated (stale)
      const usersQueries = queryClient.getQueryCache().findAll({ queryKey: ['users'] });
      expect(usersQueries.every((q) => q.state.isInvalidated)).toBe(true);

      // Check that posts queries are not invalidated
      const postsQueries = queryClient.getQueryCache().findAll({ queryKey: ['posts'] });
      expect(postsQueries.every((q) => !q.state.isInvalidated)).toBe(true);
    });
  });

  describe('invalidateProcedure', () => {
    it('invalidates all queries for a specific procedure', async () => {
      // Set up some cached data
      queryClient.setQueryData(['users', 'getUser', { id: '1' }], { id: '1', name: 'User 1' });
      queryClient.setQueryData(['users', 'getUser', { id: '2' }], { id: '2', name: 'User 2' });
      queryClient.setQueryData(['users', 'listUsers'], [{ id: '1' }, { id: '2' }]);

      // Invalidate only getUser queries
      await invalidateProcedure(queryClient, 'users', 'getUser');

      // Check that getUser queries are invalidated
      const getUserQueries = queryClient.getQueryCache().findAll({
        queryKey: ['users', 'getUser'],
      });
      expect(getUserQueries.every((q) => q.state.isInvalidated)).toBe(true);

      // Check that listUsers is not invalidated
      const listUsersQueries = queryClient.getQueryCache().findAll({
        queryKey: ['users', 'listUsers'],
        exact: true,
      });
      expect(listUsersQueries.every((q) => !q.state.isInvalidated)).toBe(true);
    });
  });

  describe('invalidateQuery', () => {
    it('invalidates a specific query by exact key', async () => {
      // Set up some cached data
      queryClient.setQueryData(['users', 'getUser', { id: '1' }], { id: '1', name: 'User 1' });
      queryClient.setQueryData(['users', 'getUser', { id: '2' }], { id: '2', name: 'User 2' });

      // Invalidate only user 1
      await invalidateQuery(queryClient, 'users', 'getUser', { id: '1' });

      // Check that user 1 query is invalidated
      const user1Query = queryClient.getQueryCache().find({
        queryKey: ['users', 'getUser', { id: '1' }],
      });
      expect(user1Query?.state.isInvalidated).toBe(true);

      // Check that user 2 query is not invalidated
      const user2Query = queryClient.getQueryCache().find({
        queryKey: ['users', 'getUser', { id: '2' }],
      });
      expect(user2Query?.state.isInvalidated).toBe(false);
    });

    it('handles queries without input', async () => {
      queryClient.setQueryData(['health', 'check'], { status: 'ok' });

      await invalidateQuery(queryClient, 'health', 'check');

      const healthQuery = queryClient.getQueryCache().find({
        queryKey: ['health', 'check'],
      });
      expect(healthQuery?.state.isInvalidated).toBe(true);
    });
  });
});

// ============================================================================
// Cache Data Accessor Tests
// ============================================================================

describe('cache data accessors', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('getQueryData', () => {
    it('retrieves cached data by key', () => {
      const userData = { id: '123', name: 'Test User' };
      queryClient.setQueryData(['users', 'getUser', { id: '123' }], userData);

      const result = getQueryData(queryClient, 'users', 'getUser', { id: '123' });
      expect(result).toEqual(userData);
    });

    it('returns undefined for uncached keys', () => {
      const result = getQueryData(queryClient, 'users', 'getUser', { id: 'nonexistent' });
      expect(result).toBeUndefined();
    });

    it('retrieves data for queries without input', () => {
      const healthData = { status: 'ok' };
      queryClient.setQueryData(['health', 'check'], healthData);

      const result = getQueryData(queryClient, 'health', 'check');
      expect(result).toEqual(healthData);
    });
  });

  describe('setQueryData', () => {
    it('sets data in the cache', () => {
      const userData = { id: '123', name: 'Test User' };
      setQueryData(queryClient, 'users', 'getUser', { id: '123' }, userData);

      const cached = queryClient.getQueryData(['users', 'getUser', { id: '123' }]);
      expect(cached).toEqual(userData);
    });

    it('overwrites existing cached data', () => {
      const oldData = { id: '123', name: 'Old Name' };
      const newData = { id: '123', name: 'New Name' };

      setQueryData(queryClient, 'users', 'getUser', { id: '123' }, oldData);
      setQueryData(queryClient, 'users', 'getUser', { id: '123' }, newData);

      const cached = queryClient.getQueryData(['users', 'getUser', { id: '123' }]);
      expect(cached).toEqual(newData);
    });
  });
});
