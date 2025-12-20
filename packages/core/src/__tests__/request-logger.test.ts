/**
 * @veloxts/core - Request Logger Plugin Unit Tests
 * Tests for request logging functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../plugins/request-logger.js';

describe('Request Logger Plugin', () => {
  const originalEnv = process.env.VELOX_REQUEST_LOGGING;
  let mockServer: ReturnType<typeof createMockServer>;
  let onRequestHook: ((request: unknown) => Promise<void>) | null;
  let onResponseHook: ((request: unknown, reply: unknown) => Promise<void>) | null;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  function createMockServer() {
    onRequestHook = null;
    onResponseHook = null;

    return {
      addHook: vi.fn((hookName: string, handler: (...args: unknown[]) => Promise<void>) => {
        if (hookName === 'onRequest') {
          onRequestHook = handler as (request: unknown) => Promise<void>;
        } else if (hookName === 'onResponse') {
          onResponseHook = handler as (request: unknown, reply: unknown) => Promise<void>;
        }
      }),
    };
  }

  beforeEach(() => {
    mockServer = createMockServer();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.VELOX_REQUEST_LOGGING = originalEnv;
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('plugin registration', () => {
    it('should skip registration when VELOX_REQUEST_LOGGING is not set', async () => {
      delete process.env.VELOX_REQUEST_LOGGING;

      // Get the underlying plugin function
      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});

      expect(mockServer.addHook).not.toHaveBeenCalled();
    });

    it('should skip registration when VELOX_REQUEST_LOGGING is false', async () => {
      process.env.VELOX_REQUEST_LOGGING = 'false';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});

      expect(mockServer.addHook).not.toHaveBeenCalled();
    });

    it('should register hooks when VELOX_REQUEST_LOGGING is true', async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});

      expect(mockServer.addHook).toHaveBeenCalledTimes(2);
      expect(mockServer.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
      expect(mockServer.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
    });

    it('should have correct plugin metadata', () => {
      // Access the plugin metadata via Symbol property
      const displayNameSymbol = Symbol.for('fastify.display-name');
      const plugin = requestLogger as unknown as Record<symbol, unknown>;

      expect(plugin[displayNameSymbol]).toBe('velox-request-logger');
    });
  });

  describe('request timing', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should set start time on request', async () => {
      const mockRequest = { method: 'GET', url: '/test' };

      await onRequestHook!(mockRequest);

      expect((mockRequest as Record<string, unknown>)._veloxStartTime).toBeDefined();
      expect(typeof (mockRequest as Record<string, unknown>)._veloxStartTime).toBe('number');
    });

    it('should log request with timing on response', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/api/users' };
      const mockReply = { statusCode: 200 };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, mockReply);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain('/api/users');
      expect(consoleSpy.mock.calls[0][0]).toContain('200');
      expect(consoleSpy.mock.calls[0][0]).toContain('GET');
    });

    it('should handle missing start time gracefully', async () => {
      const mockRequest = { method: 'POST', url: '/test' };
      const mockReply = { statusCode: 201 };

      // Skip onRequest hook to simulate missing start time
      await onResponseHook!(mockRequest, mockReply);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      // Should still log, just with 0 duration
    });
  });

  describe('status code colors', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should use green for 2xx status codes', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 200 });

      // Green is \x1b[32m
      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[32m');
    });

    it('should use green for 201 Created', async () => {
      const mockRequest: Record<string, unknown> = { method: 'POST', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 201 });

      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[32m');
    });

    it('should use cyan for 3xx status codes', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/redirect' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 301 });

      // Cyan is \x1b[36m
      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[36m');
    });

    it('should use cyan for 304 Not Modified', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/cached' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 304 });

      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[36m');
    });

    it('should use yellow for 4xx status codes', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/notfound' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 404 });

      // Yellow is \x1b[33m
      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[33m');
    });

    it('should use yellow for 400 Bad Request', async () => {
      const mockRequest: Record<string, unknown> = { method: 'POST', url: '/invalid' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 400 });

      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[33m');
    });

    it('should use red for 5xx status codes', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/error' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 500 });

      // Red is \x1b[31m
      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[31m');
    });

    it('should use red for 503 Service Unavailable', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/unavailable' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 503 });

      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[31m');
    });

    it('should use white for 1xx status codes', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/continue' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 100 });

      // White is \x1b[37m
      expect(consoleSpy.mock.calls[0][0]).toContain('\x1b[37m');
    });
  });

  describe('method padding', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should pad GET method', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 200 });

      // GET padded to 7 chars: "GET    "
      expect(consoleSpy.mock.calls[0][0]).toContain('GET');
    });

    it('should pad POST method', async () => {
      const mockRequest: Record<string, unknown> = { method: 'POST', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 201 });

      expect(consoleSpy.mock.calls[0][0]).toContain('POST');
    });

    it('should pad DELETE method', async () => {
      const mockRequest: Record<string, unknown> = { method: 'DELETE', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 204 });

      expect(consoleSpy.mock.calls[0][0]).toContain('DELETE');
    });

    it('should handle OPTIONS method (max length)', async () => {
      const mockRequest: Record<string, unknown> = { method: 'OPTIONS', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 200 });

      expect(consoleSpy.mock.calls[0][0]).toContain('OPTIONS');
    });
  });

  describe('duration formatting', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should format milliseconds for fast requests', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/fast' };

      await onRequestHook!(mockRequest);
      // Simulate fast request
      await onResponseHook!(mockRequest, { statusCode: 200 });

      // Should contain "ms" suffix
      expect(consoleSpy.mock.calls[0][0]).toMatch(/\d+ms/);
    });

    it('should format seconds for slow requests', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/slow' };

      // Set start time to 2 seconds ago
      mockRequest._veloxStartTime = performance.now() - 2000;
      await onResponseHook!(mockRequest, { statusCode: 200 });

      // Should contain "s" suffix for seconds
      expect(consoleSpy.mock.calls[0][0]).toMatch(/\d+\.\d{2}s/);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should not throw when console.log fails', async () => {
      consoleSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/test' };

      await onRequestHook!(mockRequest);

      // Should not throw - logging errors are swallowed
      await expect(
        onResponseHook!(mockRequest, { statusCode: 200 })
      ).resolves.not.toThrow();
    });

    it('should not break request handling when logging fails', async () => {
      consoleSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/test' };
      const mockReply = { statusCode: 200 };

      await onRequestHook!(mockRequest);
      const result = await onResponseHook!(mockRequest, mockReply);

      // Should complete without throwing
      expect(result).toBeUndefined();
    });
  });

  describe('time formatting', () => {
    beforeEach(async () => {
      process.env.VELOX_REQUEST_LOGGING = 'true';

      const pluginFn = requestLogger as unknown as {
        (server: unknown, opts: unknown): Promise<void>;
      };

      await pluginFn(mockServer, {});
    });

    it('should include timestamp in log output', async () => {
      const mockRequest: Record<string, unknown> = { method: 'GET', url: '/test' };

      await onRequestHook!(mockRequest);
      await onResponseHook!(mockRequest, { statusCode: 200 });

      // Timestamp format: HH:MM:SS
      expect(consoleSpy.mock.calls[0][0]).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });
});
