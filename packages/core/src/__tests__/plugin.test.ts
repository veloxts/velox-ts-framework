/**
 * @veloxts/core - Plugin Registration Tests
 * Tests plugin registration and functionality
 */

import type { FastifyPluginAsync } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';
import type { VeloxPlugin } from '../plugin.js';
import { definePlugin } from '../plugin.js';

describe('VeloxApp - Plugin Registration', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should register a plugin before start', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'test-plugin',
      version: '1.0.0',
      async register(server) {
        server.get('/test', async () => ({ success: true }));
      },
    });

    await app.use(plugin);
    await app.start();

    // Test route exists using Fastify inject
    const response = await app.server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
  });

  it('should register multiple plugins', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin1 = definePlugin({
      name: 'plugin-1',
      version: '1.0.0',
      async register(server) {
        server.get('/plugin1', async () => ({ plugin: 1 }));
      },
    });

    const plugin2 = definePlugin({
      name: 'plugin-2',
      version: '1.0.0',
      async register(server) {
        server.get('/plugin2', async () => ({ plugin: 2 }));
      },
    });

    await app.use(plugin1);
    await app.use(plugin2);
    await app.start();

    const response1 = await app.server.inject({
      method: 'GET',
      url: '/plugin1',
    });

    const response2 = await app.server.inject({
      method: 'GET',
      url: '/plugin2',
    });

    expect(response1.json()).toEqual({ plugin: 1 });
    expect(response2.json()).toEqual({ plugin: 2 });
  });

  it('should pass options to plugin', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    interface TestPluginOptions {
      message: string;
    }

    const plugin = definePlugin<TestPluginOptions>({
      name: 'options-plugin',
      version: '1.0.0',
      async register(server, options) {
        server.get('/message', async () => ({ message: options.message }));
      },
    });

    await app.use(plugin, { message: 'Hello from plugin' });
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/message',
    });

    expect(response.json()).toEqual({ message: 'Hello from plugin' });
  });

  it('should throw error for plugin without name', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const invalidPlugin = {
      name: '',
      version: '1.0.0',
      async register() {},
    };

    await expect(app.use(invalidPlugin as unknown as VeloxPlugin)).rejects.toThrow(
      'Plugin must have a non-empty name'
    );
  });

  it('should throw error for plugin without version', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const invalidPlugin = {
      name: 'test',
      version: '',
      async register() {},
    };

    await expect(app.use(invalidPlugin as unknown as VeloxPlugin)).rejects.toThrow(
      'Plugin "test" must have a version'
    );
  });

  it('should throw error when VeloxPlugin registration fails', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const failingPlugin = definePlugin({
      name: 'failing-plugin',
      version: '1.0.0',
      async register() {
        throw new Error('Registration failed!');
      },
    });

    await expect(app.use(failingPlugin)).rejects.toThrow(
      'Failed to register plugin "failing-plugin": Registration failed!'
    );
  });

  it('should register FastifyPluginAsync directly', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const fastifyPlugin: FastifyPluginAsync = async (server) => {
      server.get('/fastify-route', async () => ({ fastify: true }));
    };

    await app.use(fastifyPlugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/fastify-route',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ fastify: true });
  });

  it('should throw error when FastifyPluginAsync registration fails', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const failingFastifyPlugin: FastifyPluginAsync = async () => {
      throw new Error('Fastify plugin error!');
    };

    await expect(app.use(failingFastifyPlugin)).rejects.toThrow(
      'Failed to register Fastify plugin: Fastify plugin error!'
    );
  });

  it('should throw error for invalid plugin type', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    // Neither a VeloxPlugin nor a FastifyPluginAsync
    const invalidPlugin = { invalid: true };

    await expect(
      app.use(invalidPlugin as unknown as VeloxPlugin)
    ).rejects.toThrow('Invalid plugin: must be a VeloxPlugin object or FastifyPluginAsync function');
  });
});
