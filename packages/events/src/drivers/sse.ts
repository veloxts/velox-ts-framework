/**
 * Server-Sent Events (SSE) Driver
 *
 * Fallback driver for environments without WebSocket support.
 * Uses HTTP streaming for server-to-client communication.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
  BroadcastDriver,
  BroadcastEvent,
  EventsSseOptions,
  PresenceMember,
  ServerMessage,
} from '../types.js';

/**
 * Default SSE driver configuration.
 */
const DEFAULT_CONFIG: Partial<EventsSseOptions> = {
  path: '/events',
  heartbeatInterval: 15000,
  retryInterval: 3000,
  pingInterval: 30000,
  connectionTimeout: 60000,
};

/**
 * SSE connection information.
 */
interface SseConnection {
  id: string;
  reply: FastifyReply;
  channels: Set<string>;
  presenceInfo: Map<string, PresenceMember>;
  lastActivity: Date;
}

/**
 * Create an SSE broadcast driver.
 *
 * @param config - SSE driver configuration
 * @returns Broadcast driver implementation with handler
 *
 * @example
 * ```typescript
 * const driver = createSseDriver({
 *   driver: 'sse',
 *   path: '/events',
 *   heartbeatInterval: 15000,
 * });
 *
 * // Register the SSE endpoint
 * app.get('/events', driver.handler);
 *
 * // Broadcast events
 * await driver.broadcast({
 *   channel: 'notifications',
 *   event: 'new_message',
 *   data: { text: 'Hello!' },
 * });
 * ```
 */
export function createSseDriver(config: EventsSseOptions): BroadcastDriver & {
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  subscribe: (connectionId: string, channel: string, member?: PresenceMember) => void;
  unsubscribe: (connectionId: string, channel: string) => void;
} {
  const options = { ...DEFAULT_CONFIG, ...config };
  const { heartbeatInterval, retryInterval } = options;

  // Connection tracking
  const connections = new Map<string, SseConnection>();

  // Channel subscriptions: channel -> Set of connection IDs
  const channelSubscriptions = new Map<string, Set<string>>();

  // Presence data: channel -> Map of connection ID -> PresenceMember
  const presenceData = new Map<string, Map<string, PresenceMember>>();

  /**
   * Generate a unique connection ID.
   */
  function generateConnectionId(): string {
    return `sse-${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Send an SSE message to a connection.
   */
  function send(conn: SseConnection, message: ServerMessage): void {
    try {
      const data = JSON.stringify(message);
      conn.reply.raw.write(`event: ${message.type}\n`);
      conn.reply.raw.write(`data: ${data}\n\n`);
      conn.lastActivity = new Date();
    } catch {
      // Connection may be closed, ignore
    }
  }

  /**
   * Send a heartbeat comment to keep connection alive.
   */
  function sendHeartbeat(conn: SseConnection): void {
    try {
      conn.reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      conn.lastActivity = new Date();
    } catch {
      // Connection closed, will be cleaned up
    }
  }

  /**
   * Broadcast an event to subscribers.
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

    for (const connId of subscribers) {
      if (event.except && connId === event.except) continue;

      const conn = connections.get(connId);
      if (conn) {
        send(conn, message);
      }
    }
  }

  /**
   * Subscribe a connection to a channel.
   */
  function subscribe(connectionId: string, channel: string, member?: PresenceMember): void {
    const conn = connections.get(connectionId);
    if (!conn) return;

    // Add to connection's channels
    conn.channels.add(channel);

    // Add to channel subscriptions
    let subscribers = channelSubscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Set();
      channelSubscriptions.set(channel, subscribers);
    }
    subscribers.add(connectionId);

    // Handle presence channel
    if (member && channel.startsWith('presence-')) {
      let members = presenceData.get(channel);
      if (!members) {
        members = new Map();
        presenceData.set(channel, members);
      }
      members.set(connectionId, member);
      conn.presenceInfo.set(channel, member);

      // Notify others of new member
      broadcastLocal({
        channel,
        event: 'member_added',
        data: member,
        except: connectionId,
      });
    }

    // Send success message
    send(conn, {
      type: 'subscription_succeeded',
      channel,
      data:
        member && channel.startsWith('presence-')
          ? { members: Array.from(presenceData.get(channel)?.values() ?? []) }
          : undefined,
    });
  }

  /**
   * Unsubscribe a connection from a channel.
   */
  function unsubscribe(connectionId: string, channel: string): void {
    const conn = connections.get(connectionId);
    if (!conn) return;

    // Remove from connection's channels
    conn.channels.delete(channel);

    // Remove from channel subscriptions
    const subscribers = channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        channelSubscriptions.delete(channel);
      }
    }

    // Handle presence channel
    if (channel.startsWith('presence-')) {
      const members = presenceData.get(channel);
      if (members) {
        const member = members.get(connectionId);
        members.delete(connectionId);
        conn.presenceInfo.delete(channel);

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
   * Handle connection close.
   */
  function handleDisconnect(connectionId: string): void {
    const conn = connections.get(connectionId);
    if (!conn) return;

    // Unsubscribe from all channels
    for (const channel of conn.channels) {
      unsubscribe(connectionId, channel);
    }

    // Remove from connections
    connections.delete(connectionId);
  }

  // Heartbeat interval to keep connections alive
  const heartbeatIntervalId = setInterval(() => {
    for (const conn of connections.values()) {
      sendHeartbeat(conn);
    }
  }, heartbeatInterval);

  /**
   * SSE request handler.
   */
  async function handler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const connectionId = generateConnectionId();

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send retry interval
    reply.raw.write(`retry: ${retryInterval}\n\n`);

    // Create connection
    const conn: SseConnection = {
      id: connectionId,
      reply,
      channels: new Set(),
      presenceInfo: new Map(),
      lastActivity: new Date(),
    };

    connections.set(connectionId, conn);

    // Send connection info
    send(conn, {
      type: 'event',
      event: 'connected',
      data: { connectionId },
    });

    // Handle client disconnect
    request.raw.on('close', () => {
      handleDisconnect(connectionId);
    });

    // Keep connection open
    // The reply is not ended here; SSE keeps streaming
  }

  const driver: BroadcastDriver & {
    handler: typeof handler;
    subscribe: typeof subscribe;
    unsubscribe: typeof unsubscribe;
  } = {
    handler,
    subscribe,
    unsubscribe,

    async broadcast<T>(event: BroadcastEvent<T>): Promise<void> {
      broadcastLocal(event);
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
      clearInterval(heartbeatIntervalId);

      // Close all connections
      for (const conn of connections.values()) {
        try {
          conn.reply.raw.end();
        } catch {
          // Ignore
        }
      }

      connections.clear();
      channelSubscriptions.clear();
      presenceData.clear();
    },
  };

  return driver;
}

/**
 * SSE driver name.
 */
export const DRIVER_NAME = 'sse' as const;
