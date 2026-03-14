/**
 * DomainEvent Base Class Tests
 *
 * Tests for the abstract DomainEvent base class used for internal
 * server-side business logic events (e.g., OrderCreated, UserRegistered).
 */

import { describe, expect, it } from 'vitest';

import { DomainEvent } from '../domain/event.js';
import type { DomainEventClass } from '../domain/event.js';

// =============================================================================
// Concrete event classes for testing
// =============================================================================

interface OrderCreatedData {
  orderId: string;
  customerId: string;
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

describe('DomainEvent', () => {
  describe('data', () => {
    it('stores typed data correctly', () => {
      const data: OrderCreatedData = {
        orderId: 'order-123',
        customerId: 'customer-456',
        total: 99.99,
      };
      const event = new OrderCreatedEvent(data);

      expect(event.data.orderId).toBe('order-123');
      expect(event.data.customerId).toBe('customer-456');
      expect(event.data.total).toBe(99.99);
    });

    it('stores the exact data reference passed to it', () => {
      const data: OrderCreatedData = {
        orderId: 'order-abc',
        customerId: 'cust-xyz',
        total: 0,
      };
      const event = new OrderCreatedEvent(data);

      expect(event.data).toBe(data);
    });
  });

  describe('timestamp', () => {
    it('sets timestamp to a Date at construction time', () => {
      const before = new Date();
      const event = new OrderCreatedEvent({
        orderId: 'order-1',
        customerId: 'cust-1',
        total: 10,
      });
      const after = new Date();

      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('creates a distinct timestamp per instance', () => {
      const data: OrderCreatedData = { orderId: 'o1', customerId: 'c1', total: 1 };
      const event1 = new OrderCreatedEvent(data);
      const event2 = new OrderCreatedEvent(data);

      // Both are valid Dates; timestamps are independent (may be equal in fast execution)
      expect(event1.timestamp).toBeInstanceOf(Date);
      expect(event2.timestamp).toBeInstanceOf(Date);
      expect(event1.timestamp.getTime()).toBeLessThanOrEqual(event2.timestamp.getTime());
    });
  });

  describe('correlationId', () => {
    it('defaults to undefined when no options are provided', () => {
      const event = new OrderCreatedEvent({
        orderId: 'order-1',
        customerId: 'cust-1',
        total: 5,
      });

      expect(event.correlationId).toBeUndefined();
    });

    it('defaults to undefined when options object is provided without correlationId', () => {
      const event = new OrderCreatedEvent(
        { orderId: 'order-2', customerId: 'cust-2', total: 5 },
        {}
      );

      expect(event.correlationId).toBeUndefined();
    });

    it('stores correlationId when provided via options', () => {
      const correlationId = 'corr-abc-123';
      const event = new OrderCreatedEvent(
        { orderId: 'order-3', customerId: 'cust-3', total: 15 },
        { correlationId }
      );

      expect(event.correlationId).toBe(correlationId);
    });
  });

  describe('static eventName', () => {
    it('returns the class name for concrete event subclasses', () => {
      expect(OrderCreatedEvent.eventName).toBe('OrderCreatedEvent');
    });

    it('returns a different name for a different event class', () => {
      expect(UserRegisteredEvent.eventName).toBe('UserRegisteredEvent');
    });

    it('each class has its own independent eventName', () => {
      expect(OrderCreatedEvent.eventName).not.toBe(UserRegisteredEvent.eventName);
    });
  });

  describe('multiple event classes', () => {
    it('instances of different event classes are independent', () => {
      const orderEvent = new OrderCreatedEvent(
        { orderId: 'o1', customerId: 'c1', total: 100 },
        { correlationId: 'corr-order' }
      );
      const userEvent = new UserRegisteredEvent(
        { userId: 'u1', email: 'user@example.com' },
        { correlationId: 'corr-user' }
      );

      expect(orderEvent.data.orderId).toBe('o1');
      expect(userEvent.data.userId).toBe('u1');
      expect(orderEvent.correlationId).toBe('corr-order');
      expect(userEvent.correlationId).toBe('corr-user');
      expect(orderEvent instanceof OrderCreatedEvent).toBe(true);
      expect(userEvent instanceof UserRegisteredEvent).toBe(true);
    });

    it('instances of different classes both extend DomainEvent', () => {
      const orderEvent = new OrderCreatedEvent({ orderId: 'o2', customerId: 'c2', total: 0 });
      const userEvent = new UserRegisteredEvent({ userId: 'u2', email: 'b@b.com' });

      expect(orderEvent instanceof DomainEvent).toBe(true);
      expect(userEvent instanceof DomainEvent).toBe(true);
    });
  });
});

describe('DomainEventClass type', () => {
  it('can be used to type a reference to a concrete event class', () => {
    const EventCtor: DomainEventClass<OrderCreatedData> = OrderCreatedEvent;
    const instance = new EventCtor(
      { orderId: 'order-type-test', customerId: 'cust-type-test', total: 42 },
      { correlationId: 'type-corr' }
    );

    expect(instance.data.orderId).toBe('order-type-test');
    expect(instance.correlationId).toBe('type-corr');
    expect(EventCtor.eventName).toBe('OrderCreatedEvent');
  });
});
