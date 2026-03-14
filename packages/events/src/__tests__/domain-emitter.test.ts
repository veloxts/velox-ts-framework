/**
 * DomainEventEmitter Tests
 *
 * Tests for the DomainEventEmitter class that dispatches typed domain events
 * to registered listeners with support for sequential and concurrent execution.
 */

import { describe, expect, it, vi } from 'vitest';

import { DomainEventEmitter } from '../domain/emitter.js';
import { DomainEvent } from '../domain/event.js';

// =============================================================================
// Concrete event classes for testing
// =============================================================================

interface OrderCreatedData {
  orderId: string;
  total: number;
}

class OrderCreatedEvent extends DomainEvent<OrderCreatedData> {}

interface UserRegisteredData {
  userId: string;
  email: string;
}

class UserRegisteredEvent extends DomainEvent<UserRegisteredData> {}

// =============================================================================
// Tests
// =============================================================================

describe('DomainEventEmitter', () => {
  describe('on() + emit()', () => {
    it('calls the handler with event data when the matching event is emitted', async () => {
      const emitter = new DomainEventEmitter();
      const handler = vi.fn();

      emitter.on(OrderCreatedEvent, handler);

      const event = new OrderCreatedEvent({ orderId: 'order-1', total: 99.99 });
      await emitter.emit(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ orderId: 'order-1', total: 99.99 });
    });

    it('passes event.data (the typed payload), not the event instance', async () => {
      const emitter = new DomainEventEmitter();
      let received: OrderCreatedData | undefined;

      emitter.on(OrderCreatedEvent, (data) => {
        received = data;
      });

      const data: OrderCreatedData = { orderId: 'order-2', total: 50 };
      const event = new OrderCreatedEvent(data);
      await emitter.emit(event);

      expect(received).toBe(data);
    });
  });

  describe('multiple listeners', () => {
    it('calls all listeners registered for the same event', async () => {
      const emitter = new DomainEventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on(OrderCreatedEvent, handler1);
      emitter.on(OrderCreatedEvent, handler2);
      emitter.on(OrderCreatedEvent, handler3);

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-3', total: 10 }));

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();
    });

    it('does NOT call listeners registered for a different event', async () => {
      const emitter = new DomainEventEmitter();
      const orderHandler = vi.fn();
      const userHandler = vi.fn();

      emitter.on(OrderCreatedEvent, orderHandler);
      emitter.on(UserRegisteredEvent, userHandler);

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-4', total: 20 }));

      expect(orderHandler).toHaveBeenCalledOnce();
      expect(userHandler).not.toHaveBeenCalled();
    });
  });

  describe('concurrent listeners (default)', () => {
    it('runs concurrent listeners in parallel — fast listener resolves before slow listener', async () => {
      const emitter = new DomainEventEmitter();
      const order: string[] = [];

      // slow listener registered first
      emitter.on(OrderCreatedEvent, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
        order.push('slow');
      });

      // fast listener registered second
      emitter.on(OrderCreatedEvent, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
        order.push('fast');
      });

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-5', total: 30 }));

      expect(order[0]).toBe('fast');
    });
  });

  describe('sequential listeners', () => {
    it('runs sequential listeners in registration order, awaiting each', async () => {
      const emitter = new DomainEventEmitter();
      const order: string[] = [];

      emitter.on(
        OrderCreatedEvent,
        async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
          order.push('first');
        },
        { sequential: true }
      );

      emitter.on(
        OrderCreatedEvent,
        async () => {
          order.push('second');
        },
        { sequential: true }
      );

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-6', total: 40 }));

      expect(order).toEqual(['first', 'second']);
    });

    it('runs sequential listeners before concurrent listeners', async () => {
      const emitter = new DomainEventEmitter();
      const order: string[] = [];

      // concurrent registered first
      emitter.on(OrderCreatedEvent, async () => {
        order.push('concurrent');
      });

      // sequential registered second
      emitter.on(
        OrderCreatedEvent,
        async () => {
          order.push('sequential');
        },
        { sequential: true }
      );

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-7', total: 50 }));

      expect(order[0]).toBe('sequential');
      expect(order).toContain('concurrent');
    });
  });

  describe('error handling', () => {
    it('catches listener errors and does not throw from emit()', async () => {
      const emitter = new DomainEventEmitter();

      emitter.on(OrderCreatedEvent, async () => {
        throw new Error('handler failed');
      });

      await expect(
        emitter.emit(new OrderCreatedEvent({ orderId: 'order-8', total: 60 }))
      ).resolves.not.toThrow();
    });

    it('catches errors from sequential listeners and continues emit without throwing', async () => {
      const emitter = new DomainEventEmitter();
      const secondHandler = vi.fn();

      emitter.on(
        OrderCreatedEvent,
        async () => {
          throw new Error('sequential handler failed');
        },
        { sequential: true }
      );

      emitter.on(OrderCreatedEvent, secondHandler);

      await expect(
        emitter.emit(new OrderCreatedEvent({ orderId: 'order-9', total: 70 }))
      ).resolves.not.toThrow();

      expect(secondHandler).toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('removes a listener so it is no longer called on emit', async () => {
      const emitter = new DomainEventEmitter();
      const handler = vi.fn();

      emitter.on(OrderCreatedEvent, handler);
      emitter.off(OrderCreatedEvent, handler);

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-10', total: 80 }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes only the specified listener and leaves others intact', async () => {
      const emitter = new DomainEventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on(OrderCreatedEvent, handler1);
      emitter.on(OrderCreatedEvent, handler2);
      emitter.off(OrderCreatedEvent, handler1);

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-11', total: 90 }));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('emit() with no listeners', () => {
    it('is a no-op and resolves without error when no listeners are registered', async () => {
      const emitter = new DomainEventEmitter();

      await expect(
        emitter.emit(new OrderCreatedEvent({ orderId: 'order-12', total: 100 }))
      ).resolves.not.toThrow();
    });

    it('is a no-op and resolves without error for an event class that had all listeners removed', async () => {
      const emitter = new DomainEventEmitter();
      const handler = vi.fn();

      emitter.on(OrderCreatedEvent, handler);
      emitter.off(OrderCreatedEvent, handler);

      await expect(
        emitter.emit(new OrderCreatedEvent({ orderId: 'order-13', total: 110 }))
      ).resolves.not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('retryable option', () => {
    it('stores retryable option without implementing retry logic', async () => {
      const emitter = new DomainEventEmitter();
      const handler = vi.fn();

      // Should not throw — retryable is a placeholder stored but not acted on
      emitter.on(OrderCreatedEvent, handler, { retryable: true });

      await emitter.emit(new OrderCreatedEvent({ orderId: 'order-14', total: 120 }));

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
