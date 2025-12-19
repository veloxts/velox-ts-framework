/**
 * Tests for Client-Side Hydrator
 *
 * Note: These tests mock DOM APIs since we're running in Node.js.
 * Full integration tests would require a browser environment.
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Set up a basic DOM environment before importing the module
const dom = new JSDOM(
  '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3030',
  }
);

// @ts-expect-error - setting up global DOM
global.document = dom.window.document;
// @ts-expect-error - setting up global window
global.window = dom.window;

// Now import the module that uses DOM APIs
import { extractInitialData, getInitialData, showErrorOverlay } from './client-hydrator.js';

describe('client-hydrator utilities', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = '<div id="root"></div>';
    // Clear window data
    delete (window as { __VELOX_INITIAL_DATA__?: unknown }).__VELOX_INITIAL_DATA__;
  });

  describe('extractInitialData', () => {
    it('should return undefined when no data script exists', () => {
      const data = extractInitialData();
      expect(data).toBeUndefined();
    });

    it('should extract JSON data from __velox_data__ script', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = JSON.stringify({ user: { id: '1', name: 'John' } });
      document.body.appendChild(script);

      const data = extractInitialData();
      expect(data).toEqual({ user: { id: '1', name: 'John' } });
    });

    it('should handle empty data script', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = '{}';
      document.body.appendChild(script);

      const data = extractInitialData();
      expect(data).toEqual({});
    });

    it('should handle null data', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = 'null';
      document.body.appendChild(script);

      const data = extractInitialData();
      expect(data).toBeNull();
    });

    it('should handle array data', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = '[1, 2, 3]';
      document.body.appendChild(script);

      const data = extractInitialData();
      expect(data).toEqual([1, 2, 3]);
    });

    it('should return undefined for invalid JSON', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = 'invalid json';
      document.body.appendChild(script);

      // Mock console.error to suppress output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const data = extractInitialData();
      expect(data).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should handle empty script content', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = '';
      document.body.appendChild(script);

      const data = extractInitialData();
      expect(data).toEqual({});
    });
  });

  describe('getInitialData', () => {
    it('should return undefined when no data is set', () => {
      const data = getInitialData();
      expect(data).toBeUndefined();
    });

    it('should return data from window.__VELOX_INITIAL_DATA__', () => {
      (window as { __VELOX_INITIAL_DATA__?: unknown }).__VELOX_INITIAL_DATA__ = {
        theme: 'dark',
      };

      const data = getInitialData<{ theme: string }>();
      expect(data).toEqual({ theme: 'dark' });
    });

    it('should support type parameter', () => {
      interface UserData {
        user: { id: string; name: string };
      }

      (window as { __VELOX_INITIAL_DATA__?: unknown }).__VELOX_INITIAL_DATA__ = {
        user: { id: '1', name: 'Test' },
      };

      const data = getInitialData<UserData>();
      expect(data?.user.id).toBe('1');
      expect(data?.user.name).toBe('Test');
    });
  });

  describe('showErrorOverlay', () => {
    it('should create an overlay element', () => {
      const error = new Error('Test error');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay).not.toBeNull();
    });

    it('should display error message', () => {
      const error = new Error('Custom error message');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).toContain('Custom error message');
    });

    it('should display error stack', () => {
      const error = new Error('Test');
      error.stack = 'Error: Test\n    at test.js:1:1';
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).toContain('at test.js:1:1');
    });

    it('should include a reload button', () => {
      const error = new Error('Test');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).toContain('Reload Page');
    });

    it('should escape HTML in error messages', () => {
      const error = new Error('<script>alert("xss")</script>');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).not.toContain('<script>');
      expect(overlay?.innerHTML).toContain('&lt;script&gt;');
    });

    afterEach(() => {
      // Clean up overlay
      const overlay = document.getElementById('velox-error-overlay');
      overlay?.remove();
    });
  });
});

describe('hydrate function', () => {
  // Note: Full hydrate() testing would require a complete React environment
  // These are basic interface tests

  it('should be exported from the module', async () => {
    const module = await import('./client-hydrator.js');
    expect(typeof module.hydrate).toBe('function');
  });

  it('should export hydrateRoot from react-dom/client', async () => {
    const module = await import('./client-hydrator.js');
    expect(typeof module.hydrateRoot).toBe('function');
  });

  it('should export HydrateOptions type', async () => {
    // Type-only check - if this compiles, the type is exported
    const options: import('./client-hydrator.js').HydrateOptions = {
      rootElement: null,
    };
    expect(options.rootElement).toBeNull();
  });

  it('should export HydrateResult type', async () => {
    // Type-only check
    type Result = import('./client-hydrator.js').HydrateResult;
    const mockResult: Result = {
      root: {} as Result['root'],
      initialData: null,
    };
    expect(mockResult.initialData).toBeNull();
  });
});
