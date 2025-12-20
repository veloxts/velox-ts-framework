/**
 * @veloxts/core - Context Availability Tests
 * Tests request context availability and request-scoped isolation
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';
import { createContext, isContext, setupTestContext } from '../context.js';
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

describe('Context - Unit Tests', () => {
  describe('createContext', () => {
    it('should create a context with request and reply', () => {
      const mockRequest = { url: '/test', method: 'GET' };
      const mockReply = { status: () => {}, send: () => {} };

      const context = createContext(mockRequest as never, mockReply as never);

      expect(context).toBeDefined();
      expect(context.request).toBe(mockRequest);
      expect(context.reply).toBe(mockReply);
    });

    it('should create contexts with different request objects', () => {
      const mockRequest1 = { url: '/test1', method: 'GET' };
      const mockRequest2 = { url: '/test2', method: 'POST' };
      const mockReply = { status: () => {}, send: () => {} };

      const context1 = createContext(mockRequest1 as never, mockReply as never);
      const context2 = createContext(mockRequest2 as never, mockReply as never);

      expect(context1.request).toBe(mockRequest1);
      expect(context2.request).toBe(mockRequest2);
      expect(context1.request).not.toBe(context2.request);
    });
  });

  describe('isContext', () => {
    it('should return true for valid context objects', () => {
      const mockRequest = { url: '/test' };
      const mockReply = { status: () => {} };
      const context = createContext(mockRequest as never, mockReply as never);

      expect(isContext(context)).toBe(true);
    });

    it('should return true for objects with request and reply properties', () => {
      const obj = {
        request: { url: '/test' },
        reply: { status: () => {} },
      };

      expect(isContext(obj)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isContext(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isContext(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isContext('string')).toBe(false);
      expect(isContext(123)).toBe(false);
      expect(isContext(true)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isContext({})).toBe(false);
    });

    it('should return false for object missing request', () => {
      expect(isContext({ reply: {} })).toBe(false);
    });

    it('should return false for object missing reply', () => {
      expect(isContext({ request: {} })).toBe(false);
    });

    it('should return false for object with null request', () => {
      expect(isContext({ request: null, reply: {} })).toBe(false);
    });

    it('should return false for object with null reply', () => {
      expect(isContext({ request: {}, reply: null })).toBe(false);
    });

    it('should return false for object with non-object request', () => {
      expect(isContext({ request: 'string', reply: {} })).toBe(false);
    });

    it('should return false for object with non-object reply', () => {
      expect(isContext({ request: {}, reply: 'string' })).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isContext([])).toBe(false);
      expect(isContext([1, 2, 3])).toBe(false);
    });
  });

  describe('setupTestContext', () => {
    it('should add onRequest hook that sets up context', async () => {
      // Create a mock Fastify server
      let capturedHook: ((request: unknown, reply: unknown) => Promise<void>) | null = null;

      const mockServer = {
        addHook: (
          _hookName: string,
          handler: (request: unknown, reply: unknown) => Promise<void>
        ) => {
          capturedHook = handler;
        },
      };

      setupTestContext(mockServer as never);

      expect(capturedHook).not.toBeNull();

      // Test that the hook sets up context on the request
      const mockRequest: { context?: unknown } = {};
      const mockReply = { status: () => {} };

      await capturedHook!(mockRequest, mockReply);

      expect(mockRequest.context).toBeDefined();
      expect((mockRequest.context as { request: unknown }).request).toBe(mockRequest);
      expect((mockRequest.context as { reply: unknown }).reply).toBe(mockReply);
    });
  });
});
