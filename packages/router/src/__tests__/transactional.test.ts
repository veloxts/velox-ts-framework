/**
 * @veloxts/router - Transactional Procedure Tests
 * Tests .transactional() on the procedure builder and transaction wrapping in executeProcedure
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';

describe('.transactional()', () => {
  describe('builder method', () => {
    it('should store transactional flag on compiled procedure', () => {
      const proc = procedure()
        .transactional()
        .query(async () => ({ success: true }));

      expect(proc.transactional).toBe(true);
      expect(proc.transactionalOptions).toBeUndefined();
    });

    it('should store transactional options on compiled procedure', () => {
      const proc = procedure()
        .transactional({ isolationLevel: 'Serializable', timeout: 10000 })
        .mutation(async () => ({ created: true }));

      expect(proc.transactional).toBe(true);
      expect(proc.transactionalOptions).toEqual({
        isolationLevel: 'Serializable',
        timeout: 10000,
      });
    });

    it('should store partial options (isolationLevel only)', () => {
      const proc = procedure()
        .transactional({ isolationLevel: 'ReadCommitted' })
        .mutation(async () => ({ ok: true }));

      expect(proc.transactional).toBe(true);
      expect(proc.transactionalOptions).toEqual({
        isolationLevel: 'ReadCommitted',
      });
    });

    it('should store partial options (timeout only)', () => {
      const proc = procedure()
        .transactional({ timeout: 5000 })
        .mutation(async () => ({ ok: true }));

      expect(proc.transactional).toBe(true);
      expect(proc.transactionalOptions).toEqual({ timeout: 5000 });
    });

    it('should work in a full builder chain', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ success: z.boolean() }))
        .transactional({ isolationLevel: 'RepeatableRead' })
        .mutation(async () => ({ success: true }));

      expect(proc.transactional).toBe(true);
      expect(proc.inputSchema).toBeDefined();
      expect(proc.outputSchema).toBeDefined();
    });
  });

  describe('executeProcedure with transactional wrapping', () => {
    it('should wrap handler in ctx.db.$transaction when transactional', async () => {
      const mockTxClient = { findMany: vi.fn().mockResolvedValue([{ id: '1' }]) };
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
          return callback(mockTxClient);
        }),
      };

      const proc = procedure()
        .transactional()
        .query(async ({ ctx }) => {
          const ctxWithDb = ctx as BaseContext & { db: typeof mockTxClient };
          return { items: await ctxWithDb.db.findMany() };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [{ id: '1' }] });
    });

    it('should replace ctx.db with the transaction client inside handler', async () => {
      const originalDb = { name: 'original' };
      const txClient = { name: 'transaction-client' };

      const mockDb = {
        ...originalDb,
        $transaction: vi.fn(async (callback: (tx: typeof txClient) => Promise<unknown>) => {
          return callback(txClient);
        }),
      };

      let capturedDbName: string | undefined;

      const proc = procedure()
        .transactional()
        .query(async ({ ctx }) => {
          const ctxWithDb = ctx as BaseContext & { db: { name: string } };
          capturedDbName = ctxWithDb.db.name;
          return { ok: true };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, undefined, ctx);

      expect(capturedDbName).toBe('transaction-client');
    });

    it('should pass transactional options to $transaction', async () => {
      const mockTxClient = {};
      const mockDb = {
        $transaction: vi.fn(
          async (callback: (tx: unknown) => Promise<unknown>, _options?: unknown) => {
            return callback(mockTxClient);
          }
        ),
      };

      const proc = procedure()
        .transactional({ isolationLevel: 'Serializable', timeout: 15000 })
        .mutation(async () => ({ done: true }));

      const ctx = { db: mockDb } as unknown as BaseContext;
      await executeProcedure(proc, undefined, ctx);

      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.anything(), {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    });

    it('should auto-rollback on handler throw', async () => {
      const mockTxClient = {};
      const transactionError = new Error('Handler failed inside transaction');

      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          // Prisma $transaction will auto-rollback if callback throws
          return callback(mockTxClient);
        }),
      };

      const proc = procedure()
        .transactional()
        .mutation(async () => {
          throw transactionError;
        });

      const ctx = { db: mockDb } as unknown as BaseContext;

      await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow(
        'Handler failed inside transaction'
      );
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should work without .transactional() (backward compatible, no wrapping)', async () => {
      const mockDb = {
        $transaction: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      };

      const proc = procedure().query(async ({ ctx }) => {
        const ctxWithDb = ctx as BaseContext & { db: typeof mockDb };
        return { items: await ctxWithDb.db.findMany() };
      });

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(mockDb.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [] });
    });

    it('should skip transaction wrapping when ctx.db is undefined', async () => {
      const proc = procedure()
        .transactional()
        .query(async () => ({ result: 'no-db' }));

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      // Should fall through to normal execution since there's no db
      expect(result).toEqual({ result: 'no-db' });
    });

    it('should skip transaction wrapping when ctx.db.$transaction is missing', async () => {
      const mockDb = { findMany: vi.fn().mockResolvedValue([]) };

      const proc = procedure()
        .transactional()
        .query(async ({ ctx }) => {
          const ctxWithDb = ctx as BaseContext & { db: typeof mockDb };
          return { items: await ctxWithDb.db.findMany() };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      // Should fall through to normal execution since $transaction doesn't exist
      expect(result).toEqual({ items: [] });
    });

    it('should work with input validation and transactional', async () => {
      const mockTxClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTxClient);
        }),
      };

      const proc = procedure()
        .input(z.object({ name: z.string() }))
        .transactional()
        .mutation(async ({ input }) => ({ created: input.name }));

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, { name: 'Alice' }, ctx);

      expect(result).toEqual({ created: 'Alice' });
      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should work with output validation and transactional', async () => {
      const mockTxClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTxClient);
        }),
      };

      const proc = procedure()
        .output(z.object({ count: z.number() }))
        .transactional()
        .query(async () => ({ count: 42 }));

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ count: 42 });
    });

    it('should work with middleware and transactional', async () => {
      const executionOrder: string[] = [];
      const mockTxClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          executionOrder.push('transaction-start');
          const result = await callback(mockTxClient);
          executionOrder.push('transaction-end');
          return result;
        }),
      };

      const proc = procedure()
        .use(async ({ next }) => {
          executionOrder.push('middleware-before');
          const result = await next();
          executionOrder.push('middleware-after');
          return result;
        })
        .transactional()
        .mutation(async () => {
          executionOrder.push('handler');
          return { ok: true };
        });

      const ctx = { db: mockDb } as unknown as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ ok: true });
      // Transaction wraps the entire middleware+handler chain
      expect(executionOrder).toEqual([
        'transaction-start',
        'middleware-before',
        'handler',
        'middleware-after',
        'transaction-end',
      ]);
    });
  });
});
