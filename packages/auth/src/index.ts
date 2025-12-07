/**
 * @veloxts/auth - Authentication and authorization system
 *
 * Provides JWT authentication, password hashing, authorization guards,
 * resource policies, and rate limiting for VeloxTS applications.
 *
 * @packageDocumentation
 * @module @veloxts/auth
 */

// ============================================================================
// Version Export
// ============================================================================

export { AUTH_VERSION } from './plugin.js';

// ============================================================================
// Types
// ============================================================================

export type {
  AuthConfig,
  AuthContext,
  AuthMiddlewareOptions,
  GuardDefinition,
  // Guard types
  GuardFunction,
  HashConfig,
  // Configuration types
  JwtConfig,
  // Policy types
  PolicyAction,
  PolicyDefinition,
  RateLimitConfig,
  SessionConfig,
  TokenPair,
  TokenPayload,
  // Core types
  User,
} from './types.js';

// ============================================================================
// JWT Authentication
// ============================================================================

export { createJwtManager, generateTokenId, JwtManager, parseTimeToSeconds } from './jwt.js';

// ============================================================================
// Password Hashing
// ============================================================================

export {
  createPasswordHasher,
  hashPassword,
  PasswordHasher,
  verifyPassword,
} from './hash.js';

// ============================================================================
// Guards
// ============================================================================

export {
  // Combinators
  allOf,
  anyOf,
  // Built-in guards
  authenticated,
  // Factory functions
  defineGuard,
  emailVerified,
  // Execution
  executeGuard,
  executeGuards,
  guard,
  hasAnyPermission,
  hasPermission,
  hasRole,
  not,
  userCan,
} from './guards.js';

// ============================================================================
// Policies
// ============================================================================

export {
  authorize,
  // Authorization checks
  can,
  cannot,
  clearPolicies,
  createAdminOnlyPolicy,
  // Common patterns
  createOwnerOrAdminPolicy,
  createPolicyBuilder,
  createReadOnlyPolicy,
  // Factory
  definePolicy,
  getPolicy,
  // Registry
  registerPolicy,
} from './policies.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  clearRateLimitStore,
  createAuthMiddleware,
  createRateLimitMiddleware,
} from './middleware.js';

// ============================================================================
// Plugin
// ============================================================================

export type { AuthPluginOptions, AuthService } from './plugin.js';
export { authPlugin, createAuthPlugin } from './plugin.js';
