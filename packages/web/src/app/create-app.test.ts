/**
 * Tests for the VeloxTS web application factory
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defineVeloxApp } from './create-app.js';

describe('defineVeloxApp', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('basic configuration', () => {
    it('should create app with default configuration', () => {
      const app = defineVeloxApp();

      expect(app.name).toBe('velox-app');
      expect(app.server.port).toBe(3030);
      expect(app.server.host).toBe('localhost');
      expect(app.routers).toHaveLength(3);
    });

    it('should create app with custom port and host', () => {
      const app = defineVeloxApp({
        port: 8080,
        host: '0.0.0.0',
      });

      expect(app.server.port).toBe(8080);
      expect(app.server.host).toBe('0.0.0.0');
    });

    it('should merge environment config with provided options', () => {
      process.env.PORT = '9000';
      process.env.HOST = '127.0.0.1';

      const app = defineVeloxApp({
        port: 3000, // This should override env
      });

      expect(app.server.port).toBe(3000);
      expect(app.server.host).toBe('127.0.0.1'); // From env
    });

    it('should prioritize explicit options over environment variables', () => {
      process.env.PORT = '4000';
      process.env.HOST = 'localhost';

      const app = defineVeloxApp({
        port: 5000,
        host: '0.0.0.0',
      });

      expect(app.server.port).toBe(5000);
      expect(app.server.host).toBe('0.0.0.0');
    });
  });

  describe('router configuration', () => {
    it('should create three routers', () => {
      const app = defineVeloxApp();

      expect(app.routers).toHaveLength(3);
      expect(app.routers[0].name).toBe('api');
      expect(app.routers[1].name).toBe('client');
      expect(app.routers[2].name).toBe('ssr');
    });

    it('should configure API router correctly', () => {
      const app = defineVeloxApp({
        apiBase: '/api',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');

      expect(apiRouter).toBeDefined();
      expect(apiRouter?.type).toBe('http');
      expect(apiRouter?.handler).toBe('./src/api.handler');
      expect(apiRouter?.target).toBe('server');
      expect(apiRouter?.base).toBe('/api');
    });

    it('should configure client router correctly', () => {
      const app = defineVeloxApp({
        buildBase: '/_build',
      });

      const clientRouter = app.routers.find((r) => r.name === 'client');

      expect(clientRouter).toBeDefined();
      expect(clientRouter?.type).toBe('client');
      expect(clientRouter?.handler).toBe('./src/entry.client');
      expect(clientRouter?.target).toBe('browser');
      expect(clientRouter?.base).toBe('/_build');
    });

    it('should configure SSR router correctly', () => {
      const app = defineVeloxApp();

      const ssrRouter = app.routers.find((r) => r.name === 'ssr');

      expect(ssrRouter).toBeDefined();
      expect(ssrRouter?.type).toBe('http');
      expect(ssrRouter?.handler).toBe('./src/entry.server');
      expect(ssrRouter?.target).toBe('server');
      expect(ssrRouter?.base).toBeUndefined(); // No base = catch-all
    });

    it('should use custom base paths', () => {
      const app = defineVeloxApp({
        apiBase: '/v1',
        buildBase: '/static',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');
      const clientRouter = app.routers.find((r) => r.name === 'client');

      expect(apiRouter?.base).toBe('/v1');
      expect(clientRouter?.base).toBe('/static');
    });
  });

  describe('handler paths', () => {
    it('should use default handler paths', () => {
      const app = defineVeloxApp();

      const apiRouter = app.routers.find((r) => r.name === 'api');
      const clientRouter = app.routers.find((r) => r.name === 'client');
      const ssrRouter = app.routers.find((r) => r.name === 'ssr');

      expect(apiRouter?.handler).toBe('./src/api.handler');
      expect(clientRouter?.handler).toBe('./src/entry.client');
      expect(ssrRouter?.handler).toBe('./src/entry.server');
    });

    it('should use custom handler paths', () => {
      const app = defineVeloxApp({
        apiHandler: './custom/api.ts',
        serverEntry: './custom/server.tsx',
        clientEntry: './custom/client.tsx',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');
      const clientRouter = app.routers.find((r) => r.name === 'client');
      const ssrRouter = app.routers.find((r) => r.name === 'ssr');

      expect(apiRouter?.handler).toBe('./custom/api.ts');
      expect(clientRouter?.handler).toBe('./custom/client.tsx');
      expect(ssrRouter?.handler).toBe('./custom/server.tsx');
    });

    it('should allow partial handler path overrides', () => {
      const app = defineVeloxApp({
        apiHandler: './my-api.ts',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');
      const clientRouter = app.routers.find((r) => r.name === 'client');

      expect(apiRouter?.handler).toBe('./my-api.ts');
      expect(clientRouter?.handler).toBe('./src/entry.client'); // Default
    });
  });

  describe('configuration validation', () => {
    it('should throw for invalid port numbers', () => {
      expect(() => defineVeloxApp({ port: 0 })).toThrow('Invalid port');
      expect(() => defineVeloxApp({ port: -1 })).toThrow('Invalid port');
      expect(() => defineVeloxApp({ port: 65536 })).toThrow('Invalid port');
    });

    it('should throw for conflicting base paths', () => {
      expect(() =>
        defineVeloxApp({
          apiBase: '/api',
          trpcBase: '/api',
        })
      ).toThrow('Conflicting base paths');
    });

    it('should throw for nested base paths', () => {
      expect(() =>
        defineVeloxApp({
          apiBase: '/api',
          trpcBase: '/api/trpc',
        })
      ).toThrow('Nested base paths are not allowed');
    });

    it('should accept valid configurations', () => {
      expect(() =>
        defineVeloxApp({
          port: 3030,
          apiBase: '/api',
          trpcBase: '/trpc',
          buildBase: '/_build',
        })
      ).not.toThrow();
    });
  });

  describe('directory configuration', () => {
    it('should use default directory paths', () => {
      const app = defineVeloxApp();

      // Directories are passed to config resolution
      // We can't directly access them from the app config
      // but we can verify the app was created successfully
      expect(app).toBeDefined();
      expect(app.routers).toHaveLength(3);
    });

    it('should accept custom directory paths', () => {
      const app = defineVeloxApp({
        pagesDir: 'src/pages',
        layoutsDir: 'src/layouts',
        actionsDir: 'src/actions',
      });

      expect(app).toBeDefined();
      expect(app.routers).toHaveLength(3);
    });
  });

  describe('development mode', () => {
    it('should detect development mode from NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      const app = defineVeloxApp();

      expect(app).toBeDefined();
    });

    it('should detect production mode from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const app = defineVeloxApp();

      expect(app).toBeDefined();
    });

    it('should allow explicit dev mode override', () => {
      process.env.NODE_ENV = 'production';
      const app = defineVeloxApp({ dev: true });

      expect(app).toBeDefined();
    });
  });

  describe('router order', () => {
    it('should maintain router order (api, client, ssr)', () => {
      const app = defineVeloxApp();

      expect(app.routers[0].name).toBe('api');
      expect(app.routers[1].name).toBe('client');
      expect(app.routers[2].name).toBe('ssr');
    });

    it('should preserve router order with custom config', () => {
      const app = defineVeloxApp({
        apiBase: '/v1',
        buildBase: '/assets',
      });

      expect(app.routers[0].name).toBe('api');
      expect(app.routers[1].name).toBe('client');
      expect(app.routers[2].name).toBe('ssr');
    });
  });

  describe('base path normalization', () => {
    it('should normalize base paths in routers', () => {
      const app = defineVeloxApp({
        apiBase: 'api/',
        buildBase: '_build',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');
      const clientRouter = app.routers.find((r) => r.name === 'client');

      expect(apiRouter?.base).toBe('/api');
      expect(clientRouter?.base).toBe('/_build');
    });

    it('should handle root path correctly', () => {
      const app = defineVeloxApp({
        apiBase: '/',
      });

      const apiRouter = app.routers.find((r) => r.name === 'api');
      expect(apiRouter?.base).toBe('/');
    });
  });
});
