/**
 * Type-Safe Server Action Helper
 *
 * Laravel-inspired elegant API for creating server actions with Zod validation.
 * Provides automatic type inference from schemas with minimal boilerplate.
 *
 * @module @veloxts/web/actions/action
 *
 * @example
 * ```typescript
 * 'use server';
 *
 * import { action } from '@veloxts/web';
 * import { z } from 'zod';
 *
 * // Simple form - schema first, handler second
 * export const createUser = action(
 *   z.object({ name: z.string().min(1), email: z.string().email() }),
 *   async (input) => {
 *     // input is fully typed as { name: string; email: string }
 *     const user = await db.user.create({ data: input });
 *     return user;
 *   }
 * );
 *
 * // Fluent builder form
 * export const updateUser = action
 *   .input(UpdateUserSchema)
 *   .output(UserSchema)
 *   .protected()
 *   .run(async (input, ctx) => {
 *     return await db.user.update({ where: { id: ctx.user.id }, data: input });
 *   });
 * ```
 */

import type { BaseContext } from '@veloxts/core';
import type { CompiledProcedure } from '@veloxts/router';
import type { infer as ZodInfer, ZodSchema, ZodType, ZodTypeDef } from 'zod';

import { toActionError } from './error-classifier.js';
import {
  executeProcedureDirectly,
  type ExecuteProcedureOptions,
} from './procedure-bridge.js';
import type {
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
} from './types.js';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Handler function that receives validated input and returns output.
 * The context type varies based on whether the action is protected.
 */
type ActionHandlerFn<TInput, TOutput, TContext extends ActionContext = ActionContext> = (
  input: TInput,
  ctx: TContext
) => Promise<TOutput>;

/**
 * The callable action function returned by the action() helper.
 * Returns a discriminated union for type-safe result handling.
 *
 * Note: Named `ValidatedAction` to distinguish from the simpler `ServerAction`
 * type in types.ts which does not wrap the output in ActionResult.
 */
type ValidatedAction<TInput, TOutput> = (input: TInput) => Promise<ActionResult<TOutput>>;

/**
 * Configuration options for action creation.
 * These are set via the fluent builder methods.
 */
interface ActionConfig<TInput, TOutput, TContext extends ActionContext> {
  inputSchema?: ZodSchema<TInput>;
  outputSchema?: ZodSchema<TOutput>;
  requireAuth: boolean;
  onError?: ErrorHandler<TContext>;
}

/**
 * Custom error handler type.
 */
type ErrorHandler<TContext extends ActionContext = ActionContext> = (
  error: unknown,
  ctx: TContext
) => ActionError | Promise<ActionError>;

/**
 * Options for creating an action from a procedure.
 */
interface FromProcedureOptions extends ExecuteProcedureOptions {
  /**
   * Whether to parse FormData input using the procedure's schema.
   * When true, FormData will be converted to an object before validation.
   * @default false
   */
  parseFormData?: boolean;
}

// ============================================================================
// Fluent Builder Interface
// ============================================================================

/**
 * Builder for creating actions with fluent method chaining.
 * Each method returns a new builder with updated type parameters.
 */
interface ActionBuilder<
  TInput = unknown,
  TOutput = unknown,
  TContext extends ActionContext = ActionContext,
> {
  /**
   * Sets the input validation schema.
   * Input type is automatically inferred from the Zod schema.
   *
   * @example
   * ```typescript
   * action
   *   .input(z.object({ id: z.string().uuid() }))
   *   .run(async ({ id }) => { ... });
   * ```
   */
  input<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
    schema: TSchema
  ): ActionBuilder<ZodInfer<TSchema>, TOutput, TContext>;

  /**
   * Sets the output validation schema.
   * Validates the handler's return value at runtime.
   *
   * @example
   * ```typescript
   * action
   *   .input(CreateUserSchema)
   *   .output(UserSchema)
   *   .run(async (input) => { ... });
   * ```
   */
  output<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
    schema: TSchema
  ): ActionBuilder<TInput, ZodInfer<TSchema>, TContext>;

  /**
   * Marks the action as requiring authentication.
   * The context will include the authenticated user.
   *
   * @example
   * ```typescript
   * action
   *   .input(UpdateProfileSchema)
   *   .protected()
   *   .run(async (input, ctx) => {
   *     // ctx.user is typed and guaranteed to exist
   *     return db.user.update({ where: { id: ctx.user.id }, data: input });
   *   });
   * ```
   */
  protected(): ActionBuilder<TInput, TOutput, AuthenticatedActionContext>;

  /**
   * Sets a custom error handler.
   * Allows transforming errors before returning to the client.
   *
   * @example
   * ```typescript
   * action
   *   .input(Schema)
   *   .onError((err, ctx) => ({
   *     success: false,
   *     error: { code: 'CUSTOM_ERROR', message: 'Something went wrong' }
   *   }))
   *   .run(async (input) => { ... });
   * ```
   */
  onError(handler: ErrorHandler<TContext>): ActionBuilder<TInput, TOutput, TContext>;

  /**
   * Defines the action handler and returns the callable action.
   * This is the terminal method that produces the server action.
   *
   * @example
   * ```typescript
   * export const createUser = action
   *   .input(CreateUserSchema)
   *   .run(async (input) => {
   *     return await db.user.create({ data: input });
   *   });
   * ```
   */
  run(handler: ActionHandlerFn<TInput, TOutput, TContext>): ValidatedAction<TInput, TOutput>;
}

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Creates a successful action result.
 */
function ok<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

/**
 * Creates an error action result.
 */
function fail(
  code: ActionErrorCode,
  message: string,
  details?: Record<string, unknown>
): ActionError {
  return {
    success: false,
    error: { code, message, details },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates input against a Zod schema.
 * Returns a discriminated result for safe handling.
 */
async function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ActionResult<T>> {
  try {
    const result = await schema.parseAsync(data);
    return ok(result);
  } catch (err) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const zodError = err as { errors: Array<{ path: (string | number)[]; message: string }> };
      return fail('VALIDATION_ERROR', 'Validation failed', {
        errors: zodError.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return fail('VALIDATION_ERROR', 'Validation failed');
  }
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Creates a mock action context.
 *
 * Note: In production with Vinxi integration, this will be replaced
 * with real request context from the server.
 */
function createContext(): ActionContext {
  const headers = new Headers();
  const request = new Request('http://localhost/', { headers });
  return {
    request,
    headers,
    cookies: new Map(),
  };
}

/**
 * Type guard to check if context has an authenticated user.
 */
function hasAuthenticatedUser(ctx: ActionContext): ctx is AuthenticatedActionContext {
  return 'user' in ctx && ctx.user !== undefined && ctx.user !== null;
}

// ============================================================================
// FormData Utilities
// ============================================================================

/**
 * Converts FormData to a plain object.
 * Handles multiple values for the same key by creating arrays.
 * Supports nested keys using dot notation (e.g., 'user.name').
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    // Handle nested keys (e.g., 'user.name' -> { user: { name: value } })
    const keys = key.split('.');
    let current: Record<string, unknown> = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1];
    const existingValue = current[finalKey];

    // Convert File to undefined (skip files for now, will be handled in Phase 2)
    const processedValue = value instanceof File ? undefined : value;

    if (existingValue !== undefined) {
      // Convert to array if multiple values with same key
      if (Array.isArray(existingValue)) {
        existingValue.push(processedValue);
      } else {
        current[finalKey] = [existingValue, processedValue];
      }
    } else {
      current[finalKey] = processedValue;
    }
  });

  return result;
}

// ============================================================================
// Default Error Handler
// ============================================================================

/**
 * Default error handler that uses the shared error classifier.
 *
 * Uses the centralized error classification patterns from error-classifier.ts
 * for consistent error handling across all action types.
 *
 * @see toActionError - The underlying classification function
 */
function handleError(err: unknown): ActionError {
  return toActionError(err);
}

// ============================================================================
// Builder Implementation
// ============================================================================

/**
 * Creates a new builder instance with the given configuration.
 */
function createBuilder<
  TInput = unknown,
  TOutput = unknown,
  TContext extends ActionContext = ActionContext,
>(config: ActionConfig<TInput, TOutput, TContext>): ActionBuilder<TInput, TOutput, TContext> {
  return {
    input<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(schema: TSchema) {
      return createBuilder<ZodInfer<TSchema>, TOutput, TContext>({
        ...config,
        inputSchema: schema as ZodSchema<ZodInfer<TSchema>>,
      } as ActionConfig<ZodInfer<TSchema>, TOutput, TContext>);
    },

    output<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(schema: TSchema) {
      return createBuilder<TInput, ZodInfer<TSchema>, TContext>({
        ...config,
        outputSchema: schema as ZodSchema<ZodInfer<TSchema>>,
      } as ActionConfig<TInput, ZodInfer<TSchema>, TContext>);
    },

    protected() {
      return createBuilder<TInput, TOutput, AuthenticatedActionContext>({
        ...config,
        requireAuth: true,
      } as ActionConfig<TInput, TOutput, AuthenticatedActionContext>);
    },

    onError(handler: ErrorHandler<TContext>) {
      return createBuilder<TInput, TOutput, TContext>({
        ...config,
        onError: handler,
      });
    },

    run(handler: ActionHandlerFn<TInput, TOutput, TContext>): ValidatedAction<TInput, TOutput> {
      return createValidatedAction(config, handler);
    },
  };
}

/**
 * Creates the final validated action function from config and handler.
 */
function createValidatedAction<TInput, TOutput, TContext extends ActionContext>(
  config: ActionConfig<TInput, TOutput, TContext>,
  handler: ActionHandlerFn<TInput, TOutput, TContext>
): ValidatedAction<TInput, TOutput> {
  const { inputSchema, outputSchema, requireAuth, onError } = config;

  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    try {
      // Create context (mock for now, real in production)
      const ctx = createContext();

      // Check authentication if required
      if (requireAuth && !hasAuthenticatedUser(ctx)) {
        return fail('UNAUTHORIZED', 'Authentication required');
      }

      // Validate input if schema provided
      let input: TInput = rawInput;
      if (inputSchema) {
        const validation = await validateWithSchema(inputSchema, rawInput);
        if (!validation.success) {
          return validation;
        }
        input = validation.data;
      }

      // Execute the handler with properly typed context
      const result = await handler(input, ctx as TContext);

      // Validate output if schema provided
      if (outputSchema) {
        const outputValidation = await validateWithSchema(outputSchema, result);
        if (!outputValidation.success) {
          console.error('[VeloxTS] Output validation failed:', outputValidation.error);
          return fail('INTERNAL_ERROR', 'Output validation failed');
        }
        return outputValidation;
      }

      return ok(result);
    } catch (err) {
      // Use custom error handler if provided
      if (onError) {
        return onError(err, createContext() as TContext);
      }
      return handleError(err);
    }
  };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Action helper type - combines function signature with builder methods.
 */
interface Action {
  /**
   * Creates a server action with the given input schema and handler.
   * This is the primary, most concise API.
   *
   * @example
   * ```typescript
   * 'use server';
   *
   * import { action } from '@veloxts/web';
   * import { z } from 'zod';
   *
   * const CreateUserSchema = z.object({
   *   name: z.string().min(1),
   *   email: z.string().email(),
   * });
   *
   * export const createUser = action(CreateUserSchema, async (input) => {
   *   // input is typed as { name: string; email: string }
   *   const user = await db.user.create({ data: input });
   *   return user;
   * });
   * ```
   */
  <TSchema extends ZodType<unknown, ZodTypeDef, unknown>, TOutput>(
    schema: TSchema,
    handler: ActionHandlerFn<ZodInfer<TSchema>, TOutput, ActionContext>
  ): ValidatedAction<ZodInfer<TSchema>, TOutput>;

  /**
   * Creates a builder for fluent action configuration.
   *
   * @example
   * ```typescript
   * export const updateProfile = action
   *   .input(UpdateProfileSchema)
   *   .output(UserSchema)
   *   .protected()
   *   .run(async (input, ctx) => {
   *     return db.user.update({ where: { id: ctx.user.id }, data: input });
   *   });
   * ```
   */
  input<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
    schema: TSchema
  ): ActionBuilder<ZodInfer<TSchema>, unknown, ActionContext>;

  /**
   * Creates a builder starting with output schema.
   * Useful when input is not needed (e.g., queries).
   */
  output<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
    schema: TSchema
  ): ActionBuilder<unknown, ZodInfer<TSchema>, ActionContext>;

  /**
   * Creates a protected action builder (requires authentication).
   */
  protected(): ActionBuilder<unknown, unknown, AuthenticatedActionContext>;

  /**
   * Creates a server action from a VeloxTS procedure.
   *
   * This bridges the gap between procedures (which define API logic)
   * and server actions (which enable form submissions and direct calls).
   * The procedure's validation, guards, and business logic are reused.
   *
   * @example
   * ```typescript
   * 'use server';
   *
   * import { action } from '@veloxts/web';
   * import { userProcedures } from './procedures/users';
   *
   * // Simple bridge - inherits all procedure behavior
   * export const createUser = action.fromProcedure(
   *   userProcedures.procedures.createUser
   * );
   *
   * // With options
   * export const updateUser = action.fromProcedure(
   *   userProcedures.procedures.updateUser,
   *   { skipGuards: true }
   * );
   * ```
   */
  fromProcedure<TInput, TOutput, TContext extends BaseContext = BaseContext>(
    procedure: CompiledProcedure<TInput, TOutput, TContext>,
    options?: FromProcedureOptions
  ): ValidatedAction<TInput, TOutput>;
}

/**
 * Creates a type-safe server action with Zod validation.
 *
 * The `action()` helper is the recommended way to create server actions
 * in VeloxTS applications. It provides automatic type inference from
 * Zod schemas and integrates seamlessly with React 19's server actions.
 *
 * ## Usage Patterns
 *
 * ### Simple Form (Recommended)
 *
 * For most cases, pass the schema and handler directly:
 *
 * ```typescript
 * 'use server';
 *
 * import { action } from '@veloxts/web';
 * import { z } from 'zod';
 *
 * const CreateUserSchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * export const createUser = action(CreateUserSchema, async (input) => {
 *   // input is { name: string; email: string }
 *   return await db.user.create({ data: input });
 * });
 * ```
 *
 * ### Fluent Builder Form
 *
 * For complex actions with output validation or authentication:
 *
 * ```typescript
 * export const updateProfile = action
 *   .input(UpdateProfileSchema)
 *   .output(UserSchema)
 *   .protected()
 *   .run(async (input, ctx) => {
 *     // ctx.user is guaranteed by .protected()
 *     return db.user.update({
 *       where: { id: ctx.user.id },
 *       data: input
 *     });
 *   });
 * ```
 *
 * ## Return Type
 *
 * All actions return `ActionResult<T>`, a discriminated union:
 *
 * ```typescript
 * const result = await createUser({ name: 'John', email: 'john@example.com' });
 *
 * if (result.success) {
 *   console.log(result.data); // The returned user
 * } else {
 *   console.log(result.error.code);    // 'VALIDATION_ERROR', 'UNAUTHORIZED', etc.
 *   console.log(result.error.message); // Human-readable message
 *   console.log(result.error.details); // Additional error details
 * }
 * ```
 *
 * ## Error Handling
 *
 * Validation errors are automatically captured and returned as structured errors:
 *
 * ```typescript
 * const result = await createUser({ name: '', email: 'invalid' });
 * // result = {
 * //   success: false,
 * //   error: {
 * //     code: 'VALIDATION_ERROR',
 * //     message: 'Validation failed',
 * //     details: {
 * //       errors: [
 * //         { path: 'name', message: 'String must contain at least 1 character(s)' },
 * //         { path: 'email', message: 'Invalid email' },
 * //       ]
 * //     }
 * //   }
 * // }
 * ```
 *
 * ## Authentication
 *
 * Protected actions require authentication:
 *
 * ```typescript
 * export const deleteAccount = action
 *   .input(z.object({ confirmation: z.literal('DELETE') }))
 *   .protected()
 *   .run(async (input, ctx) => {
 *     // ctx.user is typed and guaranteed to exist
 *     await db.user.delete({ where: { id: ctx.user.id } });
 *     return { deleted: true };
 *   });
 * ```
 *
 * If called without authentication, returns:
 * ```typescript
 * { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }
 * ```
 */
const action: Action = Object.assign(
  // Primary function signature: action(schema, handler)
  function actionFn<TSchema extends ZodType<unknown, ZodTypeDef, unknown>, TOutput>(
    schema: TSchema,
    handler: ActionHandlerFn<ZodInfer<TSchema>, TOutput, ActionContext>
  ): ValidatedAction<ZodInfer<TSchema>, TOutput> {
    const config: ActionConfig<ZodInfer<TSchema>, TOutput, ActionContext> = {
      inputSchema: schema as ZodSchema<ZodInfer<TSchema>>,
      requireAuth: false,
    };
    return createValidatedAction(config, handler);
  },
  // Fluent builder methods
  {
    input<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
      schema: TSchema
    ): ActionBuilder<ZodInfer<TSchema>, unknown, ActionContext> {
      return createBuilder<ZodInfer<TSchema>, unknown, ActionContext>({
        inputSchema: schema as ZodSchema<ZodInfer<TSchema>>,
        requireAuth: false,
      });
    },

    output<TSchema extends ZodType<unknown, ZodTypeDef, unknown>>(
      schema: TSchema
    ): ActionBuilder<unknown, ZodInfer<TSchema>, ActionContext> {
      return createBuilder<unknown, ZodInfer<TSchema>, ActionContext>({
        outputSchema: schema as ZodSchema<ZodInfer<TSchema>>,
        requireAuth: false,
      });
    },

    protected(): ActionBuilder<unknown, unknown, AuthenticatedActionContext> {
      return createBuilder<unknown, unknown, AuthenticatedActionContext>({
        requireAuth: true,
      });
    },

    fromProcedure<TInput, TOutput, TContext extends BaseContext = BaseContext>(
      procedure: CompiledProcedure<TInput, TOutput, TContext>,
      options?: FromProcedureOptions
    ): ValidatedAction<TInput, TOutput> {
      const { parseFormData = false, ...executionOptions } = options ?? {};

      return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
        try {
          // Create context for the action
          const ctx = createContext();

          // Handle FormData if enabled
          let input: unknown = rawInput;
          if (parseFormData && rawInput instanceof FormData) {
            input = formDataToObject(rawInput);
          }

          // Execute the procedure directly
          return await executeProcedureDirectly(procedure, input, ctx, executionOptions);
        } catch (err) {
          return handleError(err);
        }
      };
    },
  }
);

// ============================================================================
// Exports
// ============================================================================

export { action };
export type {
  Action,
  ActionBuilder,
  ActionConfig,
  ActionHandlerFn,
  ErrorHandler,
  FromProcedureOptions,
  ValidatedAction,
};
