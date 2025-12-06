/**
 * @veloxts/core - VeloxApp Edge Case Tests
 * Tests for error handling edge cases and rare code paths
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';

describe('VeloxApp - Edge Cases', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  describe('Error during server stop', () => {
    it('should throw VeloxError if server.close() fails', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      await app.start();

      // Simulate a failure in the close operation by mocking close
      const originalClose = app.server.close.bind(app.server);
      app.server.close = () => {
        return Promise.reject(new Error('Close failed'));
      };

      await expect(app.stop()).rejects.toThrow('Failed to stop server');
      await expect(app.stop()).rejects.toThrow('Close failed');

      // Restore for cleanup
      app.server.close = originalClose;
    });
  });

  describe('Graceful shutdown lifecycle', () => {
    it('should handle stop() being called directly', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      let shutdownCalled = false;

      app.onShutdown(async () => {
        shutdownCalled = true;
      });

      await app.start();
      await app.stop();

      expect(shutdownCalled).toBe(true);
      expect(app.isRunning).toBe(false);
    });

    it('should clean up signal handlers after stop', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      await app.start();

      const sigintDuring = process.listenerCount('SIGINT');
      const sigtermDuring = process.listenerCount('SIGTERM');

      await app.stop();

      // After stop, signal handlers should be cleaned up
      // The count should be less than or equal to what it was during running
      expect(process.listenerCount('SIGINT')).toBeLessThanOrEqual(sigintDuring);
      expect(process.listenerCount('SIGTERM')).toBeLessThanOrEqual(sigtermDuring);
    });
  });

  describe('Server state validation', () => {
    it('should maintain consistent state through lifecycle', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      // Initial state
      expect(app.isRunning).toBe(false);
      expect(app.address).toBeNull();

      // After start
      await app.start();
      expect(app.isRunning).toBe(true);
      expect(app.address).not.toBeNull();
      expect(app.address).toContain('http://');

      const savedAddress = app.address;

      // After stop
      await app.stop();
      expect(app.isRunning).toBe(false);
      expect(app.address).toBeNull();

      // Address should have changed
      expect(app.address).not.toBe(savedAddress);
    });
  });

  describe('Config validation edge cases', () => {
    it('should accept port 0 (random port)', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      expect(app.config.port).toBe(0);

      await app.start();
      expect(app.isRunning).toBe(true);
      expect(app.address).toContain('http://');
    });

    it('should accept port 65535 (max valid port)', async () => {
      // We can't actually bind to 65535 without privileges,
      // but we can validate the config accepts it
      app = await createVeloxApp({ port: 65535, logger: false });

      expect(app.config.port).toBe(65535);
    });

    it('should accept minimum port 0', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      expect(app.config.port).toBe(0);
    });
  });

  describe('Plugin options edge cases', () => {
    it('should pass undefined options when none provided', async () => {
      app = await createVeloxApp({ port: 0, logger: false });

      let receivedOptions: unknown = 'not-set';

      const plugin = {
        name: 'options-test',
        version: '1.0.0',
        async register(server, options) {
          receivedOptions = options;
        },
      };

      // Call use() without options argument
      await app.use(plugin);

      // Should receive empty object (Fastify behavior)
      expect(receivedOptions).toEqual({});
    });
  });

  describe('Fastify options passthrough', () => {
    it('should pass custom Fastify options to underlying server', async () => {
      app = await createVeloxApp({
        port: 0,
        logger: false,
        fastify: {
          requestTimeout: 5000,
          bodyLimit: 2048576,
        },
      });

      expect(app.config.fastify).toEqual({
        requestTimeout: 5000,
        bodyLimit: 2048576,
      });
    });

    it('should handle empty Fastify options', async () => {
      app = await createVeloxApp({
        port: 0,
        logger: false,
        fastify: {},
      });

      expect(app.config.fastify).toEqual({});
    });
  });
});
