/**
 * Tests for custom access levels
 *
 * Covers defineAccessLevels(), custom schema builder (Proxy-based),
 * set-based visibility, forLevel(), and procedure integration.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  defaultAccess,
  defineAccessLevels,
  Resource,
  ResourceCollection,
  resource,
  resourceCollection,
  resourceSchema,
} from '../resource/index.js';
import { isFieldVisibleToLevel } from '../resource/visibility.js';

// ============================================================================
// defineAccessLevels()
// ============================================================================

describe('defineAccessLevels', () => {
  it('should create a config with levels and no groups', () => {
    const config = defineAccessLevels(['public', 'authenticated', 'admin']);
    expect(config.levels).toEqual(['public', 'authenticated', 'admin']);
    expect(config.groups).toEqual({});
    expect(config.allLevels()).toEqual(new Set(['public', 'authenticated', 'admin']));
  });

  it('should create a config with levels and groups', () => {
    const config = defineAccessLevels(
      ['public', 'reviewer', 'authenticated', 'moderator', 'admin'],
      {
        everyone: '*',
        internal: ['reviewer', 'moderator', 'admin'],
        staff: ['moderator', 'admin'],
      }
    );

    expect(config.levels).toEqual(['public', 'reviewer', 'authenticated', 'moderator', 'admin']);
    expect(config.resolve('everyone')).toEqual(
      new Set(['public', 'reviewer', 'authenticated', 'moderator', 'admin'])
    );
    expect(config.resolve('internal')).toEqual(new Set(['reviewer', 'moderator', 'admin']));
    expect(config.resolve('staff')).toEqual(new Set(['moderator', 'admin']));
  });

  it('should reject fewer than 2 levels', () => {
    expect(() => defineAccessLevels(['solo'])).toThrow('at least 2 levels');
  });

  it('should reject duplicate levels', () => {
    expect(() => defineAccessLevels(['public', 'public'])).toThrow('Duplicate level');
  });

  it('should reject group names that collide with level names', () => {
    expect(() => defineAccessLevels(['public', 'admin'], { public: ['admin'] })).toThrow(
      'collides with a level name'
    );
  });

  it('should reject groups referencing unknown levels', () => {
    expect(() => defineAccessLevels(['public', 'admin'], { staff: ['unknown'] })).toThrow(
      'references unknown level'
    );
  });

  it('should reject empty groups', () => {
    expect(() => defineAccessLevels(['public', 'admin'], { empty: [] })).toThrow(
      'must contain at least one level'
    );
  });

  it('should resolve unknown group name with an error', () => {
    const config = defineAccessLevels(['public', 'admin']);
    expect(() => (config as ReturnType<typeof defineAccessLevels>).resolve('nonexistent')).toThrow(
      'Unknown group'
    );
  });
});

// ============================================================================
// defineAccessLevels with guards
// ============================================================================

describe('defineAccessLevels with guards', () => {
  it('accepts guards in options object', () => {
    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: (ctx: Record<string, unknown>) => !!ctx.user,
        admin: (ctx: Record<string, unknown>) => {
          const user = ctx.user as Record<string, unknown> | undefined;
          return user?.role === 'admin';
        },
      },
    });
    expect(access.guards).toBeDefined();
    expect(access.guards.authenticated).toBeTypeOf('function');
    expect(access.guards.admin).toBeTypeOf('function');
  });

  it('does not require a guard for the first (public) level', () => {
    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: () => true,
        admin: () => false,
      },
    });
    expect(access.guards.public).toBeUndefined();
  });

  it('accepts both guards and groups together', () => {
    const access = defineAccessLevels(['public', 'reviewer', 'editor', 'admin'], {
      guards: {
        reviewer: () => true,
        editor: () => true,
        admin: () => false,
      },
      groups: {
        staff: ['editor', 'admin'],
      },
    });
    expect(access.guards).toBeDefined();
    expect(access.groups).toBeDefined();
    expect(access.resolve('staff')).toEqual(new Set(['editor', 'admin']));
  });

  it('rejects guard keys that do not match any level name', () => {
    expect(() =>
      defineAccessLevels(['public', 'authenticated', 'admin'], {
        guards: {
          authenticated: () => true,
          admin: () => false,
          nonexistent: () => false,
        },
      })
    ).toThrow('unknown level');
  });

  it('rejects a guard for the first (public) level', () => {
    expect(() =>
      defineAccessLevels(['public', 'authenticated', 'admin'], {
        guards: {
          public: () => true,
          authenticated: () => true,
          admin: () => false,
        },
      })
    ).toThrow('first level');
  });

  it('supports async guard functions', async () => {
    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: async (ctx: Record<string, unknown>) => !!ctx.user,
        admin: async (ctx: Record<string, unknown>) => {
          const user = ctx.user as Record<string, unknown> | undefined;
          return user?.role === 'admin';
        },
      },
    });
    const adminCtx = { user: { role: 'admin' } };
    expect(await access.guards.admin(adminCtx)).toBe(true);
    expect(await access.guards.authenticated(adminCtx)).toBe(true);
    expect(await access.guards.authenticated({})).toBe(false);
  });

  it('accepts guards with _narrows phantom type', () => {
    interface AuthenticatedNarrow {
      user: { id: string; email: string };
    }

    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: Object.assign((ctx: Record<string, unknown>) => !!ctx.user, {
          _narrows: undefined as unknown as AuthenticatedNarrow,
        }),
        admin: () => false,
      },
    });
    // _narrows is a phantom — runtime value is undefined
    expect(access.guards.authenticated._narrows).toBeUndefined();
  });

  it('stores guards on the returned config', () => {
    const authenticatedGuard = () => true;
    const adminGuard = () => false;
    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      guards: {
        authenticated: authenticatedGuard,
        admin: adminGuard,
      },
    });
    expect(access.guards.authenticated).toBe(authenticatedGuard);
    expect(access.guards.admin).toBe(adminGuard);
  });

  it('preserves backward compatibility — groups-only second arg still works', () => {
    // Old-style: second arg is just groups (no guards/groups wrapper)
    // After the change, the old-style still works because we detect the shape
    const access = defineAccessLevels(['public', 'authenticated', 'admin'], {
      groups: {
        staff: ['authenticated', 'admin'],
      },
    });
    expect(access.resolve('staff')).toEqual(new Set(['authenticated', 'admin']));
  });
});

// ============================================================================
// defaultAccess
// ============================================================================

describe('defaultAccess', () => {
  it('provides built-in public/authenticated/admin levels', () => {
    expect(defaultAccess.levels).toEqual(['public', 'authenticated', 'admin']);
  });

  it('provides guards for authenticated and admin', () => {
    expect(defaultAccess.guards.authenticated).toBeTypeOf('function');
    expect(defaultAccess.guards.admin).toBeTypeOf('function');
  });

  it('does not have a guard for public', () => {
    expect(defaultAccess.guards.public).toBeUndefined();
  });

  it('authenticated guard checks for ctx.user existence', () => {
    const guard = defaultAccess.guards.authenticated;
    expect(guard?.({ user: { id: '1', email: 'a@b.com' } })).toBe(true);
    expect(guard?.({})).toBe(false);
    expect(guard?.({ user: undefined })).toBe(false);
  });

  it('admin guard checks ctx.user.role === admin', () => {
    const guard = defaultAccess.guards.admin;
    expect(guard?.({ user: { id: '1', email: 'a@b.com', role: 'admin' } })).toBe(true);
    expect(guard?.({ user: { id: '1', email: 'a@b.com', role: 'user' } })).toBe(false);
    expect(guard?.({})).toBe(false);
  });

  it('authenticated guard carries _narrows phantom type', () => {
    const guard = defaultAccess.guards.authenticated;
    expect(guard).toHaveProperty('_narrows');
  });

  it('admin guard carries _narrows phantom type', () => {
    const guard = defaultAccess.guards.admin;
    expect(guard).toHaveProperty('_narrows');
  });

  it('works with resourceSchema() for field visibility', () => {
    // defaultAccess is a custom level config, so level methods use
    // single-level sets (non-hierarchical). Use groups for hierarchy.
    const UserSchema = resourceSchema(defaultAccess)
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'x' };

    // Custom levels: each level method assigns single-level visibility
    // public sees only public fields, authenticated sees only authenticated, etc.
    expect(resource(data, UserSchema.public)).toEqual({ id: '1' });
    expect(resource(data, UserSchema.authenticated)).toEqual({ email: 'a@b.com' });
    expect(resource(data, UserSchema.admin)).toEqual({ secret: 'x' });
  });
});

// ============================================================================
// Custom schema builder (Proxy-based)
// ============================================================================

describe('resourceSchema(config) — custom builder', () => {
  const access = defineAccessLevels(['public', 'reviewer', 'authenticated', 'moderator', 'admin'], {
    everyone: '*',
    internal: ['reviewer', 'moderator', 'admin'],
    staff: ['moderator', 'admin'],
  });

  it('should provide group methods as fluent builders', () => {
    const schema = resourceSchema(access)
      .everyone('id', z.string().uuid())
      .everyone('title', z.string())
      .internal('reviewerNotes', z.string())
      .staff('moderationLog', z.string())
      .build();

    expect(schema.fields).toHaveLength(4);
    expect(schema.fields[0].name).toBe('id');
    expect(schema.fields[0].visibleTo).toEqual(
      new Set(['public', 'reviewer', 'authenticated', 'moderator', 'admin'])
    );
    expect(schema.fields[2].name).toBe('reviewerNotes');
    expect(schema.fields[2].visibleTo).toEqual(new Set(['reviewer', 'moderator', 'admin']));
    expect(schema.fields[3].name).toBe('moderationLog');
    expect(schema.fields[3].visibleTo).toEqual(new Set(['moderator', 'admin']));
  });

  it('should provide level methods for individual levels', () => {
    const schema = resourceSchema(access).admin('secret', z.string()).build();

    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0].name).toBe('secret');
    expect(schema.fields[0].visibleTo).toEqual(new Set(['admin']));
  });

  it('should support visibleTo() for explicit level sets', () => {
    const schema = resourceSchema(access)
      .visibleTo('authorEmail', z.string(), ['authenticated', 'moderator', 'admin'])
      .build();

    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0].name).toBe('authorEmail');
    expect(schema.fields[0].visibleTo).toEqual(new Set(['authenticated', 'moderator', 'admin']));
  });

  it('should support non-hierarchical visibility', () => {
    // Field visible to reviewer and admin but NOT authenticated
    const schema = resourceSchema(access)
      .visibleTo('reviewerData', z.string(), ['reviewer', 'admin'])
      .build();

    const field = schema.fields[0];
    expect(isFieldVisibleToLevel(field, 'reviewer')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'admin')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'authenticated')).toBe(false);
    expect(isFieldVisibleToLevel(field, 'public')).toBe(false);
  });

  it('should support hasOne relations with group reference', () => {
    const nested = resourceSchema(access).everyone('name', z.string()).build();

    const schema = resourceSchema(access)
      .everyone('id', z.string())
      .hasOne('author', nested, 'internal')
      .build();

    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[1].name).toBe('author');
    expect(schema.fields[1].visibleTo).toEqual(new Set(['reviewer', 'moderator', 'admin']));
    expect(schema.fields[1].cardinality).toBe('one');
  });

  it('should support hasMany relations with explicit levels array', () => {
    const nested = resourceSchema(access).everyone('text', z.string()).build();

    const schema = resourceSchema(access)
      .everyone('id', z.string())
      .hasMany('comments', nested, ['authenticated', 'moderator', 'admin'])
      .build();

    expect(schema.fields[1].name).toBe('comments');
    expect(schema.fields[1].visibleTo).toEqual(new Set(['authenticated', 'moderator', 'admin']));
    expect(schema.fields[1].cardinality).toBe('many');
  });

  it('should generate tagged views per level on build()', () => {
    const schema = resourceSchema(access)
      .everyone('id', z.string())
      .internal('reviewerNotes', z.string())
      .staff('moderationLog', z.string())
      .build();

    // Each level becomes a property
    expect(schema.public).toBeDefined();
    expect(schema.public._level).toBe('public');
    expect(schema.reviewer).toBeDefined();
    expect(schema.reviewer._level).toBe('reviewer');
    expect(schema.authenticated).toBeDefined();
    expect(schema.authenticated._level).toBe('authenticated');
    expect(schema.moderator).toBeDefined();
    expect(schema.moderator._level).toBe('moderator');
    expect(schema.admin).toBeDefined();
    expect(schema.admin._level).toBe('admin');

    // All views share the same fields
    expect(schema.public.fields).toBe(schema.admin.fields);
  });

  it('should store _levelConfig on built schema', () => {
    const schema = resourceSchema(access).everyone('id', z.string()).build();
    expect(schema._levelConfig).toBe(access);
  });
});

// ============================================================================
// Runtime projection with custom levels
// ============================================================================

describe('runtime projection with custom levels', () => {
  const access = defineAccessLevels(['public', 'reviewer', 'authenticated', 'moderator', 'admin'], {
    everyone: '*',
    internal: ['reviewer', 'moderator', 'admin'],
    staff: ['moderator', 'admin'],
  });

  const ArticleSchema = resourceSchema(access)
    .everyone('id', z.string())
    .everyone('title', z.string())
    .internal('reviewerNotes', z.string())
    .staff('moderationLog', z.string())
    .visibleTo('authorEmail', z.string(), ['authenticated', 'moderator', 'admin'])
    .visibleTo('internalFlags', z.string(), ['admin'])
    .build();

  const sampleData = {
    id: '1',
    title: 'Hello World',
    reviewerNotes: 'Looks good',
    moderationLog: 'Approved by mod',
    authorEmail: 'author@example.com',
    internalFlags: 'FLAG_INTERNAL',
  };

  describe('Resource.forLevel()', () => {
    it('should project for public level', () => {
      const r = new Resource(sampleData, ArticleSchema);
      const result = r.forLevel('public');
      expect(result).toEqual({ id: '1', title: 'Hello World' });
    });

    it('should project for reviewer level', () => {
      const r = new Resource(sampleData, ArticleSchema);
      const result = r.forLevel('reviewer');
      expect(result).toEqual({
        id: '1',
        title: 'Hello World',
        reviewerNotes: 'Looks good',
      });
    });

    it('should project for authenticated level', () => {
      const r = new Resource(sampleData, ArticleSchema);
      const result = r.forLevel('authenticated');
      expect(result).toEqual({
        id: '1',
        title: 'Hello World',
        authorEmail: 'author@example.com',
      });
    });

    it('should project for moderator level', () => {
      const r = new Resource(sampleData, ArticleSchema);
      const result = r.forLevel('moderator');
      expect(result).toEqual({
        id: '1',
        title: 'Hello World',
        reviewerNotes: 'Looks good',
        moderationLog: 'Approved by mod',
        authorEmail: 'author@example.com',
      });
    });

    it('should project for admin level (all fields)', () => {
      const r = new Resource(sampleData, ArticleSchema);
      const result = r.forLevel('admin');
      expect(result).toEqual({
        id: '1',
        title: 'Hello World',
        reviewerNotes: 'Looks good',
        moderationLog: 'Approved by mod',
        authorEmail: 'author@example.com',
        internalFlags: 'FLAG_INTERNAL',
      });
    });
  });

  describe('resource() factory with tagged schema', () => {
    it('should project via tagged schema property', () => {
      const publicView = resource(sampleData, ArticleSchema.public);
      expect(publicView).toEqual({ id: '1', title: 'Hello World' });

      const reviewerView = resource(sampleData, ArticleSchema.reviewer);
      expect(reviewerView).toEqual({
        id: '1',
        title: 'Hello World',
        reviewerNotes: 'Looks good',
      });

      const adminView = resource(sampleData, ArticleSchema.admin);
      expect(adminView).toEqual(sampleData);
    });
  });

  describe('ResourceCollection.forLevel()', () => {
    const items = [
      { ...sampleData, id: '1' },
      { ...sampleData, id: '2', title: 'Second Article' },
    ];

    it('should project collection for reviewer level', () => {
      const collection = new ResourceCollection(items, ArticleSchema);
      const result = collection.forLevel('reviewer');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        title: 'Hello World',
        reviewerNotes: 'Looks good',
      });
      expect(result[1]).toEqual({
        id: '2',
        title: 'Second Article',
        reviewerNotes: 'Looks good',
      });
    });
  });

  describe('resourceCollection() factory with tagged schema', () => {
    const items = [
      { ...sampleData, id: '1' },
      { ...sampleData, id: '2', title: 'Second' },
    ];

    it('should project collection via tagged schema', () => {
      const publicList = resourceCollection(items, ArticleSchema.public);
      expect(publicList).toHaveLength(2);
      expect(publicList[0]).toEqual({ id: '1', title: 'Hello World' });
      expect(publicList[1]).toEqual({ id: '2', title: 'Second' });
    });
  });
});

// ============================================================================
// Non-hierarchical visibility
// ============================================================================

describe('non-hierarchical visibility', () => {
  const access = defineAccessLevels(['guest', 'member', 'vip', 'admin'], {
    everyone: '*',
    privileged: ['vip', 'admin'],
  });

  it('should allow field visible to vip and admin but not member', () => {
    const schema = resourceSchema(access)
      .everyone('id', z.string())
      .privileged('vipData', z.string())
      .build();

    const data = { id: '1', vipData: 'exclusive' };

    const guestView = resource(data, schema.guest);
    expect(guestView).toEqual({ id: '1' });

    const memberView = resource(data, schema.member);
    expect(memberView).toEqual({ id: '1' });

    const vipView = resource(data, schema.vip);
    expect(vipView).toEqual({ id: '1', vipData: 'exclusive' });

    const adminView = resource(data, schema.admin);
    expect(adminView).toEqual({ id: '1', vipData: 'exclusive' });
  });
});

// ============================================================================
// Default 3-level backward compatibility
// ============================================================================

describe('default 3-level backward compatibility', () => {
  it('should work identically to the pre-existing API', () => {
    const UserSchema = resourceSchema()
      .public('id', z.string())
      .public('name', z.string())
      .authenticated('email', z.string())
      .admin('internalNotes', z.string())
      .build();

    const data = { id: '1', name: 'John', email: 'john@example.com', internalNotes: 'VIP' };

    // forPublic
    const pub = resource(data, UserSchema.public);
    expect(pub).toEqual({ id: '1', name: 'John' });

    // forAuthenticated
    const auth = resource(data, UserSchema.authenticated);
    expect(auth).toEqual({ id: '1', name: 'John', email: 'john@example.com' });

    // forAdmin
    const admin = resource(data, UserSchema.admin);
    expect(admin).toEqual(data);
  });

  it('should preserve forPublic/forAuthenticated/forAdmin methods', () => {
    const UserSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'x' };
    const r = new Resource(data, UserSchema);

    expect(r.forPublic()).toEqual({ id: '1' });
    expect(r.forAuthenticated()).toEqual({ id: '1', email: 'a@b.com' });
    expect(r.forAdmin()).toEqual(data);
  });

  it('should work with forLevel() on default schemas', () => {
    const UserSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'x' };
    const r = new Resource(data, UserSchema);

    expect(r.forLevel('public')).toEqual({ id: '1' });
    expect(r.forLevel('authenticated')).toEqual({ id: '1', email: 'a@b.com' });
    expect(r.forLevel('admin')).toEqual(data);
  });
});

// ============================================================================
// isFieldVisibleToLevel
// ============================================================================

describe('isFieldVisibleToLevel', () => {
  it('should use visibleTo set when available', () => {
    const field = {
      visibleTo: new Set(['reviewer', 'admin']),
      visibility: 'reviewer',
    };

    expect(isFieldVisibleToLevel(field, 'reviewer')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'admin')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'authenticated')).toBe(false);
    expect(isFieldVisibleToLevel(field, 'public')).toBe(false);
  });

  it('should require visibleTo set on field (no fallback)', () => {
    const field = {
      visibleTo: new Set(['authenticated', 'admin']),
      visibility: 'authenticated',
    };

    expect(isFieldVisibleToLevel(field, 'authenticated')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'admin')).toBe(true);
    expect(isFieldVisibleToLevel(field, 'public')).toBe(false);
  });
});

// ============================================================================
// Nested relations with custom levels
// ============================================================================

describe('nested relations with custom levels', () => {
  const access = defineAccessLevels(['public', 'member', 'admin'], {
    everyone: '*',
    members: ['member', 'admin'],
  });

  it('should recursively project nested hasOne relations', () => {
    const AuthorSchema = resourceSchema(access)
      .everyone('name', z.string())
      .members('email', z.string())
      .build();

    const ArticleSchema = resourceSchema(access)
      .everyone('title', z.string())
      .hasOne('author', AuthorSchema, 'everyone')
      .build();

    const data = {
      title: 'Post',
      author: { name: 'Alice', email: 'alice@example.com' },
    };

    const publicView = resource(data, ArticleSchema.public);
    expect(publicView).toEqual({
      title: 'Post',
      author: { name: 'Alice' },
    });

    const memberView = resource(data, ArticleSchema.member);
    expect(memberView).toEqual({
      title: 'Post',
      author: { name: 'Alice', email: 'alice@example.com' },
    });
  });

  it('should recursively project nested hasMany relations', () => {
    const CommentSchema = resourceSchema(access)
      .everyone('text', z.string())
      .admin('ip', z.string())
      .build();

    const PostSchema = resourceSchema(access)
      .everyone('title', z.string())
      .hasMany('comments', CommentSchema, 'everyone')
      .build();

    const data = {
      title: 'Post',
      comments: [
        { text: 'Nice!', ip: '1.2.3.4' },
        { text: 'Great!', ip: '5.6.7.8' },
      ],
    };

    const publicView = resource(data, PostSchema.public);
    expect(publicView).toEqual({
      title: 'Post',
      comments: [{ text: 'Nice!' }, { text: 'Great!' }],
    });

    const adminView = resource(data, PostSchema.admin);
    expect(adminView).toEqual(data);
  });
});

// ============================================================================
// Custom levels with default levels equivalent
// ============================================================================

describe('custom levels equivalent to default', () => {
  it('should differ from default: level methods create single-level sets', () => {
    const config = defineAccessLevels(['public', 'authenticated', 'admin']);

    // Custom: level methods create SINGLE-LEVEL sets (non-hierarchical)
    const CustomSchema = resourceSchema(config)
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    // Default: methods create HIERARCHICAL sets (public → all, auth → auth+admin, admin → admin)
    const DefaultSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'x' };

    // Custom: each level only sees its own fields
    expect(resource(data, CustomSchema.public)).toEqual({ id: '1' });
    expect(resource(data, CustomSchema.authenticated)).toEqual({ email: 'a@b.com' });
    expect(resource(data, CustomSchema.admin)).toEqual({ secret: 'x' });

    // Default: hierarchical — higher levels see lower-level fields too
    expect(resource(data, DefaultSchema.public)).toEqual({ id: '1' });
    expect(resource(data, DefaultSchema.authenticated)).toEqual({ id: '1', email: 'a@b.com' });
    expect(resource(data, DefaultSchema.admin)).toEqual(data);
  });

  it('should match default behavior when using groups that mirror hierarchy', () => {
    // To replicate default hierarchical behavior with custom levels, use groups:
    const config = defineAccessLevels(['public', 'authenticated', 'admin'], {
      everyone: '*', // all levels
      loggedIn: ['authenticated', 'admin'],
      adminsOnly: ['admin'],
    });

    const CustomSchema = resourceSchema(config)
      .everyone('id', z.string())
      .loggedIn('email', z.string())
      .adminsOnly('secret', z.string())
      .build();

    const DefaultSchema = resourceSchema()
      .public('id', z.string())
      .authenticated('email', z.string())
      .admin('secret', z.string())
      .build();

    const data = { id: '1', email: 'a@b.com', secret: 'x' };

    // Now both produce identical projections
    expect(resource(data, CustomSchema.public)).toEqual(resource(data, DefaultSchema.public));
    expect(resource(data, CustomSchema.authenticated)).toEqual(
      resource(data, DefaultSchema.authenticated)
    );
    expect(resource(data, CustomSchema.admin)).toEqual(resource(data, DefaultSchema.admin));
  });
});
