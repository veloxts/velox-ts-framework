/**
 * Router Types - Browser-Safe Type Definitions
 *
 * BROWSER-SAFE: This file imports ONLY from schemas/ and zod.
 * Never import from procedures/ or @veloxts/* packages here.
 *
 * Uses inline contract definitions for automatic type inference from Zod schemas.
 * This provides "Great DX" - one line per procedure instead of verbose type definitions.
 */

import { z } from 'zod';

import * as HealthSchemas from './schemas/health.js';
import * as UserSchemas from './schemas/user.js';

// ============================================================================
// Contract Helper (Browser-Safe)
// ============================================================================

/**
 * Type-safe contract definition helper.
 * Provides autocomplete and type inference without importing @veloxts/router.
 */
type ContractEntry = {
  input?: z.ZodType;
  output?: z.ZodType;
};

const defineContract = <T extends Record<string, ContractEntry>>(contracts: T): T => contracts;

// ============================================================================
// Health Contracts
// ============================================================================

export const healthContracts = defineContract({
  getHealth: { output: HealthSchemas.HealthResponse },
});

// ============================================================================
// User Contracts
// ============================================================================

export const userContracts = defineContract({
  getUser: { input: UserSchemas.GetUserInput, output: UserSchemas.UserSchema },
  listUsers: { input: UserSchemas.ListUsersInput, output: UserSchemas.ListUsersResponse },
  createUser: { input: UserSchemas.CreateUserInput, output: UserSchemas.UserSchema },
  updateUser: {
    input: UserSchemas.UpdateUserInput.extend({ id: z.string().uuid() }),
    output: UserSchemas.UserSchema,
  },
  patchUser: {
    input: UserSchemas.UpdateUserInput.extend({ id: z.string().uuid() }),
    output: UserSchemas.UserSchema,
  },
  deleteUser: {
    input: z.object({ id: z.string().uuid() }),
    output: z.object({ success: z.boolean() }),
  },
});

// ============================================================================
// AppRouter Type - Automatic Inference
// ============================================================================

/**
 * The complete router type, inferred from contracts.
 *
 * This replaces manual type definitions with automatic inference from Zod schemas.
 */
export type AppRouter = {
  health: typeof healthContracts;
  users: typeof userContracts;
};
