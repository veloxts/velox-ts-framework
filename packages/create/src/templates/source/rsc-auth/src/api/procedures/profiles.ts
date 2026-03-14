/**
 * Profile Procedures (Resource API Example)
 *
 * Demonstrates field-level visibility using tagged resource schemas:
 * - Public: GET /api/profiles/:id → { id, name }
 *     Uses handler-level projection: resource(data, Schema.public)
 * - Authenticated: GET /api/profiles/:id/full → { id, name, email }
 *     Uses .guard(authenticated) + .output(Schema.authenticated)
 */

import { authenticated } from '@veloxts/auth';
import { procedure, procedures, resource, resourceSchema } from '@veloxts/router';
import { z } from 'zod';

import { db } from '../database.js';

// ============================================================================
// Resource Schema (field-level visibility)
// ============================================================================

const UserProfileSchema = resourceSchema()
  .public('id', z.string().uuid())
  .public('name', z.string())
  .authenticated('email', z.string().email())
  .build();

// ============================================================================
// Profile Procedures
// ============================================================================

export const profileProcedures = procedures('profiles', {
  // Public: GET /api/profiles/:id → { id, name }
  // Handler-level projection: resource(data, Schema.public) returns projected data directly
  getProfile: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(UserProfileSchema.public)
    .query(async ({ input }) => {
      const user = await db.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }
      return resource(user, UserProfileSchema.public);
    }),

  // Authenticated: GET /api/profiles/:id/full → { id, name, email }
  // Uses .guard(authenticated) + .output(Schema.authenticated) for field-level visibility
  getFullProfile: procedure()
    .rest({ method: 'GET', path: '/profiles/:id/full' })
    .guard(authenticated)
    .input(z.object({ id: z.string().uuid() }))
    .output(UserProfileSchema.authenticated)
    .query(async ({ input }) => {
      const user = await db.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }
      return user;
    }),
});
