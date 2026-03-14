/**
 * @veloxts/router - .policy() Builder Tests
 * Tests .policy() on the procedure builder and policy execution in executeProcedure
 */

import type { BaseContext } from '@veloxts/core';
import { ForbiddenError } from '@veloxts/core';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';
import { defineStep } from '../procedure/pipeline.js';
import type { ProcedureBuilder } from '../procedure/types.js';
import type { PolicyActionLike } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates a mock PolicyActionRef matching @veloxts/auth's shape */
function createPolicyAction(
  actionName: string,
  resourceName: string,
  checkFn: (user: unknown, resource?: unknown) => boolean | Promise<boolean>
): PolicyActionLike {
  return {
    actionName,
    resourceName,
    check: checkFn,
  };
}

/** Creates a mock guard for testing */
function createMockGuard(name: string, passes: boolean) {
  return {
    name,
    check: vi.fn().mockResolvedValue(passes),
    statusCode: 403,
    message: `Guard "${name}" check failed`,
  };
}

describe('.policy()', () => {
  describe('builder method', () => {
    it('stores action ref on compiled procedure', () => {
      const policyAction = createPolicyAction('update', 'Post', () => true);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.policyAction).toBeDefined();
      expect(proc.policyAction?.actionName).toBe('update');
      expect(proc.policyAction?.resourceName).toBe('Post');
    });

    it('works in full builder chain', () => {
      const policyAction = createPolicyAction('create', 'Post', () => true);

      const proc = procedure()
        .input(z.object({ title: z.string() }))
        .guard(createMockGuard('authenticated', true))
        .policy(policyAction)
        .mutation(async ({ input }) => ({ title: input.title }));

      expect(proc.policyAction).toBeDefined();
      expect(proc.policyAction?.actionName).toBe('create');
      expect(proc.inputSchema).toBeDefined();
      expect(proc.guards).toHaveLength(1);
    });

    it('last .policy() call wins', () => {
      const action1 = createPolicyAction('create', 'Post', () => true);
      const action2 = createPolicyAction('update', 'Post', () => true);

      const proc = procedure()
        .policy(action1)
        .policy(action2)
        .mutation(async ({ input }) => input as { ok: boolean });

      expect(proc.policyAction?.actionName).toBe('update');
    });
  });

  describe('execution in executeProcedure', () => {
    it('checks action-level policy (no resource on ctx)', async () => {
      const checkFn = vi.fn().mockReturnValue(true);
      const policyAction = createPolicyAction('create', 'Post', checkFn);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ created: true }));

      const ctx = { user: { id: 'u1', role: 'admin' } } as unknown as BaseContext;
      const result = await executeProcedure(proc, {}, ctx);

      expect(result).toEqual({ created: true });
      expect(checkFn).toHaveBeenCalledWith({ id: 'u1', role: 'admin' }, undefined);
    });

    it('checks resource-level policy (ctx has resource)', async () => {
      const checkFn = vi.fn().mockReturnValue(true);
      const policyAction = createPolicyAction('update', 'Post', checkFn);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ updated: true }));

      const ctx = {
        user: { id: 'u1' },
        post: { id: 'p1', authorId: 'u1' },
      } as unknown as BaseContext;
      const result = await executeProcedure(proc, {}, ctx);

      expect(result).toEqual({ updated: true });
      expect(checkFn).toHaveBeenCalledWith({ id: 'u1' }, { id: 'p1', authorId: 'u1' });
    });

    it('throws ForbiddenError when policy fails', async () => {
      const policyAction = createPolicyAction('delete', 'Post', () => false);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ deleted: true }));

      const ctx = { user: { id: 'u1' } } as unknown as BaseContext;

      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow(ForbiddenError);
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow(
        'Policy check failed: cannot delete Post'
      );
    });

    it('passes — handler executes normally', async () => {
      const policyAction = createPolicyAction('update', 'Post', (user, resource) => {
        const u = user as { id: string };
        const r = resource as { authorId: string } | undefined;
        return r ? r.authorId === u.id : false;
      });

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ success: true }));

      const ctx = {
        user: { id: 'u1' },
        post: { authorId: 'u1' },
      } as unknown as BaseContext;

      const result = await executeProcedure(proc, {}, ctx);
      expect(result).toEqual({ success: true });
    });

    it('works without .policy() (backward compatible)', async () => {
      const proc = procedure().mutation(async ({ input }) => {
        return { received: input };
      });

      const ctx = {} as BaseContext;
      const result = await executeProcedure(proc, { data: 'test' }, ctx);

      expect(result).toEqual({ received: { data: 'test' } });
    });

    it('policy check happens before pipeline steps', async () => {
      const order: string[] = [];

      const policyAction = createPolicyAction('update', 'Post', () => {
        order.push('policy-check');
        return true;
      });

      const step = defineStep('enrich', async ({ input }) => {
        order.push('pipeline-step');
        return input;
      });

      const proc = procedure()
        .policy(policyAction)
        .through(step)
        .mutation(async ({ input }) => {
          order.push('handler');
          return input as { ok: boolean };
        });

      const ctx = {
        user: { id: 'u1' },
        post: { authorId: 'u1' },
      } as unknown as BaseContext;

      await executeProcedure(proc, { ok: true }, ctx);

      expect(order).toEqual(['policy-check', 'pipeline-step', 'handler']);
    });

    it('policy failure prevents pipeline and handler execution', async () => {
      const stepFn = vi.fn(async ({ input }: { input: unknown }) => input);
      const handlerFn = vi.fn(async () => ({ ok: true }));

      const policyAction = createPolicyAction('update', 'Post', () => false);

      const step = defineStep('enrich', stepFn);

      const proc = procedure().policy(policyAction).through(step).mutation(handlerFn);

      const ctx = {
        user: { id: 'u1' },
        post: { authorId: 'other' },
      } as unknown as BaseContext;

      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow(ForbiddenError);
      expect(stepFn).not.toHaveBeenCalled();
      expect(handlerFn).not.toHaveBeenCalled();
    });

    it('policy check runs after guards', async () => {
      const order: string[] = [];

      const guard = {
        name: 'authenticated',
        check: vi.fn().mockImplementation(() => {
          order.push('guard-check');
          return true;
        }),
        statusCode: 401,
        message: 'Not authenticated',
      };

      const policyAction = createPolicyAction('update', 'Post', () => {
        order.push('policy-check');
        return true;
      });

      const proc = procedure()
        .guard(guard)
        .policy(policyAction)
        .mutation(async () => {
          order.push('handler');
          return { ok: true };
        });

      const ctx = {
        request: {},
        reply: {},
        user: { id: 'u1' },
        post: { authorId: 'u1' },
      } as unknown as BaseContext;

      await executeProcedure(proc, {}, ctx);

      expect(order).toEqual(['guard-check', 'policy-check', 'handler']);
    });

    it('supports async policy checks', async () => {
      const policyAction = createPolicyAction('update', 'Post', async (user, resource) => {
        // Simulate async DB lookup
        await Promise.resolve();
        const u = user as { id: string };
        const r = resource as { authorId: string } | undefined;
        return r ? r.authorId === u.id : false;
      });

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ updated: true }));

      const ctx = {
        user: { id: 'u1' },
        post: { authorId: 'u1' },
      } as unknown as BaseContext;

      const result = await executeProcedure(proc, {}, ctx);
      expect(result).toEqual({ updated: true });
    });

    it('resource lookup is case-insensitive (lowercase resourceName)', async () => {
      const checkFn = vi.fn().mockReturnValue(true);
      // ResourceName is "Comment" — should look up ctx.comment
      const policyAction = createPolicyAction('delete', 'Comment', checkFn);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({ deleted: true }));

      const ctx = {
        user: { id: 'u1' },
        comment: { id: 'c1', authorId: 'u1' },
      } as unknown as BaseContext;

      await executeProcedure(proc, {}, ctx);

      expect(checkFn).toHaveBeenCalledWith({ id: 'u1' }, { id: 'c1', authorId: 'u1' });
    });

    it('should throw ForbiddenError when ctx.user is undefined', async () => {
      const policyAction = createPolicyAction('create', 'Post', () => true);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({}));

      const ctx = { request: {}, reply: {} } as unknown as BaseContext;

      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow(ForbiddenError);
      await expect(executeProcedure(proc, {}, ctx)).rejects.toThrow('no authenticated user');
    });

    it('should lookup multi-word resource name with camelCase', async () => {
      const checkFn = vi.fn().mockReturnValue(true);
      const policyAction = createPolicyAction('update', 'OrderItem', checkFn);

      const proc = procedure()
        .policy(policyAction)
        .mutation(async () => ({}));

      const ctx = {
        user: { id: '1' },
        orderItem: { id: 'oi-1' },
      } as unknown as BaseContext;

      await executeProcedure(proc, {}, ctx);

      expect(checkFn).toHaveBeenCalledWith({ id: '1' }, { id: 'oi-1' });
    });

    it('works with query procedures', async () => {
      const policyAction = createPolicyAction('view', 'Post', () => true);

      const proc = procedure()
        .policy(policyAction)
        .query(async () => ({ title: 'My Post' }));

      const ctx = {
        user: { id: 'u1' },
        post: { id: 'p1', authorId: 'u1' },
      } as unknown as BaseContext;

      const result = await executeProcedure(proc, {}, ctx);
      expect(result).toEqual({ title: 'My Post' });
    });
  });

  describe('compile-time context enforcement', () => {
    it('should accept policy when context has the resource (literal resource name)', () => {
      // PolicyActionLike with literal TResourceName
      const action: PolicyActionLike<unknown, unknown, 'Post'> = {
        actionName: 'update',
        resourceName: 'Post',
        check: () => true,
      };

      // Builder with context that has 'post' key
      type CtxWithPost = BaseContext & { post: { id: string } };

      // This should compile — context has 'post'
      type Builder = ProcedureBuilder<unknown, unknown, CtxWithPost>;
      type PolicyResult = ReturnType<Builder['policy']>;
      expectTypeOf<PolicyResult>().not.toBeNever();

      // Runtime: also works
      const proc = procedure()
        .use(async ({ next }) => next({ ctx: { post: { id: 'p1' } } }))
        .policy(action)
        .mutation(async () => ({ ok: true }));

      expect(proc.policyAction?.resourceName).toBe('Post');
    });

    it('should accept policy with wide string resourceName (graceful degradation)', () => {
      // When TResourceName is 'string' (from definePolicy<User, Post>(...)),
      // the check is skipped — no compile-time enforcement
      const action: PolicyActionLike = {
        actionName: 'update',
        resourceName: 'Post',
        check: () => true,
      };

      // This should compile even without 'post' on context
      const proc = procedure()
        .policy(action)
        .mutation(async () => ({ ok: true }));

      expect(proc.policyAction?.resourceName).toBe('Post');
    });

    it('should carry literal resourceName through PolicyActionLike', () => {
      const action: PolicyActionLike<unknown, unknown, 'OrderItem'> = {
        actionName: 'update',
        resourceName: 'OrderItem',
        check: () => true,
      };

      // Verify the literal is preserved
      expectTypeOf(action.resourceName).toEqualTypeOf<'OrderItem'>();
    });
  });
});
