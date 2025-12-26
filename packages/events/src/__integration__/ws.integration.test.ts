/**
 * WebSocket Driver Integration Tests
 *
 * Tests the WebSocket broadcast driver with real WebSocket connections.
 * Focuses on core integration functionality.
 */

import { createServer, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { createWsDriver } from '../drivers/ws.js';
import type { BroadcastDriver, ServerMessage } from '../types.js';

describe('WebSocket driver (integration)', () => {
  let httpServer: Server;
  let driver: BroadcastDriver & {
    wss: WebSocket.Server;
    handleUpgrade: (req: unknown, socket: unknown, head: Buffer) => void;
  };
  let serverPort: number;

  beforeAll(async () => {
    // Create HTTP server for WebSocket upgrade
    httpServer = createServer();

    // Create WebSocket driver
    driver = await createWsDriver({
      driver: 'ws',
      path: '/ws',
      pingInterval: 30000,
    });

    // Handle WebSocket upgrades
    httpServer.on('upgrade', (request, socket, head) => {
      driver.handleUpgrade(request, socket, head);
    });

    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    // Clean up with try/catch to prevent test hangs on cleanup failures
    try {
      await driver.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    } catch {
      /* ignore cleanup errors */
    }
  });

  /**
   * Helper to create a connected WebSocket client
   */
  async function createConnectedClient(): Promise<{
    ws: WebSocket;
    socketId: string;
    close: () => void;
    subscribe: (channel: string, data?: unknown) => Promise<void>;
    waitForEvent: (eventName: string, timeout?: number) => Promise<ServerMessage>;
    collectMessages: (duration: number) => Promise<ServerMessage[]>;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const messageQueue: ServerMessage[] = [];
      const eventWaiters: Map<string, (msg: ServerMessage) => void> = new Map();

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          messageQueue.push(msg);

          // Check for event waiters
          if (msg.event) {
            const waiter = eventWaiters.get(msg.event);
            if (waiter) {
              eventWaiters.delete(msg.event);
              waiter(msg);
            }
          }
          if (msg.type === 'subscription_succeeded') {
            const waiter = eventWaiters.get(`sub:${msg.channel}`);
            if (waiter) {
              eventWaiters.delete(`sub:${msg.channel}`);
              waiter(msg);
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('error', reject);

      ws.on('open', () => {
        // Wait for connected message
        const checkConnected = () => {
          const connectedMsg = messageQueue.find((m) => m.event === 'connected');
          if (connectedMsg) {
            resolve({
              ws,
              socketId: (connectedMsg.data as { socketId: string }).socketId,
              close: () => ws.close(),
              subscribe: (channel: string, data?: unknown) => {
                return new Promise<void>((res) => {
                  eventWaiters.set(`sub:${channel}`, () => res());
                  ws.send(JSON.stringify({ type: 'subscribe', channel, data }));
                });
              },
              waitForEvent: (eventName: string, timeout = 5000) => {
                return new Promise<ServerMessage>((res, rej) => {
                  // Check if we already have the event in the queue (prevents race condition)
                  const existing = messageQueue.find((m) => m.event === eventName);
                  if (existing) {
                    res(existing);
                    return;
                  }

                  const timer = setTimeout(
                    () => rej(new Error(`Timeout waiting for ${eventName}`)),
                    timeout
                  );
                  eventWaiters.set(eventName, (msg) => {
                    clearTimeout(timer);
                    res(msg);
                  });
                });
              },
              collectMessages: (duration: number) => {
                return new Promise((res) => {
                  const startIdx = messageQueue.length;
                  setTimeout(() => {
                    res(messageQueue.slice(startIdx));
                  }, duration);
                });
              },
            });
          } else {
            setTimeout(checkConnected, 10);
          }
        };
        checkConnected();
      });
    });
  }

  // ==========================================================================
  // Connection Tests
  // ==========================================================================

  it('should connect and receive socket ID', async () => {
    const client = await createConnectedClient();
    try {
      expect(client.socketId).toBeTruthy();
      expect(typeof client.socketId).toBe('string');
    } finally {
      client.close();
    }
  }, 10000);

  it('should handle multiple concurrent connections', async () => {
    const clients = await Promise.all([
      createConnectedClient(),
      createConnectedClient(),
      createConnectedClient(),
    ]);

    try {
      const ids = clients.map((c) => c.socketId);
      expect(new Set(ids).size).toBe(3); // All unique
    } finally {
      for (const c of clients) c.close();
    }
  }, 10000);

  // ==========================================================================
  // Channel Subscription Tests
  // ==========================================================================

  it('should subscribe to a channel and receive broadcasts', async () => {
    const client = await createConnectedClient();

    try {
      // Subscribe to channel
      await client.subscribe('test-channel');

      // Start collecting messages
      const messagesPromise = client.collectMessages(500);

      // Broadcast to channel
      await driver.broadcast({
        channel: 'test-channel',
        event: 'test.event',
        data: { message: 'Hello!' },
      });

      const messages = await messagesPromise;
      const events = messages.filter((m) => m.event === 'test.event');

      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({ message: 'Hello!' });
    } finally {
      client.close();
    }
  }, 10000);

  it('should not receive broadcasts on unsubscribed channels', async () => {
    const client = await createConnectedClient();

    try {
      // Subscribe to channel A only
      await client.subscribe('channel-a');

      // Start collecting messages
      const messagesPromise = client.collectMessages(500);

      // Broadcast to channel B (not subscribed)
      await driver.broadcast({
        channel: 'channel-b',
        event: 'test.event',
        data: { should: 'not receive' },
      });

      const messages = await messagesPromise;
      const events = messages.filter((m) => m.event === 'test.event');

      expect(events).toHaveLength(0);
    } finally {
      client.close();
    }
  }, 10000);

  // ==========================================================================
  // Multi-Client Broadcasting
  // ==========================================================================

  it('should broadcast to multiple subscribers', async () => {
    const clients = await Promise.all([
      createConnectedClient(),
      createConnectedClient(),
      createConnectedClient(),
    ]);

    try {
      // All subscribe to same channel
      await Promise.all(clients.map((c) => c.subscribe('multi-test')));

      // Start collecting on all clients
      const collectPromises = clients.map((c) => c.collectMessages(500));

      // Broadcast
      await driver.broadcast({
        channel: 'multi-test',
        event: 'broadcast.event',
        data: { value: 42 },
      });

      const allMessages = await Promise.all(collectPromises);

      // Each client should have received the broadcast
      for (const messages of allMessages) {
        const events = messages.filter((m) => m.event === 'broadcast.event');
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual({ value: 42 });
      }
    } finally {
      for (const c of clients) c.close();
    }
  }, 15000);

  it('should exclude sender with except option', async () => {
    const [sender, receiver] = await Promise.all([
      createConnectedClient(),
      createConnectedClient(),
    ]);

    try {
      // Both subscribe
      await Promise.all([sender.subscribe('except-test'), receiver.subscribe('except-test')]);

      // Collect messages from both
      const senderMessages = sender.collectMessages(500);
      const receiverMessages = receiver.collectMessages(500);

      // Broadcast excluding sender
      await driver.broadcast({
        channel: 'except-test',
        event: 'exclusive.event',
        data: { info: 'test' },
        except: sender.socketId,
      });

      const [senderMsgs, receiverMsgs] = await Promise.all([senderMessages, receiverMessages]);

      // Sender should not receive
      expect(senderMsgs.filter((m) => m.event === 'exclusive.event')).toHaveLength(0);

      // Receiver should receive
      expect(receiverMsgs.filter((m) => m.event === 'exclusive.event')).toHaveLength(1);
    } finally {
      sender.close();
      receiver.close();
    }
  }, 10000);

  // ==========================================================================
  // Driver API Tests
  // ==========================================================================

  it('should track subscribers and connection count', async () => {
    const clients = await Promise.all([createConnectedClient(), createConnectedClient()]);

    try {
      // Subscribe both
      await Promise.all(clients.map((c) => c.subscribe('api-test')));

      const subscribers = await driver.getSubscribers('api-test');
      const count = await driver.getConnectionCount('api-test');

      expect(subscribers).toHaveLength(2);
      expect(count).toBe(2);
    } finally {
      for (const c of clients) c.close();
    }
  }, 10000);

  it('should list channels', async () => {
    const client = await createConnectedClient();

    try {
      await client.subscribe('list-channel-a');
      await client.subscribe('list-channel-b');

      const channels = await driver.getChannels();

      expect(channels).toContain('list-channel-a');
      expect(channels).toContain('list-channel-b');
    } finally {
      client.close();
    }
  }, 10000);

  // ==========================================================================
  // Presence Channel Tests
  // ==========================================================================

  it('should track presence members', async () => {
    const [client1, client2] = await Promise.all([
      createConnectedClient(),
      createConnectedClient(),
    ]);

    try {
      // Subscribe with presence info
      await client1.subscribe('presence-room', { id: 'user-1', name: 'Alice' });
      await client2.subscribe('presence-room', { id: 'user-2', name: 'Bob' });

      const members = await driver.getPresenceMembers('presence-room');

      expect(members).toHaveLength(2);
      expect(members.map((m) => m.id).sort()).toEqual(['user-1', 'user-2']);
    } finally {
      client1.close();
      client2.close();
    }
  }, 10000);
});
