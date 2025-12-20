/**
 * @veloxts/core - Static File Plugin Unit Tests
 * Tests for static file serving plugin
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @fastify/static before importing the module
vi.mock('@fastify/static', async () => {
  return {
    default: vi.fn(async () => {}),
  };
});

import { registerStatic, type CacheControl, type StaticOptions } from '../plugins/static.js';

describe('Static File Plugin', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let capturedOptions: unknown;
  let capturedNotFoundHandler: ((request: unknown, reply: unknown) => unknown) | null;

  function createMockServer() {
    capturedOptions = null;
    capturedNotFoundHandler = null;

    return {
      register: vi.fn(async (_plugin: unknown, options: unknown) => {
        capturedOptions = options;
      }),
      hasDecorator: vi.fn().mockReturnValue(false),
      setNotFoundHandler: vi.fn((handler: (request: unknown, reply: unknown) => unknown) => {
        capturedNotFoundHandler = handler;
      }),
    };
  }

  beforeEach(() => {
    mockServer = createMockServer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerStatic()', () => {
    it('should register @fastify/static with default options', async () => {
      await registerStatic(mockServer as never, './public');

      expect(mockServer.register).toHaveBeenCalledTimes(1);
      expect(capturedOptions).toBeDefined();

      const opts = capturedOptions as Record<string, unknown>;
      expect(opts.prefix).toBe('/');
      expect(opts.index).toBe('index.html');
      expect(opts.decorateReply).toBe(true);
    });

    it('should resolve relative path to absolute', async () => {
      await registerStatic(mockServer as never, './public');

      const opts = capturedOptions as Record<string, unknown>;
      expect(opts.root).toContain('/public');
      expect(typeof opts.root).toBe('string');
    });

    it('should use custom prefix', async () => {
      await registerStatic(mockServer as never, './public', { prefix: '/assets' });

      const opts = capturedOptions as Record<string, unknown>;
      expect(opts.prefix).toBe('/assets');
    });

    it('should use custom index file', async () => {
      await registerStatic(mockServer as never, './public', { index: 'app.html' });

      const opts = capturedOptions as Record<string, unknown>;
      expect(opts.index).toBe('app.html');
    });

    it('should not decorate reply if already decorated', async () => {
      mockServer.hasDecorator.mockReturnValue(true);

      await registerStatic(mockServer as never, './public');

      const opts = capturedOptions as Record<string, unknown>;
      expect(opts.decorateReply).toBe(false);
    });

    describe('cache control', () => {
      it('should set default cache control header (1 day)', async () => {
        await registerStatic(mockServer as never, './public');

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=86400');
      });

      it('should parse duration in seconds', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '30s' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=30');
      });

      it('should parse duration in minutes', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '5m' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=300');
      });

      it('should parse duration in hours', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '2h' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=7200');
      });

      it('should parse duration in days', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '7d' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=604800');
      });

      it('should parse duration in weeks', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '2w' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=1209600');
      });

      it('should parse duration in years', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '1y' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=31536000');
      });

      it('should accept numeric maxAge (seconds)', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: 3600 },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=3600');
      });

      it('should add immutable directive when specified', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: '1y', immutable: true },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      });

      it('should use default for invalid duration format', async () => {
        await registerStatic(mockServer as never, './public', {
          cache: { maxAge: 'invalid' },
        });

        const opts = capturedOptions as Record<string, unknown>;
        const setHeaders = opts.setHeaders as (res: { setHeader: (k: string, v: string) => void }) => void;

        const headers: Record<string, string> = {};
        setHeaders({ setHeader: (k, v) => { headers[k] = v; } });

        // Default is 1 day
        expect(headers['Cache-Control']).toBe('public, max-age=86400');
      });
    });

    describe('SPA mode', () => {
      it('should not set notFoundHandler when SPA is disabled', async () => {
        await registerStatic(mockServer as never, './public', { spa: false });

        expect(mockServer.setNotFoundHandler).not.toHaveBeenCalled();
      });

      it('should set notFoundHandler when SPA is enabled', async () => {
        await registerStatic(mockServer as never, './public', { spa: true });

        expect(mockServer.setNotFoundHandler).toHaveBeenCalledTimes(1);
        expect(capturedNotFoundHandler).toBeTypeOf('function');
      });

      it('should return 404 for excluded paths', async () => {
        await registerStatic(mockServer as never, './public', {
          spa: true,
          exclude: ['/api', '/trpc'],
        });

        const mockRequest = { url: '/api/users', method: 'GET' };
        const mockReply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          sendFile: vi.fn(),
        };

        await capturedNotFoundHandler!(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'NotFound',
          message: 'Route GET /api/users not found',
          statusCode: 404,
        });
        expect(mockReply.sendFile).not.toHaveBeenCalled();
      });

      it('should return 404 for multiple excluded paths', async () => {
        await registerStatic(mockServer as never, './public', {
          spa: true,
          exclude: ['/api', '/trpc'],
        });

        const mockRequest = { url: '/trpc/users.list', method: 'POST' };
        const mockReply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          sendFile: vi.fn(),
        };

        await capturedNotFoundHandler!(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'NotFound',
          message: 'Route POST /trpc/users.list not found',
          statusCode: 404,
        });
      });

      it('should return 404 for file requests (with extension)', async () => {
        await registerStatic(mockServer as never, './public', { spa: true });

        const mockRequest = { url: '/missing-file.js', method: 'GET' };
        const mockReply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          sendFile: vi.fn(),
        };

        await capturedNotFoundHandler!(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({
          error: 'NotFound',
          message: 'File not found',
          statusCode: 404,
        });
      });

      it('should serve index.html for SPA routes (no extension)', async () => {
        await registerStatic(mockServer as never, './dist', { spa: true });

        const mockRequest = { url: '/dashboard/settings', method: 'GET' };
        const mockReply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          sendFile: vi.fn().mockResolvedValue(undefined),
        };

        await capturedNotFoundHandler!(mockRequest, mockReply);

        expect(mockReply.sendFile).toHaveBeenCalledWith('index.html', expect.stringContaining('/dist'));
        expect(mockReply.status).not.toHaveBeenCalled();
      });

      it('should serve custom index file when specified', async () => {
        await registerStatic(mockServer as never, './dist', {
          spa: true,
          index: 'app.html',
        });

        const mockRequest = { url: '/about', method: 'GET' };
        const mockReply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          sendFile: vi.fn().mockResolvedValue(undefined),
        };

        await capturedNotFoundHandler!(mockRequest, mockReply);

        expect(mockReply.sendFile).toHaveBeenCalledWith('app.html', expect.any(String));
      });
    });
  });

  describe('error handling', () => {
    it('should throw helpful error when @fastify/static is not installed', async () => {
      // Mock failed dynamic import
      vi.doMock('@fastify/static', () => {
        throw new Error('Cannot find module');
      });

      // Need to re-import to get the new mock
      vi.resetModules();

      // Import fresh version that will fail
      const { registerStatic: freshRegisterStatic } = await import('../plugins/static.js');

      await expect(freshRegisterStatic(mockServer as never, './public')).rejects.toThrow(
        'To serve static files, please install @fastify/static'
      );
    });
  });
});
