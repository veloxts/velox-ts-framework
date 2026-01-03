/**
 * SSE Driver Integration Tests
 *
 * Tests the Server-Sent Events driver with real HTTP connections.
 * Tests actual event streaming over HTTP.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSseDriver } from '../drivers/sse.js';
import type { BroadcastDriver, ServerMessage } from '../types.js';

describe('SSE driver (integration)', () => {
  let server: FastifyInstance;
  let driver: BroadcastDriver & {
    handler: Parameters<FastifyInstance['get']>[1];
    subscribe: (connectionId: string, channel: string) => void;
    unsubscribe: (connectionId: string, channel: string) => void;
  };
  let baseUrl: string;

  beforeAll(async () => {
    // Create SSE driver
    driver = createSseDriver({
      driver: 'sse',
      path: '/events',
      heartbeatInterval: 30000, // Long heartbeat for tests
      retryInterval: 1000,
    });

    // Create Fastify server
    server = Fastify();

    // Register SSE endpoint
    server.get('/events', driver.handler);

    // Start server
    await server.listen({ port: 0 });
    const addr = server.addresses()[0];
    baseUrl = `http://localhost:${addr.port}`;
  }, 30000);

  afterAll(async () => {
    await driver.close();
    await server.close();
  });

  /**
   * Helper to create an SSE client connection.
   */
  async function createSseClient(): Promise<{
    connectionId: string;
    close: () => void;
    collectEvents: (duration: number) => Promise<ServerMessage[]>;
    waitForEvent: (eventType: string, timeout?: number) => Promise<ServerMessage>;
  }> {
    return new Promise((resolve, reject) => {
      const abortController = new AbortController();
      const events: ServerMessage[] = [];
      const eventWaiters: Map<string, (msg: ServerMessage) => void> = new Map();

      fetch(`${baseUrl}/events`, {
        headers: { Accept: 'text/event-stream' },
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            reject(new Error(`SSE connection failed: ${response.status}`));
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          // Read stream in background
          const readLoop = async () => {
            while (true) {
              try {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE messages
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const block of lines) {
                  if (!block.trim()) continue;

                  // Extract data line
                  const dataMatch = block.match(/^data: (.+)$/m);
                  if (dataMatch) {
                    try {
                      const msg = JSON.parse(dataMatch[1]) as ServerMessage;
                      events.push(msg);

                      // Check event waiters
                      const waiter = eventWaiters.get(msg.event || msg.type);
                      if (waiter) {
                        eventWaiters.delete(msg.event || msg.type);
                        waiter(msg);
                      }
                    } catch {
                      // Ignore parse errors
                    }
                  }
                }
              } catch {
                break; // Connection closed
              }
            }
          };

          readLoop();

          // Wait for connected event
          const waitForConnected = () => {
            const connectedMsg = events.find((e) => e.event === 'connected');
            if (connectedMsg) {
              resolve({
                connectionId: (connectedMsg.data as { connectionId: string }).connectionId,
                close: () => abortController.abort(),
                collectEvents: (duration: number) => {
                  return new Promise((res) => {
                    const startIdx = events.length;
                    setTimeout(() => {
                      res(events.slice(startIdx));
                    }, duration);
                  });
                },
                waitForEvent: (eventType: string, timeout = 5000) => {
                  return new Promise((res, rej) => {
                    // Check existing events
                    const existing = events.find(
                      (e) => e.event === eventType || e.type === eventType
                    );
                    if (existing) {
                      res(existing);
                      return;
                    }

                    const timer = setTimeout(
                      () => rej(new Error(`Timeout waiting for ${eventType}`)),
                      timeout
                    );
                    eventWaiters.set(eventType, (msg) => {
                      clearTimeout(timer);
                      res(msg);
                    });
                  });
                },
              });
            } else {
              setTimeout(waitForConnected, 10);
            }
          };
          waitForConnected();
        })
        .catch(reject);
    });
  }

  // ==========================================================================
  // Connection Tests
  // ==========================================================================

  it('should connect and receive connection ID', async () => {
    const client = await createSseClient();
    try {
      expect(client.connectionId).toBeTruthy();
      expect(client.connectionId).toMatch(/^sse-/);
    } finally {
      client.close();
    }
  }, 10000);

  it('should handle multiple concurrent SSE connections', async () => {
    const clients = await Promise.all([
      createSseClient(),
      createSseClient(),
      createSseClient(),
    ]);

    try {
      const ids = clients.map((c) => c.connectionId);
      expect(new Set(ids).size).toBe(3); // All unique IDs
    } finally {
      for (const c of clients) c.close();
    }
  }, 10000);

  // ==========================================================================
  // Subscription and Broadcast Tests
  // ==========================================================================

  it('should receive broadcasts after subscription', async () => {
    const client = await createSseClient();

    try {
      // Subscribe via driver API
      driver.subscribe(client.connectionId, 'sse-test-channel');

      // Wait for subscription success
      const subMsg = await client.waitForEvent('subscription_succeeded');
      expect(subMsg.channel).toBe('sse-test-channel');

      // Start collecting events
      const eventsPromise = client.collectEvents(500);

      // Broadcast
      await driver.broadcast({
        channel: 'sse-test-channel',
        event: 'test.broadcast',
        data: { message: 'Hello SSE!' },
      });

      const events = await eventsPromise;
      const testEvents = events.filter((e) => e.event === 'test.broadcast');

      expect(testEvents).toHaveLength(1);
      expect(testEvents[0].data).toEqual({ message: 'Hello SSE!' });
    } finally {
      client.close();
    }
  }, 10000);

  it('should not receive broadcasts for unsubscribed channels', async () => {
    const client = await createSseClient();

    try {
      // Subscribe to channel A
      driver.subscribe(client.connectionId, 'channel-a');
      await client.waitForEvent('subscription_succeeded');

      // Collect events
      const eventsPromise = client.collectEvents(500);

      // Broadcast to channel B (not subscribed)
      await driver.broadcast({
        channel: 'channel-b',
        event: 'hidden.event',
        data: { should: 'not receive' },
      });

      const events = await eventsPromise;
      const hiddenEvents = events.filter((e) => e.event === 'hidden.event');

      expect(hiddenEvents).toHaveLength(0);
    } finally {
      client.close();
    }
  }, 10000);

  it('should stop receiving after unsubscribe', async () => {
    const client = await createSseClient();

    try {
      // Subscribe
      driver.subscribe(client.connectionId, 'unsub-test');
      await client.waitForEvent('subscription_succeeded');

      // Unsubscribe
      driver.unsubscribe(client.connectionId, 'unsub-test');

      // Broadcast after unsubscribe
      const eventsPromise = client.collectEvents(500);

      await driver.broadcast({
        channel: 'unsub-test',
        event: 'post.unsub',
        data: { status: 'should not receive' },
      });

      const events = await eventsPromise;
      expect(events.filter((e) => e.event === 'post.unsub')).toHaveLength(0);
    } finally {
      client.close();
    }
  }, 10000);

  // ==========================================================================
  // Multi-Client Tests
  // ==========================================================================

  it('should broadcast to multiple SSE clients', async () => {
    const clients = await Promise.all([
      createSseClient(),
      createSseClient(),
      createSseClient(),
    ]);

    try {
      // Subscribe all
      for (const client of clients) {
        driver.subscribe(client.connectionId, 'multi-sse');
        await client.waitForEvent('subscription_succeeded');
      }

      // Collect from all
      const collectPromises = clients.map((c) => c.collectEvents(500));

      // Broadcast
      await driver.broadcast({
        channel: 'multi-sse',
        event: 'multi.event',
        data: { value: 123 },
      });

      const allEvents = await Promise.all(collectPromises);

      // Each client should receive the broadcast
      for (const events of allEvents) {
        const multiEvents = events.filter((e) => e.event === 'multi.event');
        expect(multiEvents).toHaveLength(1);
        expect(multiEvents[0].data).toEqual({ value: 123 });
      }
    } finally {
      for (const c of clients) c.close();
    }
  }, 15000);

  it('should exclude specific connection with except option', async () => {
    const [sender, receiver] = await Promise.all([createSseClient(), createSseClient()]);

    try {
      // Both subscribe
      driver.subscribe(sender.connectionId, 'except-sse-test');
      driver.subscribe(receiver.connectionId, 'except-sse-test');
      await Promise.all([
        sender.waitForEvent('subscription_succeeded'),
        receiver.waitForEvent('subscription_succeeded'),
      ]);

      // Collect from both
      const senderEvents = sender.collectEvents(500);
      const receiverEvents = receiver.collectEvents(500);

      // Broadcast excluding sender
      await driver.broadcast({
        channel: 'except-sse-test',
        event: 'except.test',
        data: { info: 'exclusive' },
        except: sender.connectionId,
      });

      const [senderMsgs, receiverMsgs] = await Promise.all([senderEvents, receiverEvents]);

      // Sender should NOT receive
      expect(senderMsgs.filter((e) => e.event === 'except.test')).toHaveLength(0);

      // Receiver should receive
      expect(receiverMsgs.filter((e) => e.event === 'except.test')).toHaveLength(1);
    } finally {
      sender.close();
      receiver.close();
    }
  }, 10000);

  // ==========================================================================
  // Driver API Tests
  // ==========================================================================

  it('should track subscribers correctly', async () => {
    const clients = await Promise.all([createSseClient(), createSseClient()]);

    try {
      // Subscribe both
      for (const client of clients) {
        driver.subscribe(client.connectionId, 'track-test');
        await client.waitForEvent('subscription_succeeded');
      }

      const subscribers = await driver.getSubscribers('track-test');
      const count = await driver.getConnectionCount('track-test');

      expect(subscribers).toHaveLength(2);
      expect(count).toBe(2);
      expect(subscribers).toContain(clients[0].connectionId);
      expect(subscribers).toContain(clients[1].connectionId);
    } finally {
      for (const c of clients) c.close();
    }
  }, 10000);

  it('should list channels', async () => {
    const client = await createSseClient();

    try {
      driver.subscribe(client.connectionId, 'list-sse-a');
      driver.subscribe(client.connectionId, 'list-sse-b');

      await client.waitForEvent('subscription_succeeded');

      const channels = await driver.getChannels();

      expect(channels).toContain('list-sse-a');
      expect(channels).toContain('list-sse-b');
    } finally {
      client.close();
    }
  }, 10000);

  // ==========================================================================
  // Presence Channel Tests
  // ==========================================================================

  it('should track presence members', async () => {
    const [client1, client2] = await Promise.all([createSseClient(), createSseClient()]);

    try {
      // Subscribe with presence info
      driver.subscribe(client1.connectionId, 'presence-sse-room', {
        id: 'user-1',
        info: { name: 'Alice' },
      });
      driver.subscribe(client2.connectionId, 'presence-sse-room', {
        id: 'user-2',
        info: { name: 'Bob' },
      });

      const members = await driver.getPresenceMembers('presence-sse-room');

      expect(members).toHaveLength(2);
      expect(members.map((m) => m.id).sort()).toEqual(['user-1', 'user-2']);
    } finally {
      client1.close();
      client2.close();
    }
  }, 10000);

  // ==========================================================================
  // Clean Disconnect Tests
  // ==========================================================================

  it('should clean up subscriptions on client disconnect', async () => {
    const client = await createSseClient();
    const connId = client.connectionId;

    // Subscribe
    driver.subscribe(connId, 'cleanup-test');
    await client.waitForEvent('subscription_succeeded');

    // Verify subscribed
    expect(await driver.getConnectionCount('cleanup-test')).toBe(1);

    // Close client
    client.close();

    // Wait for cleanup
    await new Promise((r) => setTimeout(r, 200));

    // Subscription should be cleaned up
    expect(await driver.getConnectionCount('cleanup-test')).toBe(0);
  }, 10000);
});
