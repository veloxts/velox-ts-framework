/**
 * @veloxts/router - Resource API Tests
 * Tests the phantom type-based resource API for context-dependent output types
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type ADMIN,
  type AdminOutput,
  type ANONYMOUS,
  type AnonymousOutput,
  type AUTHENTICATED,
  type AuthenticatedOutput,
  getAccessibleLevels,
  isResourceSchema,
  isVisibleAtLevel,
  type OutputForTag,
  Resource,
  ResourceCollection,
  resource,
  resourceCollection,
  resourceSchema,
  type TaggedContext,
} from '../resource/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const UserSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .public('avatarUrl', z.string().url().nullable())
  .authenticated('email', z.string().email())
  .authenticated('createdAt', z.date())
  .admin('internalNotes', z.string().nullable())
  .admin('lastLoginIp', z.string().nullable())
  .build();

const testUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'John Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
  email: 'john@example.com',
  createdAt: new Date('2024-01-15'),
  internalNotes: 'VIP customer',
  lastLoginIp: '192.168.1.100',
};

const testUsers = [
  testUser,
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Jane Smith',
    avatarUrl: null,
    email: 'jane@example.com',
    createdAt: new Date('2024-02-20'),
    internalNotes: null,
    lastLoginIp: '10.0.0.1',
  },
];

// ============================================================================
// Schema Builder Tests
// ============================================================================

describe('Resource Schema Builder', () => {
  describe('resourceSchema()', () => {
    it('should create an empty schema builder', () => {
      const builder = resourceSchema();
      expect(builder).toBeDefined();
      expect(typeof builder.public).toBe('function');
      expect(typeof builder.authenticated).toBe('function');
      expect(typeof builder.admin).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    it('should build a schema with public fields', () => {
      const schema = resourceSchema().public('id', z.string()).public('name', z.string()).build();

      expect(schema.fields).toHaveLength(2);
      expect(schema.fields[0]).toEqual({
        name: 'id',
        schema: expect.any(Object),
        visibility: 'public',
      });
      expect(schema.fields[1]).toEqual({
        name: 'name',
        schema: expect.any(Object),
        visibility: 'public',
      });
    });

    it('should build a schema with mixed visibility fields', () => {
      const schema = resourceSchema()
        .public('id', z.string())
        .authenticated('email', z.string())
        .admin('secret', z.string())
        .build();

      expect(schema.fields).toHaveLength(3);
      expect(schema.fields[0].visibility).toBe('public');
      expect(schema.fields[1].visibility).toBe('authenticated');
      expect(schema.fields[2].visibility).toBe('admin');
    });

    it('should support the field() method with explicit visibility', () => {
      const schema = resourceSchema()
        .field('id', z.string(), 'public')
        .field('email', z.string(), 'authenticated')
        .field('secret', z.string(), 'admin')
        .build();

      expect(schema.fields).toHaveLength(3);
      expect(schema.fields[0].visibility).toBe('public');
      expect(schema.fields[1].visibility).toBe('authenticated');
      expect(schema.fields[2].visibility).toBe('admin');
    });
  });

  describe('isResourceSchema()', () => {
    it('should return true for valid resource schemas', () => {
      const schema = resourceSchema().public('id', z.string()).build();
      expect(isResourceSchema(schema)).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isResourceSchema(null)).toBe(false);
      expect(isResourceSchema(undefined)).toBe(false);
      expect(isResourceSchema('not a schema')).toBe(false);
      expect(isResourceSchema(123)).toBe(false);
    });

    it('should return false for objects without fields array', () => {
      expect(isResourceSchema({})).toBe(false);
      expect(isResourceSchema({ fields: 'not an array' })).toBe(false);
    });
  });
});

// ============================================================================
// Visibility Tests
// ============================================================================

describe('Visibility Helpers', () => {
  describe('isVisibleAtLevel()', () => {
    it('should allow public fields for all levels', () => {
      expect(isVisibleAtLevel('public', 'public')).toBe(true);
      expect(isVisibleAtLevel('public', 'authenticated')).toBe(true);
      expect(isVisibleAtLevel('public', 'admin')).toBe(true);
    });

    it('should allow authenticated fields for authenticated and admin', () => {
      expect(isVisibleAtLevel('authenticated', 'public')).toBe(false);
      expect(isVisibleAtLevel('authenticated', 'authenticated')).toBe(true);
      expect(isVisibleAtLevel('authenticated', 'admin')).toBe(true);
    });

    it('should allow admin fields only for admin', () => {
      expect(isVisibleAtLevel('admin', 'public')).toBe(false);
      expect(isVisibleAtLevel('admin', 'authenticated')).toBe(false);
      expect(isVisibleAtLevel('admin', 'admin')).toBe(true);
    });
  });

  describe('getAccessibleLevels()', () => {
    it('should return correct levels for public', () => {
      expect(getAccessibleLevels('public')).toEqual(['public']);
    });

    it('should return correct levels for authenticated', () => {
      expect(getAccessibleLevels('authenticated')).toEqual(['public', 'authenticated']);
    });

    it('should return correct levels for admin', () => {
      expect(getAccessibleLevels('admin')).toEqual(['public', 'authenticated', 'admin']);
    });
  });
});

// ============================================================================
// Resource Instance Tests
// ============================================================================

describe('Resource Instance', () => {
  describe('forAnonymous()', () => {
    it('should return only public fields', () => {
      const result = resource(testUser, UserSchema).forAnonymous();

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('internalNotes');
      expect(result).not.toHaveProperty('lastLoginIp');
    });
  });

  describe('forAuthenticated()', () => {
    it('should return public and authenticated fields', () => {
      const result = resource(testUser, UserSchema).forAuthenticated();

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        email: testUser.email,
        createdAt: testUser.createdAt,
      });
      expect(result).not.toHaveProperty('internalNotes');
      expect(result).not.toHaveProperty('lastLoginIp');
    });
  });

  describe('forAdmin()', () => {
    it('should return all fields', () => {
      const result = resource(testUser, UserSchema).forAdmin();

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        email: testUser.email,
        createdAt: testUser.createdAt,
        internalNotes: testUser.internalNotes,
        lastLoginIp: testUser.lastLoginIp,
      });
    });
  });

  describe('for() with context', () => {
    it('should return public fields for context without user', () => {
      const ctx = { auth: { isAuthenticated: false } };
      const result = resource(testUser, UserSchema).for(ctx as TaggedContext<typeof ANONYMOUS>);

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
      });
    });

    it('should return authenticated fields for context with user', () => {
      const ctx = {
        auth: { isAuthenticated: true },
        user: { id: '1', email: 'test@example.com' },
      };
      const result = resource(testUser, UserSchema).for(ctx as TaggedContext<typeof AUTHENTICATED>);

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        email: testUser.email,
        createdAt: testUser.createdAt,
      });
    });

    it('should return all fields for admin context', () => {
      const ctx = {
        auth: { isAuthenticated: true },
        user: { id: '1', email: 'admin@example.com', roles: ['admin'] },
        isAdmin: true,
      };
      const result = resource(testUser, UserSchema).for(ctx as TaggedContext<typeof ADMIN>);

      expect(result).toEqual({
        id: testUser.id,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        email: testUser.email,
        createdAt: testUser.createdAt,
        internalNotes: testUser.internalNotes,
        lastLoginIp: testUser.lastLoginIp,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing fields gracefully', () => {
      const partialUser = { id: '123', name: 'Test' };
      const result = resource(partialUser, UserSchema).forAdmin();

      expect(result).toEqual({
        id: '123',
        name: 'Test',
      });
      // Missing fields should not be included
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle null values', () => {
      const userWithNulls = { ...testUser, avatarUrl: null, internalNotes: null };
      const result = resource(userWithNulls, UserSchema).forAdmin();

      expect(result.avatarUrl).toBeNull();
      expect(result.internalNotes).toBeNull();
    });
  });
});

// ============================================================================
// Resource Collection Tests
// ============================================================================

describe('Resource Collection', () => {
  describe('forAnonymous()', () => {
    it('should project all items to public fields', () => {
      const results = resourceCollection(testUsers, UserSchema).forAnonymous();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: testUsers[0].id,
        name: testUsers[0].name,
        avatarUrl: testUsers[0].avatarUrl,
      });
      expect(results[1]).toEqual({
        id: testUsers[1].id,
        name: testUsers[1].name,
        avatarUrl: testUsers[1].avatarUrl,
      });
    });
  });

  describe('forAuthenticated()', () => {
    it('should project all items to authenticated fields', () => {
      const results = resourceCollection(testUsers, UserSchema).forAuthenticated();

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('email');
      expect(results[0]).toHaveProperty('createdAt');
      expect(results[0]).not.toHaveProperty('internalNotes');
    });
  });

  describe('forAdmin()', () => {
    it('should project all items to all fields', () => {
      const results = resourceCollection(testUsers, UserSchema).forAdmin();

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('internalNotes');
      expect(results[0]).toHaveProperty('lastLoginIp');
    });
  });

  describe('collection properties', () => {
    it('should report correct length', () => {
      const collection = resourceCollection(testUsers, UserSchema);
      expect(collection.length).toBe(2);
    });

    it('should detect empty collections', () => {
      const empty = resourceCollection([], UserSchema);
      expect(empty.isEmpty()).toBe(true);

      const notEmpty = resourceCollection(testUsers, UserSchema);
      expect(notEmpty.isEmpty()).toBe(false);
    });
  });
});

// ============================================================================
// Type-Level Tests (compile-time verification)
// ============================================================================

describe('Type Inference', () => {
  it('should infer correct types for anonymous output', () => {
    type AnonymousUser = AnonymousOutput<typeof UserSchema>;

    // This is a compile-time check - if types are wrong, this won't compile
    const user: AnonymousUser = {
      id: '123',
      name: 'Test',
      avatarUrl: null,
    };

    expect(user).toBeDefined();
  });

  it('should infer correct types for authenticated output', () => {
    type AuthenticatedUser = AuthenticatedOutput<typeof UserSchema>;

    const user: AuthenticatedUser = {
      id: '123',
      name: 'Test',
      avatarUrl: null,
      email: 'test@example.com',
      createdAt: new Date(),
    };

    expect(user).toBeDefined();
  });

  it('should infer correct types for admin output', () => {
    type AdminUser = AdminOutput<typeof UserSchema>;

    const user: AdminUser = {
      id: '123',
      name: 'Test',
      avatarUrl: null,
      email: 'test@example.com',
      createdAt: new Date(),
      internalNotes: 'Notes',
      lastLoginIp: '127.0.0.1',
    };

    expect(user).toBeDefined();
  });

  it('should compute output type based on context tag', () => {
    // Verify that OutputForTag computes correctly
    type AdminResult = OutputForTag<typeof UserSchema, typeof ADMIN>;

    // Verify TaggedContext can be instantiated with ADMIN tag
    const adminCtx: TaggedContext<typeof ADMIN> = {};
    expect(adminCtx).toBeDefined();

    // This is mainly a compile-time check
    const result: AdminResult = {
      id: '123',
      name: 'Test',
      avatarUrl: null,
      email: 'test@example.com',
      createdAt: new Date(),
      internalNotes: 'Notes',
      lastLoginIp: '127.0.0.1',
    };

    expect(result).toBeDefined();
  });
});

// ============================================================================
// Resource Class Direct Usage Tests
// ============================================================================

describe('Resource Class', () => {
  it('should be instantiable directly', () => {
    const res = new Resource(testUser, UserSchema);
    expect(res).toBeInstanceOf(Resource);
  });
});

describe('ResourceCollection Class', () => {
  it('should be instantiable directly', () => {
    const collection = new ResourceCollection(testUsers, UserSchema);
    expect(collection).toBeInstanceOf(ResourceCollection);
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('Security - Prototype Pollution Prevention', () => {
  it('should use null prototype for result objects', () => {
    const result = resource(testUser, UserSchema).forAnonymous();

    // Object.create(null) produces objects without prototype methods
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it('should skip __proto__ field to prevent prototype pollution', () => {
    const dangerousSchema = resourceSchema()
      .public('id', z.string())
      .public('__proto__', z.object({ polluted: z.boolean() }))
      .build();

    const dangerousData = {
      id: '123',
      __proto__: { polluted: true },
    };

    // Store original Object.prototype state
    const originalPrototype = { ...Object.prototype };

    const result = resource(dangerousData, dangerousSchema).forAnonymous();

    // Verify __proto__ field was skipped
    expect(result).toEqual({ id: '123' });
    expect('__proto__' in result).toBe(false);

    // Verify global Object.prototype was not polluted
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype).toEqual(originalPrototype);
  });

  it('should skip constructor field to prevent prototype pollution', () => {
    const dangerousSchema = resourceSchema()
      .public('name', z.string())
      .public('constructor', z.string())
      .build();

    const dangerousData = {
      name: 'test',
      constructor: 'malicious',
    };

    const result = resource(dangerousData, dangerousSchema).forAnonymous();

    // Verify constructor field was skipped
    expect(result).toEqual({ name: 'test' });
    expect('constructor' in result).toBe(false);
  });

  it('should skip prototype field to prevent prototype pollution', () => {
    const dangerousSchema = resourceSchema()
      .public('value', z.number())
      .public('prototype', z.object({}))
      .build();

    const dangerousData = {
      value: 42,
      prototype: { malicious: true },
    };

    const result = resource(dangerousData, dangerousSchema).forAnonymous();

    // Verify prototype field was skipped
    expect(result).toEqual({ value: 42 });
    expect('prototype' in result).toBe(false);
  });

  it('should protect all visibility levels from prototype pollution', () => {
    const dangerousSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('__proto__', z.object({}))
      .admin('constructor', z.string())
      .build();

    const dangerousData = {
      id: '123',
      __proto__: { polluted: true },
      constructor: 'malicious',
    };

    // Test all projection methods
    const anonResult = resource(dangerousData, dangerousSchema).forAnonymous();
    const authResult = resource(dangerousData, dangerousSchema).forAuthenticated();
    const adminResult = resource(dangerousData, dangerousSchema).forAdmin();

    // All results should only contain safe fields
    expect(anonResult).toEqual({ id: '123' });
    expect(authResult).toEqual({ id: '123' });
    expect(adminResult).toEqual({ id: '123' });

    // Verify no prototype pollution occurred
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should protect ResourceCollection from prototype pollution', () => {
    const dangerousSchema = resourceSchema()
      .public('id', z.string())
      .public('__proto__', z.object({ polluted: z.boolean() }))
      .build();

    const dangerousItems = [
      { id: '1', __proto__: { polluted: true } },
      { id: '2', __proto__: { polluted: true } },
    ];

    const results = resourceCollection(dangerousItems, dangerousSchema).forAnonymous();

    // Verify all items only contain safe fields
    expect(results).toEqual([{ id: '1' }, { id: '2' }]);

    // Verify no prototype pollution occurred
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ============================================================================
// Auto-Projection with executeProcedure Tests
// ============================================================================

describe('Auto-Projection with .resource() in Procedure Builder', () => {
  // Note: Full integration tests with executeProcedure require mocking
  // Fastify request/reply. These tests verify the Resource class behavior
  // that underlies auto-projection.

  it('should project based on access level', () => {
    // Simulate what executeProcedure does with different access levels
    const data = {
      id: '123',
      name: 'John',
      email: 'john@example.com',
      internalNotes: 'VIP',
    };

    const schema = resourceSchema()
      .public('id', z.string())
      .public('name', z.string())
      .authenticated('email', z.string())
      .admin('internalNotes', z.string())
      .build();

    // Public access level
    const publicResult = new Resource(data, schema).forAnonymous();
    expect(publicResult).toEqual({ id: '123', name: 'John' });

    // Authenticated access level
    const authResult = new Resource(data, schema).forAuthenticated();
    expect(authResult).toEqual({ id: '123', name: 'John', email: 'john@example.com' });

    // Admin access level
    const adminResult = new Resource(data, schema).forAdmin();
    expect(adminResult).toEqual({
      id: '123',
      name: 'John',
      email: 'john@example.com',
      internalNotes: 'VIP',
    });
  });

  it('should handle missing fields gracefully', () => {
    const partialData = {
      id: '123',
      name: 'John',
      // email and internalNotes are missing
    };

    const schema = resourceSchema()
      .public('id', z.string())
      .public('name', z.string())
      .authenticated('email', z.string())
      .admin('internalNotes', z.string())
      .build();

    // Should only include fields that exist in data
    const authResult = new Resource(partialData, schema).forAuthenticated();
    expect(authResult).toEqual({ id: '123', name: 'John' });
    expect('email' in authResult).toBe(false);
  });
});
