/**
 * Profile Procedures (Resource API Example)
 *
 * Demonstrates field-level visibility using tagged resource schemas:
 * - Public: GET /api/profiles/:id → { id, name }
 *     Uses handler-level projection: resource(data, Schema.public)
 * - Authenticated: GET /api/profiles/:id/full → { id, name, email }
 *     Uses procedure-level auto-projection: .output(Schema.authenticated)
 */

import {
  authenticatedNarrow,
  NotFoundError,
  procedure,
  procedures,
  resource,
  resourceSchema,
  z,
} from '@veloxts/velox';

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
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new NotFoundError(`User '${input.id}' not found`);
      return resource(user, UserProfileSchema.public);
    }),

  // Authenticated: GET /api/profiles/:id/full → { id, name, email }
  // Procedure-level auto-projection: .output(Schema.authenticated) auto-projects the return value
  getFullProfile: procedure()
    .rest({ method: 'GET', path: '/profiles/:id/full' })
    .guardNarrow(authenticatedNarrow)
    .input(z.object({ id: z.string().uuid() }))
    .output(UserProfileSchema.authenticated)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new NotFoundError(`User '${input.id}' not found`);
      return user;
    }),
});
