/**
 * @veloxts/router - .useAfter() Post-Handler Hook Tests
 *
 * Tests that .useAfter() registers post-handler hooks on compiled procedures
 * and that executeProcedure runs them after successful handler execution.
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure, procedures } from '../procedure/builder.js';

describe('.useAfter()', () => {
  describe('runs after handler succeeds', () => {
    it('should run .useAfter() hook after query handler succeeds', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .query(async () => ({ id: '1', name: 'Alice' }))
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ id: '1', name: 'Alice' });
      expect(afterSpy).toHaveBeenCalledTimes(1);
    });

    it('should run .useAfter() hook after mutation handler succeeds', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: '1', name: input.name }))
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, { name: 'Bob' }, ctx);

      expect(result).toEqual({ id: '1', name: 'Bob' });
      expect(afterSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('receives correct parameters', () => {
    it('should receive { input, result, ctx }', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'Alice' }))
        .useAfter(afterSpy);

      const ctx = { marker: 'test-ctx' } as unknown as BaseContext;
      await executeProcedure(proc, { id: '42' }, ctx);

      expect(afterSpy).toHaveBeenCalledTimes(1);
      const args = afterSpy.mock.calls[0][0];
      expect(args.input).toEqual({ id: '42' });
      expect(args.result).toEqual({ id: '42', name: 'Alice' });
      // ctx may have been extended with __accessLevel, so check the original marker
      expect(args.ctx.marker).toBe('test-ctx');
    });
  });

  describe('chaining multiple hooks', () => {
    it('should run multiple .useAfter() hooks in registration order', async () => {
      const order: string[] = [];

      const proc = procedure()
        .query(async () => ({ ok: true }))
        .useAfter(() => {
          order.push('first');
        })
        .useAfter(() => {
          order.push('second');
        })
        .useAfter(() => {
          order.push('third');
        });

      const ctx = {} as BaseContext;
      await executeProcedure(proc, undefined, ctx);

      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  describe('error handling', () => {
    it('should not fail the response if .useAfter() throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const proc = procedure()
        .query(async () => ({ id: '1' }))
        .useAfter(() => {
          throw new Error('Hook exploded');
        });

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ id: '1' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[@veloxts/router]',
        'useAfter hook error:',
        expect.objectContaining({ message: 'Hook exploded' })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not fail the response if async .useAfter() rejects', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const proc = procedure()
        .mutation(async () => ({ saved: true }))
        .useAfter(async () => {
          throw new Error('Async hook failed');
        });

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ saved: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[@veloxts/router]',
        'useAfter hook error:',
        expect.objectContaining({ message: 'Async hook failed' })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should continue running subsequent hooks even if one fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const secondSpy = vi.fn();

      const proc = procedure()
        .query(async () => ({ ok: true }))
        .useAfter(() => {
          throw new Error('First hook failed');
        })
        .useAfter(secondSpy);

      const ctx = {} as BaseContext;
      await executeProcedure(proc, undefined, ctx);

      expect(secondSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('does NOT run if handler throws', () => {
    it('should not run .useAfter() when handler throws', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .query(async () => {
          throw new Error('Handler error');
        })
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow('Handler error');
      expect(afterSpy).not.toHaveBeenCalled();
    });
  });

  describe('cannot modify the result', () => {
    it('should return the original result even if .useAfter() returns a value', async () => {
      const proc = procedure()
        .query(async () => ({ original: true }))
        .useAfter(() => {
          return { modified: true };
        });

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ original: true });
    });
  });

  describe('backward compatibility', () => {
    it('should work without .useAfter() (no afterHandlers)', async () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id }));

      expect(proc.afterHandlers).toBeUndefined();

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, { id: '99' }, ctx);
      expect(result).toEqual({ id: '99' });
    });

    it('should be accepted by procedures() without .useAfter()', () => {
      const collection = procedures('items', {
        listItems: procedure().query(async () => []),
        createItem: procedure()
          .input(z.object({ name: z.string() }))
          .mutation(async ({ input }) => ({ id: '1', name: input.name })),
      });

      expect(collection.namespace).toBe('items');
      expect(Object.keys(collection.procedures)).toEqual(['listItems', 'createItem']);
    });

    it('should be accepted by procedures() WITH .useAfter()', () => {
      const afterSpy = vi.fn();

      const collection = procedures('items', {
        listItems: procedure()
          .query(async () => [])
          .useAfter(afterSpy),
        createItem: procedure()
          .input(z.object({ name: z.string() }))
          .mutation(async ({ input }) => ({ id: '1', name: input.name }))
          .useAfter(afterSpy),
      });

      expect(collection.namespace).toBe('items');
      expect(Object.keys(collection.procedures)).toEqual(['listItems', 'createItem']);
    });
  });

  describe('works on both .mutation() and .query()', () => {
    it('should work on query', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .query(async () => 'query-result')
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toBe('query-result');
      expect(afterSpy).toHaveBeenCalledTimes(1);
      expect(proc.type).toBe('query');
    });

    it('should work on mutation', async () => {
      const afterSpy = vi.fn();

      const proc = procedure()
        .mutation(async () => 'mutation-result')
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toBe('mutation-result');
      expect(afterSpy).toHaveBeenCalledTimes(1);
      expect(proc.type).toBe('mutation');
    });
  });

  describe('interaction with .emits()', () => {
    it('should run .useAfter() hooks AFTER events are emitted', async () => {
      const order: string[] = [];

      const emitSpy = vi.fn().mockImplementation(async () => {
        order.push('event-emitted');
      });

      abstract class DomainEvent<TData extends Record<string, unknown> = Record<string, unknown>> {
        readonly data: TData;
        constructor(data: TData) {
          this.data = data;
        }
      }

      class ItemCreated extends DomainEvent<{ itemId: string }> {}

      const proc = procedure()
        .emits(ItemCreated)
        .mutation(async () => ({ itemId: 'i1' }))
        .useAfter(() => {
          order.push('after-hook');
        });

      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      await executeProcedure(proc, undefined, ctx);

      expect(order).toEqual(['event-emitted', 'after-hook']);
    });
  });

  describe('interaction with .through()', () => {
    it('should receive pipeline-enriched input, not raw input', async () => {
      const { defineStep } = await import('../procedure/pipeline.js');
      const afterSpy = vi.fn();

      const enrichStep = defineStep('enrich', async ({ input }: { input: { id: string } }) => ({
        ...input,
        enriched: true,
      }));

      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .through(enrichStep)
        .mutation(async ({ input }) => ({
          done: true,
          receivedId: (input as Record<string, unknown>).id,
        }))
        .useAfter(afterSpy);

      const ctx = {} as BaseContext;
      await executeProcedure(proc, { id: 'test-1' }, ctx);

      expect(afterSpy).toHaveBeenCalledTimes(1);
      const hookParams = afterSpy.mock.calls[0][0];
      // input should be pipeline-enriched (has enriched: true), not raw { id: 'test-1' }
      expect(hookParams.input).toEqual({ id: 'test-1', enriched: true });
      expect(hookParams.result).toEqual({ done: true, receivedId: 'test-1' });
    });
  });
});
