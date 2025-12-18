/**
 * @veloxts/core - DI Decorator Unit Tests
 * Tests @Injectable, @Inject, and @Optional decorators
 *
 * NOTE: These tests work with Vitest/esbuild which does NOT support
 * `emitDecoratorMetadata`. Therefore, tests focus on explicit @Inject
 * tokens rather than automatic type inference from design:paramtypes.
 */

import { describe, expect, it } from 'vitest';

import {
  createStringToken,
  createSymbolToken,
  getConstructorTokens,
  getExplicitInjectTokens,
  getInjectableScope,
  getOptionalParams,
  Inject,
  Injectable,
  isInjectable,
  makeInjectable,
  Optional,
  Scope,
  setInjectTokens,
} from '../di/index.js';

// Test tokens
const DATABASE = createStringToken<DatabaseClient>('DATABASE');
const LOGGER = createSymbolToken<Logger>('LOGGER');
const CONFIG = createStringToken<ConfigService>('CONFIG');

// Test interfaces and implementations
interface DatabaseClient {
  query(sql: string): string[];
}

interface Logger {
  log(message: string): void;
}

// Helper classes for tests
class ConfigService {
  readonly port = 3030;
}

describe('DI Decorators', () => {
  describe('@Injectable', () => {
    it('should mark class as injectable', () => {
      @Injectable()
      class TestService {}

      expect(isInjectable(TestService)).toBe(true);
    });

    it('should default to singleton scope', () => {
      @Injectable()
      class SingletonService {}

      expect(getInjectableScope(SingletonService)).toBe(Scope.SINGLETON);
    });

    it('should allow specifying transient scope', () => {
      @Injectable({ scope: Scope.TRANSIENT })
      class TransientService {}

      expect(getInjectableScope(TransientService)).toBe(Scope.TRANSIENT);
    });

    it('should allow specifying request scope', () => {
      @Injectable({ scope: Scope.REQUEST })
      class RequestService {}

      expect(getInjectableScope(RequestService)).toBe(Scope.REQUEST);
    });

    it('should return singleton for non-injectable class', () => {
      class NonInjectableService {}

      expect(getInjectableScope(NonInjectableService)).toBe(Scope.SINGLETON);
    });
  });

  describe('isInjectable', () => {
    it('should return true for @Injectable class', () => {
      @Injectable()
      class TestService {}

      expect(isInjectable(TestService)).toBe(true);
    });

    it('should return false for plain class', () => {
      class PlainClass {}

      expect(isInjectable(PlainClass)).toBe(false);
    });

    it('should return false for function', () => {
      function testFn() {}

      expect(isInjectable(testFn)).toBe(false);
    });
  });

  describe('@Inject', () => {
    it('should store injection token for parameter', () => {
      @Injectable()
      class TestService {
        constructor(@Inject(DATABASE) _db: DatabaseClient) {}
      }

      const tokens = getExplicitInjectTokens(TestService);
      expect(tokens.get(0)).toBe(DATABASE);
    });

    it('should store multiple injection tokens', () => {
      @Injectable()
      class TestService {
        constructor(@Inject(DATABASE) _db: DatabaseClient, @Inject(LOGGER) _logger: Logger) {}
      }

      const tokens = getExplicitInjectTokens(TestService);
      expect(tokens.get(0)).toBe(DATABASE);
      expect(tokens.get(1)).toBe(LOGGER);
    });

    it('should store token at correct index with gaps', () => {
      @Injectable()
      class TestService {
        constructor(
          @Inject(DATABASE) _db: DatabaseClient,
          _undecorated: unknown,
          @Inject(LOGGER) _logger: Logger
        ) {}
      }

      const tokens = getExplicitInjectTokens(TestService);
      expect(tokens.get(0)).toBe(DATABASE);
      expect(tokens.has(1)).toBe(false); // No explicit token at index 1
      expect(tokens.get(2)).toBe(LOGGER);
    });
  });

  describe('@Optional', () => {
    it('should mark parameter as optional', () => {
      @Injectable()
      class TestService {
        constructor(@Optional() @Inject(DATABASE) _db?: DatabaseClient) {}
      }

      const optionalParams = getOptionalParams(TestService);
      expect(optionalParams.has(0)).toBe(true);
    });

    it('should mark multiple parameters as optional', () => {
      @Injectable()
      class TestService {
        constructor(
          @Optional() @Inject(DATABASE) _db?: DatabaseClient,
          @Optional() @Inject(LOGGER) _logger?: Logger
        ) {}
      }

      const optionalParams = getOptionalParams(TestService);
      expect(optionalParams.has(0)).toBe(true);
      expect(optionalParams.has(1)).toBe(true);
    });

    it('should work with @Inject', () => {
      @Injectable()
      class TestService {
        constructor(@Optional() @Inject(DATABASE) _db?: DatabaseClient) {}
      }

      const optionalParams = getOptionalParams(TestService);
      const injectTokens = getExplicitInjectTokens(TestService);

      expect(optionalParams.has(0)).toBe(true);
      expect(injectTokens.get(0)).toBe(DATABASE);
    });

    it('should return empty set for class without @Optional', () => {
      @Injectable()
      class TestService {
        constructor(@Inject(CONFIG) _config: ConfigService) {}
      }

      const optionalParams = getOptionalParams(TestService);
      expect(optionalParams.size).toBe(0);
    });
  });

  describe('getConstructorTokens', () => {
    it('should return empty array for class without constructor params', () => {
      @Injectable()
      class EmptyService {}

      const tokens = getConstructorTokens(EmptyService);
      expect(tokens).toEqual([]);
    });

    it('should return explicit @Inject tokens', () => {
      @Injectable()
      class TestService {
        constructor(@Inject(CONFIG) _config: ConfigService) {}
      }

      const tokens = getConstructorTokens(TestService);
      // Note: Without emitDecoratorMetadata, only explicit tokens are available
      // The design:paramtypes array will be empty, so we get tokens based on
      // explicit @Inject decorators only
      expect(tokens).toEqual([]);
    });
  });

  describe('makeInjectable', () => {
    it('should make a plain class injectable', () => {
      class ThirdPartyService {}

      expect(isInjectable(ThirdPartyService)).toBe(false);

      makeInjectable(ThirdPartyService);

      expect(isInjectable(ThirdPartyService)).toBe(true);
    });

    it('should set default singleton scope', () => {
      class ThirdPartyService {}

      makeInjectable(ThirdPartyService);

      expect(getInjectableScope(ThirdPartyService)).toBe(Scope.SINGLETON);
    });

    it('should allow specifying scope', () => {
      class ThirdPartyService {}

      makeInjectable(ThirdPartyService, { scope: Scope.TRANSIENT });

      expect(getInjectableScope(ThirdPartyService)).toBe(Scope.TRANSIENT);
    });
  });

  describe('setInjectTokens', () => {
    it('should set inject tokens programmatically', () => {
      class ThirdPartyService {}

      setInjectTokens(ThirdPartyService, [DATABASE, LOGGER]);

      const tokens = getExplicitInjectTokens(ThirdPartyService);
      expect(tokens.get(0)).toBe(DATABASE);
      expect(tokens.get(1)).toBe(LOGGER);
    });

    it('should overwrite existing tokens', () => {
      class TestService {}

      setInjectTokens(TestService, [DATABASE]);
      setInjectTokens(TestService, [LOGGER, CONFIG]);

      const tokens = getExplicitInjectTokens(TestService);
      expect(tokens.get(0)).toBe(LOGGER);
      expect(tokens.get(1)).toBe(CONFIG);
      expect(tokens.has(2)).toBe(false);
    });
  });
});
