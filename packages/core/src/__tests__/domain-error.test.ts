/**
 * @veloxts/core - DomainError Unit Tests
 * Tests DomainError base class, typed data payloads, and isDomainError type guard
 */

import { describe, expect, it } from 'vitest';

import { DomainError, isDomainError } from '../errors/domain-error.js';
import { VeloxError } from '../errors.js';

// ---------------------------------------------------------------------------
// Test subclasses
// ---------------------------------------------------------------------------

class InsufficientStock extends DomainError<{
  sku: string;
  requested: number;
  available: number;
}> {
  readonly code = 'INSUFFICIENT_STOCK' as const;
  readonly status = 422;
  readonly message = 'Not enough inventory';
}

class SubscriptionLimitExceeded extends DomainError<{
  plan: string;
  limit: number;
  current: number;
}> {
  readonly code = 'SUBSCRIPTION_LIMIT_EXCEEDED' as const;
  readonly status = 403;
  readonly message = 'Subscription limit reached';
}

class PaymentDeclined extends DomainError<{
  reason: string;
  retryable: boolean;
}> {
  readonly code = 'PAYMENT_DECLINED' as const;
  readonly status = 422;
  readonly message = 'Payment was declined';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DomainError', () => {
  describe('inheritance', () => {
    it('should extend VeloxError', () => {
      const error = new InsufficientStock({
        sku: 'ABC-123',
        requested: 10,
        available: 3,
      });

      expect(error).toBeInstanceOf(VeloxError);
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(InsufficientStock);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have a proper stack trace', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InsufficientStock');
    });
  });

  describe('typed data', () => {
    it('should store typed data correctly', () => {
      const data = { sku: 'ABC-123', requested: 10, available: 3 };
      const error = new InsufficientStock(data);

      expect(error.data).toEqual(data);
      expect(error.data.sku).toBe('ABC-123');
      expect(error.data.requested).toBe(10);
      expect(error.data.available).toBe(3);
    });

    it('should preserve data reference identity', () => {
      const data = { sku: 'X', requested: 1, available: 0 };
      const error = new InsufficientStock(data);

      expect(error.data).toBe(data);
    });
  });

  describe('properties', () => {
    it('should expose code from the subclass', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.code).toBe('INSUFFICIENT_STOCK');
    });

    it('should expose statusCode derived from status', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.statusCode).toBe(422);
    });

    it('should expose message from the subclass', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.message).toBe('Not enough inventory');
    });

    it('should have the subclass name as error name', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.name).toBe('InsufficientStock');
    });

    it('should work with Error.prototype.toString()', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      expect(error.toString()).toContain('Not enough inventory');
    });
  });

  describe('toJSON()', () => {
    it('should include error name, message, statusCode, code, and data', () => {
      const data = { sku: 'ABC-123', requested: 10, available: 3 };
      const error = new InsufficientStock(data);

      const json = error.toJSON();

      expect(json).toEqual({
        error: 'InsufficientStock',
        message: 'Not enough inventory',
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
        data: { sku: 'ABC-123', requested: 10, available: 3 },
      });
    });

    it('should produce valid JSON via JSON.stringify', () => {
      const error = new InsufficientStock({
        sku: 'X',
        requested: 1,
        available: 0,
      });

      const parsed = JSON.parse(JSON.stringify(error)) as Record<string, unknown>;

      expect(parsed.error).toBe('InsufficientStock');
      expect(parsed.code).toBe('INSUFFICIENT_STOCK');
      expect(parsed.data).toEqual({ sku: 'X', requested: 1, available: 0 });
    });
  });

  describe('multiple subclass types', () => {
    it('should work independently for InsufficientStock', () => {
      const error = new InsufficientStock({
        sku: 'WIDGET-99',
        requested: 5,
        available: 2,
      });

      expect(error.code).toBe('INSUFFICIENT_STOCK');
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Not enough inventory');
      expect(error.data.sku).toBe('WIDGET-99');
    });

    it('should work independently for SubscriptionLimitExceeded', () => {
      const error = new SubscriptionLimitExceeded({
        plan: 'free',
        limit: 100,
        current: 100,
      });

      expect(error.code).toBe('SUBSCRIPTION_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Subscription limit reached');
      expect(error.data.plan).toBe('free');
      expect(error.data.limit).toBe(100);
    });

    it('should work independently for PaymentDeclined', () => {
      const error = new PaymentDeclined({
        reason: 'insufficient_funds',
        retryable: true,
      });

      expect(error.code).toBe('PAYMENT_DECLINED');
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Payment was declined');
      expect(error.data.reason).toBe('insufficient_funds');
      expect(error.data.retryable).toBe(true);
    });

    it('should produce distinct toJSON() output per subclass', () => {
      const stock = new InsufficientStock({ sku: 'A', requested: 1, available: 0 });
      const sub = new SubscriptionLimitExceeded({ plan: 'free', limit: 10, current: 10 });

      expect(stock.toJSON().code).toBe('INSUFFICIENT_STOCK');
      expect(sub.toJSON().code).toBe('SUBSCRIPTION_LIMIT_EXCEEDED');
      expect(stock.toJSON().error).toBe('InsufficientStock');
      expect(sub.toJSON().error).toBe('SubscriptionLimitExceeded');
    });
  });
});

describe('isDomainError()', () => {
  it('should return true for DomainError subclasses', () => {
    const stock = new InsufficientStock({ sku: 'A', requested: 1, available: 0 });
    const sub = new SubscriptionLimitExceeded({ plan: 'free', limit: 10, current: 10 });
    const payment = new PaymentDeclined({ reason: 'declined', retryable: false });

    expect(isDomainError(stock)).toBe(true);
    expect(isDomainError(sub)).toBe(true);
    expect(isDomainError(payment)).toBe(true);
  });

  it('should return false for plain Error', () => {
    expect(isDomainError(new Error('test'))).toBe(false);
  });

  it('should return false for VeloxError', () => {
    expect(isDomainError(new VeloxError('test', 500))).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
    expect(isDomainError('error')).toBe(false);
    expect(isDomainError(123)).toBe(false);
    expect(isDomainError(true)).toBe(false);
    expect(isDomainError({})).toBe(false);
    expect(isDomainError({ message: 'test', code: 'ERR' })).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const error: unknown = new InsufficientStock({
      sku: 'X',
      requested: 1,
      available: 0,
    });

    if (isDomainError(error)) {
      // After narrowing, we can access DomainError properties
      expect(error.data).toBeDefined();
      expect(error.code).toBeDefined();
      expect(error.statusCode).toBeDefined();
      expect(error.message).toBeDefined();
    } else {
      // Should not reach here
      expect.unreachable('isDomainError should have returned true');
    }
  });
});
