/**
 * @veloxts/core - Server Lifecycle Tests
 * Tests VeloxApp start/stop functionality and state management
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';

describe('VeloxApp - Server Lifecycle', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    // Clean up: stop server if running
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should create an app instance', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    expect(app).toBeDefined();
    expect(app.isRunning).toBe(false);
    expect(app.address).toBeNull();
  });

  it('should start the server', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    await app.start();

    expect(app.isRunning).toBe(true);
    expect(app.address).toBeDefined();
    expect(app.address).toMatch(/^http:\/\//);
  });

  it('should stop the server', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    await app.start();
    expect(app.isRunning).toBe(true);

    await app.stop();
    expect(app.isRunning).toBe(false);
    expect(app.address).toBeNull();
  });

  it('should throw error when starting already running server', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    await app.start();

    await expect(app.start()).rejects.toThrow('Server is already running');
  });

  it('should throw error when stopping non-running server', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    await expect(app.stop()).rejects.toThrow('Server is not running');
  });

  it('should prevent restarting after stop (Fastify limitation)', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    await app.start();
    expect(app.isRunning).toBe(true);

    await app.stop();
    expect(app.isRunning).toBe(false);

    // Fastify instances cannot be reopened once closed
    // This is a Fastify limitation, not a VeloxTS limitation
    await expect(app.start()).rejects.toThrow();
  });
});
