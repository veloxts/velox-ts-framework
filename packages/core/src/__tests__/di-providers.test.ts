/**
 * @veloxts/core - DI Provider Unit Tests
 * Tests provider types, type guards, validation, and builders
 */

import { describe, expect, it } from 'vitest';

import {
  asClass,
  asExisting,
  asFactory,
  asValue,
  describeProvider,
  isClassProvider,
  isExistingProvider,
  isFactoryProvider,
  isValueProvider,
  normalizeProvider,
  validateProvider,
} from '../di/providers.js';
import { Scope } from '../di/scope.js';
import { createStringToken, createSymbolToken } from '../di/tokens.js';

// Test classes
class UserService {
  getName(): string {
    return 'UserService';
  }
}

class MockUserService extends UserService {
  override getName(): string {
    return 'MockUserService';
  }
}

class ConfigService {
  readonly port = 3030;
}

describe('DI Providers', () => {
  describe('Provider Type Guards', () => {
    describe('isClassProvider', () => {
      it('should return true for class provider', () => {
        const provider = { provide: UserService, useClass: UserService };
        expect(isClassProvider(provider)).toBe(true);
      });

      it('should return false for factory provider', () => {
        const provider = { provide: UserService, useFactory: () => new UserService() };
        expect(isFactoryProvider(provider)).toBe(true);
        expect(isClassProvider(provider)).toBe(false);
      });

      it('should return false for value provider', () => {
        const provider = { provide: 'CONFIG', useValue: { port: 3030 } };
        expect(isClassProvider(provider)).toBe(false);
      });
    });

    describe('isFactoryProvider', () => {
      it('should return true for factory provider', () => {
        const provider = { provide: UserService, useFactory: () => new UserService() };
        expect(isFactoryProvider(provider)).toBe(true);
      });

      it('should return true for factory provider with inject', () => {
        const provider = {
          provide: UserService,
          useFactory: (_config: ConfigService) => new UserService(),
          inject: [ConfigService],
        };
        expect(isFactoryProvider(provider)).toBe(true);
      });

      it('should return false for class provider', () => {
        const provider = { provide: UserService, useClass: UserService };
        expect(isFactoryProvider(provider)).toBe(false);
      });
    });

    describe('isValueProvider', () => {
      it('should return true for value provider', () => {
        const provider = { provide: 'CONFIG', useValue: { port: 3030 } };
        expect(isValueProvider(provider)).toBe(true);
      });

      it('should return true for null value', () => {
        const provider = { provide: 'NULL', useValue: null };
        expect(isValueProvider(provider)).toBe(true);
      });

      it('should return true for undefined value', () => {
        const provider = { provide: 'UNDEFINED', useValue: undefined };
        expect(isValueProvider(provider)).toBe(true);
      });

      it('should return false for class provider', () => {
        const provider = { provide: UserService, useClass: UserService };
        expect(isValueProvider(provider)).toBe(false);
      });
    });

    describe('isExistingProvider', () => {
      it('should return true for existing provider', () => {
        const ALIAS = createStringToken<UserService>('ALIAS');
        const provider = { provide: ALIAS, useExisting: UserService };
        expect(isExistingProvider(provider)).toBe(true);
      });

      it('should return false for class provider', () => {
        const provider = { provide: UserService, useClass: UserService };
        expect(isExistingProvider(provider)).toBe(false);
      });
    });
  });

  describe('validateProvider', () => {
    it('should validate class provider', () => {
      const provider = { provide: UserService, useClass: UserService };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should validate factory provider', () => {
      const provider = { provide: UserService, useFactory: () => new UserService() };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should validate factory provider with inject', () => {
      const provider = {
        provide: UserService,
        useFactory: (_config: ConfigService) => new UserService(),
        inject: [ConfigService],
      };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should validate value provider', () => {
      const CONFIG = createStringToken<{ port: number }>('CONFIG');
      const provider = { provide: CONFIG, useValue: { port: 3030 } };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should validate existing provider', () => {
      const ALIAS = createStringToken<UserService>('ALIAS');
      const provider = { provide: ALIAS, useExisting: UserService };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should validate provider with scope', () => {
      const provider = {
        provide: UserService,
        useClass: UserService,
        scope: Scope.REQUEST,
      };
      expect(() => validateProvider(provider)).not.toThrow();
    });

    it('should throw for null provider', () => {
      expect(() => validateProvider(null)).toThrow('Provider must be an object');
    });

    it('should throw for non-object provider', () => {
      expect(() => validateProvider('not an object')).toThrow('Provider must be an object');
    });

    it('should throw for provider without provide token', () => {
      expect(() => validateProvider({ useClass: UserService })).toThrow(
        'Provider must have a "provide" token'
      );
    });

    it('should throw for provider with invalid token', () => {
      expect(() => validateProvider({ provide: null, useClass: UserService })).toThrow(
        'Injection token cannot be null or undefined'
      );
    });

    it('should throw for provider without implementation', () => {
      expect(() => validateProvider({ provide: UserService })).toThrow(
        'Provider must specify one of: useClass, useFactory, useValue, or useExisting'
      );
    });

    it('should throw for provider with multiple implementations', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useClass: UserService,
          useFactory: () => new UserService(),
        })
      ).toThrow('Provider cannot have multiple types');
    });

    it('should throw for non-function useClass', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useClass: 'not a class' as unknown as typeof UserService,
        })
      ).toThrow('useClass must be a class constructor');
    });

    it('should throw for non-function useFactory', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useFactory: 'not a function' as unknown as () => UserService,
        })
      ).toThrow('useFactory must be a function');
    });

    it('should throw for non-array inject', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useFactory: () => new UserService(),
          inject: 'not an array' as unknown as [],
        })
      ).toThrow('Factory inject must be an array');
    });

    it('should throw for invalid inject token', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useFactory: () => new UserService(),
          inject: [null as unknown as typeof ConfigService],
        })
      ).toThrow('Injection token cannot be null or undefined');
    });

    it('should throw for invalid scope', () => {
      expect(() =>
        validateProvider({
          provide: UserService,
          useClass: UserService,
          scope: 'invalid' as Scope,
        })
      ).toThrow('Invalid scope');
    });
  });

  describe('normalizeProvider', () => {
    it('should normalize class provider', () => {
      const provider = { provide: UserService, useClass: UserService };
      const normalized = normalizeProvider(provider);

      expect(normalized.provide).toBe(UserService);
      expect(normalized.type).toBe('class');
      expect(normalized.scope).toBe(Scope.SINGLETON);
      expect(normalized.implementation.class).toBe(UserService);
    });

    it('should normalize class provider with custom scope', () => {
      const provider = {
        provide: UserService,
        useClass: UserService,
        scope: Scope.TRANSIENT,
      };
      const normalized = normalizeProvider(provider);

      expect(normalized.scope).toBe(Scope.TRANSIENT);
    });

    it('should normalize factory provider', () => {
      const factory = () => new UserService();
      const provider = {
        provide: UserService,
        useFactory: factory,
        inject: [ConfigService],
      };
      const normalized = normalizeProvider(provider);

      expect(normalized.type).toBe('factory');
      expect(normalized.implementation.factory).toBe(factory);
      expect(normalized.implementation.inject).toEqual([ConfigService]);
    });

    it('should normalize value provider to singleton scope', () => {
      const CONFIG = createStringToken<{ port: number }>('CONFIG');
      const value = { port: 3030 };
      const provider = { provide: CONFIG, useValue: value, scope: Scope.TRANSIENT };
      const normalized = normalizeProvider(provider);

      expect(normalized.type).toBe('value');
      expect(normalized.scope).toBe(Scope.SINGLETON);
      expect(normalized.implementation.value).toBe(value);
    });

    it('should normalize existing provider', () => {
      const ALIAS = createStringToken<UserService>('ALIAS');
      const provider = { provide: ALIAS, useExisting: UserService };
      const normalized = normalizeProvider(provider);

      expect(normalized.type).toBe('existing');
      expect(normalized.implementation.existing).toBe(UserService);
    });
  });

  describe('Provider Builders', () => {
    describe('asClass', () => {
      it('should create class provider with default singleton scope', () => {
        const provider = asClass(UserService);

        expect(provider.provide).toBe(UserService);
        expect(provider.useClass).toBe(UserService);
        expect(provider.scope).toBe(Scope.SINGLETON);
      });

      it('should create class provider with custom scope', () => {
        const provider = asClass(UserService, Scope.REQUEST);

        expect(provider.scope).toBe(Scope.REQUEST);
      });
    });

    describe('asFactory', () => {
      it('should create factory provider', () => {
        const DATABASE = createSymbolToken<string>('DATABASE');
        const factory = () => 'db-connection';
        const provider = asFactory(DATABASE, factory);

        expect(provider.provide).toBe(DATABASE);
        expect(provider.useFactory).toBe(factory);
        expect(provider.scope).toBe(Scope.SINGLETON);
      });

      it('should create factory provider with inject', () => {
        const DATABASE = createSymbolToken<string>('DATABASE');
        const provider = asFactory(DATABASE, (_config: ConfigService) => 'db', {
          inject: [ConfigService],
        });

        expect(provider.inject).toEqual([ConfigService]);
      });

      it('should create factory provider with custom scope', () => {
        const DATABASE = createSymbolToken<string>('DATABASE');
        const provider = asFactory(DATABASE, () => 'db', { scope: Scope.TRANSIENT });

        expect(provider.scope).toBe(Scope.TRANSIENT);
      });
    });

    describe('asValue', () => {
      it('should create value provider', () => {
        const CONFIG = createStringToken<{ port: number }>('CONFIG');
        const value = { port: 3030 };
        const provider = asValue(CONFIG, value);

        expect(provider.provide).toBe(CONFIG);
        expect(provider.useValue).toBe(value);
      });

      it('should allow null values', () => {
        const NULL_TOKEN = createStringToken<null>('NULL');
        const provider = asValue(NULL_TOKEN, null);

        expect(provider.useValue).toBeNull();
      });
    });

    describe('asExisting', () => {
      it('should create existing/alias provider', () => {
        const ALIAS = createStringToken<UserService>('ALIAS');
        const provider = asExisting(ALIAS, UserService);

        expect(provider.provide).toBe(ALIAS);
        expect(provider.useExisting).toBe(UserService);
      });
    });
  });

  describe('describeProvider', () => {
    it('should describe class provider', () => {
      const provider = { provide: UserService, useClass: MockUserService };
      const description = describeProvider(provider);

      expect(description).toContain('ClassProvider');
      expect(description).toContain('UserService');
      expect(description).toContain('MockUserService');
    });

    it('should describe factory provider', () => {
      const provider = {
        provide: UserService,
        useFactory: () => new UserService(),
        inject: [ConfigService],
      };
      const description = describeProvider(provider);

      expect(description).toContain('FactoryProvider');
      expect(description).toContain('ConfigService');
    });

    it('should describe value provider', () => {
      const CONFIG = createStringToken<{ port: number }>('CONFIG');
      const provider = { provide: CONFIG, useValue: { port: 3030 } };
      const description = describeProvider(provider);

      expect(description).toContain('ValueProvider');
      expect(description).toContain('CONFIG');
    });

    it('should describe existing provider', () => {
      const ALIAS = createStringToken<UserService>('ALIAS');
      const provider = { provide: ALIAS, useExisting: UserService };
      const description = describeProvider(provider);

      expect(description).toContain('ExistingProvider');
      expect(description).toContain('ALIAS');
      expect(description).toContain('UserService');
    });
  });
});
