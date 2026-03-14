/**
 * Pipeline executor for .through() steps
 *
 * Executes pipeline steps in declaration order. Each step's output becomes
 * the next step's input. On failure, runs revert actions for completed
 * steps in reverse order (compensation pattern).
 *
 * @module procedure/pipeline-executor
 */

import type { PipelineStep } from './pipeline.js';

/**
 * Tracks a completed pipeline step and its output for potential revert
 */
interface CompletedStep {
  readonly step: PipelineStep;
  readonly output: unknown;
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
  ctx: unknown,
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
  ctx: unknown,
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
        revertError,
      );
    }
  }
}
