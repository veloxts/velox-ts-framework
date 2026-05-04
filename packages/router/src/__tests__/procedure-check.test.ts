/**
 * @veloxts/router - .check() Builder Tests
 *
 * Tests `.check()` on the procedure builder — the post-middleware authorization
 * primitive added to fix the gap exposed by the freehand `ara/apps/api` audit
 * (where `requireParticipant((i) => i.id)` had to be implemented as `.use()`
 * middleware because guards couldn't see middleware-extended ctx).
 */
import type { BaseContext } from '@veloxts/core';
import { ForbiddenError } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';

const ctxBase = (): BaseContext =>
  ({
    request: {} as unknown as BaseContext['request'],
    reply: {} as unknown as BaseContext['reply'],
  }) as BaseContext;

describe('.check()', () => {
  describe('builder', () => {
    it('stores the check on the compiled procedure', () => {
      const proc = procedure()
        .check(() => true)
        .mutation(async () => ({ ok: true }));

      expect(proc.checks).toBeDefined();
      expect(proc.checks).toHaveLength(1);
    });

    it('accumulates multiple .check() calls', () => {
      const proc = procedure()
        .check(() => true)
        .check(() => true)
        .check(() => true)
        .mutation(async () => ({ ok: true }));

      expect(proc.checks).toHaveLength(3);
    });
  });

  describe('execution', () => {
    it('passes when check returns true', async () => {
      const proc = procedure()
        .check(() => true)
        .query(async () => ({ result: 'ok' }));

      const result = await executeProcedure(proc, {}, ctxBase());
      expect(result).toEqual({ result: 'ok' });
    });

    it('passes when async check resolves true', async () => {
      const proc = procedure()
        .check(async () => true)
        .query(async () => ({ result: 'ok' }));

      const result = await executeProcedure(proc, {}, ctxBase());
      expect(result).toEqual({ result: 'ok' });
    });

    it('throws ForbiddenError (403) when check returns false', async () => {
      const proc = procedure()
        .check(() => false)
        .query(async () => ({ result: 'ok' }));

      await expect(executeProcedure(proc, {}, ctxBase())).rejects.toThrow(ForbiddenError);
    });

    it('propagates errors thrown inside a check (no wrapping)', async () => {
      class CustomError extends Error {
        readonly statusCode = 418;
      }

      const proc = procedure()
        .check(() => {
          throw new CustomError('teapot');
        })
        .query(async () => ({ result: 'ok' }));

      await expect(executeProcedure(proc, {}, ctxBase())).rejects.toThrow(CustomError);
      await expect(executeProcedure(proc, {}, ctxBase())).rejects.toThrow('teapot');
    });

    it('AND-composes multiple checks in declaration order', async () => {
      const calls: number[] = [];

      const proc = procedure()
        .check(() => {
          calls.push(1);
          return true;
        })
        .check(() => {
          calls.push(2);
          return true;
        })
        .check(() => {
          calls.push(3);
          return true;
        })
        .query(async () => ({ ok: true }));

      await executeProcedure(proc, {}, ctxBase());
      expect(calls).toEqual([1, 2, 3]);
    });

    it('short-circuits on first false (later checks not invoked)', async () => {
      const second = vi.fn().mockReturnValue(true);

      const proc = procedure()
        .check(() => false)
        .check(second)
        .query(async () => ({ ok: true }));

      await expect(executeProcedure(proc, {}, ctxBase())).rejects.toThrow(ForbiddenError);
      expect(second).not.toHaveBeenCalled();
    });

    it('does NOT call the handler when a check fails', async () => {
      const handler = vi.fn(async () => ({ ok: true }));

      const proc = procedure()
        .check(() => false)
        .query(handler);

      await expect(executeProcedure(proc, {}, ctxBase())).rejects.toThrow(ForbiddenError);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('integration with other builder methods', () => {
    it('sees the parsed input from .input()', async () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .check(({ input }) => input.id === 'allowed')
        .query(async ({ input }) => ({ id: input.id }));

      await expect(executeProcedure(proc, { id: 'denied' }, ctxBase())).rejects.toThrow(
        ForbiddenError
      );

      const result = await executeProcedure(proc, { id: 'allowed' }, ctxBase());
      expect(result).toEqual({ id: 'allowed' });
    });

    it('sees ctx mutations from preceding .use() middleware', async () => {
      // This is the canonical use case from the freehand audit:
      // .use(loadParticipant) extends ctx, .check() reads ctx.participant
      const proc = procedure()
        .input(z.object({ sessionId: z.string() }))
        .use(async ({ ctx, next }) => {
          // Simulate "loadParticipant" middleware
          return next({
            ctx: { ...ctx, participant: { id: 'p1', sessionId: 'sess-A' } },
          });
        })
        .check(({ input, ctx }) => {
          const c = ctx as BaseContext & { participant?: { sessionId: string } };
          return c.participant?.sessionId === input.sessionId;
        })
        .query(async ({ ctx }) => ({
          participantId: (ctx as BaseContext & { participant: { id: string } }).participant.id,
        }));

      await expect(executeProcedure(proc, { sessionId: 'wrong' }, ctxBase())).rejects.toThrow(
        ForbiddenError
      );

      const result = await executeProcedure(proc, { sessionId: 'sess-A' }, ctxBase());
      expect(result).toEqual({ participantId: 'p1' });
    });

    it('runs after .guard() and only when guards pass', async () => {
      const checkFn = vi.fn().mockReturnValue(true);
      const failingGuard = {
        name: 'failingGuard',
        statusCode: 401,
        message: 'unauthenticated',
        check: () => false,
      };

      const proc = procedure()
        .guard(failingGuard)
        .check(checkFn)
        .query(async () => ({ ok: true }));

      const ctx = ctxBase();
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow();
      // Check not invoked because guard rejected first
      expect(checkFn).not.toHaveBeenCalled();
    });

    it('preserves accessLevel from .guardNarrow() guards', async () => {
      // Regression: .check() must NOT reset ctx.__accessLevel set by guards
      // with the accessLevel marker (used for resource auto-projection).
      let observedLevel: string | undefined;

      const adminGuard = {
        name: 'adminNarrow',
        statusCode: 403,
        message: 'admin only',
        accessLevel: 'admin',
        check: () => true,
      };

      const proc = procedure()
        .guard(adminGuard)
        .check(() => true)
        .query(async ({ ctx }) => {
          observedLevel = (ctx as BaseContext & { __accessLevel?: string }).__accessLevel;
          return { ok: true };
        });

      await executeProcedure(proc, {}, ctxBase());
      expect(observedLevel).toBe('admin');
    });

    it('runs inside a transactional() wrapper', async () => {
      const tx = { kind: 'tx' };
      const $transaction = vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
      let observedDb: unknown;

      const proc = procedure()
        .transactional()
        .check(({ ctx }) => {
          // Inside the transaction wrapper ctx.db is replaced with the tx
          observedDb = (ctx as BaseContext & { db?: unknown }).db;
          return true;
        })
        .mutation(async () => ({ ok: true }));

      const ctx = {
        ...ctxBase(),
        db: { $transaction },
      } as unknown as BaseContext;

      await executeProcedure(proc, {}, ctx);
      expect(observedDb).toBe(tx);
      expect($transaction).toHaveBeenCalled();
    });

    it('runs after pipeline transforms (sees post-pipeline input)', async () => {
      const { defineStep } = await import('../procedure/pipeline.js');

      const enrichInput = defineStep<{ id: string }, { id: string; enriched: boolean }>(
        'enrichInput',
        async ({ input }) => ({ ...input, enriched: true })
      );

      let observedInput: unknown;

      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .through(enrichInput)
        .check(({ input }) => {
          observedInput = input;
          return true;
        })
        .query(async ({ input }) => input);

      await executeProcedure(proc, { id: '42' }, ctxBase());
      expect(observedInput).toEqual({ id: '42', enriched: true });
    });
  });
});
