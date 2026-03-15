/**
 * @veloxts/router - .throws() Procedure Builder Tests
 * Tests that .throws() stores domain error classes on compiled procedures
 * and preserves builder state through the chain.
 */

import { DomainError } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { procedure } from '../procedure/builder.js';

// ---------------------------------------------------------------------------
// Test domain error classes
// ---------------------------------------------------------------------------

class InsufficientStock extends DomainError<{ sku: string; requested: number; available: number }> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

class PaymentFailed extends DomainError<{ orderId: string; reason: string }> {
  readonly code = 'PAYMENT_FAILED' as const;
  readonly status = 402;
  readonly message = 'Payment could not be processed';
}

class ItemNotFound extends DomainError<{ itemId: string }> {
  readonly code = 'ITEM_NOT_FOUND' as const;
  readonly status = 404;
  readonly message = 'Item not found';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('.throws()', () => {
  it('should store a single error class on the compiled procedure', () => {
    const proc = procedure()
      .throws(InsufficientStock)
      .query(async () => ({ ok: true }));

    expect(proc.errorClasses).toBeDefined();
    expect(proc.errorClasses).toHaveLength(1);
    expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
  });

  it('should store multiple error classes from a single .throws() call', () => {
    const proc = procedure()
      .throws(InsufficientStock, PaymentFailed)
      .query(async () => ({ ok: true }));

    expect(proc.errorClasses).toBeDefined();
    expect(proc.errorClasses).toHaveLength(2);
    expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
    expect(proc.errorClasses?.[1]).toBe(PaymentFailed);
  });

  it('should accumulate error classes from chained .throws() calls', () => {
    const proc = procedure()
      .throws(InsufficientStock)
      .throws(PaymentFailed)
      .throws(ItemNotFound)
      .mutation(async () => ({ ok: true }));

    expect(proc.errorClasses).toBeDefined();
    expect(proc.errorClasses).toHaveLength(3);
    expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
    expect(proc.errorClasses?.[1]).toBe(PaymentFailed);
    expect(proc.errorClasses?.[2]).toBe(ItemNotFound);
  });

  it('should preserve existing builder state (inputSchema, type, etc.)', () => {
    const InputSchema = z.object({ sku: z.string() });
    const OutputSchema = z.object({ ok: z.boolean() });

    const proc = procedure()
      .input(InputSchema)
      .output(OutputSchema)
      .throws(InsufficientStock, PaymentFailed)
      .query(async ({ input }) => ({ ok: input.sku.length > 0 }));

    // Input and output schemas preserved
    expect(proc.inputSchema).toBeDefined();
    expect(proc.inputSchema?.parse({ sku: 'ABC' })).toEqual({ sku: 'ABC' });
    expect(proc.outputSchema).toBeDefined();
    expect(proc.outputSchema?.parse({ ok: true })).toEqual({ ok: true });

    // Type preserved
    expect(proc.type).toBe('query');

    // Error classes stored
    expect(proc.errorClasses).toHaveLength(2);
    expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
    expect(proc.errorClasses?.[1]).toBe(PaymentFailed);
  });

  it('should be chainable with other builder methods', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .throws(InsufficientStock)
      .rest({ method: 'POST', path: '/custom' })
      .throws(PaymentFailed)
      .deprecated('Use v2 endpoint')
      .mutation(async () => ({ done: true }));

    expect(proc.errorClasses).toHaveLength(2);
    expect(proc.errorClasses?.[0]).toBe(InsufficientStock);
    expect(proc.errorClasses?.[1]).toBe(PaymentFailed);
    expect(proc.restOverride).toEqual({ method: 'POST', path: '/custom' });
    expect(proc.deprecated).toBe(true);
    expect(proc.deprecationMessage).toBe('Use v2 endpoint');
    expect(proc.type).toBe('mutation');
  });

  it('should have undefined errorClasses when .throws() is not used', () => {
    const proc = procedure()
      .input(z.object({ id: z.string() }))
      .query(async () => ({ ok: true }));

    expect(proc.errorClasses).toBeUndefined();
  });

  it('should work with mutation procedures', () => {
    const proc = procedure()
      .input(z.object({ orderId: z.string() }))
      .throws(PaymentFailed, ItemNotFound)
      .mutation(async () => ({ processed: true }));

    expect(proc.type).toBe('mutation');
    expect(proc.errorClasses).toHaveLength(2);
    expect(proc.errorClasses?.[0]).toBe(PaymentFailed);
    expect(proc.errorClasses?.[1]).toBe(ItemNotFound);
  });
});
