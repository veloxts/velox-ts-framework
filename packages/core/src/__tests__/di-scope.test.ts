/**
 * @veloxts/core - DI Scope Unit Tests
 * Tests scope management and lifecycle
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDefaultScope, isValidScope, Scope, ScopeManager } from '../di/scope.js';

describe('DI Scope', () => {
  describe('Scope enum', () => {
    it('should have singleton scope', () => {
      expect(Scope.SINGLETON).toBe('singleton');
    });

    it('should have transient scope', () => {
      expect(Scope.TRANSIENT).toBe('transient');
    });

    it('should have request scope', () => {
      expect(Scope.REQUEST).toBe('request');
    });
  });

  describe('isValidScope', () => {
    it('should return true for singleton', () => {
      expect(isValidScope(Scope.SINGLETON)).toBe(true);
    });

    it('should return true for transient', () => {
      expect(isValidScope(Scope.TRANSIENT)).toBe(true);
    });

    it('should return true for request', () => {
      expect(isValidScope(Scope.REQUEST)).toBe(true);
    });

    it('should return false for invalid string', () => {
      expect(isValidScope('invalid')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidScope(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidScope(undefined)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidScope(1)).toBe(false);
    });
  });

  describe('getDefaultScope', () => {
    it('should return singleton as default', () => {
      expect(getDefaultScope()).toBe(Scope.SINGLETON);
    });
  });

  describe('ScopeManager', () => {
    let scopeManager: ScopeManager;

    beforeEach(() => {
      scopeManager = new ScopeManager();
    });

    describe('Singleton Management', () => {
      it('should store and retrieve singleton', () => {
        const token = Symbol('test');
        const instance = { value: 42 };

        scopeManager.setSingleton(token, instance);
        expect(scopeManager.getSingleton(token)).toBe(instance);
      });

      it('should check if singleton exists', () => {
        const token = Symbol('test');
        expect(scopeManager.hasSingleton(token)).toBe(false);

        scopeManager.setSingleton(token, { value: 42 });
        expect(scopeManager.hasSingleton(token)).toBe(true);
      });

      it('should return undefined for non-existent singleton', () => {
        const token = Symbol('nonexistent');
        expect(scopeManager.getSingleton(token)).toBeUndefined();
      });

      it('should clear all singletons', () => {
        const token1 = Symbol('test1');
        const token2 = Symbol('test2');

        scopeManager.setSingleton(token1, { value: 1 });
        scopeManager.setSingleton(token2, { value: 2 });

        scopeManager.clearSingletons();

        expect(scopeManager.hasSingleton(token1)).toBe(false);
        expect(scopeManager.hasSingleton(token2)).toBe(false);
      });

      it('should handle different token types', () => {
        class TestService {}
        const stringToken = 'string-token';
        const symbolToken = Symbol('symbol-token');

        scopeManager.setSingleton(TestService, new TestService());
        scopeManager.setSingleton(stringToken, 'string-value');
        scopeManager.setSingleton(symbolToken, 'symbol-value');

        expect(scopeManager.hasSingleton(TestService)).toBe(true);
        expect(scopeManager.hasSingleton(stringToken)).toBe(true);
        expect(scopeManager.hasSingleton(symbolToken)).toBe(true);
      });
    });

    describe('Reset', () => {
      it('should reset all state', () => {
        const token = Symbol('test');
        scopeManager.setSingleton(token, { value: 42 });

        scopeManager.reset();

        expect(scopeManager.hasSingleton(token)).toBe(false);
      });
    });

    describe('Request Scope (without Fastify)', () => {
      it('should throw when ensuring request scope without request', () => {
        expect(() => scopeManager.ensureRequestScope(undefined)).toThrow(
          'Cannot resolve request-scoped service outside of request context'
        );
      });
    });

    describe('getSingletonOrThrow', () => {
      it('should return singleton when it exists', () => {
        const token = Symbol('test');
        const instance = { value: 42 };

        scopeManager.setSingleton(token, instance);
        expect(scopeManager.getSingletonOrThrow(token)).toBe(instance);
      });

      it('should throw when singleton does not exist', () => {
        const token = Symbol('nonexistent');

        expect(() => scopeManager.getSingletonOrThrow(token)).toThrow(
          'Singleton not found for token'
        );
      });
    });

    describe('Request Scope Methods (using attachToFastify)', () => {
      let onRequestHook: ((request: unknown) => Promise<void>) | null = null;
      let onResponseHook: ((request: unknown) => Promise<void>) | null = null;

      beforeEach(() => {
        onRequestHook = null;
        onResponseHook = null;

        // Set up hooks to capture them
        const mockServer = {
          addHook: vi.fn((name: string, handler: (request: unknown) => Promise<void>) => {
            if (name === 'onRequest') onRequestHook = handler;
            if (name === 'onResponse') onResponseHook = handler;
          }),
        };
        scopeManager.attachToFastify(mockServer as never);
      });

      describe('getRequestScoped', () => {
        it('should return undefined when cache not initialized', () => {
          const token = Symbol('test');
          const request = {};

          const result = scopeManager.getRequestScoped(token, request as never);
          expect(result).toBeUndefined();
        });

        it('should return undefined when token not in cache', async () => {
          const token = Symbol('test');
          const request = {};
          await onRequestHook!(request);

          const result = scopeManager.getRequestScoped(token, request as never);
          expect(result).toBeUndefined();
        });

        it('should return cached instance after setRequestScoped', async () => {
          const token = Symbol('test');
          const instance = { value: 42 };
          const request = {};
          await onRequestHook!(request);

          scopeManager.setRequestScoped(token, instance, request as never);
          const result = scopeManager.getRequestScoped(token, request as never);
          expect(result).toBe(instance);
        });
      });

      describe('setRequestScoped', () => {
        it('should throw when cache not initialized', () => {
          const token = Symbol('test');
          const request = {};

          expect(() =>
            scopeManager.setRequestScoped(token, { value: 42 }, request as never)
          ).toThrow('Request scope cache not initialized');
        });

        it('should store instance in cache', async () => {
          const token = Symbol('test');
          const instance = { value: 42 };
          const request = {};
          await onRequestHook!(request);

          scopeManager.setRequestScoped(token, instance, request as never);
          expect(scopeManager.getRequestScoped(token, request as never)).toBe(instance);
        });
      });

      describe('hasRequestScoped', () => {
        it('should return false when cache not initialized', () => {
          const token = Symbol('test');
          const request = {};

          expect(scopeManager.hasRequestScoped(token, request as never)).toBe(false);
        });

        it('should return false when token not in cache', async () => {
          const token = Symbol('test');
          const request = {};
          await onRequestHook!(request);

          expect(scopeManager.hasRequestScoped(token, request as never)).toBe(false);
        });

        it('should return true when token is in cache', async () => {
          const token = Symbol('test');
          const request = {};
          await onRequestHook!(request);
          scopeManager.setRequestScoped(token, { value: 42 }, request as never);

          expect(scopeManager.hasRequestScoped(token, request as never)).toBe(true);
        });
      });

      describe('getRequestScopedOrThrow', () => {
        it('should throw when cache not initialized', () => {
          const token = Symbol('test');
          const request = {};

          expect(() => scopeManager.getRequestScopedOrThrow(token, request as never)).toThrow(
            'Request-scoped instance not found for token'
          );
        });

        it('should throw when token not in cache', async () => {
          const token = Symbol('test');
          const request = {};
          await onRequestHook!(request);

          expect(() => scopeManager.getRequestScopedOrThrow(token, request as never)).toThrow(
            'Request-scoped instance not found for token'
          );
        });

        it('should return cached instance', async () => {
          const token = Symbol('test');
          const instance = { value: 42 };
          const request = {};
          await onRequestHook!(request);
          scopeManager.setRequestScoped(token, instance, request as never);

          const result = scopeManager.getRequestScopedOrThrow(token, request as never);
          expect(result).toBe(instance);
        });
      });

      describe('ensureRequestScope', () => {
        it('should throw when request is undefined', () => {
          expect(() => scopeManager.ensureRequestScope(undefined)).toThrow(
            'Cannot resolve request-scoped service outside of request context'
          );
        });

        it('should throw when cache not initialized', () => {
          const request = {};

          expect(() => scopeManager.ensureRequestScope(request as never)).toThrow(
            'Request scope cache not initialized'
          );
        });

        it('should return request when valid', async () => {
          const request = {};
          await onRequestHook!(request);

          const result = scopeManager.ensureRequestScope(request as never);
          expect(result).toBe(request);
        });
      });

      describe('onResponse cleanup', () => {
        it('should clear cache on response', async () => {
          const token = Symbol('test');
          const request = {};
          await onRequestHook!(request);
          scopeManager.setRequestScoped(token, { value: 42 }, request as never);

          expect(scopeManager.hasRequestScoped(token, request as never)).toBe(true);

          await onResponseHook!(request);

          expect(scopeManager.hasRequestScoped(token, request as never)).toBe(false);
        });

        it('should handle onResponse when cache not present', async () => {
          const request = {};
          // Should not throw
          await expect(onResponseHook!(request)).resolves.not.toThrow();
        });
      });
    });

    describe('attachToFastify', () => {
      it('should skip if already initialized', () => {
        const mockServer = {
          addHook: vi.fn(),
        };

        // First call should register hooks
        scopeManager.attachToFastify(mockServer as never);
        expect(mockServer.addHook).toHaveBeenCalledTimes(2);

        // Second call should be skipped
        mockServer.addHook.mockClear();
        scopeManager.attachToFastify(mockServer as never);
        expect(mockServer.addHook).not.toHaveBeenCalled();
      });

      it('should register onRequest and onResponse hooks', () => {
        const mockServer = {
          addHook: vi.fn(),
        };

        scopeManager.attachToFastify(mockServer as never);

        expect(mockServer.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
        expect(mockServer.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
      });
    });
  });
});
