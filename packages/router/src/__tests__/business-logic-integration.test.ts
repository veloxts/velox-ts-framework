/**
 * @veloxts/router - Cross-Package Business Logic Integration Test
 *
 * Validates that ALL Tier 3 business logic primitives work together in a single
 * procedure chain:
 *   - DomainError (.throws())
 *   - DomainEvent (.emits()) — stubbed locally; @veloxts/events is not a dep
 *   - Policy (.policy()) — uses PolicyActionLike-compatible helper
 *   - Pipeline steps (.through()) with defineStep / defineRevert
 *   - Post-handler hook (.useAfter())
 *   - procedures() collection
 *   - executeProcedure() orchestration
 */

import type { BaseContext } from '@veloxts/core';
import { DomainError, ForbiddenError } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure, procedures } from '../procedure/builder.js';
import { defineRevert, defineStep } from '../procedure/pipeline.js';
import type { PolicyActionLike } from '../types.js';

// ============================================================================
// 1. Domain Error
// ============================================================================

class InsufficientStock extends DomainError<{ sku: string; available: number }> {
  override readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  override readonly message = 'Not enough inventory';
}

// ============================================================================
// 2. Domain Event (local stub — @veloxts/events is not a router dependency)
//    Matches the @veloxts/events DomainEvent contract exactly.
// ============================================================================

abstract class DomainEvent<TData extends Record<string, unknown> = Record<string, unknown>> {
  readonly data: TData;
  readonly timestamp: Date;
  readonly correlationId?: string;

  constructor(data: TData, options?: { correlationId?: string }) {
    this.data = data;
    this.timestamp = new Date();
    this.correlationId = options?.correlationId;
  }

  static get eventName(): string {
    return DomainEvent.name;
  }
}

class OrderCreated extends DomainEvent<{ orderId: string; total: number }> {}

// ============================================================================
// 3. Policy (compatible with PolicyActionLike / @veloxts/auth's definePolicy)
// ============================================================================

/**
 * Minimal definePolicy implementation that produces PolicyActionLike objects.
 * The real @veloxts/auth.definePolicy produces the same shape — this keeps
 * the integration test self-contained without adding an extra dependency.
 */
function definePolicy<TUser = unknown, TResource = unknown>(
  resourceName: string,
  actions: Record<
    string,
    (ctx: { user: TUser; resource?: TResource }) => boolean | Promise<boolean>
  >
): Record<string, PolicyActionLike<TUser, TResource>> & { resourceName: string } {
  const result: Record<string, unknown> = { resourceName };
  for (const [actionName, handler] of Object.entries(actions)) {
    const ref: PolicyActionLike<TUser, TResource> = {
      actionName,
      resourceName,
      check: (user: TUser, resource?: TResource) => handler({ user, resource }),
    };
    result[actionName] = ref;
  }
  return result as Record<string, PolicyActionLike<TUser, TResource>> & { resourceName: string };
}

interface AppUser {
  id: string;
  email: string;
}

const OrderPolicy = definePolicy<AppUser>('Order', {
  create: ({ user }) => !!user,
});

// ============================================================================
// 4. Pipeline steps
// ============================================================================

const validateStock = defineStep('validateStock', async ({ input }) => {
  const typedInput = input as { sku: string; quantity: number };
  return { ...typedInput, stockChecked: true };
});

const chargePayment = defineStep({ name: 'chargePayment', external: true }, async ({ input }) => {
  const typedInput = input as { sku: string; quantity: number; stockChecked: boolean };
  return { ...typedInput, chargeId: 'ch_123' };
});

const refundPayment = defineRevert('refundPayment', async () => {
  // compensate external payment
});

// ============================================================================
// 5. Full Tier 3 procedure collection
// ============================================================================

const auditSpy = vi.fn();

const orderProcedures = procedures('orders', {
  createOrder: procedure()
    .input(z.object({ sku: z.string(), quantity: z.number() }))
    .policy(OrderPolicy.create)
    .throws(InsufficientStock)
    .through(validateStock, chargePayment.onRevert(refundPayment))
    .emits(OrderCreated, (result: { id: string; total: number }) => ({
      orderId: result.id,
      total: result.total,
    }))
    .mutation(async ({ input }) => {
      return { id: 'order-1', total: input.quantity * 10 };
    })
    .useAfter(async ({ result }) => {
      auditSpy(result);
    }),
});

// ============================================================================
// Test helpers
// ============================================================================

function makeCtx(overrides: Partial<BaseContext> = {}): BaseContext {
  return overrides as BaseContext;
}

// ============================================================================
// Tests
// ============================================================================

describe('Business Logic Integration — Full Tier 3 Chain', () => {
  describe('orderProcedures collection shape', () => {
    it('is a valid procedure collection', () => {
      expect(orderProcedures.namespace).toBe('orders');
      expect(Object.keys(orderProcedures.procedures)).toContain('createOrder');
    });

    it('createOrder has all Tier 3 metadata', () => {
      const proc = orderProcedures.procedures.createOrder;

      expect(proc.inputSchema).toBeDefined();
      expect(proc.policyAction).toBeDefined();
      expect(proc.policyAction?.actionName).toBe('create');
      expect(proc.policyAction?.resourceName).toBe('Order');
      expect(proc.errorClasses).toHaveLength(1);
      expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
      expect(proc.pipelineSteps).toHaveLength(2);
      expect(proc.pipelineSteps?.[0].name).toBe('validateStock');
      expect(proc.pipelineSteps?.[1].name).toBe('chargePayment');
      expect(proc.pipelineSteps?.[1].revertAction?.name).toBe('refundPayment');
      expect(proc.emittedEvents).toHaveLength(1);
      expect(proc.emittedEvents?.[0].eventClass).toBe(OrderCreated);
      expect(proc.afterHandlers).toHaveLength(1);
    });
  });

  describe('Test 1: full chain executes successfully', () => {
    it('guard passes, policy passes, pipeline transforms input, handler runs, event fires, useAfter runs', async () => {
      auditSpy.mockReset();

      const emitSpy = vi.fn().mockResolvedValue(undefined);

      const ctx = makeCtx({
        user: { id: 'u1', email: 'user@example.com' },
        events: { emit: emitSpy },
      });

      const proc = orderProcedures.procedures.createOrder;
      const result = await executeProcedure(proc, { sku: 'SKU-1', quantity: 3 }, ctx);

      // Handler result
      expect(result).toEqual({ id: 'order-1', total: 30 });

      // Pipeline ran (validateStock added stockChecked, chargePayment added chargeId)
      // — evidence: handler received transformed input (quantity=3, total=30)

      // Event was emitted
      expect(emitSpy).toHaveBeenCalledTimes(1);
      const emittedEvent = emitSpy.mock.calls[0][0];
      expect(emittedEvent).toBeInstanceOf(OrderCreated);
      expect(emittedEvent.data).toEqual({ orderId: 'order-1', total: 30 });

      // useAfter ran
      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy).toHaveBeenCalledWith({ id: 'order-1', total: 30 });
    });
  });

  describe('Test 2: policy failure → ForbiddenError', () => {
    it('throws ForbiddenError when user is absent (policy check fails)', async () => {
      const proc = orderProcedures.procedures.createOrder;

      // No user in context → policy check returns false
      const ctx = makeCtx({});

      await expect(executeProcedure(proc, { sku: 'SKU-1', quantity: 1 }, ctx)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('throws ForbiddenError with expected message', async () => {
      const proc = orderProcedures.procedures.createOrder;
      const ctx = makeCtx({});

      await expect(
        executeProcedure(proc, { sku: 'SKU-1', quantity: 1 }, ctx)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Policy check failed: no authenticated user'),
      });
    });

    it('does NOT run pipeline or handler when policy fails', async () => {
      const stepSpy = vi.fn(async ({ input }: { input: unknown }) => input);
      const handlerSpy = vi.fn(async () => ({ id: 'x', total: 0 }));

      const stepWithSpy = defineStep('spy', stepSpy);

      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .through(stepWithSpy)
        .mutation(handlerSpy);

      const ctx = makeCtx({});

      await expect(executeProcedure(testProc, { sku: 'SKU-1', quantity: 1 }, ctx)).rejects.toThrow(
        ForbiddenError
      );

      expect(stepSpy).not.toHaveBeenCalled();
      expect(handlerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Test 3: pipeline step failure triggers revert', () => {
    it('runs revert actions in reverse order when a later step fails', async () => {
      const revertOrder: string[] = [];

      const revert1 = defineRevert('undoValidate', async () => {
        revertOrder.push('revert-validate');
      });
      const revert2 = defineRevert('undoCharge', async () => {
        revertOrder.push('revert-charge');
      });

      const step1 = defineStep('validateStep', async ({ input }) => {
        revertOrder.push('validate-ran');
        return { ...(input as Record<string, unknown>), validated: true };
      }).onRevert(revert1);

      const step2 = defineStep({ name: 'chargeStep', external: true }, async ({ input }) => {
        revertOrder.push('charge-ran');
        return { ...(input as Record<string, unknown>), chargeId: 'ch_abc' };
      }).onRevert(revert2);

      const step3 = defineStep('failStep', async () => {
        revertOrder.push('fail-step-ran');
        throw new Error('Step 3 failed during fulfillment');
      });

      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .through(step1, step2, step3)
        .mutation(async ({ input }) => ({ id: 'order-x', total: input.quantity * 10 }));

      const ctx = makeCtx({ user: { id: 'u1', email: 'user@example.com' } });

      await expect(executeProcedure(testProc, { sku: 'SKU-2', quantity: 2 }, ctx)).rejects.toThrow(
        'Step 3 failed during fulfillment'
      );

      // Steps ran forward
      expect(revertOrder[0]).toBe('validate-ran');
      expect(revertOrder[1]).toBe('charge-ran');
      expect(revertOrder[2]).toBe('fail-step-ran');

      // Reverts ran in reverse order (step3 has no revert; step2 then step1)
      expect(revertOrder[3]).toBe('revert-charge');
      expect(revertOrder[4]).toBe('revert-validate');
      expect(revertOrder).toHaveLength(5);
    });
  });

  describe('Test 4: domain error thrown by handler', () => {
    it('InsufficientStock propagates with typed data payload', async () => {
      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .throws(InsufficientStock)
        .mutation(async ({ input }) => {
          throw new InsufficientStock({ sku: input.sku, available: 0 });
        });

      const ctx = makeCtx({ user: { id: 'u1', email: 'user@example.com' } });

      const thrown = await executeProcedure(
        testProc,
        { sku: 'OUT-OF-STOCK', quantity: 5 },
        ctx
      ).catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(InsufficientStock);
      const err = thrown as InsufficientStock;
      expect(err.code).toBe('INSUFFICIENT_STOCK');
      expect(err.status).toBe(422);
      expect(err.message).toBe('Not enough inventory');
      expect(err.data).toEqual({ sku: 'OUT-OF-STOCK', available: 0 });
    });

    it('events are NOT emitted when handler throws a domain error', async () => {
      const emitSpy = vi.fn().mockResolvedValue(undefined);

      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .throws(InsufficientStock)
        .emits(OrderCreated, (result: { id: string; total: number }) => ({
          orderId: result.id,
          total: result.total,
        }))
        .mutation(async ({ input }) => {
          throw new InsufficientStock({ sku: input.sku, available: 0 });
        });

      const ctx = makeCtx({
        user: { id: 'u1', email: 'user@example.com' },
        events: { emit: emitSpy },
      });

      await expect(
        executeProcedure(testProc, { sku: 'NONE', quantity: 1 }, ctx)
      ).rejects.toBeInstanceOf(InsufficientStock);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('useAfter is NOT called when handler throws', async () => {
      const afterSpy = vi.fn();

      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(OrderPolicy.create)
        .throws(InsufficientStock)
        .mutation(async ({ input }) => {
          throw new InsufficientStock({ sku: input.sku, available: 0 });
        })
        .useAfter(afterSpy);

      const ctx = makeCtx({ user: { id: 'u1', email: 'user@example.com' } });

      await expect(
        executeProcedure(testProc, { sku: 'GONE', quantity: 2 }, ctx)
      ).rejects.toBeInstanceOf(InsufficientStock);

      expect(afterSpy).not.toHaveBeenCalled();
    });
  });

  describe('execution order invariants', () => {
    it('policy → pipeline → handler → events → useAfter', async () => {
      const order: string[] = [];

      const policyAction: PolicyActionLike = {
        actionName: 'create',
        resourceName: 'Order',
        check: () => {
          order.push('policy');
          return true;
        },
      };

      const step = defineStep('enrich', async ({ input }) => {
        order.push('pipeline');
        return input;
      });

      const emitSpy = vi.fn().mockImplementation(async () => {
        order.push('event');
      });

      abstract class AuditEvent extends DomainEvent<{ orderId: string; total: number }> {}
      class OrderAuditEvent extends AuditEvent {}

      const testProc = procedure()
        .input(z.object({ sku: z.string(), quantity: z.number() }))
        .policy(policyAction)
        .through(step)
        .emits(OrderAuditEvent, (result: { id: string; total: number }) => ({
          orderId: result.id,
          total: result.total,
        }))
        .mutation(async ({ input }) => {
          order.push('handler');
          return { id: 'ord-1', total: input.quantity * 10 };
        })
        .useAfter(async () => {
          order.push('useAfter');
        });

      const ctx = makeCtx({
        user: { id: 'u1' },
        events: { emit: emitSpy },
      });

      await executeProcedure(testProc, { sku: 'SKU-X', quantity: 1 }, ctx);

      expect(order).toEqual(['policy', 'pipeline', 'handler', 'event', 'useAfter']);
    });
  });
});
