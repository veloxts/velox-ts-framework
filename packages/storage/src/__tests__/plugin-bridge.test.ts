/**
 * @veloxts/storage - Plugin Bridge Test
 *
 * Verifies that the storage plugin populates `request.context.storage` so
 * handlers can read `ctx.storage` without a manual addHook workaround.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { setupContextHook } from '@veloxts/core';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { storagePlugin } from '../plugin.js';

describe('storage plugin bridge', () => {
  let storageRoot: string;

  beforeAll(() => {
    storageRoot = mkdtempSync(join(tmpdir(), 'velox-storage-bridge-'));
  });

  afterAll(() => {
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it('populates request.context.storage', async () => {
    const app = Fastify({ logger: false });
    setupContextHook(app);
    await app.register(
      storagePlugin({ driver: 'local', root: storageRoot, baseUrl: 'http://localhost/files' })
    );

    let bridgedStorage: unknown;
    app.get('/probe', async (request) => {
      const ctx = (request as unknown as { context?: Record<string, unknown> }).context;
      bridgedStorage = ctx?.storage;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/probe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(bridgedStorage).toBeDefined();
    expect(typeof (bridgedStorage as { put?: unknown }).put).toBe('function');
  });
});
