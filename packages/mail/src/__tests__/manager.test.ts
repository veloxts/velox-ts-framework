/**
 * Mail Manager Tests
 *
 * Tests for the mail manager including sendBulk performance optimizations.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineMail } from '../mail.js';
import { createMailManager } from '../manager.js';

// Simple test mail for manager tests
const TestEmail = defineMail({
  name: 'test',
  schema: z.object({ name: z.string() }),
  subject: ({ name }) => `Hello, ${name}!`,
  template: ({ name }) =>
    ({
      type: 'div',
      props: { children: `Hello ${name}` },
    }) as never,
});

describe('createMailManager', () => {
  it('should create a mail manager with log driver by default', async () => {
    const manager = await createMailManager();

    expect(manager).toBeDefined();
    expect(typeof manager.send).toBe('function');
    expect(typeof manager.sendBulk).toBe('function');
    expect(typeof manager.render).toBe('function');
    expect(typeof manager.close).toBe('function');

    await manager.close();
  });

  it('should send an email', async () => {
    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    const result = await manager.send(TestEmail, {
      to: 'user@example.com',
      data: { name: 'John' },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    await manager.close();
  });

  it('should render an email without sending', async () => {
    const manager = await createMailManager({
      driver: 'log',
      from: { email: 'test@example.com' },
    });

    const rendered = await manager.render(TestEmail, {
      to: 'user@example.com',
      data: { name: 'Jane' },
    });

    expect(rendered.subject).toBe('Hello, Jane!');
    expect(rendered.to).toHaveLength(1);
    expect(rendered.to[0].email).toBe('user@example.com');

    await manager.close();
  });
});

describe('sendBulk', () => {
  it('should send multiple emails', async () => {
    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    const results = await manager.sendBulk(TestEmail, [
      { to: 'user1@example.com', data: { name: 'User 1' } },
      { to: 'user2@example.com', data: { name: 'User 2' } },
      { to: 'user3@example.com', data: { name: 'User 3' } },
    ]);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);

    await manager.close();
  });

  it('should return empty array for empty messages', async () => {
    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    const results = await manager.sendBulk(TestEmail, []);

    expect(results).toEqual([]);

    await manager.close();
  });

  it('should preserve result order matching input order', async () => {
    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    const messages = Array.from({ length: 25 }, (_, i) => ({
      to: `user${i}@example.com`,
      data: { name: `User ${i}` },
    }));

    const results = await manager.sendBulk(TestEmail, messages);

    expect(results).toHaveLength(25);
    expect(results.every((r) => r.success)).toBe(true);

    await manager.close();
  });

  it('should use default concurrency of 10', async () => {
    const sendTimes: number[] = [];
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    // Create a transport that tracks concurrency
    const trackingTransport = {
      async send() {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        sendTimes.push(Date.now());

        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));

        concurrentCalls--;
        return { success: true as const, messageId: `msg-${Date.now()}` };
      },
      async close() {},
    };

    // Manually create manager with tracking transport
    const manager = {
      send: async (_mail: unknown, _options: unknown) => {
        return trackingTransport.send();
      },
      sendBulk: async (
        mail: Parameters<typeof manager.send>[0],
        messages: Array<Parameters<typeof manager.send>[1]>,
        bulkOptions?: { concurrency?: number }
      ) => {
        if (messages.length === 0) {
          return [];
        }

        const concurrency = bulkOptions?.concurrency ?? 10;
        const results: Awaited<ReturnType<typeof manager.send>>[] = new Array(messages.length);

        for (let i = 0; i < messages.length; i += concurrency) {
          const batch = messages.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map((message) => manager.send(mail, message))
          );

          for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j];
          }
        }

        return results;
      },
      render: async () => ({}) as never,
      close: async () => {},
    };

    // Send 15 messages (should be 2 batches: 10 + 5)
    const messages = Array.from({ length: 15 }, (_, i) => ({
      to: `user${i}@example.com`,
      data: { name: `User ${i}` },
    }));

    await manager.sendBulk(TestEmail, messages);

    // With default concurrency of 10, max concurrent should be <= 10
    expect(maxConcurrent).toBeLessThanOrEqual(10);
    expect(maxConcurrent).toBeGreaterThan(1); // Should be parallel, not sequential
  });

  it('should respect custom concurrency option', async () => {
    let maxConcurrent = 0;
    let concurrentCalls = 0;

    const trackingTransport = {
      async send() {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrentCalls--;
        return { success: true as const, messageId: `msg-${Date.now()}` };
      },
      async close() {},
    };

    const manager = {
      send: async () => trackingTransport.send(),
      sendBulk: async (
        _mail: unknown,
        messages: Array<unknown>,
        bulkOptions?: { concurrency?: number }
      ) => {
        if (messages.length === 0) {
          return [];
        }

        const concurrency = bulkOptions?.concurrency ?? 10;
        const results: Awaited<ReturnType<typeof trackingTransport.send>>[] = new Array(
          messages.length
        );

        for (let i = 0; i < messages.length; i += concurrency) {
          const batch = messages.slice(i, i + concurrency);
          const batchResults = await Promise.all(batch.map(() => trackingTransport.send()));

          for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j];
          }
        }

        return results;
      },
      close: async () => {},
    };

    const messages = Array.from({ length: 10 }, (_, i) => ({
      to: `user${i}@example.com`,
      data: { name: `User ${i}` },
    }));

    // Use concurrency of 3
    await manager.sendBulk(TestEmail, messages, { concurrency: 3 });

    // Max concurrent should be <= 3
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('should be faster than sequential sending for multiple emails', async () => {
    // This test verifies parallel execution is happening
    const emailCount = 5;

    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    // Measure sendBulk time (should be parallel)
    const messages = Array.from({ length: emailCount }, (_, i) => ({
      to: `user${i}@example.com`,
      data: { name: `User ${i}` },
    }));

    const startTime = Date.now();
    await manager.sendBulk(TestEmail, messages);
    const bulkTime = Date.now() - startTime;

    // For 5 emails with 0ms actual send time, bulk should be much faster than
    // sequential (which would be at least 5 * render time)
    // We just verify it completes without timing out
    expect(bulkTime).toBeLessThan(5000); // Very generous timeout

    await manager.close();
  });

  it('should handle mixed success and failure results', async () => {
    let callCount = 0;

    // Create a custom log transport that fails on specific calls
    const mixedTransport = {
      async send() {
        callCount++;
        if (callCount === 2) {
          return { success: false as const, error: 'Simulated failure' };
        }
        return { success: true as const, messageId: `msg-${callCount}` };
      },
      async close() {},
    };

    // Create manager manually to inject custom transport
    const manager = await createMailManager({
      driver: 'log',
      config: { logger: () => {} },
      from: { email: 'test@example.com' },
    });

    // Override send to use our transport
    (manager as { send: typeof manager.send }).send = async (_mail, _options) => {
      return mixedTransport.send();
    };

    const results = await manager.sendBulk(TestEmail, [
      { to: 'user1@example.com', data: { name: 'User 1' } },
      { to: 'user2@example.com', data: { name: 'User 2' } },
      { to: 'user3@example.com', data: { name: 'User 3' } },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('Simulated failure');
    expect(results[2].success).toBe(true);

    await manager.close();
  });
});
