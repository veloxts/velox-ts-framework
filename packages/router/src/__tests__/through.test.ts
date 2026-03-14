/**
 * @veloxts/router - .through() Pipeline Tests
 * Tests .through() on the procedure builder and pipeline execution in executeProcedure
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';
import { defineRevert, defineStep } from '../procedure/pipeline.js';

describe('.through()', () => {
  describe('builder method', () => {
    it('stores steps on compiled procedure', () => {
      const step1 = defineStep('validate', async ({ input }) => input);
      const step2 = defineStep('enrich', async ({ input }) => input);

      const proc = procedure()
        .through(step1, step2)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.pipelineSteps).toBeDefined();
      expect(proc.pipelineSteps).toHaveLength(2);
      expect(proc.pipelineSteps![0].name).toBe('validate');
      expect(proc.pipelineSteps![1].name).toBe('enrich');
    });

    it('works with single step', () => {
      const step = defineStep('single', async ({ input }) => input);

      const proc = procedure()
        .through(step)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.pipelineSteps).toHaveLength(1);
      expect(proc.pipelineSteps![0].name).toBe('single');
    });

    it('accumulates steps from multiple .through() calls', () => {
      const step1 = defineStep('a', async ({ input }) => input);
      const step2 = defineStep('b', async ({ input }) => input);
      const step3 = defineStep('c', async ({ input }) => input);

      const proc = procedure()
        .through(step1)
        .through(step2, step3)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.pipelineSteps).toHaveLength(3);
      expect(proc.pipelineSteps![0].name).toBe('a');
      expect(proc.pipelineSteps![1].name).toBe('b');
      expect(proc.pipelineSteps![2].name).toBe('c');
    });

    it('works in full builder chain', () => {
      const step = defineStep('validate', async ({ input }) => input);

      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ id: z.string(), processed: z.boolean() }))
        .through(step)
        .mutation(async ({ input }) => ({ id: input.id, processed: true }));

      expect(proc.pipelineSteps).toHaveLength(1);
      expect(proc.inputSchema).toBeDefined();
      expect(proc.outputSchema).toBeDefined();
    });
  });

  describe('pipeline execution in executeProcedure', () => {
    it('executes steps in order', async () => {
      const order: string[] = [];

      const step1 = defineStep('first', async ({ input }) => {
        order.push('first');
        return input;
      });
      const step2 = defineStep('second', async ({ input }) => {
        order.push('second');
        return input;
      });
      const step3 = defineStep('third', async ({ input }) => {
        order.push('third');
        return input;
      });

      const proc = procedure()
        .through(step1, step2, step3)
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      expect(order).toEqual(['first', 'second', 'third', 'handler']);
    });

    it('each step receives previous step output as input', async () => {
      const step1 = defineStep('addA', async ({ input }) => {
        return { ...(input as Record<string, unknown>), a: 1 };
      });
      const step2 = defineStep('addB', async ({ input }) => {
        return { ...(input as Record<string, unknown>), b: 2 };
      });

      let capturedInput: unknown;

      const proc = procedure()
        .through(step1, step2)
        .mutation(async ({ input }) => {
          capturedInput = input;
          return input as Record<string, unknown>;
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { original: true }, ctx);

      expect(capturedInput).toEqual({ original: true, a: 1, b: 2 });
    });

    it('pipeline result is passed to mutation handler', async () => {
      const step = defineStep('transform', async () => {
        return { transformed: true, value: 42 };
      });

      let handlerInput: unknown;

      const proc = procedure()
        .through(step)
        .mutation(async ({ input }) => {
          handlerInput = input;
          return { received: true };
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { original: 'data' }, ctx);

      expect(handlerInput).toEqual({ transformed: true, value: 42 });
    });

    it('steps receive ctx', async () => {
      let capturedCtx: unknown;

      const step = defineStep('checkCtx', async ({ input, ctx }) => {
        capturedCtx = ctx;
        return input;
      });

      const proc = procedure()
        .through(step)
        .mutation(async ({ input }) => input as { ok: boolean });

      const ctx = { userId: 'u1' } as unknown as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      expect(capturedCtx).toEqual(expect.objectContaining({ userId: 'u1' }));
    });

    it('step failure triggers revert actions in reverse order', async () => {
      const revertOrder: string[] = [];

      const revert1 = defineRevert('undoStep1', async () => {
        revertOrder.push('revert1');
      });
      const revert2 = defineRevert('undoStep2', async () => {
        revertOrder.push('revert2');
      });

      const step1 = defineStep('step1', async ({ input }) => {
        return { ...(input as Record<string, unknown>), step1: true };
      }).onRevert(revert1);

      const step2 = defineStep('step2', async ({ input }) => {
        return { ...(input as Record<string, unknown>), step2: true };
      }).onRevert(revert2);

      const step3 = defineStep('step3', async () => {
        throw new Error('Step 3 failed');
      });

      const proc = procedure()
        .through(step1, step2, step3)
        .mutation(async ({ input }) => input as Record<string, unknown>);

      const ctx = {} as BaseContext;

      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('Step 3 failed');

      // Reverts should run in reverse order: step2 first, then step1
      expect(revertOrder).toEqual(['revert2', 'revert1']);
    });

    it('revert receives the output of the reverted step', async () => {
      let revertInput: unknown;

      const revert1 = defineRevert('undoCharge', async ({ input }) => {
        revertInput = input;
      });

      const step1 = defineStep('charge', async () => {
        return { chargeId: 'ch_abc', amount: 99 };
      }).onRevert(revert1);

      const step2 = defineStep('ship', async () => {
        throw new Error('Shipping failed');
      });

      const proc = procedure()
        .through(step1, step2)
        .mutation(async ({ input }) => input as Record<string, unknown>);

      const ctx = {} as BaseContext;
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('Shipping failed');

      expect(revertInput).toEqual({ chargeId: 'ch_abc', amount: 99 });
    });

    it('revert errors do not suppress original error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const revert1 = defineRevert('badRevert', async () => {
        throw new Error('Revert also failed');
      });

      const step1 = defineStep('step1', async ({ input }) => {
        return input;
      }).onRevert(revert1);

      const step2 = defineStep('step2', async () => {
        throw new Error('Original failure');
      });

      const proc = procedure()
        .through(step1, step2)
        .mutation(async ({ input }) => input as Record<string, unknown>);

      const ctx = {} as BaseContext;

      // Should throw the ORIGINAL error, not the revert error
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('Original failure');

      // Revert error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[velox:router] Revert'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('works without .through() (backward compatible)', async () => {
      const proc = procedure()
        .mutation(async ({ input }) => {
          return { received: input };
        });

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, { data: 'test' }, ctx);

      expect(result).toEqual({ received: { data: 'test' } });
    });

    it('works with no revert actions on failure (just throws)', async () => {
      const step1 = defineStep('step1', async ({ input }) => input);
      const step2 = defineStep('step2', async () => {
        throw new Error('No revert needed');
      });

      const proc = procedure()
        .through(step1, step2)
        .mutation(async ({ input }) => input as Record<string, unknown>);

      const ctx = {} as BaseContext;
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('No revert needed');
    });

    it('works with input validation before pipeline', async () => {
      const step = defineStep('enrich', async ({ input }) => {
        return { ...(input as Record<string, unknown>), enriched: true };
      });

      const proc = procedure()
        .input(z.object({ name: z.string() }))
        .through(step)
        .mutation(async ({ input }) => input as Record<string, unknown>);

      const ctx = {} as BaseContext;

      // Valid input
      const result = await executeProcedure(proc, { name: 'Alice' }, ctx);
      expect(result).toEqual({ name: 'Alice', enriched: true });

      // Invalid input should fail at validation, before pipeline
      await expect(executeProcedure(proc, { name: 123 }, ctx)).rejects.toThrow();
    });

    it('works with transactional wrapping', async () => {
      const order: string[] = [];
      const txClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          order.push('tx-start');
          const result = await callback(txClient);
          order.push('tx-end');
          return result;
        }),
      };

      const step = defineStep('prepare', async ({ input }) => {
        order.push('pipeline-step');
        return input;
      });

      const proc = procedure()
        .through(step)
        .transactional()
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      // Pipeline runs before handler, both inside transaction
      expect(order).toEqual(['tx-start', 'pipeline-step', 'handler', 'tx-end']);
    });

    it('works with query procedures', async () => {
      const step = defineStep('addMeta', async ({ input }) => {
        return { ...(input as Record<string, unknown>), meta: true };
      });

      let handlerInput: unknown;

      const proc = procedure()
        .through(step)
        .query(async ({ input }) => {
          handlerInput = input;
          return { result: 'ok' };
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { id: '1' }, ctx);

      expect(handlerInput).toEqual({ id: '1', meta: true });
    });
  });
});
