/**
 * @veloxts/core - defineContextPlugin Tests
 * Tests for the context-injecting plugin helper
 */

import { describe, expect, it, vi } from 'vitest';

import { defineContextPlugin } from '../plugin.js';

describe('defineContextPlugin', () => {
  function createMockFastify() {
    const hooks: Record<string, Array<(...args: unknown[]) => Promise<void>>> = {};
    const decorations: Record<string, unknown> = {};

    return {
      decorateRequest: vi.fn((key: string, value: unknown) => {
        decorations[key] = value;
      }),
      addHook: vi.fn((hookName: string, handler: (...args: unknown[]) => Promise<void>) => {
        if (!hooks[hookName]) hooks[hookName] = [];
        hooks[hookName].push(handler);
      }),
      getHooks(name: string) {
        return hooks[name] ?? [];
      },
      getDecorations() {
        return decorations;
      },
    };
  }

  it('should create a valid VeloxPlugin', () => {
    const plugin = defineContextPlugin({
      name: '@test/analytics',
      version: '1.0.0',
      contextKey: 'analytics',
      create: () => ({ track: vi.fn() }),
    });

    expect(plugin.name).toBe('@test/analytics');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.register).toBe('function');
  });

  it('should decorate request with the context key', async () => {
    const service = { track: vi.fn() };
    const plugin = defineContextPlugin({
      name: '@test/analytics',
      version: '1.0.0',
      contextKey: 'analytics',
      create: () => service,
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    expect(fastify.decorateRequest).toHaveBeenCalledWith('analytics', undefined);
  });

  it('should set service on request via onRequest hook', async () => {
    const service = { track: vi.fn() };
    const plugin = defineContextPlugin({
      name: '@test/analytics',
      version: '1.0.0',
      contextKey: 'analytics',
      create: () => service,
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    const onRequestHooks = fastify.getHooks('onRequest');
    expect(onRequestHooks).toHaveLength(1);

    const request: Record<string, unknown> = {};
    await onRequestHooks[0](request);
    expect(request.analytics).toBe(service);
  });

  it('should call close on server shutdown', async () => {
    const closeFn = vi.fn();
    const service = { track: vi.fn() };
    const plugin = defineContextPlugin({
      name: '@test/analytics',
      version: '1.0.0',
      contextKey: 'analytics',
      create: () => service,
      close: closeFn,
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    const onCloseHooks = fastify.getHooks('onClose');
    expect(onCloseHooks).toHaveLength(1);

    await onCloseHooks[0]();
    expect(closeFn).toHaveBeenCalledWith(service);
  });

  it('should not register onClose hook when close is not provided', async () => {
    const plugin = defineContextPlugin({
      name: '@test/simple',
      version: '1.0.0',
      contextKey: 'simple',
      create: () => ({ value: 42 }),
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    const onCloseHooks = fastify.getHooks('onClose');
    expect(onCloseHooks).toHaveLength(0);
  });

  it('should support async create function', async () => {
    const service = { query: vi.fn() };
    const plugin = defineContextPlugin({
      name: '@test/db',
      version: '1.0.0',
      contextKey: 'db',
      create: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service;
      },
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    const onRequestHooks = fastify.getHooks('onRequest');
    const request: Record<string, unknown> = {};
    await onRequestHooks[0](request);
    expect(request.db).toBe(service);
  });

  it('should store service on fastify instance via symbol', async () => {
    const service = { send: vi.fn() };
    const plugin = defineContextPlugin({
      name: '@test/mailer',
      version: '1.0.0',
      contextKey: 'mail',
      create: () => service,
    });

    const fastify = createMockFastify();
    await plugin.register(fastify as never, {});

    const symbolKey = Symbol.for('@test/mailer:mail');
    const descriptor = Object.getOwnPropertyDescriptor(fastify, symbolKey);
    expect(descriptor).toBeDefined();
    expect(descriptor?.value).toBe(service);
    expect(descriptor?.writable).toBe(false);
  });
});
