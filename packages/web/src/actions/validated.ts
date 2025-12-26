/**
 * Validated Server Action Helper
 *
 * Type-safe server actions with automatic Zod validation, authentication,
 * CSRF protection, rate limiting, and input sanitization.
 *
 * Designed for use with the "use server" directive in React Server Components.
 *
 * @module @veloxts/web/actions/validated
 */

import { ZodError, type ZodType, type ZodTypeDef } from 'zod';

import { createH3Context, type H3ActionContext } from '../adapters/h3-adapter.js';
import type {
  ActionContext,
  ActionError,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
} from './types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Constraint for valid Zod schemas
 */
export type ValidZodSchema<T = unknown> = ZodType<T, ZodTypeDef, unknown>;

/**
 * Infers the output type from a Zod schema
 */
export type InferSchemaType<TSchema> =
  TSchema extends ZodType<infer O, ZodTypeDef, unknown> ? O : never;

/**
 * Handler function signature for validated actions
 */
export type ValidatedHandler<TInput, TOutput, TContext extends ActionContext> = (
  input: TInput,
  ctx: TContext
) => TOutput | Promise<TOutput>;

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom key generator for rate limit buckets */
  keyGenerator?: (ctx: ActionContext) => string;
}

/**
 * Base options for validated() - authentication NOT required
 */
export interface ValidatedOptionsBase {
  /**
   * Require authentication for this action
   * When false/undefined, ctx.user is optional
   * @default false
   */
  requireAuth?: false;

  /**
   * Output schema for response validation (optional)
   * Validates handler return value before sending to client
   */
  outputSchema?: ValidZodSchema;

  /**
   * Maximum input payload size in bytes
   * Prevents DoS via large payloads
   * @default 1048576 (1MB)
   */
  maxInputSize?: number;

  /**
   * Rate limiting configuration
   * @default { maxRequests: 100, windowMs: 60000 } for queries
   */
  rateLimit?: RateLimitConfig;

  /**
   * Bypass CSRF protection (only for read-only queries)
   * @default false
   */
  bypassCsrf?: boolean;

  /**
   * Custom error transformer
   */
  onError?: (error: unknown) => ActionError['error'];
}

/**
 * Options for validated() when authentication IS required
 */
export interface ValidatedOptionsAuthenticated {
  /**
   * Require authentication for this action
   * When true, ctx.user is guaranteed non-optional
   */
  requireAuth: true;

  /**
   * Required roles (any match grants access)
   */
  requireRoles?: string[];

  /**
   * Required permissions (all must match)
   */
  requirePermissions?: string[];

  /** Output schema for response validation */
  outputSchema?: ValidZodSchema;

  /** Maximum input payload size in bytes */
  maxInputSize?: number;

  /**
   * Rate limiting configuration
   * @default { maxRequests: 10, windowMs: 60000 } for mutations
   */
  rateLimit?: RateLimitConfig;

  /** Bypass CSRF protection */
  bypassCsrf?: boolean;

  /** Custom error transformer */
  onError?: (error: unknown) => ActionError['error'];
}

/**
 * Union of valid option configurations
 */
export type ValidatedOptions = ValidatedOptionsBase | ValidatedOptionsAuthenticated;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MAX_INPUT_SIZE = 1024 * 1024; // 1MB

const DEFAULT_RATE_LIMITS = {
  query: { maxRequests: 100, windowMs: 60000 }, // 100/min for queries
  mutation: { maxRequests: 10, windowMs: 60000 }, // 10/min for mutations
};

// Simple in-memory rate limiter (replace with Redis in production)
// WARNING: For production with multiple server instances, use Redis-backed rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup interval reference (for testing cleanup)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts periodic cleanup of expired rate limit entries to prevent memory leaks.
 * Runs every 60 seconds by default.
 *
 * @param intervalMs - Cleanup interval in milliseconds (default: 60000)
 */
function startRateLimitCleanup(intervalMs = 60000): void {
  if (cleanupInterval) return; // Already running

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, intervalMs);

  // Don't prevent Node.js from exiting
  cleanupInterval.unref();
}

/**
 * Stops the rate limit cleanup interval.
 * Only used for testing purposes.
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clears all rate limit entries.
 * Only used for testing purposes.
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

// Start cleanup on module load
startRateLimitCleanup();

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Validates input size before parsing (DoS prevention)
 *
 * Handles circular references and other serialization failures gracefully.
 */
function validateInputSize(input: unknown, maxSize: number): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    // Handle circular references or other serialization failures
    // Estimate size using a depth-limited traversal
    const estimatedSize = estimateObjectSize(input);
    if (estimatedSize > maxSize) {
      throw new InputSizeError(`Input payload exceeds maximum size of ${maxSize} bytes`);
    }
    return;
  }

  if (serialized.length > maxSize) {
    throw new InputSizeError(`Input payload exceeds maximum size of ${maxSize} bytes`);
  }
}

/**
 * Estimates object size for inputs that can't be serialized (e.g., circular refs)
 *
 * Uses a depth-limited traversal with Set-based cycle detection to avoid
 * infinite loops. Returns a conservative estimate of the serialized size.
 */
function estimateObjectSize(obj: unknown, seen = new WeakSet(), depth = 0): number {
  const MAX_DEPTH = 10;

  if (depth > MAX_DEPTH) {
    return 100; // Conservative estimate for deep objects
  }

  if (obj === null) return 4; // "null"
  if (obj === undefined) return 9; // "undefined"

  switch (typeof obj) {
    case 'string':
      return obj.length + 2; // quotes
    case 'number':
    case 'boolean':
      return String(obj).length;
    case 'object': {
      // Cycle detection
      if (seen.has(obj as object)) {
        return 100; // Conservative estimate for circular ref
      }
      seen.add(obj as object);

      if (Array.isArray(obj)) {
        let size = 2; // []
        for (const item of obj) {
          size += estimateObjectSize(item, seen, depth + 1) + 1; // comma
        }
        return size;
      }

      let size = 2; // {}
      for (const [key, value] of Object.entries(obj)) {
        size += key.length + 3; // "key":
        size += estimateObjectSize(value, seen, depth + 1) + 1; // comma
      }
      return size;
    }
    default:
      return 10;
  }
}

/**
 * Sanitizes input to prevent prototype pollution and null byte injection
 */
function sanitizeInput<T>(input: T): T {
  if (typeof input === 'string') {
    // Strip null bytes (prevent injection attacks)
    return input.replace(/\0/g, '') as T;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput) as T;
  }

  if (input !== null && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized as T;
  }

  return input;
}

/**
 * Enforces rate limiting
 */
function enforceRateLimit(ctx: ActionContext, config: RateLimitConfig): void {
  const key = config.keyGenerator?.(ctx) ?? getDefaultRateLimitKey(ctx);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (entry && now > entry.resetAt) {
    rateLimitStore.delete(key);
    entry = undefined;
  }

  if (!entry) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return;
  }

  entry.count += 1;

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter}s`, retryAfter);
  }
}

/**
 * IPv4 regex pattern
 * Matches standard dotted-decimal notation (e.g., 192.168.1.1)
 */
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * IPv6 regex pattern (simplified)
 * Matches standard and compressed IPv6 notation
 */
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/**
 * Validates an IP address format
 *
 * Returns the IP if valid, or 'invalid' if the format is not recognized.
 * This prevents using malformed IP strings as rate limit keys.
 */
function validateIpAddress(ip: string | undefined | null): string {
  if (!ip) return 'unknown';

  const trimmed = ip.trim();
  if (!trimmed) return 'unknown';

  // Check IPv4
  if (IPV4_REGEX.test(trimmed)) {
    // Validate each octet is 0-255
    const octets = trimmed.split('.');
    if (octets.every((o) => Number(o) >= 0 && Number(o) <= 255)) {
      return trimmed;
    }
  }

  // Check IPv6
  if (IPV6_REGEX.test(trimmed) || trimmed === '::1') {
    return trimmed;
  }

  // Could be IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (trimmed.startsWith('::ffff:')) {
    const ipv4Part = trimmed.slice(7);
    if (IPV4_REGEX.test(ipv4Part)) {
      return ipv4Part; // Normalize to IPv4
    }
  }

  return 'invalid';
}

/**
 * Extracts client IP address from request headers
 *
 * Priority order:
 * 1. X-Forwarded-For (first IP in chain, set by reverse proxies)
 * 2. X-Real-IP (set by nginx and some proxies)
 * 3. 'unknown' if no valid IP found
 *
 * All IPs are validated to prevent malformed rate limit keys.
 */
function extractClientIp(headers: Headers): string {
  // Try X-Forwarded-For first (standard for proxies)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list: client, proxy1, proxy2
    // The first IP is typically the original client
    const firstIp = forwardedFor.split(',')[0];
    const validated = validateIpAddress(firstIp);
    if (validated !== 'unknown' && validated !== 'invalid') {
      return validated;
    }
  }

  // Try X-Real-IP (used by nginx)
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    const validated = validateIpAddress(realIp);
    if (validated !== 'unknown' && validated !== 'invalid') {
      return validated;
    }
  }

  return 'unknown';
}

/**
 * Gets default rate limit key from context
 */
function getDefaultRateLimitKey(ctx: ActionContext): string {
  // Prefer user ID if authenticated, fall back to IP
  if ('user' in ctx && ctx.user) {
    return `user:${(ctx.user as { id: string }).id}`;
  }

  // Extract and validate client IP
  const ip = extractClientIp(ctx.headers);
  return `ip:${ip}`;
}

/**
 * Formats Zod errors for safe client consumption
 */
function formatZodErrors(error: ZodError): Array<{ path: string; message: string; code: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

// ============================================================================
// Error Classes
// ============================================================================

class InputSizeError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InputSizeError';
  }
}

class RateLimitError extends Error {
  readonly code = 'RATE_LIMITED' as const;
  constructor(
    message: string,
    readonly retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class AuthenticationError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN' as const;
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class CsrfError extends Error {
  readonly code = 'CSRF_INVALID' as const;
  constructor(message = 'CSRF validation failed') {
    super(message);
    this.name = 'CsrfError';
  }
}

// ============================================================================
// Result Factories
// ============================================================================

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function errorResult(
  code: ActionError['error']['code'],
  message: string,
  details?: Record<string, unknown>
): ActionError {
  return {
    success: false,
    error: { code, message, details },
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if options require authentication
 */
function isAuthRequired(
  options: ValidatedOptions | undefined
): options is ValidatedOptionsAuthenticated {
  return options !== undefined && 'requireAuth' in options && options.requireAuth === true;
}

/**
 * Type guard to check if context has authenticated user
 */
function hasAuthenticatedUser(ctx: ActionContext): ctx is AuthenticatedActionContext {
  return 'user' in ctx && ctx.user !== undefined && ctx.user !== null;
}

/**
 * Type guard to check if user has required roles
 */
function hasRequiredRoles(ctx: AuthenticatedActionContext, requiredRoles: string[]): boolean {
  const user = ctx.user as { roles?: string[] };
  if (!user.roles || !Array.isArray(user.roles)) {
    return false;
  }
  return requiredRoles.some((role) => user.roles?.includes(role));
}

/**
 * Type guard to check if user has required permissions
 */
function hasRequiredPermissions(
  ctx: AuthenticatedActionContext,
  requiredPermissions: string[]
): boolean {
  const user = ctx.user as { permissions?: string[] };
  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }
  return requiredPermissions.every((perm) => user.permissions?.includes(perm));
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Converts errors to safe ActionError responses
 */
function handleError(
  error: unknown,
  onError?: (err: unknown) => ActionError['error']
): ActionError {
  // Custom error handler
  if (onError) {
    return { success: false, error: onError(error) };
  }

  // Known error types
  if (error instanceof ZodError) {
    return errorResult('VALIDATION_ERROR', 'Validation failed', {
      errors: formatZodErrors(error),
    });
  }

  if (error instanceof InputSizeError) {
    return errorResult('BAD_REQUEST', error.message);
  }

  if (error instanceof RateLimitError) {
    return errorResult('RATE_LIMITED', error.message, { retryAfter: error.retryAfter });
  }

  if (error instanceof AuthenticationError) {
    return errorResult('UNAUTHORIZED', error.message);
  }

  if (error instanceof AuthorizationError) {
    return errorResult('FORBIDDEN', error.message);
  }

  if (error instanceof CsrfError) {
    return errorResult('FORBIDDEN', error.message);
  }

  // Log unknown errors server-side (structured for production)
  console.error(
    '[VeloxTS] Server action error:',
    error instanceof Error ? error.message : 'Unknown error'
  );

  // Return sanitized error to client
  return errorResult('INTERNAL_ERROR', 'An unexpected error occurred');
}

// ============================================================================
// Context Provider - Vinxi Integration
// ============================================================================

/**
 * Whether we're running in a Vinxi/H3 environment
 * Cached after first check for performance
 */
let isVinxiEnvironment: boolean | null = null;

/**
 * Gets the current server action context from Vinxi's H3 layer.
 *
 * When running inside a Vinxi server function, this returns real request
 * context with headers, cookies, and response utilities. Falls back to
 * a mock context for testing or non-Vinxi environments.
 */
async function getServerContext(): Promise<ActionContext | H3ActionContext> {
  // Try to use real H3 context from Vinxi
  if (isVinxiEnvironment === null) {
    try {
      // Attempt to create H3 context - this will throw if vinxi is not available
      const ctx = await createH3Context();
      isVinxiEnvironment = true;
      return ctx;
    } catch {
      // Not in Vinxi environment (testing, non-RSC usage, etc.)
      isVinxiEnvironment = false;
    }
  } else if (isVinxiEnvironment) {
    return createH3Context();
  }

  // Fallback: mock context for testing
  const headers = new Headers();
  const request = new Request('http://localhost/', { headers });

  return {
    request,
    headers,
    cookies: new Map(),
  };
}

/**
 * Resets the Vinxi environment detection.
 * Only used for testing purposes.
 */
export function resetServerContextCache(): void {
  isVinxiEnvironment = null;
}

// ============================================================================
// CSRF Validation
// ============================================================================

/**
 * Default allowed origins for CSRF validation.
 * Can be extended via environment variable ALLOWED_ORIGINS (comma-separated).
 */
function getAllowedOrigins(request: Request): string[] {
  const origins: string[] = [];

  // Add the request's origin as allowed
  const url = new URL(request.url);
  origins.push(url.origin);

  // Add configured origins from environment
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    origins.push(...envOrigins.split(',').map((o) => o.trim()));
  }

  // Common development origins
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:3030', 'http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Validates CSRF protection for authenticated mutations.
 *
 * Uses Origin header validation as the primary defense against CSRF attacks.
 * For server actions invoked via JavaScript, browsers always send the Origin header.
 *
 * Security model:
 * 1. Origin header MUST be present for authenticated mutations
 * 2. Origin MUST match the server's expected origins
 * 3. If no Origin, check Referer as fallback
 * 4. Reject if neither header is present or valid
 *
 * @throws CsrfError if validation fails
 */
function validateCsrf(ctx: ActionContext): void {
  const origin = ctx.headers.get('origin');
  const referer = ctx.headers.get('referer');

  // For server actions, Origin header should always be present
  // (browsers send it for all cross-origin AND same-origin requests triggered by JS)
  if (!origin && !referer) {
    // If both are missing, this could be:
    // 1. A same-origin navigation (safe for form submissions, but we're a server action)
    // 2. A non-browser client (API client, curl, etc.)
    // 3. Privacy-stripping proxy
    // For server actions, we require at least one header for CSRF protection
    throw new CsrfError(
      'Missing Origin header. CSRF validation requires Origin or Referer header.'
    );
  }

  const allowedOrigins = getAllowedOrigins(ctx.request);

  // Check Origin header first (preferred)
  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      throw new CsrfError(`Origin '${origin}' not in allowed list`);
    }
    return; // Origin is valid, CSRF check passed
  }

  // Fallback: check Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        throw new CsrfError(`Referer origin '${refererOrigin}' not in allowed list`);
      }
      return; // Referer origin is valid, CSRF check passed
    } catch {
      throw new CsrfError('Invalid Referer header format');
    }
  }

  // Should not reach here (checked above), but just in case
  throw new CsrfError('CSRF validation failed');
}

// ============================================================================
// Main Implementation
// ============================================================================

/**
 * Creates a validated server action with security layers.
 *
 * Security layers (in order):
 * 1. Rate limiting (before any processing)
 * 2. Input size validation (DoS prevention)
 * 3. Authentication check (if required)
 * 4. Authorization check (roles/permissions)
 * 5. CSRF validation (for authenticated mutations)
 * 6. Zod schema validation
 * 7. Input sanitization (prototype pollution, null bytes)
 *
 * @example
 * ```typescript
 * "use server";
 * import { validated } from '@veloxts/web';
 * import { z } from 'zod';
 *
 * // Basic usage - input inferred from schema
 * export const updateProfile = validated(
 *   z.object({ name: z.string().max(100), bio: z.string().max(1000).optional() }),
 *   async (input, ctx) => {
 *     return ctx.db.user.update({ where: { id: ctx.user?.id }, data: input });
 *   }
 * );
 *
 * // With authentication requirement
 * export const deleteAccount = validated(
 *   z.object({ confirmation: z.literal('DELETE') }),
 *   async (input, ctx) => {
 *     // ctx.user is guaranteed non-null here
 *     return ctx.db.user.delete({ where: { id: ctx.user.id } });
 *   },
 *   { requireAuth: true }
 * );
 * ```
 */
export function validated<TSchema extends ValidZodSchema, TOutput>(
  schema: TSchema,
  handler: ValidatedHandler<InferSchemaType<TSchema>, TOutput, ActionContext>,
  options?: ValidatedOptionsBase
): (input: InferSchemaType<TSchema>) => Promise<ActionResult<TOutput>>;

export function validated<TSchema extends ValidZodSchema, TOutput>(
  schema: TSchema,
  handler: ValidatedHandler<InferSchemaType<TSchema>, TOutput, AuthenticatedActionContext>,
  options: ValidatedOptionsAuthenticated
): (input: InferSchemaType<TSchema>) => Promise<ActionResult<TOutput>>;

// Implementation signature must be compatible with all overloads
// Using a generic constraint that covers both ActionContext and AuthenticatedActionContext
export function validated<
  TSchema extends ValidZodSchema,
  TOutput,
  TContext extends ActionContext = ActionContext,
>(
  schema: TSchema,
  handler: ValidatedHandler<InferSchemaType<TSchema>, TOutput, TContext>,
  options?: ValidatedOptions
): (input: InferSchemaType<TSchema>) => Promise<ActionResult<TOutput>> {
  const maxInputSize = options?.maxInputSize ?? DEFAULT_MAX_INPUT_SIZE;
  const rateLimit =
    options?.rateLimit ??
    (isAuthRequired(options) ? DEFAULT_RATE_LIMITS.mutation : DEFAULT_RATE_LIMITS.query);

  return async (rawInput: InferSchemaType<TSchema>): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Get server context
      const ctx = await getServerContext();

      // 2. Rate limiting (FIRST - before any expensive operations)
      enforceRateLimit(ctx, rateLimit);

      // 3. Input size check (DoS prevention)
      validateInputSize(rawInput, maxInputSize);

      // 4. Authentication check
      if (isAuthRequired(options)) {
        if (!hasAuthenticatedUser(ctx)) {
          throw new AuthenticationError();
        }

        // 5. Authorization check (roles)
        if (options.requireRoles?.length) {
          if (!hasRequiredRoles(ctx as AuthenticatedActionContext, options.requireRoles)) {
            throw new AuthorizationError(`Required roles: ${options.requireRoles.join(', ')}`);
          }
        }

        // 6. Authorization check (permissions)
        if (options.requirePermissions?.length) {
          if (
            !hasRequiredPermissions(ctx as AuthenticatedActionContext, options.requirePermissions)
          ) {
            throw new AuthorizationError('Missing required permissions');
          }
        }
      }

      // 7. CSRF validation (for authenticated mutations)
      // Server actions require Origin header validation to prevent CSRF attacks
      if (!options?.bypassCsrf && isAuthRequired(options)) {
        validateCsrf(ctx);
      }

      // 8. Zod schema validation
      const parseResult = schema.safeParse(rawInput);
      if (!parseResult.success) {
        return errorResult('VALIDATION_ERROR', 'Validation failed', {
          errors: formatZodErrors(parseResult.error),
        });
      }

      // 9. Input sanitization
      const sanitizedInput = sanitizeInput(parseResult.data) as InferSchemaType<TSchema>;

      // 10. Execute handler
      const result = await handler(sanitizedInput, ctx as TContext);

      // 11. Output validation (optional)
      if (options?.outputSchema) {
        const outputResult = options.outputSchema.safeParse(result);
        if (!outputResult.success) {
          console.error('[VeloxTS] Output validation failed:', outputResult.error);
          return errorResult('INTERNAL_ERROR', 'Response validation failed');
        }
        return success(outputResult.data as TOutput);
      }

      return success(result);
    } catch (error) {
      return handleError(error, options?.onError);
    }
  };
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Creates a validated mutation (requires authentication by default)
 *
 * @example
 * ```typescript
 * export const createPost = validatedMutation(
 *   z.object({ title: z.string(), content: z.string() }),
 *   async (input, ctx) => {
 *     // ctx.user is guaranteed
 *     return ctx.db.post.create({ data: { ...input, authorId: ctx.user.id } });
 *   }
 * );
 * ```
 */
export function validatedMutation<TSchema extends ValidZodSchema, TOutput>(
  schema: TSchema,
  handler: ValidatedHandler<InferSchemaType<TSchema>, TOutput, AuthenticatedActionContext>,
  options?: Omit<ValidatedOptionsAuthenticated, 'requireAuth'>
): (input: InferSchemaType<TSchema>) => Promise<ActionResult<TOutput>> {
  return validated(schema, handler, { ...options, requireAuth: true });
}

/**
 * Creates a validated query (authentication optional, CSRF bypassed)
 *
 * @example
 * ```typescript
 * export const getPost = validatedQuery(
 *   z.object({ id: z.string().uuid() }),
 *   async (input, ctx) => {
 *     return ctx.db.post.findUnique({ where: { id: input.id } });
 *   }
 * );
 * ```
 */
export function validatedQuery<TSchema extends ValidZodSchema, TOutput>(
  schema: TSchema,
  handler: ValidatedHandler<InferSchemaType<TSchema>, TOutput, ActionContext>,
  options?: ValidatedOptionsBase
): (input: InferSchemaType<TSchema>) => Promise<ActionResult<TOutput>> {
  return validated(schema, handler, { ...options, bypassCsrf: true });
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Extracts the input type from a validated action
 *
 * @example
 * ```typescript
 * const updateProfile = validated(z.object({ name: z.string() }), handler);
 * type Input = InferValidatedInput<typeof updateProfile>;
 * // Input = { name: string }
 * ```
 */
export type InferValidatedInput<TAction> = TAction extends (
  input: infer I
) => Promise<ActionResult<unknown>>
  ? I
  : never;

/**
 * Extracts the output type from a validated action
 */
export type InferValidatedOutput<TAction> = TAction extends (
  input: unknown
) => Promise<ActionResult<infer O>>
  ? O
  : never;

// ============================================================================
// Re-export Error Classes for Custom Error Handling
// ============================================================================

export { AuthenticationError, AuthorizationError, CsrfError, InputSizeError, RateLimitError };
