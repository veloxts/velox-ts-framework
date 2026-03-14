/**
 * @veloxts/router - Pipeline Step & Revert Factory Tests
 * Tests defineStep, defineRevert factories and step.onRevert() chaining
 */

import { describe, expect, it, vi } from 'vitest';

import { defineRevert, defineStep } from '../procedure/pipeline.js';

describe('defineStep', () => {
  it('creates step with name and external=false from string', () => {
    const step = defineStep('validateInventory', async ({ input }) => {
      return input;
    });

    expect(step.name).toBe('validateInventory');
    expect(step.external).toBe(false);
    expect(typeof step.handler).toBe('function');
    expect(step.revertAction).toBeUndefined();
  });

  it('creates external step from options object', () => {
    const step = defineStep({ name: 'chargePayment', external: true }, async ({ input }) => {
      return input;
    });

    expect(step.name).toBe('chargePayment');
    expect(step.external).toBe(true);
    expect(typeof step.handler).toBe('function');
  });

  it('defaults external to false when not specified in options', () => {
    const step = defineStep({ name: 'checkStock' }, async ({ input }) => {
      return input;
    });

    expect(step.name).toBe('checkStock');
    expect(step.external).toBe(false);
  });

  it('step handler is callable and returns result', async () => {
    const step = defineStep('enrich', async ({ input }) => {
      const data = input as { id: string };
      return { ...data, enriched: true };
    });

    const result = await step.handler({ input: { id: '1' }, ctx: {} });
    expect(result).toEqual({ id: '1', enriched: true });
  });

  it('step handler receives ctx', async () => {
    const step = defineStep('withCtx', async ({ ctx }) => {
      const context = ctx as { userId: string };
      return { userId: context.userId };
    });

    const result = await step.handler({ input: {}, ctx: { userId: 'u1' } });
    expect(result).toEqual({ userId: 'u1' });
  });
});

describe('defineRevert', () => {
  it('creates revert action with name and handler', () => {
    const revert = defineRevert('refundPayment', async () => {
      // undo logic
    });

    expect(revert.name).toBe('refundPayment');
    expect(typeof revert.handler).toBe('function');
  });

  it('revert handler is callable', async () => {
    const spy = vi.fn();
    const revert = defineRevert('undoCharge', async ({ input }) => {
      spy(input);
    });

    await revert.handler({ input: { chargeId: 'ch_1' }, ctx: {} });
    expect(spy).toHaveBeenCalledWith({ chargeId: 'ch_1' });
  });

  it('revert handler returns void', async () => {
    const revert = defineRevert('cleanup', async () => {
      // no return
    });

    const result = await revert.handler({ input: {}, ctx: {} });
    expect(result).toBeUndefined();
  });
});

describe('step.onRevert()', () => {
  it('returns new step with revertAction attached', () => {
    const charge = defineStep({ name: 'chargePayment', external: true }, async ({ input }) => {
      return input;
    });

    const refund = defineRevert('refundPayment', async () => {
      // undo
    });

    const chargeWithRevert = charge.onRevert(refund);

    expect(chargeWithRevert.name).toBe('chargePayment');
    expect(chargeWithRevert.external).toBe(true);
    expect(chargeWithRevert.revertAction).toBe(refund);
    expect(typeof chargeWithRevert.handler).toBe('function');
  });

  it('does not mutate original step', () => {
    const step = defineStep('process', async ({ input }) => {
      return input;
    });

    const revert = defineRevert('undoProcess', async () => {
      // undo
    });

    const stepWithRevert = step.onRevert(revert);

    // Original should not have revertAction
    expect(step.revertAction).toBeUndefined();
    // New step should have it
    expect(stepWithRevert.revertAction).toBe(revert);
    // They should be different objects
    expect(step).not.toBe(stepWithRevert);
  });

  it('preserves handler reference on new step', async () => {
    const handler = vi.fn(async ({ input }) => input);
    const step = defineStep('orig', handler);
    const revert = defineRevert('undo', async () => {});

    const stepped = step.onRevert(revert);
    await stepped.handler({ input: { x: 1 }, ctx: {} });

    expect(handler).toHaveBeenCalledWith({ input: { x: 1 }, ctx: {} });
  });
});
