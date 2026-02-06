/**
 * Type tests for nested resource relations (.hasOne / .hasMany)
 *
 * Verifies that OutputForTag correctly computes nested relation types
 * including recursive field filtering by visibility level.
 */

import { expectType } from 'tsd';
import { z } from 'zod';

import type { ADMIN, ANONYMOUS, AUTHENTICATED, OutputForTag } from '../../dist/index.js';
import { resource, resourceCollection, resourceSchema } from '../../dist/index.js';

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
// Anonymous Output — includes hasOne(public), excludes hasMany(authenticated)
// ============================================================================

type AnonUser = OutputForTag<typeof UserSchema, typeof ANONYMOUS>;

expectType<{
  id: string;
  name: string;
  organization: { id: string; name: string } | null;
}>({} as AnonUser);

// ============================================================================
// Authenticated Output — includes hasOne + hasMany, nested fields filtered
// ============================================================================

type AuthUser = OutputForTag<typeof UserSchema, typeof AUTHENTICATED>;

expectType<{
  id: string;
  name: string;
  email: string;
  organization: { id: string; name: string } | null;
  posts: Array<{ id: string; title: string; draft: boolean }>;
}>({} as AuthUser);

// ============================================================================
// Admin Output — all fields, nested admin fields included
// ============================================================================

type AdminUser = OutputForTag<typeof UserSchema, typeof ADMIN>;

expectType<{
  id: string;
  name: string;
  email: string;
  organization: { id: string; name: string; taxId: string } | null;
  posts: Array<{ id: string; title: string; draft: boolean }>;
  internalNotes: string;
}>({} as AdminUser);

// ============================================================================
// hasOne produces T | null
// ============================================================================

type OrgAnon = OutputForTag<typeof UserSchema, typeof ANONYMOUS>['organization'];
expectType<{ id: string; name: string } | null>({} as OrgAnon);

// ============================================================================
// hasMany produces Array<T>
// ============================================================================

type PostsAuth = OutputForTag<typeof UserSchema, typeof AUTHENTICATED>['posts'];
expectType<Array<{ id: string; title: string; draft: boolean }>>({} as PostsAuth);

// ============================================================================
// Backward compatibility: schemas without relations produce identical types
// ============================================================================

const SimpleSchema = resourceSchema()
  .public('id', z.string())
  .authenticated('email', z.string())
  .admin('secret', z.string())
  .build();

type SimpleAnon = OutputForTag<typeof SimpleSchema, typeof ANONYMOUS>;
expectType<{ id: string }>({} as SimpleAnon);

type SimpleAuth = OutputForTag<typeof SimpleSchema, typeof AUTHENTICATED>;
expectType<{ id: string; email: string }>({} as SimpleAuth);

type SimpleAdmin = OutputForTag<typeof SimpleSchema, typeof ADMIN>;
expectType<{ id: string; email: string; secret: string }>({} as SimpleAdmin);

// ============================================================================
// Tagged schema views with relations
// ============================================================================

const testData = {
  id: '1',
  name: 'Test',
  email: 'test@test.com',
  organization: { id: 'org-1', name: 'Org', taxId: 'TX' },
  posts: [{ id: 'p-1', title: 'Post', draft: false }],
  internalNotes: 'notes',
};

// resource() with tagged schema returns projected data directly
const publicResult = resource(testData, UserSchema.public);
expectType<{
  id: string;
  name: string;
  organization: { id: string; name: string } | null;
}>(publicResult);

const authResult = resource(testData, UserSchema.authenticated);
expectType<{
  id: string;
  name: string;
  email: string;
  organization: { id: string; name: string } | null;
  posts: Array<{ id: string; title: string; draft: boolean }>;
}>(authResult);

const adminResult = resource(testData, UserSchema.admin);
expectType<{
  id: string;
  name: string;
  email: string;
  organization: { id: string; name: string; taxId: string } | null;
  posts: Array<{ id: string; title: string; draft: boolean }>;
  internalNotes: string;
}>(adminResult);

// resourceCollection() with tagged schema
const collectionPublic = resourceCollection([testData], UserSchema.public);
expectType<
  Array<{
    id: string;
    name: string;
    organization: { id: string; name: string } | null;
  }>
>(collectionPublic);
