/**
 * @veloxts/core - Empty Body Parser Tests
 *
 * Verifies that POST/PUT/PATCH requests with `Content-Type: application/json`
 * and an empty body parse to `{}` rather than 400ing — required so that
 * input-less mutations from the Velox client can reach the procedure pipeline.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { VeloxApp } from '../app.js';
import { veloxApp } from '../app.js';

describe('Empty body parser', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('parses empty JSON body as {} instead of 400', async () => {
    app = await veloxApp({ port: 0, logger: false });
    app.server.post('/echo', async (request) => ({ body: request.body }));
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ body: {} });
  });

  it('parses whitespace-only JSON body as {}', async () => {
    app = await veloxApp({ port: 0, logger: false });
    app.server.post('/echo', async (request) => ({ body: request.body }));
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '   \n  ',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ body: {} });
  });

  it('parses valid JSON normally', async () => {
    app = await veloxApp({ port: 0, logger: false });
    app.server.post('/echo', async (request) => ({ body: request.body }));
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'velox', count: 3 }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ body: { name: 'velox', count: 3 } });
  });

  it('rejects malformed JSON with 400', async () => {
    app = await veloxApp({ port: 0, logger: false });
    app.server.post('/echo', async (request) => ({ body: request.body }));
    await app.start();

    const response = await app.server.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{ not valid json',
    });

    expect(response.statusCode).toBe(400);
  });
});
