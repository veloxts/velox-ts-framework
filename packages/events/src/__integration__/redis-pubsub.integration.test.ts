/**
 * Redis Pub/Sub Integration Tests for Events Package
 *
 * Tests the WebSocket driver's Redis pub/sub functionality for horizontal scaling.
 * Uses testcontainers to run a real Redis instance.
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';

import {
  isDockerAvailable,
  type RedisContainerResult,
  startRedisContainer,
} from '@veloxts/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { createWsDriver } from '../drivers/ws.js';
import type { BroadcastDriver, ServerMessage } from '../types.js';

// Type for the extended driver returned by createWsDriver
type WsDriverWithUpgrade = BroadcastDriver & {
  wss: WebSocket.Server;
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
};

// Check Docker availability at module load time
const dockerAvailable = await isDockerAvailable();

// Skip in CI environments (image pulls are slow) or if Docker is not available
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeIntegration = dockerAvailable && !isCI ? describe : describe.skip;

describeIntegration('Redis pub/sub for events (integration)', () => {
  let redis: RedisContainerResult;

  // Two separate "instances" simulating horizontal scaling
  let httpServer1: Server;
  let httpServer2: Server;
  let driver1: WsDriverWithUpgrade;
  let driver2: WsDriverWithUpgrade;
  let port1: number;
  let port2: number;

  beforeAll(async () => {
    // Start Redis container
    redis = await startRedisContainer();

    // Create two WebSocket server "instances" sharing the same Redis
    httpServer1 = createServer();
    httpServer2 = createServer();

    driver1 = await createWsDriver({
      driver: 'ws',
      path: '/ws',
      redis: redis.url,
      pingInterval: 30000,
    });

    driver2 = await createWsDriver({
      driver: 'ws',
      path: '/ws',
      redis: redis.url,
      pingInterval: 30000,
    });

    // Handle WebSocket upgrades
    httpServer1.on('upgrade', (request, socket, head) => {
      driver1.handleUpgrade(request, socket, head);
    });

    httpServer2.on('upgrade', (request, socket, head) => {
      driver2.handleUpgrade(request, socket, head);
    });

    // Start both HTTP servers
    await Promise.all([
      new Promise<void>((resolve) => {
        httpServer1.listen(0, () => {
          const addr = httpServer1.address();
          port1 = typeof addr === 'object' && addr ? addr.port : 0;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        httpServer2.listen(0, () => {
          const addr = httpServer2.address();
          port2 = typeof addr === 'object' && addr ? addr.port : 0;
          resolve();
        });
      }),
    ]);

    // Wait for Redis pub/sub subscriptions to be fully established
    await new Promise((r) => setTimeout(r, 1000));
  }, 60000); // 60s timeout for container + servers

  afterAll(async () => {
    // Clean up with try/catch to prevent test hangs on cleanup failures
    try {
      await driver1.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await driver2.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await new Promise<void>((resolve) => httpServer1.close(() => resolve()));
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await new Promise<void>((resolve) => httpServer2.close(() => resolve()));
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await redis.stop();
    } catch {
      /* ignore cleanup errors */
    }
  });

  /**
   * Helper to create a connected WebSocket client with message queue.
   * Uses the same robust pattern as ws.integration.test.ts.
   */
  async function createConnectedClient(port: number): Promise<{
    ws: WebSocket;
    socketId: string;
    close: () => void;
    subscribe: (channel: string, data?: unknown) => Promise<void>;
    waitForEvent: (eventName: string, timeout?: number) => Promise<ServerMessage>;
    collectMessages: (duration: number) => Promise<ServerMessage[]>;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
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
                  // Check if we already have the event in the queue
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
  // Cross-Instance Broadcasting via Redis
  // ==========================================================================

  describe('cross-instance broadcasting', () => {
    it('should broadcast from instance 1 to client on instance 2', async () => {
      // Connect client to instance 2
      const client = await createConnectedClient(port2);

      try {
        // Subscribe on instance 2
        await client.subscribe('cross-instance');

        // Start collecting messages
        const messagesPromise = client.collectMessages(2000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Broadcast from instance 1
        await driver1.broadcast({
          channel: 'cross-instance',
          event: 'remote.event',
          data: { from: 'instance1' },
        });

        const messages = await messagesPromise;

        // Client on instance 2 should receive the event
        const events = messages.filter((m) => m.event === 'remote.event');
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual({ from: 'instance1' });
      } finally {
        client.close();
      }
    }, 15000);

    it('should broadcast from instance 2 to client on instance 1', async () => {
      // Connect client to instance 1
      const client = await createConnectedClient(port1);

      try {
        // Subscribe on instance 1
        await client.subscribe('reverse-cross');

        // Start collecting messages
        const messagesPromise = client.collectMessages(2000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Broadcast from instance 2
        await driver2.broadcast({
          channel: 'reverse-cross',
          event: 'remote.event',
          data: { from: 'instance2' },
        });

        const messages = await messagesPromise;

        // Client on instance 1 should receive the event
        const events = messages.filter((m) => m.event === 'remote.event');
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual({ from: 'instance2' });
      } finally {
        client.close();
      }
    }, 15000);

    it('should broadcast to clients on both instances', async () => {
      // Connect clients to both instances
      const [client1, client2] = await Promise.all([
        createConnectedClient(port1),
        createConnectedClient(port2),
      ]);

      try {
        // Both subscribe to same channel
        await Promise.all([
          client1.subscribe('both-instances'),
          client2.subscribe('both-instances'),
        ]);

        // Start collecting on both
        const messages1Promise = client1.collectMessages(2000);
        const messages2Promise = client2.collectMessages(2000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Broadcast from instance 1
        await driver1.broadcast({
          channel: 'both-instances',
          event: 'global.event',
          data: { value: 42 },
        });

        const [messages1, messages2] = await Promise.all([messages1Promise, messages2Promise]);

        // Both clients should receive the event
        const events1 = messages1.filter((m) => m.event === 'global.event');
        const events2 = messages2.filter((m) => m.event === 'global.event');

        expect(events1).toHaveLength(1);
        expect(events2).toHaveLength(1);
        expect(events1[0].data).toEqual({ value: 42 });
        expect(events2[0].data).toEqual({ value: 42 });
      } finally {
        client1.close();
        client2.close();
      }
    }, 15000);
  });

  // ==========================================================================
  // Multiple Broadcasts
  // ==========================================================================

  describe('multiple broadcasts', () => {
    it('should handle rapid sequential broadcasts', async () => {
      const client = await createConnectedClient(port2);

      try {
        await client.subscribe('rapid-test');

        const messagesPromise = client.collectMessages(3000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Send 10 rapid broadcasts from instance 1
        for (let i = 0; i < 10; i++) {
          await driver1.broadcast({
            channel: 'rapid-test',
            event: 'rapid.event',
            data: { index: i },
          });
        }

        const messages = await messagesPromise;
        const events = messages.filter((m) => m.event === 'rapid.event');

        // Should receive all 10 events
        expect(events).toHaveLength(10);

        // Verify order is preserved
        const indices = events.map((e) => (e.data as { index: number }).index);
        expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      } finally {
        client.close();
      }
    }, 20000);

    it('should handle concurrent broadcasts from different instances', async () => {
      const client = await createConnectedClient(port1);

      try {
        await client.subscribe('concurrent-test');

        const messagesPromise = client.collectMessages(3000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Broadcast concurrently from both instances
        await Promise.all([
          driver1.broadcast({
            channel: 'concurrent-test',
            event: 'from.one',
            data: { source: 1 },
          }),
          driver2.broadcast({
            channel: 'concurrent-test',
            event: 'from.two',
            data: { source: 2 },
          }),
        ]);

        const messages = await messagesPromise;

        // Should receive both events
        const fromOne = messages.find((m) => m.event === 'from.one');
        const fromTwo = messages.find((m) => m.event === 'from.two');

        expect(fromOne).toBeDefined();
        expect(fromTwo).toBeDefined();
        expect(fromOne?.data).toEqual({ source: 1 });
        expect(fromTwo?.data).toEqual({ source: 2 });
      } finally {
        client.close();
      }
    }, 15000);
  });

  // ==========================================================================
  // Channel Isolation
  // ==========================================================================

  describe('channel isolation', () => {
    it('should only deliver to subscribed channels across instances', async () => {
      const [clientA, clientB] = await Promise.all([
        createConnectedClient(port1),
        createConnectedClient(port2),
      ]);

      try {
        // Client A subscribes to channel-a
        await clientA.subscribe('channel-a');
        // Client B subscribes to channel-b
        await clientB.subscribe('channel-b');

        const messagesA = clientA.collectMessages(2000);
        const messagesB = clientB.collectMessages(2000);

        // Small delay to ensure subscription is fully propagated
        await new Promise((r) => setTimeout(r, 100));

        // Broadcast to channel-a from instance 2
        await driver2.broadcast({
          channel: 'channel-a',
          event: 'test.event',
          data: { for: 'a' },
        });

        // Broadcast to channel-b from instance 1
        await driver1.broadcast({
          channel: 'channel-b',
          event: 'test.event',
          data: { for: 'b' },
        });

        const [msgsA, msgsB] = await Promise.all([messagesA, messagesB]);

        // Client A should only receive channel-a events
        const eventsA = msgsA.filter((m) => m.event === 'test.event');
        expect(eventsA).toHaveLength(1);
        expect(eventsA[0].data).toEqual({ for: 'a' });

        // Client B should only receive channel-b events
        const eventsB = msgsB.filter((m) => m.event === 'test.event');
        expect(eventsB).toHaveLength(1);
        expect(eventsB[0].data).toEqual({ for: 'b' });
      } finally {
        clientA.close();
        clientB.close();
      }
    }, 15000);
  });
});
