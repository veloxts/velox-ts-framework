/**
 * Events Manager Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createManagerFromDriver } from '../manager.js';
import type { BroadcastDriver, BroadcastEvent, PresenceMember } from '../types.js';

/**
 * Create a mock broadcast driver for testing.
 */
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

describe('Events Manager', () => {
  let mockDriver: ReturnType<typeof createMockDriver>;
  let manager: ReturnType<typeof createManagerFromDriver>;

  beforeEach(() => {
    mockDriver = createMockDriver();
    manager = createManagerFromDriver(mockDriver);
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('broadcast', () => {
    it('should broadcast an event to a channel', async () => {
      await manager.broadcast('orders.123', 'order.shipped', { trackingNumber: 'TRACK123' });

      expect(mockDriver.broadcastedEvents).toHaveLength(1);
      expect(mockDriver.broadcastedEvents[0]).toEqual({
        channel: 'orders.123',
        event: 'order.shipped',
        data: { trackingNumber: 'TRACK123' },
        except: undefined,
      });
    });

    it('should exclude a socket from broadcast', async () => {
      await manager.broadcast('chat.room', 'message', { text: 'Hello' }, 'socket-123');

      expect(mockDriver.broadcastedEvents[0]).toMatchObject({
        channel: 'chat.room',
        event: 'message',
        except: 'socket-123',
      });
    });
  });

  describe('broadcastToMany', () => {
    it('should broadcast to multiple channels', async () => {
      await manager.broadcastToMany(['users.1', 'users.2', 'users.3'], 'notification', {
        message: 'System update',
      });

      expect(mockDriver.broadcastedEvents).toHaveLength(3);
      expect(mockDriver.broadcastedEvents.map((e) => e.channel)).toEqual([
        'users.1',
        'users.2',
        'users.3',
      ]);
    });
  });

  describe('toOthers', () => {
    it('should broadcast to all except sender', async () => {
      await manager.toOthers('chat.room', 'typing', { userId: '456' }, 'sender-socket');

      expect(mockDriver.broadcastedEvents[0]).toMatchObject({
        channel: 'chat.room',
        event: 'typing',
        except: 'sender-socket',
      });
    });
  });

  describe('subscriberCount', () => {
    it('should return subscriber count for a channel', async () => {
      mockDriver.subscribers.set('chat.room', ['socket-1', 'socket-2', 'socket-3']);

      const count = await manager.subscriberCount('chat.room');
      expect(count).toBe(3);
    });

    it('should return 0 for empty channel', async () => {
      const count = await manager.subscriberCount('empty.channel');
      expect(count).toBe(0);
    });
  });

  describe('presenceMembers', () => {
    it('should return presence members for a channel', async () => {
      const members: PresenceMember[] = [
        { id: 'user-1', info: { name: 'Alice' } },
        { id: 'user-2', info: { name: 'Bob' } },
      ];
      mockDriver.presenceMembers.set('presence-chat', members);

      const result = await manager.presenceMembers('presence-chat');
      expect(result).toEqual(members);
    });

    it('should return empty array for non-presence channel', async () => {
      const result = await manager.presenceMembers('regular.channel');
      expect(result).toEqual([]);
    });
  });

  describe('hasSubscribers', () => {
    it('should return true if channel has subscribers', async () => {
      mockDriver.subscribers.set('active.channel', ['socket-1']);

      const result = await manager.hasSubscribers('active.channel');
      expect(result).toBe(true);
    });

    it('should return false if channel has no subscribers', async () => {
      const result = await manager.hasSubscribers('empty.channel');
      expect(result).toBe(false);
    });
  });

  describe('channels', () => {
    it('should return all active channels', async () => {
      mockDriver.subscribers.set('channel-1', ['socket-1']);
      mockDriver.subscribers.set('channel-2', ['socket-2']);
      mockDriver.subscribers.set('channel-3', ['socket-3']);

      const result = await manager.channels();
      expect(result).toEqual(['channel-1', 'channel-2', 'channel-3']);
    });

    it('should return empty array when no channels', async () => {
      const result = await manager.channels();
      expect(result).toEqual([]);
    });
  });

  describe('close', () => {
    it('should clean up driver resources', async () => {
      mockDriver.subscribers.set('channel', ['socket']);

      await manager.close();

      expect(mockDriver.subscribers.size).toBe(0);
    });
  });

  describe('driver access', () => {
    it('should expose the underlying driver', () => {
      expect(manager.driver).toBe(mockDriver);
    });
  });
});

describe('events alias', () => {
  it('should export events as alias for createEventsManager', async () => {
    const { events } = await import('../manager.js');
    const { createEventsManager } = await import('../manager.js');
    expect(events).toBe(createEventsManager);
  });
});
