/**
 * Events Types
 *
 * Type definitions for real-time event broadcasting.
 * Uses discriminated unions for type-safe driver configuration.
 */

import type { FastifyRequest } from 'fastify';

// =============================================================================
// Channel Types
// =============================================================================

/**
 * Channel type determines access control.
 * - public: Anyone can subscribe
 * - private: Requires authentication
 * - presence: Requires authentication + tracks who's online
 */
export type ChannelType = 'public' | 'private' | 'presence';

/**
 * Channel information.
 */
export interface Channel {
  /** Channel name (e.g., "orders.123", "chat.room-1") */
  name: string;
  /** Channel type */
  type: ChannelType;
}

/**
 * Presence channel member information.
 */
export interface PresenceMember {
  /** Unique user identifier */
  id: string;
  /** Optional user info (name, avatar, etc.) */
  info?: Record<string, unknown>;
}

/**
 * Channel authorization result.
 */
export interface ChannelAuthResult {
  /** Whether access is allowed */
  authorized: boolean;
  /** For presence channels, the member info to broadcast */
  member?: PresenceMember;
  /** Optional error message if not authorized */
  error?: string;
}

/**
 * Channel authorization function.
 */
export type ChannelAuthorizer = (
  channel: Channel,
  request: FastifyRequest
) => Promise<ChannelAuthResult> | ChannelAuthResult;

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event payload structure.
 */
export interface BroadcastEvent<T = unknown> {
  /** Event name (e.g., "order.shipped", "message.created") */
  event: string;
  /** Channel to broadcast to */
  channel: string;
  /** Event data payload */
  data: T;
  /** Optional sender socket ID to exclude from broadcast */
  except?: string;
}

/**
 * Subscription to a channel.
 */
export interface Subscription {
  /** Channel being subscribed to */
  channel: string;
  /** Unique socket/connection ID */
  socketId: string;
  /** For presence channels, the member info */
  member?: PresenceMember;
}

// =============================================================================
// Connection Types
// =============================================================================

/**
 * Client connection information.
 */
export interface ClientConnection {
  /** Unique socket identifier */
  id: string;
  /** Channels this client is subscribed to */
  channels: Set<string>;
  /** Optional user info if authenticated */
  user?: Record<string, unknown>;
  /** Connection timestamp */
  connectedAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Message sent from client.
 */
export interface ClientMessage {
  /** Message type */
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'message';
  /** Channel name (for subscribe/unsubscribe) */
  channel?: string;
  /** Event name (for message) */
  event?: string;
  /** Message data */
  data?: unknown;
}

/**
 * Message sent to client.
 */
export interface ServerMessage {
  /** Message type */
  type: 'event' | 'subscription_succeeded' | 'subscription_error' | 'pong' | 'error';
  /** Channel name */
  channel?: string;
  /** Event name */
  event?: string;
  /** Message data */
  data?: unknown;
  /** Error message */
  error?: string;
}

// =============================================================================
// Driver Interface
// =============================================================================

/**
 * Broadcast driver interface.
 * All drivers must implement this interface.
 */
export interface BroadcastDriver {
  /**
   * Broadcast an event to a channel.
   */
  broadcast<T>(event: BroadcastEvent<T>): Promise<void>;

  /**
   * Get all subscribers for a channel.
   */
  getSubscribers(channel: string): Promise<string[]>;

  /**
   * Get presence members for a channel.
   */
  getPresenceMembers(channel: string): Promise<PresenceMember[]>;

  /**
   * Get connection count for a channel.
   */
  getConnectionCount(channel: string): Promise<number>;

  /**
   * Get all active channels.
   */
  getChannels(): Promise<string[]>;

  /**
   * Close the driver and clean up resources.
   */
  close(): Promise<void>;
}

// =============================================================================
// Driver Configuration (Discriminated Unions)
// =============================================================================

/**
 * Base configuration shared by all drivers.
 */
export interface EventsBaseOptions {
  /** Default channel authorizer */
  authorizer?: ChannelAuthorizer;
  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;
  /** Connection timeout in milliseconds (default: 60000) */
  connectionTimeout?: number;
}

/**
 * WebSocket driver configuration.
 */
export interface EventsWsOptions extends EventsBaseOptions {
  driver: 'ws';
  /** WebSocket path (default: "/ws") */
  path?: string;
  /** Redis URL for horizontal scaling (optional) */
  redis?: string;
  /** Maximum payload size in bytes (default: 1MB) */
  maxPayloadSize?: number;
}

/**
 * Server-Sent Events driver configuration.
 */
export interface EventsSseOptions extends EventsBaseOptions {
  driver: 'sse';
  /** SSE path (default: "/events") */
  path?: string;
  /** Heartbeat interval in milliseconds (default: 15000) */
  heartbeatInterval?: number;
  /** Retry interval sent to client in milliseconds (default: 3000) */
  retryInterval?: number;
}

/**
 * Default configuration (WebSocket).
 */
export interface EventsDefaultOptions extends EventsBaseOptions {
  driver?: undefined;
  /** WebSocket path (default: "/ws") */
  path?: string;
  /** Redis URL for horizontal scaling (optional) */
  redis?: string;
}

/**
 * Union type for all events plugin options.
 */
export type EventsPluginOptions = EventsWsOptions | EventsSseOptions | EventsDefaultOptions;

// =============================================================================
// Manager Interface
// =============================================================================

/**
 * Events manager options.
 */
export interface EventsManagerOptions extends EventsBaseOptions {
  /** The broadcast driver to use */
  driver: BroadcastDriver;
}

/**
 * Events manager interface.
 * High-level API for broadcasting events.
 */
export interface EventsManager {
  /**
   * Broadcast an event to a channel.
   *
   * @example
   * ```typescript
   * await events.broadcast('orders.123', 'order.shipped', {
   *   orderId: '123',
   *   trackingNumber: 'TRACK123',
   * });
   * ```
   */
  broadcast<T>(channel: string, event: string, data: T, except?: string): Promise<void>;

  /**
   * Broadcast an event to multiple channels.
   *
   * @example
   * ```typescript
   * await events.broadcastToMany(['users.1', 'users.2'], 'notification', {
   *   message: 'System maintenance scheduled',
   * });
   * ```
   */
  broadcastToMany<T>(channels: string[], event: string, data: T): Promise<void>;

  /**
   * Broadcast to all subscribers except the sender.
   *
   * @example
   * ```typescript
   * await events.toOthers('chat.room-1', 'message.sent', {
   *   text: 'Hello!',
   * }, senderSocketId);
   * ```
   */
  toOthers<T>(channel: string, event: string, data: T, except: string): Promise<void>;

  /**
   * Get subscriber count for a channel.
   */
  subscriberCount(channel: string): Promise<number>;

  /**
   * Get presence members for a channel.
   */
  presenceMembers(channel: string): Promise<PresenceMember[]>;

  /**
   * Check if a channel has subscribers.
   */
  hasSubscribers(channel: string): Promise<boolean>;

  /**
   * Get all active channels.
   */
  channels(): Promise<string[]>;

  /**
   * Close the manager and clean up resources.
   */
  close(): Promise<void>;
}
