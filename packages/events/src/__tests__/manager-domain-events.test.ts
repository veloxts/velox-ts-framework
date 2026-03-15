/**
 * Manager Domain Events Tests
 *
 * Tests that the EventsManager correctly exposes emit/on/off domain event
 * methods alongside the existing broadcast methods.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainEvent } from '../domain/event.js';
import { createManagerFromDriver } from '../manager.js';
import type { BroadcastDriver, BroadcastEvent, PresenceMember } from '../types.js';

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
// Mock driver
// =============================================================================

function createMockDriver(): BroadcastDriver & {
  broadcastedEvents: BroadcastEvent[];
  subscribers: Map<string, string[]>;
  presenceMembers: Map<string, PresenceMember[]>;
} {
  const broadcastedEvents: BroadcastEvent[] = [];
  const subscribers = new Map<string, string[]>();
  const presenceMembers = new Map<string, PresenceMember[]>();

  return {
    broadcastedEvents,
    subscribers,
    presenceMembers,

    async broadcast<T>(event: BroadcastEvent<T>): Promise<void> {
      broadcastedEvents.push(event as BroadcastEvent);
    },

    async getSubscribers(channel: string): Promise<string[]> {
      return subscribers.get(channel) ?? [];
    },

    async getPresenceMembers(channel: string): Promise<PresenceMember[]> {
      return presenceMembers.get(channel) ?? [];
    },

    async getConnectionCount(channel: string): Promise<number> {
      return subscribers.get(channel)?.length ?? 0;
    },

    async getChannels(): Promise<string[]> {
      return Array.from(subscribers.keys());
    },

    async close(): Promise<void> {
      subscribers.clear();
      presenceMembers.clear();
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('EventsManager domain events', () => {
  let mockDriver: ReturnType<typeof createMockDriver>;
  let manager: ReturnType<typeof createManagerFromDriver>;

  beforeEach(() => {
    mockDriver = createMockDriver();
    manager = createManagerFromDriver(mockDriver);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('emit()', () => {
    it('exposes emit() for domain events', () => {
      expect(typeof manager.emit).toBe('function');
    });

    it('resolves without error when no listeners are registered', async () => {
      await expect(
        manager.emit(new OrderCreatedEvent({ orderId: 'order-1', total: 99.99 }))
      ).resolves.not.toThrow();
    });
  });

  describe('on()', () => {
    it('exposes on() for domain event listeners', () => {
      expect(typeof manager.on).toBe('function');
    });

    it('registers a listener that receives event data on emit', async () => {
      const handler = vi.fn();

      manager.on(OrderCreatedEvent, handler);

      await manager.emit(new OrderCreatedEvent({ orderId: 'order-2', total: 50 }));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ orderId: 'order-2', total: 50 });
    });
  });

  describe('off()', () => {
    it('exposes off() for removing domain event listeners', () => {
      expect(typeof manager.off).toBe('function');
    });

    it('removes a listener so it is no longer called on emit', async () => {
      const handler = vi.fn();

      manager.on(OrderCreatedEvent, handler);
      manager.off(OrderCreatedEvent, handler);

      await manager.emit(new OrderCreatedEvent({ orderId: 'order-3', total: 30 }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('emit + on integration', () => {
    it('domain events work through manager with multiple listeners', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.on(OrderCreatedEvent, handler1);
      manager.on(OrderCreatedEvent, handler2);

      await manager.emit(new OrderCreatedEvent({ orderId: 'order-4', total: 100 }));

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('only calls listeners for the matching event class', async () => {
      const orderHandler = vi.fn();
      const userHandler = vi.fn();

      manager.on(OrderCreatedEvent, orderHandler);
      manager.on(UserRegisteredEvent, userHandler);

      await manager.emit(new OrderCreatedEvent({ orderId: 'order-5', total: 75 }));

      expect(orderHandler).toHaveBeenCalledOnce();
      expect(userHandler).not.toHaveBeenCalled();
    });

    it('supports listener options (sequential)', async () => {
      const order: string[] = [];

      manager.on(
        OrderCreatedEvent,
        async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
          order.push('first');
        },
        { sequential: true }
      );

      manager.on(
        OrderCreatedEvent,
        async () => {
          order.push('second');
        },
        { sequential: true }
      );

      await manager.emit(new OrderCreatedEvent({ orderId: 'order-6', total: 60 }));

      expect(order).toEqual(['first', 'second']);
    });
  });

  describe('broadcast regression', () => {
    it('existing broadcast methods still work alongside domain events', async () => {
      // Register a domain event listener
      const domainHandler = vi.fn();
      manager.on(OrderCreatedEvent, domainHandler);

      // Use broadcast (client-facing)
      await manager.broadcast('orders.123', 'order.shipped', { trackingNumber: 'TRACK123' });

      expect(mockDriver.broadcastedEvents).toHaveLength(1);
      expect(mockDriver.broadcastedEvents[0]).toEqual({
        channel: 'orders.123',
        event: 'order.shipped',
        data: { trackingNumber: 'TRACK123' },
        except: undefined,
      });

      // Domain handler should NOT have been called by broadcast
      expect(domainHandler).not.toHaveBeenCalled();

      // Now emit a domain event
      await manager.emit(new OrderCreatedEvent({ orderId: 'order-7', total: 42 }));

      // Domain handler should be called
      expect(domainHandler).toHaveBeenCalledOnce();
      expect(domainHandler).toHaveBeenCalledWith({ orderId: 'order-7', total: 42 });

      // Broadcast events should still be just 1
      expect(mockDriver.broadcastedEvents).toHaveLength(1);
    });

    it('broadcastToMany still works', async () => {
      await manager.broadcastToMany(['ch-1', 'ch-2'], 'evt', { msg: 'hi' });
      expect(mockDriver.broadcastedEvents).toHaveLength(2);
    });

    it('broadcastExcept still works', async () => {
      await manager.broadcastExcept('ch-1', 'evt', { msg: 'hi' }, 'socket-1');
      expect(mockDriver.broadcastedEvents[0]).toMatchObject({
        channel: 'ch-1',
        except: 'socket-1',
      });
    });
  });
});
