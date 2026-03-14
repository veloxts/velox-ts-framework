/**
 * @veloxts/router - .emits() Procedure Builder Tests
 * Tests that .emits() stores domain event metadata on compiled procedures
 * and that executeProcedure emits events after successful handler execution.
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { executeProcedure, procedure } from '../procedure/builder.js';

// ---------------------------------------------------------------------------
// Minimal DomainEvent stubs (avoid hard dependency on @veloxts/events)
// ---------------------------------------------------------------------------

/**
 * Minimal abstract DomainEvent stub matching @veloxts/events contract.
 */
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
    return this.name;
  }
}

// Concrete event classes for testing
class OrderCreated extends DomainEvent<{ orderId: string; total: number }> {}
class InventoryReserved extends DomainEvent<{ sku: string; quantity: number }> {}
class AuditLogWritten extends DomainEvent<{ action: string }> {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('.emits()', () => {
  describe('builder method', () => {
    it('should store event on compiled procedure (no mapper)', () => {
      const proc = procedure()
        .emits(OrderCreated)
        .query(async () => ({ orderId: 'o1', total: 50 }));

      expect(proc.emittedEvents).toBeDefined();
      expect(proc.emittedEvents).toHaveLength(1);
      expect(proc.emittedEvents![0].eventClass).toBe(OrderCreated);
      expect(proc.emittedEvents![0].mapper).toBeUndefined();
    });

    it('should store event with mapper', () => {
      const mapper = (result: { id: string; amount: number }) => ({
        orderId: result.id,
        total: result.amount,
      });

      const proc = procedure()
        .emits(OrderCreated, mapper)
        .query(async () => ({ id: 'o1', amount: 100 }));

      expect(proc.emittedEvents).toBeDefined();
      expect(proc.emittedEvents).toHaveLength(1);
      expect(proc.emittedEvents![0].eventClass).toBe(OrderCreated);
      expect(proc.emittedEvents![0].mapper).toBe(mapper);
    });

    it('should accumulate multiple .emits() calls', () => {
      const proc = procedure()
        .emits(OrderCreated)
        .emits(InventoryReserved, () => ({ sku: 'ABC', quantity: 1 }))
        .emits(AuditLogWritten)
        .mutation(async () => ({ action: 'created' }));

      expect(proc.emittedEvents).toBeDefined();
      expect(proc.emittedEvents).toHaveLength(3);
      expect(proc.emittedEvents![0].eventClass).toBe(OrderCreated);
      expect(proc.emittedEvents![1].eventClass).toBe(InventoryReserved);
      expect(proc.emittedEvents![2].eventClass).toBe(AuditLogWritten);
    });

    it('should have undefined emittedEvents when .emits() is not used', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .query(async () => ({ ok: true }));

      expect(proc.emittedEvents).toBeUndefined();
    });

    it('should be chainable with other builder methods', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ orderId: z.string(), total: z.number() }))
        .emits(OrderCreated)
        .rest({ method: 'POST', path: '/custom' })
        .mutation(async () => ({ orderId: 'o1', total: 50 }));

      expect(proc.emittedEvents).toHaveLength(1);
      expect(proc.emittedEvents![0].eventClass).toBe(OrderCreated);
      expect(proc.inputSchema).toBeDefined();
      expect(proc.outputSchema).toBeDefined();
      expect(proc.restOverride).toEqual({ method: 'POST', path: '/custom' });
      expect(proc.type).toBe('mutation');
    });
  });

  describe('executeProcedure event emission', () => {
    it('should emit event after successful handler execution', async () => {
      const emitSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .emits(OrderCreated)
        .mutation(async () => ({ orderId: 'o1', total: 99.99 }));

      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ orderId: 'o1', total: 99.99 });
      expect(emitSpy).toHaveBeenCalledTimes(1);

      // Verify the emitted event is an instance of OrderCreated
      const emittedEvent = emitSpy.mock.calls[0][0];
      expect(emittedEvent).toBeInstanceOf(OrderCreated);
      expect(emittedEvent.data).toEqual({ orderId: 'o1', total: 99.99 });
    });

    it('should use mapper to transform result to event data', async () => {
      const emitSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .emits(OrderCreated, (result: { id: string; amount: number }) => ({
          orderId: result.id,
          total: result.amount,
        }))
        .mutation(async () => ({ id: 'order-123', amount: 50 }));

      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ id: 'order-123', amount: 50 });
      expect(emitSpy).toHaveBeenCalledTimes(1);

      const emittedEvent = emitSpy.mock.calls[0][0];
      expect(emittedEvent).toBeInstanceOf(OrderCreated);
      expect(emittedEvent.data).toEqual({ orderId: 'order-123', total: 50 });
    });

    it('should NOT emit events if handler throws', async () => {
      const emitSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .emits(OrderCreated)
        .mutation(async () => {
          throw new Error('Handler failed');
        });

      await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow('Handler failed');
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should catch event emission errors without failing the request', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const emitSpy = vi.fn().mockRejectedValue(new Error('Emit failed'));
      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .emits(OrderCreated)
        .mutation(async () => ({ orderId: 'o1', total: 10 }));

      const result = await executeProcedure(proc, undefined, ctx);

      // Request should succeed despite emission failure
      expect(result).toEqual({ orderId: 'o1', total: 10 });
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[@veloxts/router]',
        'Event emission error:',
        expect.objectContaining({ message: 'Emit failed' })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should work without ctx.events (no-op, no error)', async () => {
      const ctx = {} as BaseContext;

      const proc = procedure()
        .emits(OrderCreated)
        .mutation(async () => ({ orderId: 'o1', total: 10 }));

      // Should not throw
      const result = await executeProcedure(proc, undefined, ctx);
      expect(result).toEqual({ orderId: 'o1', total: 10 });
    });

    it('should emit multiple events from multiple .emits() calls', async () => {
      const emitSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = {
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .emits(OrderCreated)
        .emits(AuditLogWritten, () => ({ action: 'order_created' }))
        .mutation(async () => ({ orderId: 'o1', total: 25 }));

      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ orderId: 'o1', total: 25 });
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // First event: OrderCreated with result as data (no mapper)
      const firstEvent = emitSpy.mock.calls[0][0];
      expect(firstEvent).toBeInstanceOf(OrderCreated);
      expect(firstEvent.data).toEqual({ orderId: 'o1', total: 25 });

      // Second event: AuditLogWritten with mapped data
      const secondEvent = emitSpy.mock.calls[1][0];
      expect(secondEvent).toBeInstanceOf(AuditLogWritten);
      expect(secondEvent.data).toEqual({ action: 'order_created' });
    });

    it('should emit events AFTER transactional commit', async () => {
      const executionOrder: string[] = [];
      const emitSpy = vi.fn().mockImplementation(async () => {
        executionOrder.push('event-emitted');
      });

      const mockTxClient = {};
      const mockDb = {
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
          executionOrder.push('transaction-start');
          const res = await callback(mockTxClient);
          executionOrder.push('transaction-commit');
          return res;
        }),
      };

      const ctx = {
        db: mockDb,
        events: { emit: emitSpy },
      } as unknown as BaseContext;

      const proc = procedure()
        .transactional()
        .emits(OrderCreated)
        .mutation(async () => {
          executionOrder.push('handler');
          return { orderId: 'o1', total: 42 };
        });

      await executeProcedure(proc, undefined, ctx);

      // Events must fire AFTER transaction commit
      expect(executionOrder).toEqual([
        'transaction-start',
        'handler',
        'transaction-commit',
        'event-emitted',
      ]);
    });
  });
});
