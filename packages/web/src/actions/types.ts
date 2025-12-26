/**
 * Server Actions Type Definitions
 *
 * Type definitions for type-safe server actions with tRPC bridge support.
 *
 * @module @veloxts/web/actions/types
 */

import type { ZodSchema, ZodType } from 'zod';

/**
 * Context passed to server actions.
 * Can be extended via declaration merging.
 */
export interface ActionContext {
  /**
   * The original request object
   */
  request: Request;

  /**
   * Request headers
   */
  headers: Headers;

  /**
   * Cookies from the request
   */
  cookies: Map<string, string>;
}

/**
 * Extended action context with user info (when authenticated)
 */
export interface AuthenticatedActionContext extends ActionContext {
  /**
   * The authenticated user (when available)
   */
  user: {
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Result of a successful action
 */
export interface ActionSuccess<T> {
  success: true;
  data: T;
}

/**
 * Result of a failed action
 */
export interface ActionError {
  success: false;
  error: {
    code: ActionErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for action results
 */
export type ActionResult<T> = ActionSuccess<T> | ActionError;

/**
 * Standard action error codes
 */
export type ActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED';

/**
 * Options for creating a server action
 */
export interface CreateActionOptions<TInput, TOutput> {
  /**
   * Zod schema for input validation
   */
  input?: ZodSchema<TInput>;

  /**
   * Zod schema for output validation
   */
  output?: ZodSchema<TOutput>;

  /**
   * Whether authentication is required
   * @default false
   */
  requireAuth?: boolean;

  /**
   * Custom error handler
   */
  onError?: (error: unknown, ctx: ActionContext) => ActionError | Promise<ActionError>;
}

/**
 * Server action handler function type
 */
export type ActionHandler<TInput, TOutput, TContext extends ActionContext = ActionContext> = (
  input: TInput,
  ctx: TContext
) => Promise<TOutput>;

/**
 * Form action handler function type
 */
export type FormActionHandler<TOutput, TContext extends ActionContext = ActionContext> = (
  formData: FormData,
  ctx: TContext
) => Promise<TOutput>;

/**
 * Callable server action (what gets exported)
 */
export type CallableAction<TInput, TOutput> = (input: TInput) => Promise<ActionResult<TOutput>>;

/**
 * Callable form action (what gets exported)
 */
export type CallableFormAction<TOutput> = (formData: FormData) => Promise<ActionResult<TOutput>>;

/**
 * Action metadata for registration and introspection
 */
export interface ActionMetadata {
  /**
   * Unique action identifier
   */
  id: string;

  /**
   * Human-readable action name
   */
  name: string;

  /**
   * Whether the action requires authentication
   */
  requiresAuth: boolean;

  /**
   * Input schema (if validation is enabled)
   */
  inputSchema?: ZodType;

  /**
   * Output schema (if validation is enabled)
   */
  outputSchema?: ZodType;
}

/**
 * Registered action with metadata
 */
export interface RegisteredAction<TInput = unknown, TOutput = unknown> {
  /**
   * Action metadata
   */
  metadata: ActionMetadata;

  /**
   * The callable action function
   */
  action: CallableAction<TInput, TOutput>;

  /**
   * The original handler (for testing/introspection)
   */
  handler: ActionHandler<TInput, TOutput>;
}

/**
 * Action registry for managing registered actions
 */
export interface ActionRegistry {
  /**
   * Register an action
   */
  register<TInput, TOutput>(id: string, action: RegisteredAction<TInput, TOutput>): void;

  /**
   * Get a registered action by ID
   */
  get<TInput = unknown, TOutput = unknown>(
    id: string
  ): RegisteredAction<TInput, TOutput> | undefined;

  /**
   * Check if an action is registered
   */
  has(id: string): boolean;

  /**
   * Get all registered action IDs
   */
  keys(): string[];

  /**
   * Get all registered actions
   */
  values(): RegisteredAction[];
}

/**
 * Options for the tRPC bridge
 */
export interface TrpcBridgeOptions {
  /**
   * Base path for the tRPC endpoint (short alias)
   * @default '/trpc'
   */
  base?: string;

  /**
   * Base path for the tRPC endpoint
   * @default '/trpc'
   * @deprecated Use `base` instead for conciseness
   */
  trpcBase?: string;

  /**
   * Full base URL for server-side tRPC calls (when not in browser context).
   * In browser, uses window.location.origin automatically.
   *
   * @default process.env.API_URL || 'http://localhost:3030'
   *
   * @example
   * ```typescript
   * // Development
   * const bridge = createTrpcBridge({ baseUrl: 'http://localhost:3030' });
   *
   * // Production
   * const bridge = createTrpcBridge({ baseUrl: process.env.API_URL });
   * ```
   */
  baseUrl?: string;

  /**
   * Headers to forward to tRPC calls
   */
  forwardHeaders?: string[];

  /**
   * Custom fetch implementation
   */
  fetch?: typeof fetch;
}

/**
 * tRPC procedure caller type
 */
export type ProcedureCaller<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : TRouter[K];
};

/**
 * Action builder for fluent API
 */
export interface ActionBuilder<TInput, TOutput, TContext extends ActionContext> {
  /**
   * Set input validation schema
   */
  input<TNewInput>(schema: ZodSchema<TNewInput>): ActionBuilder<TNewInput, TOutput, TContext>;

  /**
   * Set output validation schema
   */
  output<TNewOutput>(schema: ZodSchema<TNewOutput>): ActionBuilder<TInput, TNewOutput, TContext>;

  /**
   * Require authentication
   */
  protected(): ActionBuilder<TInput, TOutput, AuthenticatedActionContext>;

  /**
   * Define the action handler
   */
  action(handler: ActionHandler<TInput, TOutput, TContext>): CallableAction<TInput, TOutput>;
}
