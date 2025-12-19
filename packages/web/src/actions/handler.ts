/**
 * Server Action Handler
 *
 * Core implementation for type-safe server actions with validation,
 * error handling, and context management.
 *
 * @module @veloxts/web/actions/handler
 */

import type { ZodSchema } from 'zod';

import type {
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionHandler,
  ActionMetadata,
  ActionRegistry,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
  CallableAction,
  CallableFormAction,
  CreateActionOptions,
  FormActionHandler,
  RegisteredAction,
} from './types.js';

/**
 * Creates a successful action result
 */
export function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

/**
 * Creates an error action result
 */
export function error(
  code: ActionErrorCode,
  message: string,
  details?: Record<string, unknown>
): ActionError {
  return {
    success: false,
    error: { code, message, details },
  };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: ActionResult<T>): result is ActionSuccess<T> {
  return result.success === true;
}

/**
 * Type guard to check if result is an error
 */
export function isError<T>(result: ActionResult<T>): result is ActionError {
  return result.success === false;
}

/**
 * Parses cookies from a request headers
 */
export function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return cookies;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name) {
      const value = valueParts.join('=');
      cookies.set(name.trim(), decodeURIComponent(value.trim()));
    }
  }

  return cookies;
}

/**
 * Creates an action context from a request
 */
export function createActionContext(request: Request): ActionContext {
  return {
    request,
    headers: request.headers,
    cookies: parseCookies(request),
  };
}

/**
 * Validates input against a Zod schema
 */
async function validateInput<T>(schema: ZodSchema<T>, input: unknown): Promise<ActionResult<T>> {
  try {
    const result = await schema.parseAsync(input);
    return success(result);
  } catch (err) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zodError = err as { errors: Array<{ path: (string | number)[]; message: string }> };
      return error('VALIDATION_ERROR', 'Input validation failed', {
        errors: zodError.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return error('VALIDATION_ERROR', 'Input validation failed');
  }
}

/**
 * Validates output against a Zod schema
 */
async function validateOutput<T>(schema: ZodSchema<T>, output: unknown): Promise<ActionResult<T>> {
  try {
    const result = await schema.parseAsync(output);
    return success(result);
  } catch (err) {
    // Output validation errors are internal errors (shouldn't happen in production)
    console.error('[VeloxTS] Action output validation failed:', err);
    return error('INTERNAL_ERROR', 'Action output validation failed');
  }
}

/**
 * Default error handler
 */
function defaultErrorHandler(err: unknown): ActionError {
  // Handle known error types
  if (err instanceof Error) {
    // Check for common error patterns
    if (err.message.includes('unauthorized') || err.message.includes('Unauthorized')) {
      return error('UNAUTHORIZED', err.message);
    }
    if (err.message.includes('forbidden') || err.message.includes('Forbidden')) {
      return error('FORBIDDEN', err.message);
    }
    if (err.message.includes('not found') || err.message.includes('Not found')) {
      return error('NOT_FOUND', err.message);
    }

    // Log unexpected errors in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[VeloxTS] Action error:', err);
    }

    return error('INTERNAL_ERROR', err.message);
  }

  return error('INTERNAL_ERROR', 'An unexpected error occurred');
}

/**
 * Generates a unique action ID
 */
let actionIdCounter = 0;
export function generateActionId(name?: string): string {
  actionIdCounter += 1;
  const base = name ? name.replace(/[^a-zA-Z0-9]/g, '_') : 'action';
  return `${base}_${actionIdCounter}`;
}

/**
 * Creates a server action with validation and error handling.
 *
 * @example
 * ```typescript
 * import { createAction } from '@veloxts/web';
 * import { z } from 'zod';
 *
 * export const updateUser = createAction({
 *   input: z.object({
 *     id: z.string().uuid(),
 *     name: z.string().min(1),
 *   }),
 *   output: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     updatedAt: z.string(),
 *   }),
 * }, async (input, ctx) => {
 *   // Update user in database
 *   return { id: input.id, name: input.name, updatedAt: new Date().toISOString() };
 * });
 * ```
 */
export function createAction<TInput, TOutput>(
  options: CreateActionOptions<TInput, TOutput>,
  handler: ActionHandler<TInput, TOutput>
): CallableAction<TInput, TOutput> {
  const { input: inputSchema, output: outputSchema, requireAuth, onError } = options;

  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      // For now, create a mock context since we don't have a real request
      // In production, this would be injected via Vinxi's server functions
      const ctx = createMockContext();

      // Check authentication if required
      if (requireAuth && !isAuthenticatedContext(ctx)) {
        return error('UNAUTHORIZED', 'Authentication required');
      }

      // Validate input if schema provided
      let validatedInput: TInput = input;
      if (inputSchema) {
        const inputResult = await validateInput(inputSchema, input);
        if (!isSuccess(inputResult)) {
          return inputResult;
        }
        validatedInput = inputResult.data;
      }

      // Execute the handler
      const result = await handler(validatedInput, ctx);

      // Validate output if schema provided
      if (outputSchema) {
        const outputResult = await validateOutput(outputSchema, result);
        if (!isSuccess(outputResult)) {
          return outputResult;
        }
        return outputResult;
      }

      return success(result);
    } catch (err) {
      // Use custom error handler if provided
      if (onError) {
        return onError(err, createMockContext());
      }
      return defaultErrorHandler(err);
    }
  };
}

/**
 * Creates a form action that handles FormData input.
 *
 * @example
 * ```typescript
 * import { createFormAction } from '@veloxts/web';
 *
 * export const submitContact = createFormAction(async (formData, ctx) => {
 *   const name = formData.get('name') as string;
 *   const email = formData.get('email') as string;
 *   const message = formData.get('message') as string;
 *
 *   // Process the form...
 *   return { success: true };
 * });
 * ```
 */
export function createFormAction<TOutput>(
  handler: FormActionHandler<TOutput>,
  options?: Omit<CreateActionOptions<FormData, TOutput>, 'input'>
): CallableFormAction<TOutput> {
  const { output: outputSchema, requireAuth, onError } = options ?? {};

  return async (formData: FormData): Promise<ActionResult<TOutput>> => {
    try {
      const ctx = createMockContext();

      // Check authentication if required
      if (requireAuth && !isAuthenticatedContext(ctx)) {
        return error('UNAUTHORIZED', 'Authentication required');
      }

      // Execute the handler
      const result = await handler(formData, ctx);

      // Validate output if schema provided
      if (outputSchema) {
        const outputResult = await validateOutput(outputSchema, result);
        if (!isSuccess(outputResult)) {
          return outputResult;
        }
        return outputResult;
      }

      return success(result);
    } catch (err) {
      if (onError) {
        return onError(err, createMockContext());
      }
      return defaultErrorHandler(err);
    }
  };
}

/**
 * Type guard to check if context has authenticated user
 */
export function isAuthenticatedContext(ctx: ActionContext): ctx is AuthenticatedActionContext {
  return 'user' in ctx && ctx.user !== undefined && ctx.user !== null;
}

/**
 * Creates a mock context for testing or when not in a request context
 */
function createMockContext(): ActionContext {
  const headers = new Headers();
  const request = new Request('http://localhost/', { headers });

  return {
    request,
    headers,
    cookies: new Map(),
  };
}

/**
 * Creates an action context with a user for authenticated actions
 */
export function createAuthenticatedContext(
  user: { id: string; [key: string]: unknown },
  baseContext?: Partial<ActionContext>
): AuthenticatedActionContext {
  const headers = baseContext?.headers ?? new Headers();
  const request = baseContext?.request ?? new Request('http://localhost/', { headers });

  return {
    request,
    headers,
    cookies: baseContext?.cookies ?? new Map(),
    user,
  };
}

/**
 * Creates an action registry for managing registered actions
 */
export function createActionRegistry(): ActionRegistry {
  const actions = new Map<string, RegisteredAction>();

  return {
    register<TInput, TOutput>(id: string, action: RegisteredAction<TInput, TOutput>): void {
      if (actions.has(id)) {
        throw new Error(`Action with id "${id}" is already registered`);
      }
      actions.set(id, action as RegisteredAction);
    },

    get<TInput = unknown, TOutput = unknown>(
      id: string
    ): RegisteredAction<TInput, TOutput> | undefined {
      return actions.get(id) as RegisteredAction<TInput, TOutput> | undefined;
    },

    has(id: string): boolean {
      return actions.has(id);
    },

    keys(): string[] {
      return Array.from(actions.keys());
    },

    values(): RegisteredAction[] {
      return Array.from(actions.values());
    },
  };
}

/**
 * Registers an action and returns it with metadata
 */
export function registerAction<TInput, TOutput>(
  registry: ActionRegistry,
  name: string,
  options: CreateActionOptions<TInput, TOutput>,
  handler: ActionHandler<TInput, TOutput>
): RegisteredAction<TInput, TOutput> {
  const id = generateActionId(name);
  const action = createAction(options, handler);

  const metadata: ActionMetadata = {
    id,
    name,
    requiresAuth: options.requireAuth ?? false,
    inputSchema: options.input,
    outputSchema: options.output,
  };

  const registered: RegisteredAction<TInput, TOutput> = {
    metadata,
    action,
    handler,
  };

  registry.register(id, registered);

  return registered;
}

/**
 * Global action registry (singleton)
 */
let globalRegistry: ActionRegistry | undefined;

/**
 * Gets or creates the global action registry
 */
export function getActionRegistry(): ActionRegistry {
  if (!globalRegistry) {
    globalRegistry = createActionRegistry();
  }
  return globalRegistry;
}

/**
 * Resets the global action registry (for testing)
 */
export function resetActionRegistry(): void {
  globalRegistry = undefined;
  actionIdCounter = 0;
}
