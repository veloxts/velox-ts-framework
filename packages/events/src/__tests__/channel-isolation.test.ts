/**
 * Channel Isolation Tests
 *
 * Tests for verifying events don't leak between channels
 * and that channel state is properly isolated.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createManagerFromDriver } from '../manager.js';
import type { BroadcastDriver, BroadcastEvent, PresenceMember } from '../types.js';

/**
 * Create a mock broadcast driver with channel-specific tracking.
 */
function createChannelTrackingDriver(): BroadcastDriver & {
  eventsByChannel: Map<string, BroadcastEvent[]>;
  subscribers: Map<string, string[]>;
  presenceMembers: Map<string, PresenceMember[]>;
  getAllEvents(): BroadcastEvent[];
  getEventsForChannel(channel: string): BroadcastEvent[];
} {
  const eventsByChannel = new Map<string, BroadcastEvent[]>();
  const subscribers = new Map<string, string[]>();
  const presenceMembers = new Map<string, PresenceMember[]>();

  return {
    eventsByChannel,
    subscribers,
    presenceMembers,

    getAllEvents(): BroadcastEvent[] {
      return Array.from(eventsByChannel.values()).flat();
    },

    getEventsForChannel(channel: string): BroadcastEvent[] {
      return eventsByChannel.get(channel) ?? [];
    },

    async broadcast<T>(event: BroadcastEvent<T>): Promise<void> {
      const channelEvents = eventsByChannel.get(event.channel) ?? [];
      channelEvents.push(event as BroadcastEvent);
      eventsByChannel.set(event.channel, channelEvents);
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
      eventsByChannel.clear();
      subscribers.clear();
      presenceMembers.clear();
    },
  };
}

describe('Channel Isolation', () => {
  let driver: ReturnType<typeof createChannelTrackingDriver>;
  let manager: ReturnType<typeof createManagerFromDriver>;

  beforeEach(() => {
    driver = createChannelTrackingDriver();
    manager = createManagerFromDriver(driver);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('event isolation between channels', () => {
    it('should not leak events between different channels', async () => {
      await manager.broadcast('channel-a', 'event-a', { channel: 'a' });
      await manager.broadcast('channel-b', 'event-b', { channel: 'b' });
      await manager.broadcast('channel-c', 'event-c', { channel: 'c' });

      // Verify events are properly isolated
      expect(driver.getEventsForChannel('channel-a')).toHaveLength(1);
      expect(driver.getEventsForChannel('channel-b')).toHaveLength(1);
      expect(driver.getEventsForChannel('channel-c')).toHaveLength(1);

      // Verify event data is correct for each channel
      expect(driver.getEventsForChannel('channel-a')[0].data).toEqual({ channel: 'a' });
      expect(driver.getEventsForChannel('channel-b')[0].data).toEqual({ channel: 'b' });
      expect(driver.getEventsForChannel('channel-c')[0].data).toEqual({ channel: 'c' });
    });

    it('should isolate events with similar channel names', async () => {
      await manager.broadcast('orders', 'created', { type: 'base' });
      await manager.broadcast('orders.123', 'created', { type: 'specific' });
      await manager.broadcast('orders.456', 'created', { type: 'another' });
      await manager.broadcast('order', 'created', { type: 'singular' });

      expect(driver.getEventsForChannel('orders')).toHaveLength(1);
      expect(driver.getEventsForChannel('orders.123')).toHaveLength(1);
      expect(driver.getEventsForChannel('orders.456')).toHaveLength(1);
      expect(driver.getEventsForChannel('order')).toHaveLength(1);

      // Verify no cross-contamination
      expect(driver.getEventsForChannel('orders')[0].data).toEqual({ type: 'base' });
      expect(driver.getEventsForChannel('orders.123')[0].data).toEqual({ type: 'specific' });
    });

    it('should isolate events under parallel broadcast to different channels', async () => {
      const channelData: Record<string, { channel: string; values: number[] }> = {};

      const promises = Array.from({ length: 100 }, (_, i) => {
        const channel = `channel-${i % 10}`;
        if (!channelData[channel]) {
          channelData[channel] = { channel, values: [] };
        }
        channelData[channel].values.push(i);

        return manager.broadcast(channel, 'event', { channel, value: i });
      });

      await Promise.all(promises);

      // Verify each channel received exactly its events
      for (let c = 0; c < 10; c++) {
        const channel = `channel-${c}`;
        const events = driver.getEventsForChannel(channel);
        expect(events).toHaveLength(10);

        // Verify all events in this channel have the correct channel marker
        events.forEach((event) => {
          const data = event.data as { channel: string; value: number };
          expect(data.channel).toBe(channel);
        });

        // Verify no events from other channels leaked in
        const values = events.map((e) => (e.data as { value: number }).value);
        expect(values.every((v) => v % 10 === c)).toBe(true);
      }
    });
  });

  describe('subscriber isolation', () => {
    it('should isolate subscriber counts between channels', async () => {
      driver.subscribers.set('busy-channel', ['s1', 's2', 's3', 's4', 's5']);
      driver.subscribers.set('quiet-channel', ['s6']);
      driver.subscribers.set('empty-channel', []);

      expect(await manager.subscriberCount('busy-channel')).toBe(5);
      expect(await manager.subscriberCount('quiet-channel')).toBe(1);
      expect(await manager.subscriberCount('empty-channel')).toBe(0);
      expect(await manager.subscriberCount('nonexistent')).toBe(0);
    });

    it('should isolate hasSubscribers between channels', async () => {
      driver.subscribers.set('active', ['socket']);
      driver.subscribers.set('inactive', []);

      expect(await manager.hasSubscribers('active')).toBe(true);
      expect(await manager.hasSubscribers('inactive')).toBe(false);
      expect(await manager.hasSubscribers('missing')).toBe(false);
    });

    it('should not share subscribers between similarly named channels', async () => {
      driver.subscribers.set('room', ['base-socket']);
      driver.subscribers.set('room.1', ['room-1-socket']);
      driver.subscribers.set('room.2', ['room-2-socket-a', 'room-2-socket-b']);

      expect(await manager.subscriberCount('room')).toBe(1);
      expect(await manager.subscriberCount('room.1')).toBe(1);
      expect(await manager.subscriberCount('room.2')).toBe(2);
    });
  });

  describe('presence isolation', () => {
    it('should isolate presence members between channels', async () => {
      driver.presenceMembers.set('presence-room-1', [
        { id: 'user-a', info: { name: 'Alice' } },
        { id: 'user-b', info: { name: 'Bob' } },
      ]);
      driver.presenceMembers.set('presence-room-2', [{ id: 'user-c', info: { name: 'Charlie' } }]);

      const room1Members = await manager.presenceMembers('presence-room-1');
      const room2Members = await manager.presenceMembers('presence-room-2');

      expect(room1Members).toHaveLength(2);
      expect(room2Members).toHaveLength(1);

      expect(room1Members.map((m) => m.id)).toContain('user-a');
      expect(room1Members.map((m) => m.id)).toContain('user-b');
      expect(room2Members.map((m) => m.id)).toContain('user-c');

      // Verify no cross-contamination
      expect(room1Members.map((m) => m.id)).not.toContain('user-c');
      expect(room2Members.map((m) => m.id)).not.toContain('user-a');
    });

    it('should return empty array for channels without presence', async () => {
      driver.presenceMembers.set('with-presence', [{ id: 'user', info: {} }]);

      expect(await manager.presenceMembers('with-presence')).toHaveLength(1);
      expect(await manager.presenceMembers('without-presence')).toHaveLength(0);
      expect(await manager.presenceMembers('nonexistent')).toHaveLength(0);
    });
  });

  describe('broadcastToMany isolation', () => {
    it('should broadcast to exactly the specified channels', async () => {
      const targetChannels = ['target-1', 'target-2', 'target-3'];
      await manager.broadcastToMany(targetChannels, 'notification', { important: true });

      // Verify each target channel got the event
      for (const channel of targetChannels) {
        expect(driver.getEventsForChannel(channel)).toHaveLength(1);
      }

      // Verify non-target channels didn't get events
      expect(driver.getEventsForChannel('target-4')).toHaveLength(0);
      expect(driver.getEventsForChannel('other')).toHaveLength(0);
    });

    it('should handle overlapping broadcastToMany calls correctly', async () => {
      await Promise.all([
        manager.broadcastToMany(['ch-1', 'ch-2', 'ch-3'], 'batch-1', { batch: 1 }),
        manager.broadcastToMany(['ch-2', 'ch-3', 'ch-4'], 'batch-2', { batch: 2 }),
        manager.broadcastToMany(['ch-3', 'ch-4', 'ch-5'], 'batch-3', { batch: 3 }),
      ]);

      // ch-1: 1 event, ch-2: 2 events, ch-3: 3 events, ch-4: 2 events, ch-5: 1 event
      expect(driver.getEventsForChannel('ch-1')).toHaveLength(1);
      expect(driver.getEventsForChannel('ch-2')).toHaveLength(2);
      expect(driver.getEventsForChannel('ch-3')).toHaveLength(3);
      expect(driver.getEventsForChannel('ch-4')).toHaveLength(2);
      expect(driver.getEventsForChannel('ch-5')).toHaveLength(1);
    });
  });

  describe('except parameter isolation', () => {
    it('should not affect events in other channels when using except', async () => {
      await manager.broadcast('channel-a', 'event', { data: 'a' }, 'socket-to-exclude');
      await manager.broadcast('channel-b', 'event', { data: 'b' });

      const aEvents = driver.getEventsForChannel('channel-a');
      const bEvents = driver.getEventsForChannel('channel-b');

      // 'except' on channel-a should not affect channel-b
      expect(aEvents[0].except).toBe('socket-to-exclude');
      expect(bEvents[0].except).toBeUndefined();
    });

    it('should maintain separate except values per event', async () => {
      await Promise.all([
        manager.broadcast('room', 'message', { text: '1' }, 'sender-1'),
        manager.broadcast('room', 'message', { text: '2' }, 'sender-2'),
        manager.broadcast('room', 'message', { text: '3' }, 'sender-3'),
      ]);

      const events = driver.getEventsForChannel('room');
      const excepts = events.map((e) => e.except);

      expect(excepts).toContain('sender-1');
      expect(excepts).toContain('sender-2');
      expect(excepts).toContain('sender-3');
    });
  });

  describe('channel name edge cases', () => {
    it('should treat channels with special characters as separate', async () => {
      const specialChannels = [
        'channel:with:colons',
        'channel/with/slashes',
        'channel.with.dots',
        'channel-with-dashes',
        'channel_with_underscores',
        'channel with spaces',
      ];

      await Promise.all(
        specialChannels.map((channel) => manager.broadcast(channel, 'event', { channel }))
      );

      for (const channel of specialChannels) {
        const events = driver.getEventsForChannel(channel);
        expect(events).toHaveLength(1);
        expect((events[0].data as { channel: string }).channel).toBe(channel);
      }
    });

    it('should handle empty string channel (if allowed)', async () => {
      await manager.broadcast('', 'event', { empty: true });
      await manager.broadcast('nonempty', 'event', { empty: false });

      expect(driver.getEventsForChannel('')).toHaveLength(1);
      expect(driver.getEventsForChannel('nonempty')).toHaveLength(1);
    });

    it('should differentiate channels with only case differences', async () => {
      await manager.broadcast('Channel', 'event', { case: 'capital' });
      await manager.broadcast('channel', 'event', { case: 'lower' });
      await manager.broadcast('CHANNEL', 'event', { case: 'upper' });

      expect(driver.getEventsForChannel('Channel')).toHaveLength(1);
      expect(driver.getEventsForChannel('channel')).toHaveLength(1);
      expect(driver.getEventsForChannel('CHANNEL')).toHaveLength(1);

      expect((driver.getEventsForChannel('Channel')[0].data as { case: string }).case).toBe(
        'capital'
      );
      expect((driver.getEventsForChannel('channel')[0].data as { case: string }).case).toBe(
        'lower'
      );
      expect((driver.getEventsForChannel('CHANNEL')[0].data as { case: string }).case).toBe(
        'upper'
      );
    });
  });

  describe('close behavior isolation', () => {
    it('should clear all channels on close', async () => {
      driver.subscribers.set('ch-1', ['s1']);
      driver.subscribers.set('ch-2', ['s2']);
      driver.presenceMembers.set('ch-1', [{ id: 'u1', info: {} }]);

      await manager.broadcast('ch-1', 'event', {});
      await manager.broadcast('ch-2', 'event', {});

      await manager.close();

      expect(driver.subscribers.size).toBe(0);
      expect(driver.presenceMembers.size).toBe(0);
      expect(driver.eventsByChannel.size).toBe(0);
    });
  });

  describe('multi-tenant isolation patterns', () => {
    it('should isolate events between tenant channels', async () => {
      const tenants = ['tenant-a', 'tenant-b', 'tenant-c'];

      await Promise.all(
        tenants.flatMap((tenant) => [
          manager.broadcast(`${tenant}.orders`, 'order.created', { tenant }),
          manager.broadcast(`${tenant}.users`, 'user.updated', { tenant }),
          manager.broadcast(`${tenant}.notifications`, 'alert', { tenant }),
        ])
      );

      for (const tenant of tenants) {
        // Each tenant's channels should only have their events
        const orderEvents = driver.getEventsForChannel(`${tenant}.orders`);
        const userEvents = driver.getEventsForChannel(`${tenant}.users`);
        const alertEvents = driver.getEventsForChannel(`${tenant}.notifications`);

        expect(orderEvents).toHaveLength(1);
        expect(userEvents).toHaveLength(1);
        expect(alertEvents).toHaveLength(1);

        expect((orderEvents[0].data as { tenant: string }).tenant).toBe(tenant);
        expect((userEvents[0].data as { tenant: string }).tenant).toBe(tenant);
        expect((alertEvents[0].data as { tenant: string }).tenant).toBe(tenant);
      }
    });

    it('should prevent tenant channel prefix collision', async () => {
      // These could be confused without proper isolation
      await manager.broadcast('tenant-a', 'event', { tenant: 'a' });
      await manager.broadcast('tenant-a-admin', 'event', { tenant: 'a-admin' });
      await manager.broadcast('tenant-ab', 'event', { tenant: 'ab' });

      expect(driver.getEventsForChannel('tenant-a')).toHaveLength(1);
      expect(driver.getEventsForChannel('tenant-a-admin')).toHaveLength(1);
      expect(driver.getEventsForChannel('tenant-ab')).toHaveLength(1);

      // Verify no leakage
      expect((driver.getEventsForChannel('tenant-a')[0].data as { tenant: string }).tenant).toBe(
        'a'
      );
      expect(
        (driver.getEventsForChannel('tenant-a-admin')[0].data as { tenant: string }).tenant
      ).toBe('a-admin');
    });
  });
});
