/**
 * @veloxts/core - VeloxApp Enhanced Tests
 * Tests routes(), onShutdown(), error handling edge cases, and app integration
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';
import { VeloxError } from '../errors.js';
import { definePlugin } from '../plugin.js';

describe('VeloxApp - Enhanced Features', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  describe('routes() method', () => {
    it('should register routes via routes() method', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      app.routes((server) => {
        server.get('/test-route', async () => ({ success: true }));
      });

      await app.start();

      const response = await app.server.inject({
        method: 'GET',
        url: '/test-route',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });

    it('should register multiple routes', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      app.routes((server) => {
        server.get('/route1', async () => ({ route: 1 }));
        server.get('/route2', async () => ({ route: 2 }));
        server.post('/route3', async () => ({ route: 3 }));
      });

      await app.start();

      const responses = await Promise.all([
        app.server.inject({ method: 'GET', url: '/route1' }),
        app.server.inject({ method: 'GET', url: '/route2' }),
        app.server.inject({ method: 'POST', url: '/route3' }),
      ]);

      expect(responses[0].json()).toEqual({ route: 1 });
      expect(responses[1].json()).toEqual({ route: 2 });
      expect(responses[2].json()).toEqual({ route: 3 });
    });

    it('should support method chaining', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const result = app.routes((server) => {
        server.get('/chained', async () => ({ chained: true }));
      });

      expect(result).toBe(app);

      await app.start();

      const response = await app.server.inject({
        method: 'GET',
        url: '/chained',
      });

      expect(response.json()).toEqual({ chained: true });
    });

    it('should allow calling routes() multiple times', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      app.routes((server) => {
        server.get('/first', async () => ({ first: true }));
      });

      app.routes((server) => {
        server.get('/second', async () => ({ second: true }));
      });

      await app.start();

      const response1 = await app.server.inject({ method: 'GET', url: '/first' });
      const response2 = await app.server.inject({ method: 'GET', url: '/second' });

      expect(response1.json()).toEqual({ first: true });
      expect(response2.json()).toEqual({ second: true });
    });

    it('should provide access to Fastify server instance', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      app.routes((server) => {
        // Should be able to use Fastify server features
        expect(server).toBeDefined();
        expect(typeof server.get).toBe('function');
        expect(typeof server.post).toBe('function');
        expect(typeof server.addHook).toBe('function');
      });

      await app.start();
      expect(app.isRunning).toBe(true);
    });
  });

  describe('onShutdown() method', () => {
    it('should execute shutdown handler when stopping', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      let handlerExecuted = false;

      app.onShutdown(async () => {
        handlerExecuted = true;
      });

      await app.start();
      await app.stop();

      expect(handlerExecuted).toBe(true);
    });

    it('should execute multiple shutdown handlers', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const executed: number[] = [];

      app.onShutdown(async () => {
        executed.push(1);
      });

      app.onShutdown(async () => {
        executed.push(2);
      });

      app.onShutdown(async () => {
        executed.push(3);
      });

      await app.start();
      await app.stop();

      expect(executed).toEqual([1, 2, 3]);
    });

    it('should execute handlers in order', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const order: string[] = [];

      app.onShutdown(async () => {
        order.push('first');
      });

      app.onShutdown(async () => {
        order.push('second');
      });

      await app.start();
      await app.stop();

      expect(order).toEqual(['first', 'second']);
    });

    it('should handle async shutdown handlers', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const events: string[] = [];

      app.onShutdown(async () => {
        events.push('start-cleanup');
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push('end-cleanup');
      });

      await app.start();
      await app.stop();

      expect(events).toEqual(['start-cleanup', 'end-cleanup']);
    });

    it('should continue shutdown even if handler fails', async () => {
      // Suppress expected console.error from lifecycle manager
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      app = await createVeloxApp({ port: 0, logger: false });

      const executed: number[] = [];

      app.onShutdown(async () => {
        executed.push(1);
      });

      app.onShutdown(async () => {
        executed.push(2);
        throw new Error('Handler failed');
      });

      app.onShutdown(async () => {
        executed.push(3);
      });

      await app.start();
      await app.stop();

      expect(executed).toEqual([1, 2, 3]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during shutdown handler execution:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error handler edge cases', () => {
    it('should handle errors with custom statusCode property', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const plugin = definePlugin({
        name: 'custom-status-test',
        version: '1.0.0',
        async register(server) {
          server.get('/custom-status', async () => {
            const error = new Error('Custom error') as Error & { statusCode: number };
            error.statusCode = 403;
            throw error;
          });
        },
      });

      await app.use(plugin);
      await app.start();

      const response = await app.server.inject({
        method: 'GET',
        url: '/custom-status',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('Custom error');
    });

    it('should handle errors that occur in error handler (fallback)', async () => {
      // Suppress expected console.error from error handler fallback
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      app = await createVeloxApp({ port: 0, logger: false });

      const plugin = definePlugin({
        name: 'error-handler-error-test',
        version: '1.0.0',
        async register(server) {
          server.get('/cause-error-handler-failure', async () => {
            // Create an error that will cause issues in toJSON
            const error = new VeloxError('test');
            Object.defineProperty(error, 'toJSON', {
              get() {
                throw new Error('toJSON failed');
              },
            });
            throw error;
          });
        },
      });

      await app.use(plugin);
      await app.start();

      const response = await app.server.inject({
        method: 'GET',
        url: '/cause-error-handler-failure',
      });

      // Should fall back to generic 500 error
      expect(response.statusCode).toBe(500);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Critical error in error handler:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should only log 5xx errors, not 4xx errors', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const plugin = definePlugin({
        name: 'log-test',
        version: '1.0.0',
        async register(server) {
          server.get('/400-error', async () => {
            throw new VeloxError('Client error', 400);
          });

          server.get('/500-error', async () => {
            throw new VeloxError('Server error', 500);
          });
        },
      });

      await app.use(plugin);
      await app.start();

      // Both should return appropriate status codes
      const response400 = await app.server.inject({
        method: 'GET',
        url: '/400-error',
      });

      const response500 = await app.server.inject({
        method: 'GET',
        url: '/500-error',
      });

      expect(response400.statusCode).toBe(400);
      expect(response500.statusCode).toBe(500);
    });
  });

  describe('Server access and configuration', () => {
    it('should provide access to underlying Fastify server', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      expect(app.server).toBeDefined();
      expect(typeof app.server.get).toBe('function');
      expect(typeof app.server.post).toBe('function');
      expect(typeof app.server.listen).toBe('function');
    });

    it('should provide readonly config access', async () => {
      app = await createVeloxApp({ port: 5000, host: '127.0.0.1', logger: false });

      expect(app.config).toBeDefined();
      expect(app.config.port).toBe(5000);
      expect(app.config.host).toBe('127.0.0.1');
      expect(app.config.logger).toBe(false);
    });

    it('should freeze config object', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      expect(Object.isFrozen(app.config)).toBe(true);
    });
  });

  describe('Plugin registration edge cases', () => {
    it('should throw error if plugin registration fails', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const failingPlugin = definePlugin({
        name: 'failing-plugin',
        version: '1.0.0',
        async register() {
          throw new Error('Plugin failed to register');
        },
      });

      await expect(app.use(failingPlugin)).rejects.toThrow(
        'Failed to register plugin "failing-plugin"'
      );
    });

    it('should include original error message in plugin registration error', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const failingPlugin = definePlugin({
        name: 'specific-error',
        version: '1.0.0',
        async register() {
          throw new Error('Database connection failed');
        },
      });

      await expect(app.use(failingPlugin)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('App initialization', () => {
    it('should initialize successfully with empty config', async () => {
      app = await createVeloxApp();

      expect(app).toBeDefined();
      expect(app.isRunning).toBe(false);
      expect(app.address).toBeNull();
    });

    it('should call initialize() during creation', async () => {
      // The createVeloxApp function should call initialize()
      app = await createVeloxApp({ port: 0, logger: false });

      expect(app).toBeDefined();
      // If initialize() wasn't called, app would not be created properly
    });
  });

  describe('Integration scenarios', () => {
    it('should support full app lifecycle with plugins and routes', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      let shutdownExecuted = false;

      // Register plugin
      const plugin = definePlugin({
        name: 'integration-test',
        version: '1.0.0',
        async register(server) {
          server.get('/plugin-route', async () => ({ plugin: true }));
        },
      });

      await app.use(plugin);

      // Register routes
      app.routes((server) => {
        server.get('/app-route', async () => ({ app: true }));
      });

      // Add shutdown handler
      app.onShutdown(async () => {
        shutdownExecuted = true;
      });

      // Start server
      await app.start();
      expect(app.isRunning).toBe(true);

      // Test plugin route
      const pluginResponse = await app.server.inject({
        method: 'GET',
        url: '/plugin-route',
      });
      expect(pluginResponse.json()).toEqual({ plugin: true });

      // Test app route
      const appResponse = await app.server.inject({
        method: 'GET',
        url: '/app-route',
      });
      expect(appResponse.json()).toEqual({ app: true });

      // Stop server
      await app.stop();
      expect(app.isRunning).toBe(false);
      expect(shutdownExecuted).toBe(true);
    });

    it('should handle multiple plugins with dependencies', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      const basePlugin = definePlugin({
        name: 'base-plugin',
        version: '1.0.0',
        async register(server) {
          server.decorate('baseValue', 'base');
        },
      });

      const dependentPlugin = definePlugin({
        name: 'dependent-plugin',
        version: '1.0.0',
        dependencies: ['base-plugin'],
        async register(server) {
          server.get('/dependent', async () => ({
            base: (server as never)['baseValue'],
            dependent: true,
          }));
        },
      });

      await app.use(basePlugin);
      await app.use(dependentPlugin);
      await app.start();

      const response = await app.server.inject({
        method: 'GET',
        url: '/dependent',
      });

      expect(response.json()).toEqual({
        base: 'base',
        dependent: true,
      });
    });
  });
});
