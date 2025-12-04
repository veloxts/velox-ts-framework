/**
 * @veloxts/core - Error Handling Tests
 * Tests error handling consistency and serialization
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { createVeloxApp } from '../app.js';
import { NotFoundError, ValidationError, VeloxError } from '../errors.js';
import { definePlugin } from '../plugin.js';

describe('VeloxApp - Error Handling', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should handle VeloxError with custom status code', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'error-test',
      version: '1.0.0',
      async register(server) {
        server.get('/velox-error', async () => {
          throw new VeloxError('Custom error', 418, 'TEAPOT');
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/velox-error',
    });

    expect(response.statusCode).toBe(418);
    expect(response.json()).toEqual({
      error: 'VeloxError',
      message: 'Custom error',
      statusCode: 418,
      code: 'TEAPOT',
    });
  });

  it('should handle ValidationError with field details', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'validation-test',
      version: '1.0.0',
      async register(server) {
        server.get('/validation-error', async () => {
          throw new ValidationError('Invalid input', {
            email: 'Must be a valid email',
            age: 'Must be at least 18',
          });
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/validation-error',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('ValidationError');
    expect(body.message).toBe('Invalid input');
    expect(body.fields).toEqual({
      email: 'Must be a valid email',
      age: 'Must be at least 18',
    });
  });

  it('should handle NotFoundError with resource info', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'notfound-test',
      version: '1.0.0',
      async register(server) {
        server.get('/not-found', async () => {
          throw new NotFoundError('User', '123');
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/not-found',
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe('NotFoundError');
    expect(body.message).toBe('User with id 123 not found');
    expect(body.resource).toBe('User');
    expect(body.resourceId).toBe('123');
  });

  it('should handle generic Error instances', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'generic-error-test',
      version: '1.0.0',
      async register(server) {
        server.get('/generic-error', async () => {
          throw new Error('Something went wrong');
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/generic-error',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error).toBe('Error');
    expect(body.message).toBe('Something went wrong');
    expect(body.statusCode).toBe(500);
  });

  it('should handle non-Error throws', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'string-error-test',
      version: '1.0.0',
      async register(server) {
        server.get('/string-error', async () => {
          throw 'String error';
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const response = await app.server.inject({
      method: 'GET',
      url: '/string-error',
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error).toBe('Error');
    expect(body.message).toBe('Internal Server Error');
  });

  it('should serialize errors consistently', async () => {
    app = await createVeloxApp({ port: 0, logger: false });

    const plugin = definePlugin({
      name: 'consistency-test',
      version: '1.0.0',
      async register(server) {
        server.get('/error1', async () => {
          throw new VeloxError('Error 1', 500);
        });

        server.get('/error2', async () => {
          throw new ValidationError('Error 2');
        });

        server.get('/error3', async () => {
          throw new NotFoundError('Resource');
        });
      },
    });

    await app.use(plugin);
    await app.start();

    const responses = await Promise.all([
      app.server.inject({ method: 'GET', url: '/error1' }),
      app.server.inject({ method: 'GET', url: '/error2' }),
      app.server.inject({ method: 'GET', url: '/error3' }),
    ]);

    // All should have consistent structure
    responses.forEach((response) => {
      const body = response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('statusCode');
    });
  });
});
