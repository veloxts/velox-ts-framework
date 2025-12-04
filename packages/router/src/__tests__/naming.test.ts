/**
 * @veloxts/router - REST Naming Convention Tests
 * Tests parsing of procedure names into REST routes using conventions
 */

import { describe, expect, it } from 'vitest';

import {
  buildRestPath,
  followsNamingConvention,
  inferResourceName,
  parseNamingConvention,
} from '../rest/naming.js';

describe('parseNamingConvention', () => {
  describe('GET with ID - single resource', () => {
    it('should parse getX pattern', () => {
      const result = parseNamingConvention('getUser', 'query');

      expect(result).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });
    });

    it('should parse get with camelCase names', () => {
      expect(parseNamingConvention('getUserProfile', 'query')).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });

      expect(parseNamingConvention('getOrderItem', 'query')).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });
    });

    it('should reject get pattern for mutations', () => {
      const result = parseNamingConvention('getUser', 'mutation');

      expect(result).toBeUndefined();
    });
  });

  describe('GET without ID - list/collection', () => {
    it('should parse listX pattern', () => {
      const result = parseNamingConvention('listUsers', 'query');

      expect(result).toEqual({
        method: 'GET',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should parse list with camelCase names', () => {
      expect(parseNamingConvention('listUserProfiles', 'query')).toEqual({
        method: 'GET',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should reject list pattern for mutations', () => {
      const result = parseNamingConvention('listUsers', 'mutation');

      expect(result).toBeUndefined();
    });
  });

  describe('GET without ID - search/find', () => {
    it('should parse findX pattern', () => {
      const result = parseNamingConvention('findUsers', 'query');

      expect(result).toEqual({
        method: 'GET',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should parse find with camelCase names', () => {
      expect(parseNamingConvention('findActiveUsers', 'query')).toEqual({
        method: 'GET',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should reject find pattern for mutations', () => {
      const result = parseNamingConvention('findUsers', 'mutation');

      expect(result).toBeUndefined();
    });
  });

  describe('POST - create resource', () => {
    it('should parse createX pattern', () => {
      const result = parseNamingConvention('createUser', 'mutation');

      expect(result).toEqual({
        method: 'POST',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should parse create with camelCase names', () => {
      expect(parseNamingConvention('createUserProfile', 'mutation')).toEqual({
        method: 'POST',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should reject create pattern for queries', () => {
      const result = parseNamingConvention('createUser', 'query');

      expect(result).toBeUndefined();
    });
  });

  describe('POST - add resource (alias)', () => {
    it('should parse addX pattern', () => {
      const result = parseNamingConvention('addUser', 'mutation');

      expect(result).toEqual({
        method: 'POST',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should parse add with camelCase names', () => {
      expect(parseNamingConvention('addTeamMember', 'mutation')).toEqual({
        method: 'POST',
        path: '/',
        hasIdParam: false,
      });
    });

    it('should reject add pattern for queries', () => {
      const result = parseNamingConvention('addUser', 'query');

      expect(result).toBeUndefined();
    });
  });

  describe('Unknown patterns', () => {
    it('should return undefined for unknown query patterns', () => {
      expect(parseNamingConvention('fetchUser', 'query')).toBeUndefined();
      expect(parseNamingConvention('retrieveUser', 'query')).toBeUndefined();
      expect(parseNamingConvention('doSomething', 'query')).toBeUndefined();
    });

    it('should return undefined for unknown mutation patterns', () => {
      expect(parseNamingConvention('updateUser', 'mutation')).toBeUndefined();
      expect(parseNamingConvention('deleteUser', 'mutation')).toBeUndefined();
      expect(parseNamingConvention('saveUser', 'mutation')).toBeUndefined();
    });

    it('should return undefined for lowercase prefixes', () => {
      expect(parseNamingConvention('getuser', 'query')).toBeUndefined();
      expect(parseNamingConvention('createuser', 'mutation')).toBeUndefined();
    });

    it('should return undefined for non-prefixed names', () => {
      expect(parseNamingConvention('User', 'query')).toBeUndefined();
      expect(parseNamingConvention('users', 'query')).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle single letter resource names', () => {
      expect(parseNamingConvention('getX', 'query')).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });
    });

    it('should handle very long resource names', () => {
      expect(parseNamingConvention('getUserProfileSettingPreference', 'query')).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });
    });

    it('should handle acronyms in resource names', () => {
      expect(parseNamingConvention('getAPIKey', 'query')).toEqual({
        method: 'GET',
        path: '/:id',
        hasIdParam: true,
      });
    });
  });
});

describe('buildRestPath', () => {
  it('should build path for root collection', () => {
    const mapping = { method: 'GET', path: '/', hasIdParam: false } as const;

    const path = buildRestPath('users', mapping);

    expect(path).toBe('/users');
  });

  it('should build path with ID parameter', () => {
    const mapping = { method: 'GET', path: '/:id', hasIdParam: true } as const;

    const path = buildRestPath('users', mapping);

    expect(path).toBe('/users/:id');
  });

  it('should handle namespace with no trailing slash', () => {
    const mapping = { method: 'POST', path: '/', hasIdParam: false } as const;

    const path = buildRestPath('posts', mapping);

    expect(path).toBe('/posts');
  });

  it('should handle multi-segment namespaces', () => {
    const mapping = { method: 'GET', path: '/:id', hasIdParam: true } as const;

    const path = buildRestPath('api/users', mapping);

    expect(path).toBe('/api/users/:id');
  });

  it('should handle custom path patterns', () => {
    const mapping = { method: 'POST', path: '/:id/activate', hasIdParam: true } as const;

    const path = buildRestPath('users', mapping);

    expect(path).toBe('/users/:id/activate');
  });

  it('should not add trailing slash for root', () => {
    const mapping = { method: 'GET', path: '/', hasIdParam: false } as const;

    const path = buildRestPath('items', mapping);

    expect(path).toBe('/items');
    expect(path).not.toBe('/items/');
  });
});

describe('inferResourceName', () => {
  it('should infer resource from get pattern', () => {
    expect(inferResourceName('getUser')).toBe('User');
    expect(inferResourceName('getUserProfile')).toBe('UserProfile');
  });

  it('should infer resource from list pattern', () => {
    expect(inferResourceName('listUsers')).toBe('Users');
    expect(inferResourceName('listUserProfiles')).toBe('UserProfiles');
  });

  it('should infer resource from find pattern', () => {
    expect(inferResourceName('findUser')).toBe('User');
    expect(inferResourceName('findActiveUsers')).toBe('ActiveUsers');
  });

  it('should infer resource from create pattern', () => {
    expect(inferResourceName('createUser')).toBe('User');
    expect(inferResourceName('createUserProfile')).toBe('UserProfile');
  });

  it('should infer resource from add pattern', () => {
    expect(inferResourceName('addUser')).toBe('User');
    expect(inferResourceName('addTeamMember')).toBe('TeamMember');
  });

  it('should return undefined for unknown patterns', () => {
    expect(inferResourceName('fetchUser')).toBeUndefined();
    expect(inferResourceName('doSomething')).toBeUndefined();
    expect(inferResourceName('User')).toBeUndefined();
  });

  it('should handle single letter resources', () => {
    expect(inferResourceName('getX')).toBe('X');
  });

  it('should preserve case in resource names', () => {
    expect(inferResourceName('getAPIKey')).toBe('APIKey');
    expect(inferResourceName('createIOSDevice')).toBe('IOSDevice');
  });
});

describe('followsNamingConvention', () => {
  it('should return true for valid query conventions', () => {
    expect(followsNamingConvention('getUser', 'query')).toBe(true);
    expect(followsNamingConvention('listUsers', 'query')).toBe(true);
    expect(followsNamingConvention('findUsers', 'query')).toBe(true);
  });

  it('should return true for valid mutation conventions', () => {
    expect(followsNamingConvention('createUser', 'mutation')).toBe(true);
    expect(followsNamingConvention('addUser', 'mutation')).toBe(true);
  });

  it('should return false for invalid conventions', () => {
    expect(followsNamingConvention('fetchUser', 'query')).toBe(false);
    expect(followsNamingConvention('updateUser', 'mutation')).toBe(false);
    expect(followsNamingConvention('doSomething', 'query')).toBe(false);
  });

  it('should return false for mismatched type', () => {
    expect(followsNamingConvention('getUser', 'mutation')).toBe(false);
    expect(followsNamingConvention('createUser', 'query')).toBe(false);
  });
});

describe('Comprehensive naming scenarios', () => {
  it('should handle complete REST resource patterns', () => {
    const namespace = 'users';

    // GET /users/:id
    const getMapping = parseNamingConvention('getUser', 'query');
    expect(getMapping).toBeDefined();
    if (getMapping) {
      expect(buildRestPath(namespace, getMapping)).toBe('/users/:id');
    }

    // GET /users
    const listMapping = parseNamingConvention('listUsers', 'query');
    expect(listMapping).toBeDefined();
    if (listMapping) {
      expect(buildRestPath(namespace, listMapping)).toBe('/users');
    }

    // POST /users
    const createMapping = parseNamingConvention('createUser', 'mutation');
    expect(createMapping).toBeDefined();
    if (createMapping) {
      expect(buildRestPath(namespace, createMapping)).toBe('/users');
    }
  });

  it('should handle nested resource patterns', () => {
    const namespace = 'users/posts';

    const getMapping = parseNamingConvention('getPost', 'query');
    expect(getMapping).toBeDefined();
    if (getMapping) {
      expect(buildRestPath(namespace, getMapping)).toBe('/users/posts/:id');
    }
  });

  it('should differentiate between similar patterns', () => {
    // list vs get
    const list = parseNamingConvention('listUsers', 'query');
    const get = parseNamingConvention('getUser', 'query');

    expect(list?.hasIdParam).toBe(false);
    expect(get?.hasIdParam).toBe(true);

    // create vs add (both should be POST)
    const create = parseNamingConvention('createUser', 'mutation');
    const add = parseNamingConvention('addUser', 'mutation');

    expect(create?.method).toBe('POST');
    expect(add?.method).toBe('POST');
  });

  it('should handle plural vs singular resource names', () => {
    // Framework doesn't care about pluralization - it's up to the developer
    expect(parseNamingConvention('getUsers', 'query')).toEqual({
      method: 'GET',
      path: '/:id',
      hasIdParam: true,
    });

    expect(parseNamingConvention('listUser', 'query')).toEqual({
      method: 'GET',
      path: '/',
      hasIdParam: false,
    });
  });
});
