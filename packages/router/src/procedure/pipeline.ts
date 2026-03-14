/**
 * Pipeline step and revert action factories
 *
 * Provides `defineStep` and `defineRevert` for building pipeline steps
 * that execute in sequence via `.through()` on the procedure builder.
 * Each step's output becomes the next step's input. External steps run
 * outside DB transactions and can have revert actions for compensation.
 *
 * @module procedure/pipeline
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Options for configuring a pipeline step
 */
export interface StepOptions {
  /** Step name used for logging and error reporting */
  readonly name: string;
  /** Whether this step runs outside the DB transaction (default: false) */
  readonly external?: boolean;
}

/**
 * A revert action that undoes the effect of an external step
 *
 * Revert actions are invoked when a later step in the pipeline fails,
 * allowing compensation for steps that ran outside the DB transaction.
 */
export interface RevertAction<TInput = unknown> {
  readonly name: string;
  readonly handler: (params: { input: TInput; ctx: unknown }) => void | Promise<void>;
}

/**
 * A single step in a procedure pipeline
 *
 * Steps execute in order, each one's output becoming the next one's input.
 * External steps run outside DB transactions and may have revert actions
 * for compensation when a later step fails.
 */
export interface PipelineStep<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly external: boolean;
  readonly handler: (params: { input: TInput; ctx: unknown }) => TOutput | Promise<TOutput>;
  readonly revertAction?: RevertAction;
  /** Attach a revert action to this step, returning a new step (immutable) */
  onRevert(revert: RevertAction): PipelineStep<TInput, TOutput>;
}

// ============================================================================
// Step handler type
// ============================================================================

/** Handler function signature for pipeline steps */
type StepHandler<TInput, TOutput> = (params: {
  input: TInput;
  ctx: unknown;
}) => TOutput | Promise<TOutput>;

// ============================================================================
// defineStep — two overloads
// ============================================================================

/**
 * Define a pipeline step with a string name (external defaults to false)
 *
 * @example
 * ```typescript
 * const validate = defineStep('validateInventory', async ({ input, ctx }) => {
 *   return { ...input, validated: true };
 * });
 * ```
 */
export function defineStep<TInput = unknown, TOutput = unknown>(
  name: string,
  handler: StepHandler<TInput, TOutput>
): PipelineStep<TInput, TOutput>;

/**
 * Define a pipeline step with options (name + external flag)
 *
 * @example
 * ```typescript
 * const charge = defineStep(
 *   { name: 'chargePayment', external: true },
 *   async ({ input, ctx }) => {
 *     return { ...input, chargeId: 'ch_123' };
 *   },
 * );
 * ```
 */
export function defineStep<TInput = unknown, TOutput = unknown>(
  options: StepOptions,
  handler: StepHandler<TInput, TOutput>
): PipelineStep<TInput, TOutput>;

/** @internal */
export function defineStep<TInput = unknown, TOutput = unknown>(
  nameOrOptions: string | StepOptions,
  handler: StepHandler<TInput, TOutput>
): PipelineStep<TInput, TOutput> {
  const resolved =
    typeof nameOrOptions === 'string'
      ? { name: nameOrOptions, external: false }
      : { name: nameOrOptions.name, external: nameOrOptions.external ?? false };

  return createStep(resolved.name, resolved.external, handler, undefined);
}

// ============================================================================
// defineRevert
// ============================================================================

/**
 * Define a revert action for compensating an external pipeline step
 *
 * Revert handlers receive the same `{ input, ctx }` shape but return void.
 *
 * @example
 * ```typescript
 * const refund = defineRevert('refundPayment', async ({ input, ctx }) => {
 *   await gateway.refund(input.chargeId);
 * });
 * ```
 */
export function defineRevert<TInput = unknown>(
  name: string,
  handler: (params: { input: TInput; ctx: unknown }) => void | Promise<void>
): RevertAction<TInput> {
  return { name, handler };
}

// ============================================================================
// Internal helpers
// ============================================================================

/** @internal Create a PipelineStep object with onRevert method */
function createStep<TInput, TOutput>(
  name: string,
  external: boolean,
  handler: StepHandler<TInput, TOutput>,
  revertAction: RevertAction | undefined
): PipelineStep<TInput, TOutput> {
  return {
    name,
    external,
    handler,
    revertAction,
    onRevert(revert: RevertAction): PipelineStep<TInput, TOutput> {
      return createStep(name, external, handler, revert);
    },
  };
}
