/**
 * Resource API with phantom types
 *
 * Provides a Laravel-inspired Resource API for defining context-dependent
 * output types using phantom types for compile-time type safety.
 *
 * ## Overview
 *
 * The Resource API solves the problem of returning different field sets
 * based on user role/auth state while maintaining precise types:
 *
 * - Anonymous: `{ id, name }`
 * - Authenticated: `{ id, name, email }`
 * - Admin: `{ id, name, email, internalNotes }`
 *
 * ## Usage
 *
 * ```typescript
 * import { z } from 'zod';
 * import { resourceSchema, resource, resourceCollection } from '@veloxts/router';
 *
 * // 1. Define schema with field visibility
 * const UserSchema = resourceSchema()
 *   .public('id', z.string().uuid())
 *   .public('name', z.string())
 *   .authenticated('email', z.string().email())
 *   .admin('internalNotes', z.string().nullable())
 *   .build();
 *
 * // 2. Use in procedures
 * export const userProcedures = procedures('users', {
 *   // Public endpoint → returns { id, name }
 *   getPublicProfile: procedure()
 *     .input(z.object({ id: z.string() }))
 *     .query(async ({ input, ctx }) => {
 *       const user = await ctx.db.user.findUnique({ where: { id: input.id } });
 *       return resource(user, UserSchema).forAnonymous();
 *     }),
 *
 *   // Authenticated endpoint → returns { id, name, email }
 *   getProfile: procedure()
 *     .guardNarrow(authenticatedNarrow)
 *     .input(z.object({ id: z.string() }))
 *     .query(async ({ input, ctx }) => {
 *       const user = await ctx.db.user.findUnique({ where: { id: input.id } });
 *       return resource(user, UserSchema).forAuthenticated();
 *     }),
 *
 *   // Admin endpoint → returns { id, name, email, internalNotes }
 *   getFullProfile: procedure()
 *     .guardNarrow(adminNarrow)
 *     .input(z.object({ id: z.string() }))
 *     .query(async ({ input, ctx }) => {
 *       const user = await ctx.db.user.findUnique({ where: { id: input.id } });
 *       return resource(user, UserSchema).forAdmin();
 *     }),
 * });
 * ```
 *
 * @module resource
 */

// ============================================================================
// Core Exports
// ============================================================================

// Resource instances
export { Resource, ResourceCollection, resource, resourceCollection } from './instance.js';
export type {
  AdminOutput,
  AnonymousOutput,
  AuthenticatedOutput,
  OutputForLevel,
  OutputForTag,
  ResourceField,
  ResourceSchema,
  ResourceSchemaWithViews,
  RuntimeField,
  TaggedResourceSchema,
} from './schema.js';
// Schema builder
export {
  isResourceSchema,
  isTaggedResourceSchema,
  ResourceSchemaBuilder,
  resourceSchema,
} from './schema.js';
// Phantom tags - exported as types since they're ambient declarations (declare const)
// AccessLevel is a runtime type used for auto-projection
export type {
  AccessLevel,
  ADMIN,
  ANONYMOUS,
  AUTHENTICATED,
  ContextTag,
  ExtractTag,
  HasTag,
  LevelToTag,
  TaggedContext,
  WithTag,
} from './tags.js';
// Type utilities
export type {
  AdminTaggedContext,
  AnonymousTaggedContext,
  AnyResourceOutput,
  AuthenticatedTaggedContext,
  IfAdmin,
  IfAuthenticated,
  InferResourceData,
  InferResourceOutput,
} from './types.js';
export type { IsVisibleToTag, VisibilityLevel } from './visibility.js';
// Visibility
export { getAccessibleLevels, getVisibilityForTag, isVisibleAtLevel } from './visibility.js';
