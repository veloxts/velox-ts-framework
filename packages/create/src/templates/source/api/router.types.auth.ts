/**
 * Router Types - Browser-Safe Type Definitions
 *
 * CRITICAL: This file imports ONLY from schemas/ directory.
 * Never import from procedures/ or @veloxts/* packages.
 *
 * This breaks the import chain that would otherwise pull server code
 * into the browser bundle.
 */

import type { z } from 'zod';

import type * as AuthSchemas from './schemas/auth.js';
import type * as HealthSchemas from './schemas/health.js';
import type * as UserSchemas from './schemas/user.js';

// ============================================================================
// Type Helpers
// ============================================================================

type Procedure<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
};

// ============================================================================
// AppRouter Type Definition
// ============================================================================

export type AppRouter = {
  health: {
    getHealth: Procedure<undefined, z.infer<typeof HealthSchemas.HealthResponse>>;
  };
  users: {
    getUser: Procedure<
      z.infer<typeof UserSchemas.GetUserInput>,
      z.infer<typeof UserSchemas.UserSchema>
    >;
    listUsers: Procedure<
      z.infer<typeof UserSchemas.ListUsersInput>,
      z.infer<typeof UserSchemas.ListUsersResponse>
    >;
    createUser: Procedure<
      z.infer<typeof UserSchemas.CreateUserInput>,
      z.infer<typeof UserSchemas.UserSchema>
    >;
    updateUser: Procedure<
      z.infer<typeof UserSchemas.UpdateUserInput> & { id: string },
      z.infer<typeof UserSchemas.UserSchema>
    >;
    patchUser: Procedure<
      z.infer<typeof UserSchemas.UpdateUserInput> & { id: string },
      z.infer<typeof UserSchemas.UserSchema>
    >;
    deleteUser: Procedure<{ id: string }, { success: boolean }>;
  };
  auth: {
    createAccount: Procedure<
      z.infer<typeof AuthSchemas.RegisterInput>,
      z.infer<typeof AuthSchemas.TokenResponse>
    >;
    createSession: Procedure<
      z.infer<typeof AuthSchemas.LoginInput>,
      z.infer<typeof AuthSchemas.TokenResponse>
    >;
    createRefresh: Procedure<
      z.infer<typeof AuthSchemas.RefreshInput>,
      z.infer<typeof AuthSchemas.TokenResponse>
    >;
    deleteSession: Procedure<undefined, z.infer<typeof AuthSchemas.LogoutResponse>>;
    getMe: Procedure<undefined, z.infer<typeof AuthSchemas.UserResponse>>;
  };
};
