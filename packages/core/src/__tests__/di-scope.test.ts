/**
 * @veloxts/core - DI Scope Unit Tests
 * Tests scope management and lifecycle
 */

import { beforeEach, describe, expect, it } from 'vitest';

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
  });
});
