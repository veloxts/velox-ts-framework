/**
 * Concurrent Access Tests
 *
 * Tests for race conditions, parallel broadcasts, and concurrent access patterns.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createManagerFromDriver } from '../manager.js';
import type { BroadcastDriver, BroadcastEvent, PresenceMember } from '../types.js';

/**
 * Create a mock broadcast driver that tracks all events.
 */
function createMockDriver(): BroadcastDriver & {
  broadcastedEvents: BroadcastEvent[];
  subscribers: Map<string, string[]>;
  presenceMembers: Map<string, PresenceMember[]>;
  broadcastDelay: number;
} {
  const broadcastedEvents: BroadcastEvent[] = [];
  const subscribers = new Map<string, string[]>();
  const presenceMembers = new Map<string, PresenceMember[]>();
  const broadcastDelay = 0;

  return {
    broadcastedEvents,
    subscribers,
    presenceMembers,
    broadcastDelay,

    async broadcast<T>(event: BroadcastEvent<T>): Promise<void> {
      if (broadcastDelay > 0) {
        await new Promise((r) => setTimeout(r, broadcastDelay));
      }
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

describe('Concurrent Access', () => {
  let mockDriver: ReturnType<typeof createMockDriver>;
  let manager: ReturnType<typeof createManagerFromDriver>;

  beforeEach(() => {
    mockDriver = createMockDriver();
    manager = createManagerFromDriver(mockDriver);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('parallel broadcast operations', () => {
    it('should handle many parallel broadcasts to same channel', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        manager.broadcast('orders.updates', 'order.created', { orderId: `order-${i}` })
      );

      await Promise.all(promises);

      expect(mockDriver.broadcastedEvents).toHaveLength(50);
      // Verify all events were broadcast to the correct channel
      mockDriver.broadcastedEvents.forEach((event) => {
        expect(event.channel).toBe('orders.updates');
        expect(event.event).toBe('order.created');
      });
    });

    it('should handle parallel broadcasts to different channels', async () => {
      const channels = ['channel-a', 'channel-b', 'channel-c', 'channel-d', 'channel-e'];
      const promises = channels.flatMap((channel) =>
        Array.from({ length: 10 }, (_, i) =>
          manager.broadcast(channel, 'test.event', { index: i, channel })
        )
      );

      await Promise.all(promises);

      expect(mockDriver.broadcastedEvents).toHaveLength(50);
      // Verify events are distributed across channels
      for (const channel of channels) {
        const channelEvents = mockDriver.broadcastedEvents.filter((e) => e.channel === channel);
        expect(channelEvents).toHaveLength(10);
      }
    });

    it('should handle concurrent broadcasts with different event types', async () => {
      const eventTypes = ['created', 'updated', 'deleted', 'archived', 'restored'];
      const promises = eventTypes.flatMap((eventType) =>
        Array.from({ length: 10 }, () =>
          manager.broadcast('resources', `resource.${eventType}`, { type: eventType })
        )
      );

      await Promise.all(promises);

      expect(mockDriver.broadcastedEvents).toHaveLength(50);
      for (const eventType of eventTypes) {
        const eventsByType = mockDriver.broadcastedEvents.filter(
          (e) => e.event === `resource.${eventType}`
        );
        expect(eventsByType).toHaveLength(10);
      }
    });

    it('should handle parallel broadcastToMany calls', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.broadcastToMany(
          [`user.${i * 3}`, `user.${i * 3 + 1}`, `user.${i * 3 + 2}`],
          'notification',
          { message: `Notification ${i}` }
        )
      );

      await Promise.all(promises);

      // 20 broadcastToMany calls × 3 channels = 60 events
      expect(mockDriver.broadcastedEvents).toHaveLength(60);
    });
  });

  describe('parallel query operations', () => {
    it('should handle parallel subscriberCount calls', async () => {
      // Setup subscribers across multiple channels
      for (let i = 0; i < 10; i++) {
        const sockets = Array.from({ length: i + 1 }, (_, j) => `socket-${i}-${j}`);
        mockDriver.subscribers.set(`channel-${i}`, sockets);
      }

      // Query all in parallel
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.subscriberCount(`channel-${i}`)
      );
      const counts = await Promise.all(promises);

      // Verify correct counts
      counts.forEach((count, i) => {
        expect(count).toBe(i + 1);
      });
    });

    it('should handle parallel hasSubscribers calls', async () => {
      mockDriver.subscribers.set('active-1', ['socket-1']);
      mockDriver.subscribers.set('active-2', ['socket-2']);
      // No subscribers for active-3

      const promises = [
        manager.hasSubscribers('active-1'),
        manager.hasSubscribers('active-2'),
        manager.hasSubscribers('active-3'),
        manager.hasSubscribers('nonexistent'),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(false);
      expect(results[3]).toBe(false);
    });

    it('should handle parallel presenceMembers calls', async () => {
      for (let i = 0; i < 5; i++) {
        const members = Array.from({ length: i + 1 }, (_, j) => ({
          id: `user-${i}-${j}`,
          info: { name: `User ${j}` },
        }));
        mockDriver.presenceMembers.set(`presence-${i}`, members);
      }

      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.presenceMembers(`presence-${i}`)
      );
      const results = await Promise.all(promises);

      results.forEach((members, i) => {
        expect(members).toHaveLength(i + 1);
      });
    });

    it('should handle parallel channels() calls', async () => {
      mockDriver.subscribers.set('ch-1', ['s1']);
      mockDriver.subscribers.set('ch-2', ['s2']);
      mockDriver.subscribers.set('ch-3', ['s3']);

      const promises = Array.from({ length: 10 }, () => manager.channels());
      const results = await Promise.all(promises);

      // All should return the same channels
      results.forEach((channels) => {
        expect(channels).toHaveLength(3);
        expect(channels).toContain('ch-1');
        expect(channels).toContain('ch-2');
        expect(channels).toContain('ch-3');
      });
    });
  });

  describe('mixed broadcast and query operations', () => {
    it('should handle interleaved broadcasts and queries', async () => {
      mockDriver.subscribers.set('chat.room', ['socket-1', 'socket-2']);

      const operations = [
        manager.broadcast('chat.room', 'message', { text: 'Hello' }),
        manager.subscriberCount('chat.room'),
        manager.broadcast('chat.room', 'typing', { user: 'alice' }),
        manager.hasSubscribers('chat.room'),
        manager.broadcast('chat.room', 'message', { text: 'World' }),
        manager.presenceMembers('chat.room'),
      ];

      const results = await Promise.all(operations);

      // Verify broadcasts completed
      expect(mockDriver.broadcastedEvents).toHaveLength(3);

      // Verify query results
      expect(results[1]).toBe(2); // subscriberCount
      expect(results[3]).toBe(true); // hasSubscribers
      expect(results[5]).toEqual([]); // presenceMembers (empty in mock)
    });
  });

  describe('broadcast exclusion under concurrency', () => {
    it('should correctly exclude sockets in parallel broadcasts', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.broadcast('room', 'event', { index: i }, `socket-${i}`)
      );

      await Promise.all(promises);

      // Verify all events have the correct except value
      mockDriver.broadcastedEvents.forEach((event) => {
        expect(event.except).toBeDefined();
      });

      // Each event should have a unique except value
      const exceptValues = mockDriver.broadcastedEvents.map((e) => e.except);
      const uniqueExcepts = new Set(exceptValues);
      expect(uniqueExcepts.size).toBe(20);
    });

    it('should handle parallel toOthers calls', async () => {
      const promises = Array.from({ length: 15 }, (_, i) =>
        manager.toOthers('typing.room', 'user.typing', { userId: `user-${i}` }, `sender-${i}`)
      );

      await Promise.all(promises);

      expect(mockDriver.broadcastedEvents).toHaveLength(15);
      mockDriver.broadcastedEvents.forEach((event) => {
        expect(event.channel).toBe('typing.room');
        expect(event.event).toBe('user.typing');
        expect(event.except).toBeDefined();
      });
    });
  });

  describe('stress tests', () => {
    it('should handle high volume of mixed operations', async () => {
      mockDriver.subscribers.set('stress.channel', ['socket-1', 'socket-2']);

      const operations: Promise<unknown>[] = [];

      // 100 broadcasts
      for (let i = 0; i < 100; i++) {
        operations.push(manager.broadcast('stress.channel', 'stress.event', { iteration: i }));
      }

      // 50 subscriber queries
      for (let i = 0; i < 50; i++) {
        operations.push(manager.subscriberCount('stress.channel'));
      }

      // 30 has subscribers checks
      for (let i = 0; i < 30; i++) {
        operations.push(manager.hasSubscribers('stress.channel'));
      }

      // 20 broadcast to many
      for (let i = 0; i < 20; i++) {
        operations.push(
          manager.broadcastToMany(['stress.1', 'stress.2'], 'batch.event', { batch: i })
        );
      }

      await Promise.all(operations);

      // 100 regular broadcasts + 20 broadcastToMany (each to 2 channels = 40)
      expect(mockDriver.broadcastedEvents).toHaveLength(140);
    });

    it('should maintain data integrity under concurrent load', async () => {
      const expectedData: Record<string, number[]> = {};

      const promises = Array.from({ length: 50 }, (_, i) => {
        const channel = `channel-${i % 5}`;
        if (!expectedData[channel]) {
          expectedData[channel] = [];
        }
        expectedData[channel].push(i);

        return manager.broadcast(channel, 'test.event', { value: i });
      });

      await Promise.all(promises);

      // Verify data integrity
      for (const channel of Object.keys(expectedData)) {
        const channelEvents = mockDriver.broadcastedEvents.filter((e) => e.channel === channel);
        const receivedValues = channelEvents
          .map((e) => (e.data as { value: number }).value)
          .sort((a, b) => a - b);
        const expectedValues = expectedData[channel].sort((a, b) => a - b);
        expect(receivedValues).toEqual(expectedValues);
      }
    });
  });

  describe('event ordering', () => {
    it('should preserve event order within same channel when serial', async () => {
      // Sequential broadcasts should maintain order
      for (let i = 0; i < 10; i++) {
        await manager.broadcast('ordered.channel', 'event', { sequence: i });
      }

      const sequences = mockDriver.broadcastedEvents.map(
        (e) => (e.data as { sequence: number }).sequence
      );
      expect(sequences).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('large payload handling', () => {
    it('should handle parallel broadcasts with large payloads', async () => {
      const largePayload = {
        data: 'X'.repeat(10000),
        nested: {
          array: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` })),
        },
      };

      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.broadcast('large.payload', 'big.event', { ...largePayload, index: i })
      );

      await Promise.all(promises);

      expect(mockDriver.broadcastedEvents).toHaveLength(20);
      mockDriver.broadcastedEvents.forEach((event) => {
        const data = event.data as typeof largePayload & { index: number };
        expect(data.data).toHaveLength(10000);
        expect(data.nested.array).toHaveLength(100);
      });
    });
  });
});
