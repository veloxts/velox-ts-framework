/**
 * @veloxts/core - Configuration Tests
 * Tests application configuration acceptance and defaults
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { veloxApp } from '../app.js';

describe('VeloxApp - Configuration', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should use default configuration', async () => {
    app = await veloxApp();

    expect(app.config.port).toBe(3030);
    expect(app.config.host).toBe('0.0.0.0');
    expect(app.config.logger).toBeDefined();
  });

  it('should accept custom port', async () => {
    app = await veloxApp({ port: 4000, logger: false });

    expect(app.config.port).toBe(4000);
  });

  it('should accept custom host', async () => {
    app = await veloxApp({ host: '127.0.0.1', logger: false });

    expect(app.config.host).toBe('127.0.0.1');
  });

  it('should accept logger as boolean', async () => {
    app = await veloxApp({ logger: false });

    expect(app.config.logger).toBe(false);
  });

  it('should accept logger as object', async () => {
    app = await veloxApp({
      logger: {
        level: 'info',
      },
      port: 0,
    });

    expect(app.config.logger).toEqual({ level: 'info' });
  });

  it('should accept custom Fastify options', async () => {
    app = await veloxApp({
      port: 0,
      logger: false,
      fastify: {
        requestTimeout: 30000,
      },
    });

    expect(app.config.fastify).toEqual({
      requestTimeout: 30000,
    });
  });

  it('should merge custom config with defaults', async () => {
    app = await veloxApp({
      port: 5000,
      logger: false,
    });

    // Custom values
    expect(app.config.port).toBe(5000);
    expect(app.config.logger).toBe(false);

    // Default values
    expect(app.config.host).toBe('0.0.0.0');
    expect(app.config.fastify).toEqual({});
  });

  it('should provide readonly config accessor', async () => {
    app = await veloxApp({ port: 0, logger: false });

    // Config is accessible via readonly getter
    expect(app.config).toBeDefined();
    expect(app.config.port).toBe(0);

    // TypeScript enforces readonly at compile time
    // (Runtime mutation is technically possible but discouraged)
  });

  it('should throw error for invalid port', async () => {
    await expect(veloxApp({ port: 999999, logger: false })).rejects.toThrow(
      'Invalid port number'
    );
  });

  it('should throw error for negative port', async () => {
    await expect(veloxApp({ port: -1, logger: false })).rejects.toThrow(
      'Invalid port number'
    );
  });

  it('should throw error for empty host', async () => {
    await expect(veloxApp({ host: '', port: 0, logger: false })).rejects.toThrow(
      'Host must be a non-empty string'
    );
  });
});
