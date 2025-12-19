/**
 * Tests for Client-Side Hydrator
 *
 * Uses jsdom for DOM environment and mocks React hydration APIs.
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create a DOM environment
const dom = new JSDOM(
  '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
  {
    url: 'http://localhost:3030',
  }
);

// Set up globals with proper typing
const globalWithDOM = globalThis as typeof globalThis & {
  document: Document;
  window: Window & typeof globalThis;
};
globalWithDOM.document = dom.window.document;
globalWithDOM.window = dom.window as unknown as Window & typeof globalThis;

// Mock react-dom/client
vi.mock('react-dom/client', () => ({
  hydrateRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

// Now import the module that uses DOM APIs
import {
  extractInitialData,
  getInitialData,
  type HydrateOptions,
  type HydrateResult,
  hydrate,
  hydrateRoot,
  showErrorOverlay,
} from './client-hydrator.js';

// Window type with VeloxTS data
interface WindowWithVeloxData extends Window {
  __VELOX_INITIAL_DATA__?: unknown;
}

describe('client-hydrator utilities', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = '<div id="root"></div>';
    // Clear window data
    delete (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__;
    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any overlays
    document.getElementById('velox-error-overlay')?.remove();
    document.getElementById('velox-hydration-warning')?.remove();
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

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const data = extractInitialData();
      expect(data).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[VeloxTS] Failed to parse initial data:',
        expect.any(SyntaxError)
      );

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

    it('should handle deeply nested data', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = JSON.stringify({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      });
      document.body.appendChild(script);

      const data = extractInitialData() as { level1: { level2: { level3: { value: string } } } };
      expect(data.level1.level2.level3.value).toBe('deep');
    });
  });

  describe('getInitialData', () => {
    it('should return undefined when no data is set', () => {
      const data = getInitialData();
      expect(data).toBeUndefined();
    });

    it('should return data from window.__VELOX_INITIAL_DATA__', () => {
      (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ = {
        theme: 'dark',
      };

      const data = getInitialData<{ theme: string }>();
      expect(data).toEqual({ theme: 'dark' });
    });

    it('should support type parameter', () => {
      interface UserData {
        user: { id: string; name: string };
      }

      (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ = {
        user: { id: '1', name: 'Test' },
      };

      const data = getInitialData<UserData>();
      expect(data?.user.id).toBe('1');
      expect(data?.user.name).toBe('Test');
    });

    it('should handle null value', () => {
      (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ = null;
      const data = getInitialData();
      expect(data).toBeNull();
    });

    it('should handle primitive values', () => {
      (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ = 42;
      const data = getInitialData<number>();
      expect(data).toBe(42);
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

    it('should handle quotes in error messages safely', () => {
      const error = new Error('Error with "quotes" and \'apostrophes\'');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      // Quotes are safe in text content, just ensure the message is displayed
      expect(overlay?.innerHTML).toContain('quotes');
      expect(overlay?.innerHTML).toContain('apostrophes');
    });

    it('should escape ampersands in error messages', () => {
      const error = new Error('Error with & ampersand');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).toContain('&amp; ampersand');
    });

    it('should display message when stack is undefined', () => {
      const error = new Error('No stack error');
      error.stack = undefined;
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.innerHTML).toContain('No stack error');
    });

    it('should have correct styling', () => {
      const error = new Error('Test');
      showErrorOverlay(error);

      const overlay = document.getElementById('velox-error-overlay');
      expect(overlay?.style.position).toBe('fixed');
      expect(overlay?.style.zIndex).toBe('999999');
    });
  });

  describe('hydrate', () => {
    it('should call hydrateRoot with the app and root element', () => {
      const app = { type: 'div', props: { children: 'Hello' } };

      const result = hydrate(app as unknown as React.ReactNode);

      expect(hydrateRoot).toHaveBeenCalledWith(
        document.getElementById('root'),
        app,
        expect.objectContaining({
          onRecoverableError: expect.any(Function),
        })
      );
      expect(result.root).toBeDefined();
    });

    it('should throw when root element is not found', () => {
      document.body.innerHTML = ''; // Remove root element

      expect(() => {
        hydrate({} as React.ReactNode);
      }).toThrow('[VeloxTS] Root element not found');
    });

    it('should use custom root element from options', () => {
      const customRoot = document.createElement('div');
      customRoot.id = 'custom-root';
      document.body.appendChild(customRoot);

      const app = { type: 'div', props: {} };
      hydrate(app as unknown as React.ReactNode, { rootElement: customRoot });

      expect(hydrateRoot).toHaveBeenCalledWith(customRoot, app, expect.any(Object));
    });

    it('should throw when custom root element is null', () => {
      expect(() => {
        hydrate({} as React.ReactNode, { rootElement: null });
      }).toThrow('[VeloxTS] Root element not found');
    });

    it('should extract initial data from the page', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = JSON.stringify({ userId: '123' });
      document.body.appendChild(script);

      const result = hydrate({} as React.ReactNode);

      expect(result.initialData).toEqual({ userId: '123' });
    });

    it('should store initial data in window', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = JSON.stringify({ theme: 'light' });
      document.body.appendChild(script);

      hydrate({} as React.ReactNode);

      expect((window as WindowWithVeloxData).__VELOX_INITIAL_DATA__).toEqual({ theme: 'light' });
    });

    it('should use custom error handler when provided', () => {
      const customHandler = vi.fn();
      const app = { type: 'div', props: {} };

      hydrate(app as unknown as React.ReactNode, {
        onRecoverableError: customHandler,
      });

      // Get the onRecoverableError callback passed to hydrateRoot
      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      // Trigger the error handler
      const testError = new Error('Test recoverable error');
      options.onRecoverableError(testError);

      expect(customHandler).toHaveBeenCalledWith(testError);
    });

    it('should wrap non-Error objects in Error', () => {
      const customHandler = vi.fn();
      const app = { type: 'div', props: {} };

      hydrate(app as unknown as React.ReactNode, {
        onRecoverableError: customHandler,
      });

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      // Trigger with a string instead of Error
      options.onRecoverableError('string error');

      expect(customHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(customHandler.mock.calls[0][0].message).toBe('string error');
    });

    it('should log hydration complete in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      expect(consoleSpy).toHaveBeenCalledWith('[VeloxTS] Hydration complete');

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not log in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should return root and initialData', () => {
      const script = document.createElement('script');
      script.id = '__velox_data__';
      script.type = 'application/json';
      script.textContent = JSON.stringify({ test: true });
      document.body.appendChild(script);

      const result = hydrate({} as React.ReactNode);

      expect(result).toHaveProperty('root');
      expect(result).toHaveProperty('initialData');
      expect(result.initialData).toEqual({ test: true });
    });

    it('should handle undefined initial data', () => {
      // No __velox_data__ script

      const result = hydrate({} as React.ReactNode);

      expect(result.initialData).toBeUndefined();
      // Should not set window data when undefined
      expect((window as WindowWithVeloxData).__VELOX_INITIAL_DATA__).toBeUndefined();
    });
  });

  describe('default recoverable error handler', () => {
    it('should warn on recoverable errors', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Test warning'));

      expect(warnSpy).toHaveBeenCalledWith('[VeloxTS Recoverable Error]', 'Test warning');

      warnSpy.mockRestore();
    });

    it('should show hydration warning in development for hydration errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Hydration mismatch detected'));

      const warning = document.getElementById('velox-hydration-warning');
      expect(warning).not.toBeNull();
      expect(warning?.innerHTML).toContain('Hydration Warning');
      expect(warning?.innerHTML).toContain('Hydration mismatch detected');

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not show hydration warning for non-hydration errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Some other error'));

      const warning = document.getElementById('velox-hydration-warning');
      expect(warning).toBeNull();

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not show duplicate hydration warnings', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      // Trigger multiple hydration errors
      options.onRecoverableError(new Error('Hydration error 1'));
      options.onRecoverableError(new Error('Hydration error 2'));

      const warnings = document.querySelectorAll('#velox-hydration-warning');
      expect(warnings.length).toBe(1);

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should escape HTML in hydration warning', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Hydration <script>xss</script>'));

      const warning = document.getElementById('velox-hydration-warning');
      expect(warning?.innerHTML).not.toContain('<script>');
      expect(warning?.innerHTML).toContain('&lt;script&gt;');

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should truncate long hydration warning messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      const longMessage = `Hydration ${'a'.repeat(300)}`;
      options.onRecoverableError(new Error(longMessage));

      const warning = document.getElementById('velox-hydration-warning');
      expect(warning?.innerHTML).toContain('...');

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should auto-dismiss hydration warning after timeout', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Hydration error'));

      expect(document.getElementById('velox-hydration-warning')).not.toBeNull();

      // Fast-forward 10 seconds
      vi.advanceTimersByTime(10000);

      expect(document.getElementById('velox-hydration-warning')).toBeNull();

      vi.useRealTimers();
      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should not show hydration warning in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      hydrate({} as React.ReactNode);

      const hydrateRootCall = vi.mocked(hydrateRoot).mock.calls[0];
      const options = hydrateRootCall[2] as { onRecoverableError: (error: unknown) => void };

      options.onRecoverableError(new Error('Hydration error in prod'));

      const warning = document.getElementById('velox-hydration-warning');
      expect(warning).toBeNull();

      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('type exports', () => {
    it('should export HydrateOptions type', () => {
      const options: HydrateOptions = {
        rootElement: null,
        onRecoverableError: () => {},
        strictMode: true,
      };
      expect(options.rootElement).toBeNull();
    });

    it('should export HydrateResult type', () => {
      const mockResult: HydrateResult = {
        root: { render: vi.fn(), unmount: vi.fn() } as unknown as HydrateResult['root'],
        initialData: { test: true },
      };
      expect(mockResult.initialData).toEqual({ test: true });
    });

    it('should re-export hydrateRoot from react-dom/client', () => {
      expect(typeof hydrateRoot).toBe('function');
    });
  });
});
