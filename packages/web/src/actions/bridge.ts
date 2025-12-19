/**
 * tRPC Bridge for Server Actions
 *
 * Provides type-safe access to tRPC procedures from server actions,
 * enabling the VeloxTS hybrid API pattern.
 *
 * @module @veloxts/web/actions/bridge
 */

import type { ZodSchema } from 'zod';

import { createAction, error, success } from './handler.js';
import type {
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionHandler,
  ActionResult,
  CallableAction,
  TrpcBridgeOptions,
} from './types.js';

// ============================================================================
// Type-Safe Procedure Path Utilities
// ============================================================================

/**
 * Extracts all valid procedure paths from a tRPC router type.
 *
 * Given a router like:
 * ```typescript
 * const router = {
 *   users: { get: procedure(), list: procedure() },
 *   posts: { create: procedure() }
 * };
 * ```
 *
 * This type produces: 'users.get' | 'users.list' | 'posts.create'
 *
 * @template TRouter - The tRPC router type
 * @template TPrefix - Internal prefix for recursive path building
 */
export type ExtractProcedurePaths<TRouter, TPrefix extends string = ''> = TRouter extends object
  ? {
      [K in keyof TRouter & string]: TRouter[K] extends (...args: never[]) => unknown
        ? TPrefix extends ''
          ? K
          : `${TPrefix}.${K}`
        : TRouter[K] extends object
          ? ExtractProcedurePaths<TRouter[K], TPrefix extends '' ? K : `${TPrefix}.${K}`>
          : never;
    }[keyof TRouter & string]
  : never;

/**
 * Extracts the input type for a procedure at a given path.
 *
 * @template TRouter - The tRPC router type
 * @template TPath - The dot-separated procedure path
 */
export type ExtractProcedureInput<TRouter, TPath extends string> = TPath extends `${infer Head}.${infer Tail}`
  ? Head extends keyof TRouter
    ? ExtractProcedureInput<TRouter[Head], Tail>
    : unknown
  : TPath extends keyof TRouter
    ? TRouter[TPath] extends { _input: infer TInput }
      ? TInput
      : TRouter[TPath] extends (...args: [infer TInput, ...unknown[]]) => unknown
        ? TInput
        : unknown
    : unknown;

/**
 * Extracts the output type for a procedure at a given path.
 *
 * @template TRouter - The tRPC router type
 * @template TPath - The dot-separated procedure path
 */
export type ExtractProcedureOutput<TRouter, TPath extends string> = TPath extends `${infer Head}.${infer Tail}`
  ? Head extends keyof TRouter
    ? ExtractProcedureOutput<TRouter[Head], Tail>
    : unknown
  : TPath extends keyof TRouter
    ? TRouter[TPath] extends { _output: infer TOutput }
      ? TOutput
      : TRouter[TPath] extends (...args: never[]) => Promise<infer TOutput>
        ? TOutput
        : TRouter[TPath] extends (...args: never[]) => infer TOutput
          ? TOutput
          : unknown
    : unknown;

/**
 * Configuration for the tRPC bridge
 */
export interface BridgeConfig {
  /**
   * Base URL for tRPC endpoint
   * @default '/trpc'
   */
  trpcBase: string;

  /**
   * Headers to forward from action context to tRPC
   */
  forwardHeaders: string[];

  /**
   * Custom fetch implementation
   */
  fetch: typeof fetch;
}

const defaultConfig: BridgeConfig = {
  trpcBase: '/trpc',
  forwardHeaders: ['authorization', 'cookie', 'x-request-id'],
  fetch: globalThis.fetch,
};

/**
 * Creates a tRPC bridge for server actions.
 *
 * The bridge allows server actions to call tRPC procedures with full type safety,
 * forwarding authentication and other headers from the action context.
 *
 * @example
 * ```typescript
 * import { createTrpcBridge } from '@veloxts/web';
 * import type { AppRouter } from './trpc/router';
 *
 * const bridge = createTrpcBridge<AppRouter>({
 *   trpcBase: '/trpc',
 * });
 *
 * // Create a server action that calls tRPC
 * export const updateProfile = bridge.createAction(
 *   'users.updateProfile',
 *   { requireAuth: true }
 * );
 * ```
 */
export function createTrpcBridge<TRouter>(
  options?: Partial<TrpcBridgeOptions>
): TrpcBridge<TRouter> {
  const config: BridgeConfig = {
    ...defaultConfig,
    ...options,
    fetch: options?.fetch ?? defaultConfig.fetch,
  };

  return new TrpcBridgeImpl<TRouter>(config);
}

/**
 * tRPC Bridge interface with type-safe procedure path validation.
 *
 * When the router type is provided, `createAction` and `createProtectedAction`
 * will validate that procedure paths are valid paths within the router.
 *
 * @template TRouter - The tRPC router type for path validation
 *
 * @example
 * ```typescript
 * import type { AppRouter } from './trpc/router';
 *
 * const bridge = createTrpcBridge<AppRouter>();
 *
 * // Type-safe: 'users.get' is validated against AppRouter
 * const getUser = bridge.createAction('users.get');
 *
 * // Type error: 'users.invalid' is not a valid procedure path
 * const invalid = bridge.createAction('users.invalid');
 * ```
 */
export interface TrpcBridge<TRouter> {
  /**
   * Create a server action that calls a tRPC procedure.
   *
   * When TRouter is provided, the procedure path is type-checked against
   * the router's structure. Input and output types can be inferred from
   * the router or explicitly provided.
   *
   * @template TPath - Procedure path (validated against TRouter when provided)
   * @template TInput - Input type (defaults to inferred from router)
   * @template TOutput - Output type (defaults to inferred from router)
   */
  createAction<
    TPath extends ExtractProcedurePaths<TRouter> extends never ? string : ExtractProcedurePaths<TRouter>,
    TInput = ExtractProcedureInput<TRouter, TPath>,
    TOutput = ExtractProcedureOutput<TRouter, TPath>,
  >(
    procedurePath: TPath,
    options?: TrpcActionOptions<TInput, TOutput>
  ): CallableAction<TInput, TOutput>;

  /**
   * Create a protected server action (requires authentication).
   *
   * Same as createAction but with requireAuth: true.
   */
  createProtectedAction<
    TPath extends ExtractProcedurePaths<TRouter> extends never ? string : ExtractProcedurePaths<TRouter>,
    TInput = ExtractProcedureInput<TRouter, TPath>,
    TOutput = ExtractProcedureOutput<TRouter, TPath>,
  >(
    procedurePath: TPath,
    options?: Omit<TrpcActionOptions<TInput, TOutput>, 'requireAuth'>
  ): CallableAction<TInput, TOutput>;

  /**
   * Call a tRPC procedure directly from an action handler.
   *
   * This method accepts any string path for flexibility in dynamic scenarios.
   * For type-safe path validation, use createAction instead.
   */
  call<TOutput = unknown>(
    procedurePath: string,
    input: unknown,
    ctx: ActionContext
  ): Promise<ActionResult<TOutput>>;

  /**
   * Create a custom action handler with access to the bridge.
   *
   * Allows composing multiple procedure calls or adding custom logic
   * while still benefiting from action validation and error handling.
   */
  handler<TInput, TOutput>(
    handlerFn: (input: TInput, ctx: ActionContext, call: TrpcCaller<TRouter>) => Promise<TOutput>,
    options?: TrpcActionOptions<TInput, TOutput>
  ): CallableAction<TInput, TOutput>;
}

/**
 * Options for creating a tRPC-bridged action
 */
export interface TrpcActionOptions<TInput, TOutput> {
  /**
   * Zod schema for input validation (before sending to tRPC)
   */
  input?: ZodSchema<TInput>;

  /**
   * Zod schema for output validation (after receiving from tRPC)
   */
  output?: ZodSchema<TOutput>;

  /**
   * Whether authentication is required
   * @default false
   */
  requireAuth?: boolean;

  /**
   * Transform input before sending to tRPC
   */
  transformInput?: (input: TInput) => unknown;

  /**
   * Transform output after receiving from tRPC
   */
  transformOutput?: (output: unknown) => TOutput;
}

/**
 * tRPC caller function type with optional path validation.
 *
 * When TRouter is provided, procedure paths are type-checked.
 * Falls back to accepting any string when TRouter is unknown.
 *
 * @template TRouter - The tRPC router type for path validation
 */
export type TrpcCaller<TRouter = unknown> = <
  TPath extends ExtractProcedurePaths<TRouter> extends never ? string : ExtractProcedurePaths<TRouter>,
  TOutput = ExtractProcedureOutput<TRouter, TPath>,
>(
  procedurePath: TPath,
  input: ExtractProcedureInput<TRouter, TPath>
) => Promise<ActionResult<TOutput>>;

/**
 * Internal tRPC bridge implementation.
 *
 * The TRouter generic is preserved at the type level for interface
 * compatibility but is not used at runtime since path validation
 * happens at compile time.
 *
 * @template TRouter - Router type for compile-time path validation
 */
class TrpcBridgeImpl<TRouter> implements TrpcBridge<TRouter> {
  constructor(private config: BridgeConfig) {}

  createAction<
    TPath extends ExtractProcedurePaths<TRouter> extends never ? string : ExtractProcedurePaths<TRouter>,
    TInput = ExtractProcedureInput<TRouter, TPath>,
    TOutput = ExtractProcedureOutput<TRouter, TPath>,
  >(
    procedurePath: TPath,
    options?: TrpcActionOptions<TInput, TOutput>
  ): CallableAction<TInput, TOutput> {
    const { input, output, requireAuth, transformInput, transformOutput } = options ?? {};

    const handler: ActionHandler<TInput, TOutput> = async (input, ctx) => {
      // Transform input if transformer provided
      const trpcInput = transformInput ? transformInput(input) : input;

      // Call the tRPC procedure
      const result = await this.call<TOutput>(procedurePath, trpcInput, ctx);

      if (!result.success) {
        throw new TrpcBridgeError(result.error.code, result.error.message);
      }

      // Transform output if transformer provided
      return transformOutput ? transformOutput(result.data) : result.data;
    };

    return createAction({ input, output, requireAuth }, handler);
  }

  createProtectedAction<
    TPath extends ExtractProcedurePaths<TRouter> extends never ? string : ExtractProcedurePaths<TRouter>,
    TInput = ExtractProcedureInput<TRouter, TPath>,
    TOutput = ExtractProcedureOutput<TRouter, TPath>,
  >(
    procedurePath: TPath,
    options?: Omit<TrpcActionOptions<TInput, TOutput>, 'requireAuth'>
  ): CallableAction<TInput, TOutput> {
    return this.createAction(procedurePath, { ...options, requireAuth: true });
  }

  async call<TOutput = unknown>(
    procedurePath: string,
    input: unknown,
    ctx: ActionContext
  ): Promise<ActionResult<TOutput>> {
    try {
      // Build the tRPC URL
      const url = this.buildTrpcUrl(procedurePath, input);

      // Forward relevant headers
      const headers = this.buildHeaders(ctx);

      // Determine if this is a query (GET) or mutation (POST)
      const isMutation = this.isMutationProcedure(procedurePath);

      const response = await this.config.fetch(url, {
        method: isMutation ? 'POST' : 'GET',
        headers,
        body: isMutation ? JSON.stringify({ json: input }) : undefined,
      });

      if (!response.ok) {
        return this.handleHttpError(response);
      }

      const data = (await response.json()) as {
        result?: { data?: { json?: unknown } };
        error?: { message?: string };
      };

      // Handle tRPC error response
      if (data.error) {
        return error('BAD_REQUEST', data.error.message ?? 'tRPC procedure failed');
      }

      // Extract the result
      const result = data.result?.data?.json ?? data.result?.data ?? data;
      return success(result as TOutput);
    } catch (err) {
      if (err instanceof TrpcBridgeError) {
        return error(err.code, err.message);
      }

      const message = err instanceof Error ? err.message : 'Unknown error calling tRPC procedure';
      return error('INTERNAL_ERROR', message);
    }
  }

  handler<TInput, TOutput>(
    handlerFn: (input: TInput, ctx: ActionContext, call: TrpcCaller<TRouter>) => Promise<TOutput>,
    options?: TrpcActionOptions<TInput, TOutput>
  ): CallableAction<TInput, TOutput> {
    const { input, output, requireAuth } = options ?? {};

    const handler: ActionHandler<TInput, TOutput> = async (input, ctx) => {
      // Create a bound caller that forwards context
      // Uses TrpcCaller<TRouter> for type-safe path validation in the handler
      const boundCaller = <TCallOutput = unknown>(
        procedurePath: string,
        callInput: unknown
      ) => this.call<TCallOutput>(procedurePath, callInput, ctx);

      return handlerFn(input, ctx, boundCaller as TrpcCaller<TRouter>);
    };

    return createAction({ input, output, requireAuth }, handler);
  }

  /**
   * Builds the tRPC URL for a procedure call
   */
  private buildTrpcUrl(procedurePath: string, input: unknown): string {
    const baseUrl =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3030';

    const url = new URL(`${this.config.trpcBase}/${procedurePath}`, baseUrl);

    // For queries, encode input in URL
    if (!this.isMutationProcedure(procedurePath) && input !== undefined) {
      url.searchParams.set('input', JSON.stringify({ json: input }));
    }

    return url.toString();
  }

  /**
   * Builds headers for the tRPC request
   */
  private buildHeaders(ctx: ActionContext): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    // Forward configured headers from context
    for (const header of this.config.forwardHeaders) {
      const value = ctx.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    }

    return headers;
  }

  /**
   * Determines if a procedure is a mutation based on naming convention
   */
  private isMutationProcedure(procedurePath: string): boolean {
    const procedureName = procedurePath.split('.').pop() ?? '';

    // VeloxTS convention: mutations start with create, update, delete, etc.
    const mutationPrefixes = [
      'create',
      'add',
      'insert',
      'update',
      'edit',
      'patch',
      'delete',
      'remove',
      'destroy',
      'set',
      'toggle',
      'submit',
    ];

    const lowerName = procedureName.toLowerCase();
    return mutationPrefixes.some((prefix) => lowerName.startsWith(prefix));
  }

  /**
   * Handles HTTP error responses
   */
  private handleHttpError(response: Response): ActionError {
    switch (response.status) {
      case 400:
        return error('BAD_REQUEST', 'Bad request to tRPC procedure');
      case 401:
        return error('UNAUTHORIZED', 'Unauthorized access to tRPC procedure');
      case 403:
        return error('FORBIDDEN', 'Forbidden access to tRPC procedure');
      case 404:
        return error('NOT_FOUND', 'tRPC procedure not found');
      case 429:
        return error('RATE_LIMITED', 'Too many requests to tRPC procedure');
      default:
        return error('INTERNAL_ERROR', `tRPC request failed with status ${response.status}`);
    }
  }
}

/**
 * Custom error class for tRPC bridge errors
 */
export class TrpcBridgeError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TrpcBridgeError';
  }
}

/**
 * Helper to create a server action that wraps a tRPC procedure.
 * Shorthand for simple procedure-to-action mapping.
 *
 * @example
 * ```typescript
 * import { wrapProcedure } from '@veloxts/web';
 *
 * // Wrap a tRPC procedure as a server action
 * export const updateUser = wrapProcedure('users.update');
 * ```
 */
export function wrapProcedure<TInput = unknown, TOutput = unknown>(
  procedurePath: string,
  options?: TrpcActionOptions<TInput, TOutput> & TrpcBridgeOptions
): CallableAction<TInput, TOutput> {
  const bridge = createTrpcBridge(options);
  return bridge.createAction(procedurePath, options);
}

/**
 * Creates a batch of server actions from procedure paths.
 *
 * @example
 * ```typescript
 * import { createActions } from '@veloxts/web';
 *
 * export const userActions = createActions({
 *   getUser: 'users.get',
 *   updateUser: 'users.update',
 *   deleteUser: 'users.delete',
 * });
 *
 * // Usage
 * const result = await userActions.getUser({ id: '123' });
 * ```
 */
export function createActions<T extends Record<string, string>>(
  procedures: T,
  options?: TrpcBridgeOptions
): { [K in keyof T]: CallableAction<unknown, unknown> } {
  const bridge = createTrpcBridge(options);
  const actions: Record<string, CallableAction<unknown, unknown>> = {};

  for (const [name, path] of Object.entries(procedures)) {
    actions[name] = bridge.createAction(path);
  }

  return actions as { [K in keyof T]: CallableAction<unknown, unknown> };
}
