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
// Types and Errors
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
  /**
   * @deprecated Use SessionConfig from session.ts for full session management
   */
  LegacySessionConfig,
  // Policy types
  PolicyAction,
  PolicyDefinition,
  RateLimitConfig,
  TokenPair,
  TokenPayload,
  // Core types
  User,
} from './types.js';
export { AuthError } from './types.js';

// ============================================================================
// JWT Authentication
// ============================================================================

export type { TokenStore } from './jwt.js';
export {
  createInMemoryTokenStore,
  generateTokenId,
  isValidTimespan,
  JwtManager,
  jwtManager,
  parseTimeToSeconds,
  validateTokenExpiration,
} from './jwt.js';

// ============================================================================
// Password Hashing
// ============================================================================

export {
  hashPassword,
  PasswordHasher,
  passwordHasher,
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
  authMiddleware,
  clearRateLimitStore,
  rateLimitMiddleware,
} from './middleware.js';

// ============================================================================
// Auth-Specific Rate Limiting
// ============================================================================

export type { AuthRateLimitConfig, AuthRateLimiterConfig } from './rate-limit.js';
export {
  // Pre-configured instance
  authRateLimiter,
  // Store management (for testing)
  clearAuthRateLimitStore,
  // Factory
  createAuthRateLimiter,
  stopAuthRateLimitCleanup,
} from './rate-limit.js';

// ============================================================================
// Plugin
// ============================================================================

export type { AuthPluginOptions, AuthService } from './plugin.js';
export {
  authPlugin,
  defaultAuthPlugin,
} from './plugin.js';

// ============================================================================
// CSRF Protection
// ============================================================================

export type {
  CsrfConfig,
  CsrfContext,
  CsrfCookieConfig,
  CsrfErrorCode,
  CsrfManager,
  CsrfMiddlewareOptions,
  CsrfTokenConfig,
  CsrfTokenData,
  CsrfTokenResult,
  CsrfValidationConfig,
} from './csrf.js';
export {
  CsrfError,
  csrfManager,
  csrfMiddleware,
} from './csrf.js';

// ============================================================================
// Session Management
// ============================================================================

export type {
  // Session handle
  Session,
  // Context types
  SessionAuthContext,
  // Configuration types
  SessionConfig,
  SessionContext,
  SessionCookieConfig,
  // Session data types
  SessionData,
  SessionExpirationConfig,
  // Session manager
  SessionManager,
  // Middleware options
  SessionMiddlewareOptions,
  // Store interface
  SessionStore,
  StoredSession,
} from './session.js';
export {
  inMemorySessionStore,
  isSessionAuthenticated,
  loginSession,
  logoutSession,
  sessionManager,
  sessionMiddleware,
} from './session.js';

// ============================================================================
// Auth Adapter System
// ============================================================================

export type {
  // Middleware types
  AdapterAuthContext,
  // Route types
  AdapterHttpMethod,
  AdapterMiddlewareOptions,
  AdapterRoute,
  // Session result types
  AdapterSession,
  AdapterSessionResult,
  AdapterUser,
  // Adapter interface
  AuthAdapter,
  // Configuration types
  AuthAdapterConfig,
  // Error types
  AuthAdapterErrorCode,
  // Plugin options
  AuthAdapterPluginOptions,
  // Type utilities
  InferAdapterConfig,
} from './adapter.js';
export {
  // Error class
  AuthAdapterError,
  // Abstract base class
  BaseAuthAdapter,
  // Factory functions
  createAdapterAuthMiddleware,
  createAuthAdapterPlugin,
  defineAuthAdapter,
  // Type guard
  isAuthAdapter,
} from './adapter.js';

// ============================================================================
// BetterAuth Adapter
// ============================================================================

export type {
  BetterAuthAdapterConfig,
  BetterAuthApi,
  BetterAuthHandler,
  BetterAuthInstance,
  BetterAuthSession,
  BetterAuthSessionResult,
  BetterAuthUser,
} from './adapters/better-auth.js';
export { BetterAuthAdapter, createBetterAuthAdapter } from './adapters/better-auth.js';

// ============================================================================
// Password Policy
// ============================================================================

export type {
  PasswordPolicyConfig,
  PasswordValidationResult,
  UserInfo,
} from './password-policy.js';
export {
  checkPasswordBreach,
  checkPasswordStrength,
  isCommonPassword,
  PasswordPolicy,
  PasswordStrength,
  passwordPolicy,
} from './password-policy.js';
