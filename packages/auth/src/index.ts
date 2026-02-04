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
  // Auth context discriminated union
  AdapterAuthContext,
  AuthConfig,
  AuthContext,
  AuthMiddlewareOptions,
  BaseAuthContext,
  GuardDefinition,
  // Guard types
  GuardFunction,
  HashConfig,
  // Configuration types
  JwtConfig,
  // Auth mode-specific contexts
  NativeAuthContext,
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
// Decoration Utilities
// ============================================================================

export {
  AUTH_REGISTERED,
  checkDoubleRegistration,
  decorateAuth,
  getRequestAuth,
  getRequestUser,
  setRequestAuth,
} from './decoration.js';

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
// Enhanced Token Store (with Revocation + Reuse Detection)
// ============================================================================

export type { EnhancedTokenStore, EnhancedTokenStoreOptions } from './token-store.js';
export {
  createEnhancedTokenStore,
  DEFAULT_ALLOWED_ROLES,
  parseUserRoles,
} from './token-store.js';

// ============================================================================
// Narrowing Guards (Experimental)
// ============================================================================

export type {
  ADMIN,
  AdminContext,
  AUTHENTICATED,
  AuthenticatedContext,
  InferNarrowedContext,
  NarrowingGuard,
  RoleNarrowedContext,
  TaggedContext,
} from './guards-narrowing.js';
export {
  adminNarrow,
  authenticatedNarrow,
  hasRoleNarrow,
} from './guards-narrowing.js';

// ============================================================================
// Password Hashing
// ============================================================================

export {
  DEFAULT_HASH_CONFIG,
  hashPassword,
  PasswordHasher,
  passwordHasher,
  verifyPassword,
} from './hash.js';

// ============================================================================
// Guards
// ============================================================================

export type { GuardBuilder } from './guards.js';
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

// NOTE: _resetGuardCounter is available via '@veloxts/auth/testing' for test isolation

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

export type { AuthRateLimitConfig, AuthRateLimiter, AuthRateLimiterConfig } from './rate-limit.js';
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

export type { AuthPluginOptions, AuthService, JwtAuthOptions } from './plugin.js';
export {
  authPlugin,
  defaultAuthPlugin,
  jwtAuth,
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
  sessionManager,
  sessionMiddleware,
} from './session.js';

// ============================================================================
// Auth Adapter System
// ============================================================================

export type {
  // Route types
  AdapterHttpMethod,
  // Middleware types
  AdapterMiddlewareContext,
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
// JWT Adapter
// ============================================================================

export type { JwtAdapterConfig } from './adapters/jwt-adapter.js';
export { createJwtAdapter, JwtAdapter } from './adapters/jwt-adapter.js';

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
