/**
 * Tests for configuration utilities
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getEnvConfig, resolveConfig, validateConfig } from './config.js';

describe('resolveConfig', () => {
  describe('default values', () => {
    it('should return all defaults when called with empty config', () => {
      const config = resolveConfig({});

      expect(config).toEqual({
        port: 3030,
        host: 'localhost',
        apiBase: '/api',
        trpcBase: '/trpc',
        buildBase: '/_build',
        pagesDir: 'app/pages',
        layoutsDir: 'app/layouts',
        actionsDir: 'app/actions',
        dev: process.env.NODE_ENV !== 'production',
      });
    });

    it('should return defaults when called with no arguments', () => {
      const config = resolveConfig();

      expect(config.port).toBe(3030);
      expect(config.host).toBe('localhost');
      expect(config.apiBase).toBe('/api');
    });
  });

  describe('partial overrides', () => {
    it('should override port while keeping other defaults', () => {
      const config = resolveConfig({ port: 4000 });

      expect(config.port).toBe(4000);
      expect(config.host).toBe('localhost');
      expect(config.apiBase).toBe('/api');
    });

    it('should override multiple values', () => {
      const config = resolveConfig({
        port: 8080,
        host: '0.0.0.0',
        apiBase: '/v1',
      });

      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
      expect(config.apiBase).toBe('/v1');
    });

    it('should override directory paths', () => {
      const config = resolveConfig({
        pagesDir: 'src/pages',
        layoutsDir: 'src/layouts',
        actionsDir: 'src/actions',
      });

      expect(config.pagesDir).toBe('src/pages');
      expect(config.layoutsDir).toBe('src/layouts');
      expect(config.actionsDir).toBe('src/actions');
    });

    it('should override dev mode explicitly', () => {
      const config = resolveConfig({ dev: true });
      expect(config.dev).toBe(true);

      const prodConfig = resolveConfig({ dev: false });
      expect(prodConfig.dev).toBe(false);
    });
  });

  describe('base path normalization', () => {
    it('should add leading slash to apiBase if missing', () => {
      const config = resolveConfig({ apiBase: 'api' });
      expect(config.apiBase).toBe('/api');
    });

    it('should remove trailing slash from apiBase', () => {
      const config = resolveConfig({ apiBase: '/api/' });
      expect(config.apiBase).toBe('/api');
    });

    it('should preserve root path /', () => {
      const config = resolveConfig({ apiBase: '/' });
      expect(config.apiBase).toBe('/');
    });

    it('should normalize trpcBase correctly', () => {
      const config = resolveConfig({ trpcBase: 'trpc/' });
      expect(config.trpcBase).toBe('/trpc');
    });

    it('should normalize buildBase correctly', () => {
      const config = resolveConfig({ buildBase: '_build/' });
      expect(config.buildBase).toBe('/_build');
    });

    it('should handle paths with multiple segments', () => {
      const config = resolveConfig({ apiBase: 'api/v1/' });
      expect(config.apiBase).toBe('/api/v1');
    });

    it('should handle already normalized paths', () => {
      const config = resolveConfig({ apiBase: '/api' });
      expect(config.apiBase).toBe('/api');
    });
  });
});

describe('validateConfig', () => {
  describe('valid configurations', () => {
    it('should not throw for valid default config', () => {
      const config = resolveConfig({});
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should not throw for valid custom config', () => {
      const config = resolveConfig({
        port: 8080,
        apiBase: '/api',
        trpcBase: '/trpc',
        buildBase: '/_build',
      });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept minimum port number', () => {
      const config = resolveConfig({ port: 1 });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept maximum port number', () => {
      const config = resolveConfig({ port: 65535 });
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('invalid port numbers', () => {
    it('should throw for port below 1', () => {
      const config = resolveConfig({ port: 0 });
      expect(() => validateConfig(config)).toThrow('Invalid port: 0. Must be between 1 and 65535.');
    });

    it('should throw for negative port', () => {
      const config = resolveConfig({ port: -1 });
      expect(() => validateConfig(config)).toThrow('Invalid port');
    });

    it('should throw for port above 65535', () => {
      const config = resolveConfig({ port: 65536 });
      expect(() => validateConfig(config)).toThrow(
        'Invalid port: 65536. Must be between 1 and 65535.'
      );
    });
  });

  describe('base path validation', () => {
    it('should throw if apiBase does not start with /', () => {
      const config = resolveConfig({});
      config.apiBase = 'api'; // Bypass normalization
      expect(() => validateConfig(config)).toThrow('API base must start with /: api');
    });

    it('should throw if trpcBase does not start with /', () => {
      const config = resolveConfig({});
      config.trpcBase = 'trpc';
      expect(() => validateConfig(config)).toThrow('tRPC base must start with /: trpc');
    });

    it('should throw if buildBase does not start with /', () => {
      const config = resolveConfig({});
      config.buildBase = '_build';
      expect(() => validateConfig(config)).toThrow('Build base must start with /: _build');
    });
  });

  describe('conflicting base paths', () => {
    it('should throw if apiBase and trpcBase are identical', () => {
      const config = resolveConfig({
        apiBase: '/api',
        trpcBase: '/api',
      });
      expect(() => validateConfig(config)).toThrow('Conflicting base paths: /api');
    });

    it('should throw if apiBase and buildBase are identical', () => {
      const config = resolveConfig({
        apiBase: '/build',
        buildBase: '/build',
      });
      expect(() => validateConfig(config)).toThrow('Conflicting base paths: /build');
    });

    it('should throw if trpcBase and buildBase are identical', () => {
      const config = resolveConfig({
        trpcBase: '/rpc',
        buildBase: '/rpc',
      });
      expect(() => validateConfig(config)).toThrow('Conflicting base paths: /rpc');
    });
  });

  describe('nested base paths', () => {
    it('should throw if apiBase is nested under trpcBase', () => {
      const config = resolveConfig({
        trpcBase: '/api',
        apiBase: '/api/v1',
      });
      expect(() => validateConfig(config)).toThrow('Nested base paths are not allowed');
    });

    it('should throw if trpcBase is nested under apiBase', () => {
      const config = resolveConfig({
        apiBase: '/api',
        trpcBase: '/api/trpc',
      });
      expect(() => validateConfig(config)).toThrow(
        'Nested base paths are not allowed: /api and /api/trpc'
      );
    });

    it('should throw if buildBase is nested under apiBase', () => {
      const config = resolveConfig({
        apiBase: '/api',
        buildBase: '/api/_build',
      });
      expect(() => validateConfig(config)).toThrow(
        'Nested base paths are not allowed: /api and /api/_build'
      );
    });

    it('should allow similar but non-nested paths', () => {
      const config = resolveConfig({
        apiBase: '/api',
        trpcBase: '/api2',
        buildBase: '/_build',
      });
      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});

describe('getEnvConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('PORT environment variable', () => {
    it('should parse PORT environment variable', () => {
      process.env.PORT = '8080';
      const config = getEnvConfig();
      expect(config.port).toBe(8080);
    });

    it('should ignore invalid PORT values', () => {
      process.env.PORT = 'invalid';
      const config = getEnvConfig();
      expect(config.port).toBeUndefined();
    });

    it('should ignore empty PORT', () => {
      process.env.PORT = '';
      const config = getEnvConfig();
      expect(config.port).toBeUndefined();
    });

    it('should parse PORT with leading/trailing whitespace', () => {
      process.env.PORT = '  3000  ';
      const config = getEnvConfig();
      expect(config.port).toBe(3000);
    });
  });

  describe('HOST environment variable', () => {
    it('should use HOST environment variable', () => {
      process.env.HOST = '0.0.0.0';
      const config = getEnvConfig();
      expect(config.host).toBe('0.0.0.0');
    });

    it('should use custom HOST', () => {
      process.env.HOST = '192.168.1.1';
      const config = getEnvConfig();
      expect(config.host).toBe('192.168.1.1');
    });

    it('should not set host if HOST is not defined', () => {
      delete process.env.HOST;
      const config = getEnvConfig();
      expect(config.host).toBeUndefined();
    });
  });

  describe('NODE_ENV environment variable', () => {
    it('should set dev to false for production', () => {
      process.env.NODE_ENV = 'production';
      const config = getEnvConfig();
      expect(config.dev).toBe(false);
    });

    it('should set dev to true for development', () => {
      process.env.NODE_ENV = 'development';
      const config = getEnvConfig();
      expect(config.dev).toBe(true);
    });

    it('should set dev to true for test', () => {
      process.env.NODE_ENV = 'test';
      const config = getEnvConfig();
      expect(config.dev).toBe(true);
    });

    it('should not set dev if NODE_ENV is not defined', () => {
      delete process.env.NODE_ENV;
      const config = getEnvConfig();
      expect(config.dev).toBeUndefined();
    });
  });

  describe('combined environment variables', () => {
    it('should combine all environment variables', () => {
      process.env.PORT = '9000';
      process.env.HOST = '127.0.0.1';
      process.env.NODE_ENV = 'production';

      const config = getEnvConfig();

      expect(config.port).toBe(9000);
      expect(config.host).toBe('127.0.0.1');
      expect(config.dev).toBe(false);
    });

    it('should return empty object when no env vars are set', () => {
      delete process.env.PORT;
      delete process.env.HOST;
      delete process.env.NODE_ENV;

      const config = getEnvConfig();

      expect(config).toEqual({});
    });
  });
});
