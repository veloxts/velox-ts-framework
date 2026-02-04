/**
 * Type tests for Resource API with phantom types
 *
 * These tests verify that TypeScript type inference works correctly
 * for context-dependent output types using phantom types.
 */

import { expectType } from 'tsd';
import { z } from 'zod';

// Import from the compiled dist folders directly
import type {
  ADMIN,
  AdminOutput,
  ANONYMOUS,
  AnonymousOutput,
  AUTHENTICATED,
  AuthenticatedOutput,
  ExtractTag,
  OutputForTag,
  ResourceSchema,
  TaggedContext,
} from '../../dist/index.js';
import { resource, resourceCollection, resourceSchema } from '../../dist/index.js';

// ============================================================================
// Test Schema
// ============================================================================

const UserSchema = resourceSchema()
  .public('id', z.string())
  .public('name', z.string())
  .authenticated('email', z.string())
  .admin('internalNotes', z.string().nullable())
  .build();

// ============================================================================
// Schema Type Inference
// ============================================================================

// resourceSchema().build() should return a ResourceSchema
expectType<ResourceSchema>(UserSchema);

// ============================================================================
// Output Type Computation
// ============================================================================

// AnonymousOutput should include only public fields
type AnonUser = AnonymousOutput<typeof UserSchema>;
expectType<{ id: string; name: string }>({} as AnonUser);

// AuthenticatedOutput should include public + authenticated fields
type AuthUser = AuthenticatedOutput<typeof UserSchema>;
expectType<{ id: string; name: string; email: string }>({} as AuthUser);

// AdminOutput should include all fields
type AdminUser = AdminOutput<typeof UserSchema>;
expectType<{ id: string; name: string; email: string; internalNotes: string | null }>(
  {} as AdminUser
);

// ============================================================================
// OutputForTag Type Computation
// ============================================================================

// OutputForTag with ANONYMOUS should equal AnonymousOutput
type OutputAnon = OutputForTag<typeof UserSchema, typeof ANONYMOUS>;
expectType<AnonUser>({} as OutputAnon);

// OutputForTag with AUTHENTICATED should equal AuthenticatedOutput
type OutputAuth = OutputForTag<typeof UserSchema, typeof AUTHENTICATED>;
expectType<AuthUser>({} as OutputAuth);

// OutputForTag with ADMIN should equal AdminOutput
type OutputAdmin = OutputForTag<typeof UserSchema, typeof ADMIN>;
expectType<AdminUser>({} as OutputAdmin);

// ============================================================================
// TaggedContext Type Utilities
// ============================================================================

// ExtractTag should extract the tag from a TaggedContext
// We use it in an assignability check to verify it extracts the correct tag type
type ExtractedAdminTag = ExtractTag<TaggedContext<typeof ADMIN>>;
// Verify ExtractTag works by using it in OutputForTag (which requires a valid tag)
type _VerifyExtractTag = OutputForTag<typeof UserSchema, ExtractedAdminTag>;

// TaggedContext should work with different tags
type AnonCtx = TaggedContext<typeof ANONYMOUS>;
type AuthCtx = TaggedContext<typeof AUTHENTICATED>;
type AdminCtx = TaggedContext<typeof ADMIN>;

// All should be valid TaggedContext types
const _anonCtx: AnonCtx = {};
const _authCtx: AuthCtx = {};
const _adminCtx: AdminCtx = {};

// ============================================================================
// Resource Instance Method Return Types
// ============================================================================

const testData = { id: '1', name: 'Test', email: 'test@test.com', internalNotes: null };

// forAnonymous() should return AnonymousOutput
const anonResult = resource(testData, UserSchema).forAnonymous();
expectType<AnonUser>(anonResult);

// forAuthenticated() should return AuthenticatedOutput
const authResult = resource(testData, UserSchema).forAuthenticated();
expectType<AuthUser>(authResult);

// forAdmin() should return AdminOutput
const adminResult = resource(testData, UserSchema).forAdmin();
expectType<AdminUser>(adminResult);

// ============================================================================
// Resource Collection Return Types
// ============================================================================

const testDataArray = [testData];

// Collection methods should return arrays of the correct type
const collectionAnon = resourceCollection(testDataArray, UserSchema).forAnonymous();
expectType<AnonUser[]>(collectionAnon);

const collectionAuth = resourceCollection(testDataArray, UserSchema).forAuthenticated();
expectType<AuthUser[]>(collectionAuth);

const collectionAdmin = resourceCollection(testDataArray, UserSchema).forAdmin();
expectType<AdminUser[]>(collectionAdmin);

// ============================================================================
// Complex Schema with Multiple Field Types
// ============================================================================

const ComplexSchema = resourceSchema()
  .public('id', z.number())
  .public('slug', z.string())
  .public('title', z.string())
  .public('publishedAt', z.date().nullable())
  .authenticated('authorId', z.string())
  .authenticated('viewCount', z.number())
  .admin('revenue', z.number())
  .admin('conversionRate', z.number())
  .build();

// Verify complex schema output types
type ComplexAnon = AnonymousOutput<typeof ComplexSchema>;
expectType<{
  id: number;
  slug: string;
  title: string;
  publishedAt: Date | null;
}>({} as ComplexAnon);

type ComplexAuth = AuthenticatedOutput<typeof ComplexSchema>;
expectType<{
  id: number;
  slug: string;
  title: string;
  publishedAt: Date | null;
  authorId: string;
  viewCount: number;
}>({} as ComplexAuth);

type ComplexAdmin = AdminOutput<typeof ComplexSchema>;
expectType<{
  id: number;
  slug: string;
  title: string;
  publishedAt: Date | null;
  authorId: string;
  viewCount: number;
  revenue: number;
  conversionRate: number;
}>({} as ComplexAdmin);
