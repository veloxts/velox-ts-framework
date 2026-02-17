/**
 * @veloxts/core - Raw Body Plugin Tests
 * Tests for raw body preservation via preParsing hook
 */

import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { rawBodyPlugin } from '../plugins/raw-body.js';

describe('Raw Body Plugin', () => {
  function createMockServer() {
    const hooks: Record<string, Array<(...args: unknown[]) => Promise<unknown>>> = {};
    const decorations: Record<string, unknown> = {};

    return {
      decorateRequest: vi.fn((key: string, value: unknown) => {
        decorations[key] = value;
      }),
      addHook: vi.fn((hookName: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        if (!hooks[hookName]) hooks[hookName] = [];
        hooks[hookName].push(handler);
      }),
      getHooks(name: string) {
        return hooks[name] ?? [];
      },
    };
  }

  it('should register a preParsing hook and decorate request', async () => {
    const server = createMockServer();

    await rawBodyPlugin.register(server as never, {});

    expect(server.decorateRequest).toHaveBeenCalledWith('rawBody', undefined);
    expect(server.addHook).toHaveBeenCalledWith('preParsing', expect.any(Function));
  });

  it('should preserve raw body on request and return a readable stream', async () => {
    const server = createMockServer();
    await rawBodyPlugin.register(server as never, {});

    const preParsingHooks = server.getHooks('preParsing');
    expect(preParsingHooks).toHaveLength(1);

    const body = JSON.stringify({ key: 'value' });
    const payload = Readable.from(Buffer.from(body));
    const request: { rawBody?: Buffer } = {};

    const result = await preParsingHooks[0](request, {}, payload);

    expect(request.rawBody).toBeInstanceOf(Buffer);
    expect(request.rawBody?.toString()).toBe(body);
    expect(result).toBeDefined();
  });

  it('should handle empty body', async () => {
    const server = createMockServer();
    await rawBodyPlugin.register(server as never, {});

    const preParsingHooks = server.getHooks('preParsing');
    const payload = Readable.from(Buffer.from(''));
    const request: { rawBody?: Buffer } = {};

    await preParsingHooks[0](request, {}, payload);

    expect(request.rawBody).toBeInstanceOf(Buffer);
    expect(request.rawBody?.length).toBe(0);
  });

  it('should handle binary body', async () => {
    const server = createMockServer();
    await rawBodyPlugin.register(server as never, {});

    const preParsingHooks = server.getHooks('preParsing');
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    const payload = Readable.from(binaryData);
    const request: { rawBody?: Buffer } = {};

    await preParsingHooks[0](request, {}, payload);

    expect(request.rawBody).toBeInstanceOf(Buffer);
    expect(Buffer.compare(request.rawBody as Buffer, binaryData)).toBe(0);
  });

  it('should have correct plugin metadata', () => {
    expect(rawBodyPlugin.name).toBe('@veloxts/raw-body');
    expect(rawBodyPlugin.version).toBe('1.0.0');
  });
});
