/**
 * Profile Procedures (Resource API Example)
 *
 * Demonstrates field-level visibility using the Resource API:
 * - Public: returns { id, name }
 * - Authenticated: returns { id, name, email }
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
  getProfile: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .resource(UserProfileSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new NotFoundError(`User '${input.id}' not found`);
      return resource(user, UserProfileSchema).forAnonymous();
    }),

  // Authenticated: GET /api/profiles/:id/full → { id, name, email }
  getFullProfile: procedure()
    .rest({ method: 'GET', path: '/profiles/:id/full' })
    .guardNarrow(authenticatedNarrow)
    .input(z.object({ id: z.string().uuid() }))
    .resource(UserProfileSchema)
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new NotFoundError(`User '${input.id}' not found`);
      return resource(user, UserProfileSchema).forAuthenticated();
    }),
});
