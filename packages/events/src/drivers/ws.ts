/**
 * WebSocket Driver
 *
 * Real-time event broadcasting using WebSocket connections.
 * Supports optional Redis pub/sub for horizontal scaling.
 */

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import type { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import type {
  BroadcastDriver,
  BroadcastEvent,
  ClientMessage,
  EventsWsOptions,
  PresenceMember,
  ServerMessage,
} from '../types.js';

/**
 * Default WebSocket driver configuration.
 */
const DEFAULT_CONFIG: Partial<EventsWsOptions> = {
  path: '/ws',
  pingInterval: 30000,
  connectionTimeout: 60000,
  maxPayloadSize: 1024 * 1024, // 1MB
};

/**
 * Extended WebSocket with connection info.
 */
interface ExtendedWebSocket extends WebSocket {
  id: string;
  isAlive: boolean;
  channels: Set<string>;
  presenceInfo: Map<string, PresenceMember>;
}

/**
 * Type-safe Redis pub/sub adapter interface.
 * Wraps ioredis clients with a clean async interface.
 */
interface RedisPubSubAdapter {
  /** Subscribe to a channel */
  subscribe(channel: string): Promise<void>;
  /** Set up a message handler */
  onMessage(handler: (channel: string, message: string) => void): void;
  /** Publish a message */
  publish(channel: string, message: string): Promise<void>;
  /** Disconnect */
  quit(): Promise<void>;
}

/**
 * Redis pub/sub connection with separate subscriber and publisher.
 */
interface RedisPubSubConnection {
  subscriber: RedisPubSubAdapter;
  publisher: RedisPubSubAdapter;
  quit: () => Promise<void>;
}

/**
 * Create a type-safe pub/sub adapter from ioredis clients.
 * This wraps the Redis clients to provide a clean async interface without type assertions.
 */
function createRedisPubSubAdapter(
  subscriberClient: Redis,
  publisherClient: Redis
): RedisPubSubConnection {
  const subscriber: RedisPubSubAdapter = {
    async subscribe(channel: string): Promise<void> {
      await subscriberClient.subscribe(channel);
    },
    onMessage(handler: (channel: string, message: string) => void): void {
      subscriberClient.on('message', handler);
    },
    async publish(): Promise<void> {
      throw new Error('Cannot publish on subscriber connection');
    },
    async quit(): Promise<void> {
      await subscriberClient.quit();
    },
  };

  const publisher: RedisPubSubAdapter = {
    async subscribe(): Promise<void> {
      throw new Error('Cannot subscribe on publisher connection');
    },
    onMessage(): void {
      throw new Error('Cannot receive messages on publisher connection');
    },
    async publish(channel: string, message: string): Promise<void> {
      await publisherClient.publish(channel, message);
    },
    async quit(): Promise<void> {
      await publisherClient.quit();
    },
  };

  return {
    subscriber,
    publisher,
    quit: async () => {
      await Promise.all([subscriber.quit(), publisher.quit()]);
    },
  };
}

/**
 * Create a WebSocket broadcast driver.
 *
 * @param config - WebSocket driver configuration
 * @returns Broadcast driver implementation
 *
 * @example
 * ```typescript
 * const driver = await createWsDriver({
 *   driver: 'ws',
 *   path: '/ws',
 *   redis: process.env.REDIS_URL, // Optional for scaling
 * });
 *
 * await driver.broadcast({
 *   channel: 'orders.123',
 *   event: 'order.shipped',
 *   data: { trackingNumber: 'TRACK123' },
 * });
 * ```
 */
export async function createWsDriver(
  config: EventsWsOptions,
  _server?: { server: unknown }
): Promise<
  BroadcastDriver & {
    wss: WebSocketServer;
    handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
  }
> {
  const options = { ...DEFAULT_CONFIG, ...config };
  const { pingInterval, maxPayloadSize, redis } = options;

  // Generate unique instance ID for filtering self-messages in Redis pub/sub
  const instanceId = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;

  // Create WebSocket server
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: maxPayloadSize,
  });

  // Connection tracking
  const connections = new Map<string, ExtendedWebSocket>();

  // Channel subscriptions: channel -> Set of socket IDs
  const channelSubscriptions = new Map<string, Set<string>>();

  // Presence data: channel -> Map of socket ID -> PresenceMember
  const presenceData = new Map<string, Map<string, PresenceMember>>();

  // Redis pub/sub for horizontal scaling
  let redisPubSub: RedisPubSubConnection | null = null;

  if (redis) {
    const { Redis: RedisClient } = await import('ioredis');
    const subscriberClient = new RedisClient(redis);
    const publisherClient = new RedisClient(redis);

    const adapter = createRedisPubSubAdapter(subscriberClient, publisherClient);

    // Subscribe to broadcast channel
    await adapter.subscriber.subscribe('velox:broadcast');

    adapter.subscriber.onMessage((_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as { __origin?: string } & BroadcastEvent;

        // Skip messages from this instance to prevent duplicates
        if (parsed.__origin === instanceId) {
          return;
        }

        // Extract the event without the origin field
        const { __origin: _, ...event } = parsed;

        // Only broadcast locally, don't re-publish
        broadcastLocal(event as BroadcastEvent);
      } catch {
        // Ignore invalid messages
      }
    });

    redisPubSub = adapter;
  }

  /**
   * Generate a unique socket ID.
   */
  function generateSocketId(): string {
    return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Maximum buffered amount before applying backpressure (64KB).
   * If the WebSocket buffer exceeds this, we skip non-critical messages.
   */
  const MAX_BUFFERED_AMOUNT = 64 * 1024;

  /**
   * Send a message to a client with backpressure handling.
   * Returns true if message was sent, false if backpressure was applied.
   */
  function send(ws: ExtendedWebSocket, message: ServerMessage): boolean {
    if (ws.readyState !== ws.OPEN) {
      return false;
    }

    // Apply backpressure: skip non-critical messages if buffer is full
    // This prevents memory buildup under high load
    if (ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      // Allow critical messages (connection, subscription, errors) through
      if (message.type === 'event' && message.event !== 'connected') {
        return false; // Drop non-critical event, client can recover
      }
    }

    ws.send(JSON.stringify(message));
    return true;
  }

  /**
   * Broadcast an event locally to connected clients.
   */
  function broadcastLocal<T>(event: BroadcastEvent<T>): void {
    const subscribers = channelSubscriptions.get(event.channel);
    if (!subscribers) return;

    const message: ServerMessage = {
      type: 'event',
      channel: event.channel,
      event: event.event,
      data: event.data,
    };

    for (const socketId of subscribers) {
      if (event.except && socketId === event.except) continue;

      const ws = connections.get(socketId);
      if (ws) {
        send(ws, message);
      }
    }
  }

  /**
   * Subscribe a client to a channel.
   */
  function subscribe(ws: ExtendedWebSocket, channel: string, member?: PresenceMember): void {
    // Add to connection's channels
    ws.channels.add(channel);

    // Add to channel subscriptions
    let subscribers = channelSubscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Set();
      channelSubscriptions.set(channel, subscribers);
    }
    subscribers.add(ws.id);

    // Handle presence channel
    if (member && channel.startsWith('presence-')) {
      let members = presenceData.get(channel);
      if (!members) {
        members = new Map();
        presenceData.set(channel, members);
      }
      members.set(ws.id, member);
      ws.presenceInfo.set(channel, member);

      // Notify others of new member
      broadcastLocal({
        channel,
        event: 'member_added',
        data: member,
        except: ws.id,
      });
    }

    // Send success message
    send(ws, {
      type: 'subscription_succeeded',
      channel,
      data:
        member && channel.startsWith('presence-')
          ? { members: Array.from(presenceData.get(channel)?.values() ?? []) }
          : undefined,
    });
  }

  /**
   * Unsubscribe a client from a channel.
   */
  function unsubscribe(ws: ExtendedWebSocket, channel: string): void {
    // Remove from connection's channels
    ws.channels.delete(channel);

    // Remove from channel subscriptions
    const subscribers = channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(ws.id);
      if (subscribers.size === 0) {
        channelSubscriptions.delete(channel);
      }
    }

    // Handle presence channel
    if (channel.startsWith('presence-')) {
      const members = presenceData.get(channel);
      if (members) {
        const member = members.get(ws.id);
        members.delete(ws.id);
        ws.presenceInfo.delete(channel);

        if (members.size === 0) {
          presenceData.delete(channel);
        }

        // Notify others of member leaving
        if (member) {
          broadcastLocal({
            channel,
            event: 'member_removed',
            data: member,
          });
        }
      }
    }
  }

  /**
   * Handle client disconnection.
   */
  function handleDisconnect(ws: ExtendedWebSocket): void {
    // Unsubscribe from all channels
    for (const channel of ws.channels) {
      unsubscribe(ws, channel);
    }

    // Remove from connections
    connections.delete(ws.id);
  }

  /**
   * Handle incoming client message.
   */
  function handleMessage(ws: ExtendedWebSocket, data: string): void {
    try {
      const message = JSON.parse(data) as ClientMessage;
      ws.isAlive = true;

      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            // For now, auto-authorize. Plugin will add proper authorization.
            subscribe(ws, message.channel, message.data as PresenceMember | undefined);
          }
          break;

        case 'unsubscribe':
          if (message.channel) {
            unsubscribe(ws, message.channel);
          }
          break;

        case 'ping':
          send(ws, { type: 'pong' });
          break;

        case 'message':
          // Client-to-server events (for presence channels mainly)
          if (message.channel && message.event) {
            broadcastLocal({
              channel: message.channel,
              event: message.event,
              data: message.data,
              except: ws.id,
            });
          }
          break;
      }
    } catch {
      send(ws, { type: 'error', error: 'Invalid message format' });
    }
  }

  // Connection handling
  wss.on('connection', (ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.id = generateSocketId();
    extWs.isAlive = true;
    extWs.channels = new Set();
    extWs.presenceInfo = new Map();

    connections.set(extWs.id, extWs);

    // Send connection info
    send(extWs, {
      type: 'event',
      event: 'connected',
      data: { socketId: extWs.id },
    });

    extWs.on('message', (data: Buffer) => {
      handleMessage(extWs, data.toString());
    });

    extWs.on('close', () => {
      handleDisconnect(extWs);
    });

    extWs.on('pong', () => {
      extWs.isAlive = true;
    });

    extWs.on('error', () => {
      handleDisconnect(extWs);
    });
  });

  // Ping interval for connection health
  const pingIntervalId = setInterval(() => {
    for (const ws of connections.values()) {
      if (!ws.isAlive) {
        ws.terminate();
        handleDisconnect(ws);
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, pingInterval);

  /**
   * Handle HTTP upgrade to WebSocket.
   *
   * @param request - The incoming HTTP request
   * @param socket - The underlying TCP socket (Duplex stream)
   * @param head - The first packet of the upgraded stream
   */
  function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }

  const driver: BroadcastDriver & { wss: WebSocketServer; handleUpgrade: typeof handleUpgrade } = {
    wss,
    handleUpgrade,

    async broadcast<T>(event: BroadcastEvent<T>): Promise<void> {
      // Broadcast locally
      broadcastLocal(event);

      // Publish to Redis for other instances
      if (redisPubSub) {
        // Include instance ID to prevent self-echo
        await redisPubSub.publisher.publish(
          'velox:broadcast',
          JSON.stringify({ ...event, __origin: instanceId })
        );
      }
    },

    async getSubscribers(channel: string): Promise<string[]> {
      const subscribers = channelSubscriptions.get(channel);
      return subscribers ? Array.from(subscribers) : [];
    },

    async getPresenceMembers(channel: string): Promise<PresenceMember[]> {
      const members = presenceData.get(channel);
      return members ? Array.from(members.values()) : [];
    },

    async getConnectionCount(channel: string): Promise<number> {
      const subscribers = channelSubscriptions.get(channel);
      return subscribers?.size ?? 0;
    },

    async getChannels(): Promise<string[]> {
      return Array.from(channelSubscriptions.keys());
    },

    async close(): Promise<void> {
      clearInterval(pingIntervalId);

      // Close all connections
      for (const ws of connections.values()) {
        ws.close(1000, 'Server shutting down');
      }
      connections.clear();
      channelSubscriptions.clear();
      presenceData.clear();

      // Close Redis connections
      if (redisPubSub) {
        await redisPubSub.quit();
      }

      // Close WebSocket server
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    },
  };

  return driver;
}

/**
 * WebSocket driver name.
 */
export const DRIVER_NAME = 'ws' as const;
