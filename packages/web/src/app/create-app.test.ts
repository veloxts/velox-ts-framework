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

      expect(app.config.name).toBe('velox-app');
      expect(app.config.server.port).toBe(3030);
      expect(app.config.server.host).toBe('localhost');
      expect(app.config.routers).toHaveLength(3);
    });

    it('should create app with custom port and host', () => {
      const app = defineVeloxApp({
        server: {
          port: 8080,
          host: '0.0.0.0',
        },
      });

      expect(app.config.server.port).toBe(8080);
      expect(app.config.server.host).toBe('0.0.0.0');
    });

    it('should merge environment config with provided options', () => {
      process.env.PORT = '9000';
      process.env.HOST = '127.0.0.1';

      const app = defineVeloxApp({
        server: {
          port: 3000, // This should override env
        },
      });

      expect(app.config.server.port).toBe(3000);
      expect(app.config.server.host).toBe('127.0.0.1'); // From env
    });

    it('should prioritize explicit options over environment variables', () => {
      process.env.PORT = '4000';
      process.env.HOST = 'localhost';

      const app = defineVeloxApp({
        server: {
          port: 5000,
          host: '0.0.0.0',
        },
      });

      expect(app.config.server.port).toBe(5000);
      expect(app.config.server.host).toBe('0.0.0.0');
    });
  });

  describe('router configuration', () => {
    it('should create three routers', () => {
      const app = defineVeloxApp();

      expect(app.config.routers).toHaveLength(3);
      expect(app.config.routers[0].name).toBe('api');
      expect(app.config.routers[1].name).toBe('client');
      expect(app.config.routers[2].name).toBe('ssr');
    });

    it('should configure API router correctly', () => {
      const app = defineVeloxApp({
        api: {
          prefix: '/api',
        },
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');

      expect(apiRouter).toBeDefined();
      expect(apiRouter?.type).toBe('http');
      // Vinxi normalizes handler paths by stripping './' prefix
      expect(apiRouter?.handler).toBe('src/api/handler');
      expect(apiRouter?.target).toBe('server');
      expect(apiRouter?.base).toBe('/api');
    });

    it('should configure client router correctly', () => {
      const app = defineVeloxApp({
        build: {
          buildBase: '/_build',
        },
      });

      const clientRouter = app.config.routers.find((r) => r.name === 'client');

      expect(clientRouter).toBeDefined();
      expect(clientRouter?.type).toBe('client');
      // Vinxi normalizes handler paths by stripping './' prefix
      expect(clientRouter?.handler).toBe('src/entry.client');
      expect(clientRouter?.target).toBe('browser');
      expect(clientRouter?.base).toBe('/_build');
    });

    it('should configure SSR router correctly', () => {
      const app = defineVeloxApp();

      const ssrRouter = app.config.routers.find((r) => r.name === 'ssr');

      expect(ssrRouter).toBeDefined();
      expect(ssrRouter?.type).toBe('http');
      // Vinxi normalizes handler paths by stripping './' prefix
      expect(ssrRouter?.handler).toBe('src/entry.server');
      expect(ssrRouter?.target).toBe('server');
      // Vinxi defaults empty base to '/' (catch-all for remaining routes)
      expect(ssrRouter?.base).toBe('/');
    });

    it('should use custom base paths', () => {
      const app = defineVeloxApp({
        api: {
          prefix: '/v1',
        },
        build: {
          buildBase: '/static',
        },
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      const clientRouter = app.config.routers.find((r) => r.name === 'client');

      expect(apiRouter?.base).toBe('/v1');
      expect(clientRouter?.base).toBe('/static');
    });
  });

  describe('handler paths', () => {
    it('should use default handler paths', () => {
      const app = defineVeloxApp();

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      const clientRouter = app.config.routers.find((r) => r.name === 'client');
      const ssrRouter = app.config.routers.find((r) => r.name === 'ssr');

      // Vinxi normalizes handler paths by stripping './' prefix
      expect(apiRouter?.handler).toBe('src/api/handler');
      expect(clientRouter?.handler).toBe('src/entry.client');
      expect(ssrRouter?.handler).toBe('src/entry.server');
    });

    it('should use custom handler paths', () => {
      const app = defineVeloxApp({
        api: {
          handlerPath: './custom/api.ts',
        },
        serverEntry: './custom/server.tsx',
        clientEntry: './custom/client.tsx',
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      const clientRouter = app.config.routers.find((r) => r.name === 'client');
      const ssrRouter = app.config.routers.find((r) => r.name === 'ssr');

      // Vinxi normalizes handler paths by stripping './' prefix
      expect(apiRouter?.handler).toBe('custom/api.ts');
      expect(clientRouter?.handler).toBe('custom/client.tsx');
      expect(ssrRouter?.handler).toBe('custom/server.tsx');
    });

    it('should allow partial handler path overrides', () => {
      const app = defineVeloxApp({
        api: {
          handlerPath: './my-api.ts',
        },
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      const clientRouter = app.config.routers.find((r) => r.name === 'client');

      // Vinxi normalizes handler paths by stripping './' prefix
      expect(apiRouter?.handler).toBe('my-api.ts');
      expect(clientRouter?.handler).toBe('src/entry.client'); // Default
    });
  });

  describe('configuration validation', () => {
    it('should throw for invalid port numbers', () => {
      expect(() => defineVeloxApp({ server: { port: 0 } })).toThrow('Invalid port');
      expect(() => defineVeloxApp({ server: { port: -1 } })).toThrow('Invalid port');
      expect(() => defineVeloxApp({ server: { port: 65536 } })).toThrow('Invalid port');
    });

    it('should accept valid configurations', () => {
      expect(() =>
        defineVeloxApp({
          server: { port: 3030 },
          api: { prefix: '/api' },
          build: { buildBase: '/_build' },
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
      expect(app.config.routers).toHaveLength(3);
    });

    it('should accept custom directory paths', () => {
      const app = defineVeloxApp({
        routing: {
          pagesDir: 'src/pages',
          layoutsDir: 'src/layouts',
          actionsDir: 'src/actions',
        },
      });

      expect(app).toBeDefined();
      expect(app.config.routers).toHaveLength(3);
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

      expect(app.config.routers[0].name).toBe('api');
      expect(app.config.routers[1].name).toBe('client');
      expect(app.config.routers[2].name).toBe('ssr');
    });

    it('should preserve router order with custom config', () => {
      const app = defineVeloxApp({
        api: { prefix: '/v1' },
        build: { buildBase: '/assets' },
      });

      expect(app.config.routers[0].name).toBe('api');
      expect(app.config.routers[1].name).toBe('client');
      expect(app.config.routers[2].name).toBe('ssr');
    });
  });

  describe('base path normalization', () => {
    it('should normalize base paths in routers', () => {
      const app = defineVeloxApp({
        api: { prefix: 'api/' },
        build: { buildBase: '_build' },
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      const clientRouter = app.config.routers.find((r) => r.name === 'client');

      expect(apiRouter?.base).toBe('/api');
      expect(clientRouter?.base).toBe('/_build');
    });

    it('should handle root path correctly', () => {
      const app = defineVeloxApp({
        api: { prefix: '/' },
      });

      const apiRouter = app.config.routers.find((r) => r.name === 'api');
      expect(apiRouter?.base).toBe('/');
    });
  });
});
