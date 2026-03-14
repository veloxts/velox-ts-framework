/**
 * Pipeline executor for .through() steps
 *
 * Executes pipeline steps in declaration order. Each step's output becomes
 * the next step's input. On failure, runs revert actions for completed
 * steps in reverse order (compensation pattern).
 *
 * When `.transactional()` is combined with `.through()`, the executor
 * implements a two-phase model:
 * - Phase A: DB steps (non-external) run inside the transaction
 * - Phase B: External steps run after the transaction commits
 *
 * @module procedure/pipeline-executor
 */

import { ConfigurationError } from '@veloxts/core';

import type { PipelineStep } from './pipeline.js';

/**
 * Tracks a completed pipeline step and its output for potential revert
 */
interface CompletedStep {
  readonly step: PipelineStep;
  readonly output: unknown;
}

/**
 * Result of splitting pipeline steps into DB and external phases
 */
export interface SplitPipelineSteps {
  /** Steps that run inside the DB transaction (external === false) */
  readonly dbSteps: ReadonlyArray<PipelineStep>;
  /** Steps that run after transaction commit (external === true) */
  readonly externalSteps: ReadonlyArray<PipelineStep>;
}

/**
 * Splits pipeline steps into DB (non-external) and external phases
 *
 * Validates the ordering constraint: when transactional, all external steps
 * must come AFTER all DB steps. If an external step appears before a DB step,
 * a ConfigurationError is thrown.
 *
 * @param steps - Pipeline steps to split
 * @returns Object with `dbSteps` and `externalSteps` arrays
 * @throws ConfigurationError if an external step precedes a DB step
 */
export function splitPipelineSteps(steps: ReadonlyArray<PipelineStep>): SplitPipelineSteps {
  const dbSteps: PipelineStep[] = [];
  const externalSteps: PipelineStep[] = [];

  let seenExternal = false;

  for (const step of steps) {
    if (step.external) {
      seenExternal = true;
      externalSteps.push(step);
    } else {
      if (seenExternal) {
        throw new ConfigurationError(
          `Pipeline step "${step.name}" (DB) is declared after external step "${externalSteps[externalSteps.length - 1].name}". ` +
            'When using .transactional(), all external steps must come after all DB steps in the .through() declaration.'
        );
      }
      dbSteps.push(step);
    }
  }

  return { dbSteps, externalSteps };
}

/**
 * Executes a sequence of pipeline steps
 *
 * Steps run in declaration order. Each step receives the previous step's
 * output as its input (the first step receives the original validated input).
 *
 * If a step fails:
 * 1. Collects all completed steps that have a revertAction
 * 2. Runs their revert handlers in REVERSE order
 * 3. Each revert receives the output of the step being reverted
 * 4. Revert errors are logged but do not suppress the original error
 * 5. Rethrows the original error
 *
 * @param steps - Pipeline steps to execute in order
 * @param input - Initial input (typically the validated procedure input)
 * @param ctx - Request context
 * @returns The output of the last step
 */
export async function executePipeline(
  steps: ReadonlyArray<PipelineStep>,
  input: unknown,
  ctx: unknown
): Promise<unknown> {
  const completedSteps: CompletedStep[] = [];
  let currentInput = input;

  for (const step of steps) {
    try {
      const output = await step.handler({ input: currentInput, ctx });
      completedSteps.push({ step, output });
      currentInput = output;
    } catch (error) {
      // Step failed — run reverts for completed steps in reverse order
      await runReverts(completedSteps, ctx);
      throw error;
    }
  }

  return currentInput;
}

/**
 * Executes external pipeline steps after a transaction has committed
 *
 * External steps run in declaration order. If a step fails, revert actions
 * are run for all previously completed EXTERNAL steps in reverse order.
 * The DB transaction is already committed — DB changes persist.
 *
 * @param steps - External pipeline steps to execute in order
 * @param input - Input for the first external step (output of last DB step, or original input)
 * @param ctx - Request context (with the ORIGINAL db, not the transactional client)
 * @returns The output of the last external step (ignored by the caller, since handler already ran)
 */
export async function executeExternalSteps(
  steps: ReadonlyArray<PipelineStep>,
  input: unknown,
  ctx: unknown
): Promise<void> {
  const completedSteps: CompletedStep[] = [];
  let currentInput = input;

  for (const step of steps) {
    try {
      const output = await step.handler({ input: currentInput, ctx });
      completedSteps.push({ step, output });
      currentInput = output;
    } catch (error) {
      // External step failed — revert only completed external steps
      await runReverts(completedSteps, ctx);
      throw error;
    }
  }
}

/**
 * Runs revert actions for completed steps in reverse order
 *
 * Each revert receives the output of the step it is reverting.
 * Revert errors are logged but never suppress the original error.
 *
 * @param completedSteps - Steps that completed successfully before the failure
 * @param ctx - Request context (forwarded to revert handlers)
 * @internal
 */
async function runReverts(
  completedSteps: ReadonlyArray<CompletedStep>,
  ctx: unknown
): Promise<void> {
  // Process in reverse order
  for (let i = completedSteps.length - 1; i >= 0; i--) {
    const { step, output } = completedSteps[i];

    if (!step.revertAction) {
      continue;
    }

    try {
      await step.revertAction.handler({ input: output, ctx });
    } catch (revertError) {
      console.error(
        `[velox:router] Revert "${step.revertAction.name}" for step "${step.name}" failed:`,
        revertError
      );
    }
  }
}
