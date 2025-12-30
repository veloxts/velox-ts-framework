/**
 * Server Actions Type Definitions
 *
 * Type definitions for type-safe server actions with tRPC bridge support.
 *
 * @module @veloxts/web/actions/types
 */

import type { ZodSchema, ZodType } from 'zod';

// Import browser-safe types for local use
import type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
} from '../types/actions.js';

// Re-export from canonical source for consumers
export type { ActionError, ActionErrorCode, ActionResult, ActionSuccess };

/**
 * Context passed to server actions.
 * Can be extended via declaration merging to add custom properties.
 *
 * @example Extending ActionContext
 * ```typescript
 * // In your project's types.d.ts or similar
 * declare module '@veloxts/web' {
 *   interface ActionContext {
 *     db: PrismaClient;
 *     logger: Logger;
 *   }
 * }
 *
 * // Now db and logger are available in action handlers
 * export const createUser = action()
 *   .input(CreateUserSchema)
 *   .run(async (input, ctx) => {
 *     ctx.db.user.create({ data: input });
 *     ctx.logger.info('User created');
 *   });
 * ```
 *
 * @public
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
 * Extended action context with user info (when authenticated).
 * Available when using `.protected()` in the action builder.
 * @public
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

// ActionSuccess, ActionError, ActionResult, ActionErrorCode are re-exported
// from ../types/actions.js above to maintain a single source of truth

/**
 * Options for creating a server action.
 * @public
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
 * Server action handler function type.
 * @public
 */
export type ActionHandler<TInput, TOutput, TContext extends ActionContext = ActionContext> = (
  input: TInput,
  ctx: TContext
) => Promise<TOutput>;

/**
 * Form action handler function type.
 * @public
 */
export type FormActionHandler<TOutput, TContext extends ActionContext = ActionContext> = (
  formData: FormData,
  ctx: TContext
) => Promise<TOutput>;

/**
 * Callable server action (what gets exported from 'use server' files).
 * @public
 */
export type CallableAction<TInput, TOutput> = (input: TInput) => Promise<ActionResult<TOutput>>;

/**
 * Callable form action (what gets exported from 'use server' files).
 * @public
 */
export type CallableFormAction<TOutput> = (formData: FormData) => Promise<ActionResult<TOutput>>;

/**
 * Action metadata for registration and introspection.
 * @public
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
 * Registered action with metadata.
 * @public
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
 * Action registry for managing registered actions.
 * @public
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
 * Options for the tRPC bridge.
 * @public
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
 * tRPC procedure caller type.
 * @public
 */
export type ProcedureCaller<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : TRouter[K];
};

/**
 * Action builder for fluent API.
 * @public
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
