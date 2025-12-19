/**
 * Tests for the client router utilities
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultClientConfig, getCacheHeaders, getContentType } from './client-router.js';

describe('getCacheHeaders', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('hashed filenames (immutable)', () => {
    it('should return immutable cache headers for JS files with hash', () => {
      const headers = getCacheHeaders('main.abc12345.js', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });

    it('should return immutable cache headers for CSS files with hash', () => {
      const headers = getCacheHeaders('styles.f1e2d3c4.css', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });

    it('should detect various hash formats', () => {
      const files = [
        'bundle.12345678.js',
        'app.abcdef12.css',
        'chunk.a1b2c3d4e5f6.js',
        'vendor.123abc456def.js',
      ];

      for (const file of files) {
        const headers = getCacheHeaders(file, { immutableCache: true });
        expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      }
    });

    it('should handle different file extensions with hashes', () => {
      const extensions = [
        'js',
        'css',
        'woff',
        'woff2',
        'ttf',
        'eot',
        'svg',
        'png',
        'jpg',
        'gif',
        'webp',
        'avif',
      ];

      for (const ext of extensions) {
        const headers = getCacheHeaders(`file.abc12345.${ext}`, { immutableCache: true });
        expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      }
    });

    it('should use custom maxAge', () => {
      const headers = getCacheHeaders('app.abc12345.js', {
        immutableCache: true,
        maxAge: 86400, // 1 day
      });
      expect(headers['Cache-Control']).toBe('public, max-age=86400, immutable');
    });

    it('should handle uppercase extensions', () => {
      const headers = getCacheHeaders('file.ABC12345.JS', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });
  });

  describe('non-hashed filenames (mutable)', () => {
    it('should return no-cache for files without hash', () => {
      const headers = getCacheHeaders('main.js');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should return no-cache for CSS files without hash', () => {
      const headers = getCacheHeaders('styles.css');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should return no-cache for short hashes', () => {
      const headers = getCacheHeaders('app.abc.js'); // Hash too short
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should return no-cache when immutableCache is disabled', () => {
      const headers = getCacheHeaders('app.abc12345.js', { immutableCache: false });
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should handle filenames with no extension', () => {
      const headers = getCacheHeaders('manifest');
      expect(headers['Cache-Control']).toBe('no-cache');
    });
  });

  describe('environment-based defaults', () => {
    it('should use immutable cache when explicitly enabled', () => {
      const headers = getCacheHeaders('app.abc12345.js', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });

    it('should not use immutable cache when explicitly disabled', () => {
      const headers = getCacheHeaders('app.abc12345.js', { immutableCache: false });
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should allow explicit override to disable caching', () => {
      const headers = getCacheHeaders('app.abc12345.js', { immutableCache: false });
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should allow explicit override to enable caching', () => {
      const headers = getCacheHeaders('app.abc12345.js', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });
  });

  describe('edge cases', () => {
    it('should handle filenames with multiple dots', () => {
      const headers = getCacheHeaders('my.component.abc12345.js', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });

    it('should handle paths with directories', () => {
      const headers = getCacheHeaders('assets/js/main.abc12345.js', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    });

    it('should handle empty filename', () => {
      const headers = getCacheHeaders('');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should handle filename with only hash pattern', () => {
      const headers = getCacheHeaders('abc12345.js');
      expect(headers['Cache-Control']).toBe('no-cache');
    });

    it('should require hash between name and extension', () => {
      const headers = getCacheHeaders('main.js.abc12345', { immutableCache: true });
      expect(headers['Cache-Control']).toBe('no-cache');
    });
  });

  describe('options merging', () => {
    it('should use defaults when no options provided', () => {
      const headers = getCacheHeaders('app.abc12345.js');
      expect(headers).toBeDefined();
    });

    it('should merge partial options with defaults', () => {
      const headers = getCacheHeaders('app.abc12345.js', {
        maxAge: 3600,
        immutableCache: true,
      });
      expect(headers['Cache-Control']).toContain('max-age=3600');
    });

    it('should not modify the default config', () => {
      const originalMaxAge = defaultClientConfig.maxAge;
      getCacheHeaders('app.abc12345.js', { maxAge: 1000 });
      expect(defaultClientConfig.maxAge).toBe(originalMaxAge);
    });
  });
});

describe('getContentType', () => {
  describe('JavaScript files', () => {
    it('should return application/javascript for .js files', () => {
      expect(getContentType('main.js')).toBe('application/javascript');
    });

    it('should return application/javascript for .mjs files', () => {
      expect(getContentType('module.mjs')).toBe('application/javascript');
    });
  });

  describe('CSS files', () => {
    it('should return text/css for .css files', () => {
      expect(getContentType('styles.css')).toBe('text/css');
    });
  });

  describe('HTML files', () => {
    it('should return text/html for .html files', () => {
      expect(getContentType('index.html')).toBe('text/html');
    });
  });

  describe('JSON files', () => {
    it('should return application/json for .json files', () => {
      expect(getContentType('data.json')).toBe('application/json');
    });

    it('should return application/json for .map files', () => {
      expect(getContentType('main.js.map')).toBe('application/json');
    });
  });

  describe('font files', () => {
    it('should return font/woff for .woff files', () => {
      expect(getContentType('font.woff')).toBe('font/woff');
    });

    it('should return font/woff2 for .woff2 files', () => {
      expect(getContentType('font.woff2')).toBe('font/woff2');
    });

    it('should return font/ttf for .ttf files', () => {
      expect(getContentType('font.ttf')).toBe('font/ttf');
    });

    it('should return application/vnd.ms-fontobject for .eot files', () => {
      expect(getContentType('font.eot')).toBe('application/vnd.ms-fontobject');
    });
  });

  describe('image files', () => {
    it('should return image/svg+xml for .svg files', () => {
      expect(getContentType('icon.svg')).toBe('image/svg+xml');
    });

    it('should return image/png for .png files', () => {
      expect(getContentType('image.png')).toBe('image/png');
    });

    it('should return image/jpeg for .jpg files', () => {
      expect(getContentType('photo.jpg')).toBe('image/jpeg');
    });

    it('should return image/jpeg for .jpeg files', () => {
      expect(getContentType('photo.jpeg')).toBe('image/jpeg');
    });

    it('should return image/gif for .gif files', () => {
      expect(getContentType('animation.gif')).toBe('image/gif');
    });

    it('should return image/webp for .webp files', () => {
      expect(getContentType('image.webp')).toBe('image/webp');
    });

    it('should return image/avif for .avif files', () => {
      expect(getContentType('image.avif')).toBe('image/avif');
    });

    it('should return image/x-icon for .ico files', () => {
      expect(getContentType('favicon.ico')).toBe('image/x-icon');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase extensions', () => {
      expect(getContentType('FILE.JS')).toBe('application/javascript');
      expect(getContentType('STYLES.CSS')).toBe('text/css');
      expect(getContentType('IMAGE.PNG')).toBe('image/png');
    });

    it('should handle mixed case extensions', () => {
      expect(getContentType('file.Js')).toBe('application/javascript');
      expect(getContentType('styles.CsS')).toBe('text/css');
    });
  });

  describe('filenames with paths', () => {
    it('should extract extension from paths', () => {
      expect(getContentType('assets/js/main.js')).toBe('application/javascript');
      expect(getContentType('styles/components/button.css')).toBe('text/css');
      expect(getContentType('/fonts/custom.woff2')).toBe('font/woff2');
    });

    it('should handle deeply nested paths', () => {
      expect(getContentType('dist/assets/chunks/vendor.abc123.js')).toBe('application/javascript');
    });
  });

  describe('filenames with multiple dots', () => {
    it('should use the last extension', () => {
      expect(getContentType('main.bundle.js')).toBe('application/javascript');
      expect(getContentType('styles.min.css')).toBe('text/css');
      expect(getContentType('app.abc123.js')).toBe('application/javascript');
    });

    it('should handle source maps', () => {
      expect(getContentType('main.js.map')).toBe('application/json');
      expect(getContentType('styles.css.map')).toBe('application/json');
    });
  });

  describe('unknown extensions', () => {
    it('should return application/octet-stream for unknown extensions', () => {
      expect(getContentType('file.xyz')).toBe('application/octet-stream');
      expect(getContentType('data.bin')).toBe('application/octet-stream');
      expect(getContentType('archive.tar')).toBe('application/octet-stream');
    });

    it('should handle files with no extension', () => {
      expect(getContentType('README')).toBe('application/octet-stream');
      expect(getContentType('Dockerfile')).toBe('application/octet-stream');
    });

    it('should handle empty filenames', () => {
      expect(getContentType('')).toBe('application/octet-stream');
    });
  });

  describe('edge cases', () => {
    it('should handle filenames starting with dot', () => {
      expect(getContentType('.gitignore')).toBe('application/octet-stream');
      expect(getContentType('.env.js')).toBe('application/javascript');
    });

    it('should handle filenames ending with dot', () => {
      expect(getContentType('file.')).toBe('application/octet-stream');
    });

    it('should handle single character extensions', () => {
      expect(getContentType('file.c')).toBe('application/octet-stream');
    });

    it('should handle very long extensions', () => {
      expect(getContentType('file.verylongextension')).toBe('application/octet-stream');
    });
  });
});

describe('defaultClientConfig', () => {
  it('should export default configuration', () => {
    expect(defaultClientConfig).toBeDefined();
    expect(defaultClientConfig.basePath).toBe('/_build');
    expect(defaultClientConfig.maxAge).toBe(31536000);
  });

  it('should set immutableCache based on NODE_ENV', () => {
    expect(typeof defaultClientConfig.immutableCache).toBe('boolean');
  });

  it('should have correct maxAge for one year', () => {
    expect(defaultClientConfig.maxAge).toBe(365 * 24 * 60 * 60);
  });
});
