/**
 * @veloxts/core - Context Availability Tests
 * Tests request context availability and request-scoped isolation
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';
import { definePlugin } from '../plugin.js';

describe('VeloxApp - Context Availability', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should have context available in request handlers', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    let contextReceived = false;

    const plugin = definePlugin({
      name: 'context-test',
      version: '1.0.0',
      async register(server) {
        server.get('/test-context', async (request) => {
          contextReceived = !!request.context;
          return {
            hasContext: !!request.context,
            hasRequest: !!request.context?.request,
            hasReply: !!request.context?.reply,
          };
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/test-context',
    });

    expect(contextReceived).toBe(true);
    expect(response.json()).toEqual({
      hasContext: true,
      hasRequest: true,
      hasReply: true,
    });
  });

  it('should provide request object via context', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'request-test',
      version: '1.0.0',
      async register(server) {
        server.get('/test-request', async (request) => {
          return {
            url: request.context.request.url,
            method: request.context.request.method,
          };
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/test-request',
    });

    const data = response.json();
    expect(data.url).toBe('/test-request');
    expect(data.method).toBe('GET');
  });

  it('should provide reply object via context', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'reply-test',
      version: '1.0.0',
      async register(server) {
        server.get('/test-reply', async (request) => {
          // Use reply object from context
          request.context.reply.status(201);
          return { created: true };
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/test-reply',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ created: true });
  });

  it('should have context isolated per request', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const contextIds: string[] = [];

    const plugin = definePlugin({
      name: 'isolation-test',
      version: '1.0.0',
      async register(server) {
        server.get('/test-isolation', async (request) => {
          // Generate unique ID for this request's context
          const contextId = `${request.context.request.id}-${Date.now()}`;
          contextIds.push(contextId);
          return { contextId };
        });
      },
    });

    await app.use(plugin);
    await app.start();

    // Make multiple requests
    const response1 = await app.server.inject({
      method: 'GET',
      url: '/test-isolation',
    });

    const response2 = await app.server.inject({
      method: 'GET',
      url: '/test-isolation',
    });

    const id1 = response1.json().contextId;
    const id2 = response2.json().contextId;

    // Each request should have unique context
    expect(id1).not.toBe(id2);
    expect(contextIds).toHaveLength(2);
  });
});
