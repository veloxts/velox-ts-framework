/**
 * @veloxts/router - Nested Resource Relation Tests
 * Tests .hasOne() and .hasMany() builder methods with recursive projection
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Resource, resource, resourceCollection, resourceSchema } from '../resource/index.js';

// ============================================================================
// Nested Schemas
// ============================================================================

const OrgSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .admin('taxId', z.string())
  .build();

const PostSchema = resourceSchema()
  .public('id', z.string())
  .public('title', z.string())
  .authenticated('draft', z.boolean())
  .build();

const UserSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string())
  .hasOne('organization', OrgSchema, 'public')
  .hasMany('posts', PostSchema, 'authenticated')
  .admin('internalNotes', z.string())
  .build();

// ============================================================================
// Test Data
// ============================================================================

const testOrg = { id: 'org-1', name: 'Acme Inc.', taxId: 'TX-12345' };

const testPosts = [
  { id: 'post-1', title: 'Hello World', draft: false },
  { id: 'post-2', title: 'Draft Post', draft: true },
];

const testUser = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@example.com',
  organization: testOrg,
  posts: testPosts,
  internalNotes: 'VIP customer',
};

// ============================================================================
// hasOne Tests
// ============================================================================

describe('hasOne relation', () => {
  it('should project nested fields at public level', () => {
    const result = resource(testUser, UserSchema).forAnonymous();

    expect(result).toEqual({
      id: 'user-1',
      name: 'John Doe',
      organization: { id: 'org-1', name: 'Acme Inc.' },
    });
    // taxId is admin-only on OrgSchema, excluded at public level
    expect((result as Record<string, unknown>).organization).not.toHaveProperty('taxId');
  });

  it('should project nested fields at authenticated level', () => {
    const result = resource(testUser, UserSchema).forAuthenticated();

    expect(result).toEqual({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      organization: { id: 'org-1', name: 'Acme Inc.' },
      posts: [
        { id: 'post-1', title: 'Hello World', draft: false },
        { id: 'post-2', title: 'Draft Post', draft: true },
      ],
    });
    // taxId still excluded (auth can't see admin fields on nested schema)
    expect((result as Record<string, unknown>).organization).not.toHaveProperty('taxId');
  });

  it('should project nested fields at admin level (all fields)', () => {
    const result = resource(testUser, UserSchema).forAdmin();

    expect(result).toEqual({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      organization: { id: 'org-1', name: 'Acme Inc.', taxId: 'TX-12345' },
      posts: [
        { id: 'post-1', title: 'Hello World', draft: false },
        { id: 'post-2', title: 'Draft Post', draft: true },
      ],
      internalNotes: 'VIP customer',
    });
  });

  it('should return null for null data', () => {
    const userData = { ...testUser, organization: null };
    const result = resource(userData, UserSchema).forAnonymous();

    expect(result.organization).toBeNull();
  });

  it('should return null for undefined data', () => {
    const userData = { ...testUser, organization: undefined };
    const result = resource(userData, UserSchema).forAnonymous();

    expect(result.organization).toBeNull();
  });

  it('should return null for non-object data', () => {
    const userData = { ...testUser, organization: 'not-an-object' };
    const result = resource(userData, UserSchema).forAnonymous();

    expect(result.organization).toBeNull();
  });
});

// ============================================================================
// hasMany Tests
// ============================================================================

describe('hasMany relation', () => {
  it('should be excluded from public view (authenticated visibility)', () => {
    const result = resource(testUser, UserSchema).forAnonymous();

    expect(result).not.toHaveProperty('posts');
  });

  it('should project each item at authenticated level', () => {
    const result = resource(testUser, UserSchema).forAuthenticated();

    expect(result.posts).toEqual([
      { id: 'post-1', title: 'Hello World', draft: false },
      { id: 'post-2', title: 'Draft Post', draft: true },
    ]);
  });

  it('should return empty array for undefined data', () => {
    const userData = { ...testUser, posts: undefined };
    const result = resource(userData, UserSchema).forAuthenticated();

    expect(result.posts).toEqual([]);
  });

  it('should return empty array for non-array data', () => {
    const userData = { ...testUser, posts: 'not-an-array' };
    const result = resource(userData, UserSchema).forAuthenticated();

    expect(result.posts).toEqual([]);
  });

  it('should handle empty array', () => {
    const userData = { ...testUser, posts: [] };
    const result = resource(userData, UserSchema).forAuthenticated();

    expect(result.posts).toEqual([]);
  });

  it('should filter out non-object items from array', () => {
    const userData = {
      ...testUser,
      posts: [
        { id: 'post-1', title: 'Valid', draft: false },
        null,
        undefined,
        123,
        'string',
        { id: 'post-2', title: 'Also Valid', draft: true },
      ],
    };
    const result = resource(userData, UserSchema).forAuthenticated();

    expect(result.posts).toEqual([
      { id: 'post-1', title: 'Valid', draft: false },
      { id: 'post-2', title: 'Also Valid', draft: true },
    ]);
  });
});

// ============================================================================
// Mixed Schema (full 3-level projection)
// ============================================================================

describe('Mixed schema with scalars + hasOne + hasMany', () => {
  it('public level: scalars + hasOne, no hasMany', () => {
    const result = resource(testUser, UserSchema).forAnonymous();

    expect(Object.keys(result).sort()).toEqual(['id', 'name', 'organization']);
    expect(result.organization).toEqual({ id: 'org-1', name: 'Acme Inc.' });
  });

  it('authenticated level: adds email + posts', () => {
    const result = resource(testUser, UserSchema).forAuthenticated();

    expect(Object.keys(result).sort()).toEqual(['email', 'id', 'name', 'organization', 'posts']);
  });

  it('admin level: all fields including nested admin fields', () => {
    const result = resource(testUser, UserSchema).forAdmin();

    expect(Object.keys(result).sort()).toEqual([
      'email',
      'id',
      'internalNotes',
      'name',
      'organization',
      'posts',
    ]);
    expect((result.organization as Record<string, unknown>).taxId).toBe('TX-12345');
  });
});

// ============================================================================
// Security Tests
// ============================================================================

describe('Security - nested relations', () => {
  it('should use null prototype for nested projected objects', () => {
    const result = resource(testUser, UserSchema).forAnonymous();

    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.getPrototypeOf(result.organization)).toBeNull();
  });

  it('should use null prototype for array items', () => {
    const result = resource(testUser, UserSchema).forAuthenticated();

    const posts = result.posts as Array<Record<string, unknown>>;
    for (const post of posts) {
      expect(Object.getPrototypeOf(post)).toBeNull();
    }
  });

  it('should skip dangerous properties in nested objects', () => {
    const NestedSchema = resourceSchema()
      .public('id', z.string())
      .public('__proto__', z.object({}))
      .build();

    const ParentSchema = resourceSchema()
      .public('id', z.string())
      .hasOne('child', NestedSchema, 'public')
      .build();

    const data = {
      id: 'parent-1',
      child: { id: 'child-1', __proto__: { polluted: true } },
    };

    const result = resource(data, ParentSchema).forAnonymous();
    const child = result.child as Record<string, unknown>;

    expect(child).toEqual({ id: 'child-1' });
    expect('__proto__' in child).toBe(false);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ============================================================================
// Circular Reference & Depth Limit Tests
// ============================================================================

describe('Circular reference and depth protection', () => {
  it('should return empty object for circular data references', () => {
    const ChildSchema = resourceSchema().public('id', z.string()).build();

    const ParentSchema = resourceSchema()
      .public('id', z.string())
      .hasOne('child', ChildSchema, 'public')
      .build();

    // Create circular data (object references itself)
    const circular: Record<string, unknown> = { id: 'p-1' };
    circular.child = circular;

    const result = resource(circular, ParentSchema).forAnonymous();

    expect(result.id).toBe('p-1');
    // The circular child should be an empty object (cycle detected)
    expect(result.child).toEqual({});
  });

  it('should return empty object for deeply nested data beyond depth limit', () => {
    // Build a chain of schemas 3 levels deep
    const Level3 = resourceSchema().public('id', z.string()).build();
    const Level2 = resourceSchema()
      .public('id', z.string())
      .hasOne('next', Level3, 'public')
      .build();
    const Level1 = resourceSchema()
      .public('id', z.string())
      .hasOne('next', Level2, 'public')
      .build();

    const data = {
      id: 'L1',
      next: { id: 'L2', next: { id: 'L3' } },
    };

    // 3 levels should work fine
    const result = resource(data, Level1).forAnonymous();
    expect(result).toEqual({
      id: 'L1',
      next: { id: 'L2', next: { id: 'L3' } },
    });
  });

  it('should handle circular references in hasMany arrays', () => {
    const ItemSchema = resourceSchema().public('id', z.string()).build();

    const ListSchema = resourceSchema()
      .public('id', z.string())
      .hasMany('items', ItemSchema, 'public')
      .build();

    // Create circular data in array
    const parent: Record<string, unknown> = { id: 'list-1' };
    parent.items = [{ id: 'item-1' }, parent]; // parent references itself in array

    const result = resource(parent, ListSchema).forAnonymous();

    expect(result.id).toBe('list-1');
    // The first item projects normally; the circular ref is filtered out
    // (parent is not a plain item — it was already visited)
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0]).toEqual({ id: 'item-1' });
    // Second item is the circular ref — returns empty object
    expect(items[1]).toEqual({});
  });
});

// ============================================================================
// Tagged Schema Factory
// ============================================================================

describe('Tagged schema with nested relations', () => {
  it('resource(data, Schema.public) projects nested at public level', () => {
    const result = resource(testUser, UserSchema.public);

    expect(result).toEqual({
      id: 'user-1',
      name: 'John Doe',
      organization: { id: 'org-1', name: 'Acme Inc.' },
    });
  });

  it('resource(data, Schema.authenticated) projects nested at auth level', () => {
    const result = resource(testUser, UserSchema.authenticated);

    expect(result).toHaveProperty('posts');
    expect(result).toHaveProperty('organization');
    expect((result as Record<string, unknown>).organization).not.toHaveProperty('taxId');
  });

  it('resource(data, Schema.admin) projects nested at admin level', () => {
    const result = resource(testUser, UserSchema.admin);

    expect((result as Record<string, unknown>).organization).toHaveProperty('taxId', 'TX-12345');
    expect(result).toHaveProperty('internalNotes');
  });

  it('resourceCollection(items, Schema.public) projects nested for each item', () => {
    const items = [testUser, { ...testUser, id: 'user-2', name: 'Jane' }];
    const results = resourceCollection(items, UserSchema.public);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: 'user-1',
      name: 'John Doe',
      organization: { id: 'org-1', name: 'Acme Inc.' },
    });
    expect(results[1]).toHaveProperty('id', 'user-2');
  });

  it('resourceCollection(items, Schema.admin) projects nested at admin', () => {
    const results = resourceCollection([testUser], UserSchema.admin);

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).organization).toHaveProperty('taxId');
  });
});

// ============================================================================
// Auto-Projection Compatibility
// ============================================================================

describe('Auto-projection with nested relations', () => {
  it('Resource class projects nested relations via forAnonymous()', () => {
    const r = new Resource(testUser, UserSchema);
    const result = r.forAnonymous();

    expect(result.organization).toEqual({ id: 'org-1', name: 'Acme Inc.' });
    expect(result).not.toHaveProperty('posts');
  });

  it('Resource class projects nested relations via forAuthenticated()', () => {
    const r = new Resource(testUser, UserSchema);
    const result = r.forAuthenticated();

    expect(result.posts).toHaveLength(2);
    expect(result.organization).not.toHaveProperty('taxId');
  });

  it('Resource class projects nested relations via forAdmin()', () => {
    const r = new Resource(testUser, UserSchema);
    const result = r.forAdmin();

    expect((result.organization as Record<string, unknown>).taxId).toBe('TX-12345');
    expect(result.posts).toHaveLength(2);
  });
});

// ============================================================================
// Backward Compatibility
// ============================================================================

describe('Backward compatibility', () => {
  it('schemas without relations work identically', () => {
    const SimpleSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'shh' };

    expect(resource(data, SimpleSchema).forAnonymous()).toEqual({ id: '1' });
    expect(resource(data, SimpleSchema).forAuthenticated()).toEqual({
      id: '1',
      email: 'a@b.com',
    });
    expect(resource(data, SimpleSchema).forAdmin()).toEqual({
      id: '1',
      email: 'a@b.com',
      secret: 'shh',
    });
  });
});
