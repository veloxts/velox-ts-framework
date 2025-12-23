/**
 * Events Types Tests
 *
 * Type-level tests to ensure discriminated unions work correctly.
 */

import { describe, expect, it } from 'vitest';

import type {
  BroadcastEvent,
  Channel,
  ChannelType,
  ClientMessage,
  EventsPluginOptions,
  EventsSseOptions,
  EventsWsOptions,
  PresenceMember,
  ServerMessage,
} from '../types.js';

describe('Channel Types', () => {
  describe('ChannelType', () => {
    it('should accept valid channel types', () => {
      const publicChannel: ChannelType = 'public';
      const privateChannel: ChannelType = 'private';
      const presenceChannel: ChannelType = 'presence';

      expect(publicChannel).toBe('public');
      expect(privateChannel).toBe('private');
      expect(presenceChannel).toBe('presence');
    });
  });

  describe('Channel', () => {
    it('should represent a channel with name and type', () => {
      const channel: Channel = {
        name: 'orders.123',
        type: 'private',
      };

      expect(channel.name).toBe('orders.123');
      expect(channel.type).toBe('private');
    });
  });

  describe('PresenceMember', () => {
    it('should represent a presence member with id', () => {
      const member: PresenceMember = {
        id: 'user-123',
      };

      expect(member.id).toBe('user-123');
      expect(member.info).toBeUndefined();
    });

    it('should support optional info', () => {
      const member: PresenceMember = {
        id: 'user-123',
        info: {
          name: 'Alice',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      expect(member.info?.name).toBe('Alice');
    });
  });
});

describe('Event Types', () => {
  describe('BroadcastEvent', () => {
    it('should represent a broadcast event', () => {
      const event: BroadcastEvent<{ orderId: string }> = {
        event: 'order.shipped',
        channel: 'orders.123',
        data: { orderId: '123' },
      };

      expect(event.event).toBe('order.shipped');
      expect(event.channel).toBe('orders.123');
      expect(event.data.orderId).toBe('123');
    });

    it('should support except for excluding sockets', () => {
      const event: BroadcastEvent = {
        event: 'message',
        channel: 'chat.room',
        data: { text: 'Hello' },
        except: 'socket-123',
      };

      expect(event.except).toBe('socket-123');
    });
  });

  describe('ClientMessage', () => {
    it('should represent subscribe message', () => {
      const msg: ClientMessage = {
        type: 'subscribe',
        channel: 'orders.123',
      };

      expect(msg.type).toBe('subscribe');
      expect(msg.channel).toBe('orders.123');
    });

    it('should represent ping message', () => {
      const msg: ClientMessage = {
        type: 'ping',
      };

      expect(msg.type).toBe('ping');
    });
  });

  describe('ServerMessage', () => {
    it('should represent event message', () => {
      const msg: ServerMessage = {
        type: 'event',
        channel: 'orders.123',
        event: 'order.shipped',
        data: { tracking: 'TRACK123' },
      };

      expect(msg.type).toBe('event');
    });

    it('should represent error message', () => {
      const msg: ServerMessage = {
        type: 'error',
        error: 'Invalid channel',
      };

      expect(msg.type).toBe('error');
      expect(msg.error).toBe('Invalid channel');
    });
  });
});

describe('Driver Configuration (Discriminated Unions)', () => {
  describe('EventsWsOptions', () => {
    it('should require driver: ws', () => {
      const options: EventsWsOptions = {
        driver: 'ws',
        path: '/ws',
        redis: 'redis://localhost:6379',
        maxPayloadSize: 1024 * 1024,
      };

      expect(options.driver).toBe('ws');
      expect(options.path).toBe('/ws');
      expect(options.redis).toBe('redis://localhost:6379');
    });
  });

  describe('EventsSseOptions', () => {
    it('should require driver: sse', () => {
      const options: EventsSseOptions = {
        driver: 'sse',
        path: '/events',
        heartbeatInterval: 15000,
        retryInterval: 3000,
      };

      expect(options.driver).toBe('sse');
      expect(options.path).toBe('/events');
      expect(options.heartbeatInterval).toBe(15000);
    });
  });

  describe('EventsPluginOptions', () => {
    it('should accept ws driver options', () => {
      const options: EventsPluginOptions = {
        driver: 'ws',
        path: '/ws',
        redis: 'redis://localhost:6379',
      };

      expect(options.driver).toBe('ws');
      if (options.driver === 'ws') {
        expect(options.redis).toBe('redis://localhost:6379');
      }
    });

    it('should accept sse driver options', () => {
      const options: EventsPluginOptions = {
        driver: 'sse',
        path: '/events',
        heartbeatInterval: 15000,
      };

      expect(options.driver).toBe('sse');
      if (options.driver === 'sse') {
        expect(options.heartbeatInterval).toBe(15000);
      }
    });

    it('should accept default options (no driver)', () => {
      const options: EventsPluginOptions = {
        path: '/ws',
        pingInterval: 30000,
      };

      expect(options.driver).toBeUndefined();
    });
  });
});
