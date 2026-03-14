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
      expect(proc.pipelineSteps?.[0].name).toBe('validate');
      expect(proc.pipelineSteps?.[1].name).toBe('enrich');
    });

    it('works with single step', () => {
      const step = defineStep('single', async ({ input }) => input);

      const proc = procedure()
        .through(step)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.pipelineSteps).toHaveLength(1);
      expect(proc.pipelineSteps?.[0].name).toBe('single');
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
      expect(proc.pipelineSteps?.[0].name).toBe('a');
      expect(proc.pipelineSteps?.[1].name).toBe('b');
      expect(proc.pipelineSteps?.[2].name).toBe('c');
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
        expect.stringContaining('[@veloxts/router]'),
        expect.stringContaining('Revert'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('works without .through() (backward compatible)', async () => {
      const proc = procedure().mutation(async ({ input }) => {
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

  describe('.through() + .transactional() two-phase model', () => {
    it('should run DB steps inside transaction, external steps after commit', async () => {
      const order: string[] = [];
      const txClient = { _isTx: true };
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          order.push('tx-start');
          const result = await callback(txClient);
          order.push('tx-commit');
          return result;
        }),
      };

      const dbStep = defineStep('dbStep', async ({ input }) => {
        order.push('db-step');
        return input;
      });

      const externalStep = defineStep(
        { name: 'externalStep', external: true },
        async ({ input }) => {
          order.push('external-step');
          return input;
        }
      );

      const proc = procedure()
        .through(dbStep, externalStep)
        .transactional()
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      // DB step and handler run inside transaction, external step runs after commit
      expect(order).toEqual(['tx-start', 'db-step', 'handler', 'tx-commit', 'external-step']);
    });

    it('should run mutation handler inside the same transaction as DB steps', async () => {
      let handlerDb: unknown;
      let stepDb: unknown;
      const txClient = { _isTx: true };
      const mockDb = {
        _isTx: false,
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(txClient);
        }),
      };

      const dbStep = defineStep('checkDb', async ({ input, ctx }) => {
        stepDb = (ctx as Record<string, unknown>).db;
        return input;
      });

      const proc = procedure()
        .through(dbStep)
        .transactional()
        .mutation(async ({ input, ctx }) => {
          handlerDb = (ctx as Record<string, unknown>).db;
          return input as { ok: boolean };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      // Both DB step and handler should see the transactional client
      expect(stepDb).toBe(txClient);
      expect(handlerDb).toBe(txClient);
    });

    it('should run external steps AFTER transaction commits', async () => {
      let transactionCommitted = false;
      let externalRanAfterCommit = false;
      const txClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          const result = await callback(txClient);
          transactionCommitted = true;
          return result;
        }),
      };

      const externalStep = defineStep(
        { name: 'afterCommit', external: true },
        async ({ input }) => {
          externalRanAfterCommit = transactionCommitted;
          return input;
        }
      );

      const proc = procedure()
        .through(externalStep)
        .transactional()
        .mutation(async ({ input }) => {
          return input as { ok: boolean };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      expect(externalRanAfterCommit).toBe(true);
    });

    it('should revert only external steps when an external step fails (DB already committed)', async () => {
      const order: string[] = [];
      let transactionCommitted = false;
      const txClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          const result = await callback(txClient);
          transactionCommitted = true;
          return result;
        }),
      };

      const dbRevert = defineRevert('undoDb', async () => {
        order.push('db-revert');
      });

      const externalRevert1 = defineRevert('undoExternal1', async () => {
        order.push('external-revert-1');
      });

      const dbStep = defineStep('dbStep', async ({ input }) => {
        order.push('db-step');
        return input;
      }).onRevert(dbRevert);

      const externalStep1 = defineStep({ name: 'ext1', external: true }, async ({ input }) => {
        order.push('external-1');
        return input;
      }).onRevert(externalRevert1);

      const externalStep2 = defineStep({ name: 'ext2', external: true }, async () => {
        order.push('external-2-fail');
        throw new Error('External step 2 failed');
      });

      const proc = procedure()
        .through(dbStep, externalStep1, externalStep2)
        .transactional()
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await expect(executeProcedure(proc, { ok: true }, ctx)).rejects.toThrow(
        'External step 2 failed'
      );

      // Transaction should have committed before external steps ran
      expect(transactionCommitted).toBe(true);

      // DB revert should NOT run (transaction already committed)
      expect(order).not.toContain('db-revert');

      // Only external-1's revert should run (external-2 failed, so only earlier external steps revert)
      expect(order).toContain('external-revert-1');

      // Execution order: db-step, handler inside tx, then external-1, external-2 fails, revert external-1
      expect(order).toEqual([
        'db-step',
        'handler',
        'external-1',
        'external-2-fail',
        'external-revert-1',
      ]);
    });

    it('should throw error if external step declared before a DB step under .transactional()', async () => {
      const externalStep = defineStep(
        { name: 'externalFirst', external: true },
        async ({ input }) => input
      );

      const dbStep = defineStep('dbAfter', async ({ input }) => input);

      const proc = procedure()
        .through(externalStep, dbStep)
        .transactional()
        .mutation(async ({ input }) => input as { ok: boolean });

      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({});
        }),
      };

      const ctx = { db: mockDb } as unknown as BaseContext;

      await expect(executeProcedure(proc, { ok: true }, ctx)).rejects.toThrow(
        /external steps must come after all DB steps/
      );
    });

    it('should run all steps in order when NOT transactional (regardless of external flag)', async () => {
      const order: string[] = [];

      const externalStep = defineStep(
        { name: 'externalStep', external: true },
        async ({ input }) => {
          order.push('external');
          return input;
        }
      );

      const dbStep = defineStep('dbStep', async ({ input }) => {
        order.push('db');
        return input;
      });

      // Note: external step is BEFORE db step — this is fine without .transactional()
      const proc = procedure()
        .through(externalStep, dbStep)
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { ok: true }, ctx);

      // Without transactional, all steps run in declaration order regardless of external flag
      expect(order).toEqual(['external', 'db', 'handler']);
    });
  });
});
