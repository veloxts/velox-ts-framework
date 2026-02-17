/**
 * @veloxts/core - Raw Body Plugin Tests
 * Tests for raw body preservation functionality
 */

import { describe, expect, it, vi } from 'vitest';

import { rawBodyPlugin } from '../plugins/raw-body.js';

describe('Raw Body Plugin', () => {
  function createMockServer() {
    let contentTypeHandler:
      | ((
          request: { rawBody?: Buffer },
          body: Buffer,
          done: (err: Error | null, result?: unknown) => void
        ) => void)
      | null = null;

    return {
      addContentTypeParser: vi.fn(
        (
          _contentType: string,
          _opts: { parseAs: string },
          handler: (
            request: { rawBody?: Buffer },
            body: Buffer,
            done: (err: Error | null, result?: unknown) => void
          ) => void
        ) => {
          contentTypeHandler = handler;
        }
      ),
      getContentTypeHandler() {
        return contentTypeHandler;
      },
    };
  }

  it('should register an application/json content type parser', async () => {
    const server = createMockServer();

    await rawBodyPlugin.register(server as never);

    expect(server.addContentTypeParser).toHaveBeenCalledWith(
      'application/json',
      { parseAs: 'buffer' },
      expect.any(Function)
    );
  });

  it('should preserve raw body on request', async () => {
    const server = createMockServer();

    await rawBodyPlugin.register(server as never);

    const handler = server.getContentTypeHandler();
    expect(handler).not.toBeNull();

    const request: { rawBody?: Buffer } = {};
    const body = Buffer.from(JSON.stringify({ key: 'value' }));

    await new Promise<void>((resolve, reject) => {
      handler?.(request, body, (err, result) => {
        if (err) {
          reject(err);
        } else {
          expect(request.rawBody).toBe(body);
          expect(result).toEqual({ key: 'value' });
          resolve();
        }
      });
    });
  });

  it('should handle empty body', async () => {
    const server = createMockServer();

    await rawBodyPlugin.register(server as never);

    const handler = server.getContentTypeHandler();
    const request: { rawBody?: Buffer } = {};
    const body = Buffer.from('');

    await new Promise<void>((resolve, reject) => {
      handler?.(request, body, (err, result) => {
        if (err) {
          reject(err);
        } else {
          expect(request.rawBody).toBe(body);
          expect(result).toBeUndefined();
          resolve();
        }
      });
    });
  });

  it('should call done with error for invalid JSON', async () => {
    const server = createMockServer();

    await rawBodyPlugin.register(server as never);

    const handler = server.getContentTypeHandler();
    const request: { rawBody?: Buffer } = {};
    const body = Buffer.from('not valid json');

    await new Promise<void>((resolve) => {
      handler?.(request, body, (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(request.rawBody).toBe(body);
        resolve();
      });
    });
  });

  it('should have correct plugin metadata', () => {
    expect(rawBodyPlugin.name).toBe('@veloxts/raw-body');
    expect(rawBodyPlugin.version).toBe('1.0.0');
  });
});
