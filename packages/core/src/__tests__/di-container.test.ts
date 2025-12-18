/**
 * @veloxts/core - DI Container Unit Tests
 * Tests container registration, resolution, and lifecycle management
 *
 * NOTE: These tests work with Vitest/esbuild which does NOT support
 * `emitDecoratorMetadata`. Therefore, tests use factory providers with
 * explicit inject arrays instead of automatic constructor injection.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  Container,
  container,
  createContainer,
  createStringToken,
  createSymbolToken,
  Injectable,
  Scope,
} from '../di/index.js';
import { VeloxError } from '../errors.js';

// Simple test services (no dependencies)
@Injectable()
class ConfigService {
  readonly port = 3030;
  readonly host = 'localhost';
}

@Injectable()
class LoggerService {
  log(message: string): string {
    return `[LOG] ${message}`;
  }
}

@Injectable({ scope: Scope.TRANSIENT })
class TransientService {
  readonly id = Math.random();
}

// Tokens for interface injection
interface DatabaseClient {
  query(sql: string): string[];
}

const DATABASE = createStringToken<DatabaseClient>('DATABASE');
const LOGGER = createSymbolToken<LoggerService>('LOGGER');

describe('DI Container', () => {
  let testContainer: Container;

  beforeEach(() => {
    testContainer = new Container();
  });

  describe('Container Creation', () => {
    it('should create container with default options', () => {
      const c = new Container();
      expect(c).toBeInstanceOf(Container);
    });

    it('should create container with autoRegister option', () => {
      const c = new Container({ autoRegister: true });
      const debugInfo = c.getDebugInfo();
      expect(debugInfo.autoRegister).toBe(true);
    });

    it('should create container using factory function', () => {
      const c = createContainer();
      expect(c).toBeInstanceOf(Container);
    });

    it('should have global container instance', () => {
      expect(container).toBeInstanceOf(Container);
    });
  });

  describe('Registration', () => {
    it('should register class provider', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      expect(testContainer.isRegistered(ConfigService)).toBe(true);
    });

    it('should register factory provider', () => {
      testContainer.register({
        provide: DATABASE,
        useFactory: () => ({ query: (sql: string) => [sql] }),
      });

      expect(testContainer.isRegistered(DATABASE)).toBe(true);
    });

    it('should register value provider', () => {
      const config = { port: 8080 };
      const CONFIG = createStringToken<{ port: number }>('CONFIG');

      testContainer.register({
        provide: CONFIG,
        useValue: config,
      });

      expect(testContainer.isRegistered(CONFIG)).toBe(true);
    });

    it('should register existing/alias provider', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      const CONFIG_ALIAS = createStringToken<ConfigService>('CONFIG_ALIAS');
      testContainer.register({
        provide: CONFIG_ALIAS,
        useExisting: ConfigService,
      });

      expect(testContainer.isRegistered(CONFIG_ALIAS)).toBe(true);
    });

    it('should register multiple providers', () => {
      testContainer.registerMany([
        { provide: ConfigService, useClass: ConfigService },
        { provide: LoggerService, useClass: LoggerService },
      ]);

      expect(testContainer.isRegistered(ConfigService)).toBe(true);
      expect(testContainer.isRegistered(LoggerService)).toBe(true);
    });

    it('should support method chaining', () => {
      const result = testContainer
        .register({ provide: ConfigService, useClass: ConfigService })
        .register({ provide: LoggerService, useClass: LoggerService });

      expect(result).toBe(testContainer);
    });
  });

  describe('Resolution - Class Providers', () => {
    it('should resolve class provider', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      const config = testContainer.resolve(ConfigService);
      expect(config).toBeInstanceOf(ConfigService);
      expect(config.port).toBe(3030);
    });

    it('should return same instance for singleton scope', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
        scope: Scope.SINGLETON,
      });

      const instance1 = testContainer.resolve(ConfigService);
      const instance2 = testContainer.resolve(ConfigService);
      expect(instance1).toBe(instance2);
    });

    it('should return new instance for transient scope', () => {
      testContainer.register({
        provide: TransientService,
        useClass: TransientService,
        scope: Scope.TRANSIENT,
      });

      const instance1 = testContainer.resolve(TransientService);
      const instance2 = testContainer.resolve(TransientService);
      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });

  describe('Resolution - Factory Providers', () => {
    it('should resolve factory provider', () => {
      testContainer.register({
        provide: DATABASE,
        useFactory: () => ({
          query: (sql: string) => [`result: ${sql}`],
        }),
      });

      const db = testContainer.resolve(DATABASE);
      expect(db.query('SELECT 1')).toEqual(['result: SELECT 1']);
    });

    it('should inject dependencies into factory', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      testContainer.register({
        provide: DATABASE,
        useFactory: (config: ConfigService) => ({
          query: (_sql: string) => [`port: ${config.port}`],
        }),
        inject: [ConfigService],
      });

      const db = testContainer.resolve(DATABASE);
      expect(db.query('')).toEqual(['port: 3030']);
    });

    it('should resolve factory with multiple dependencies', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });
      testContainer.register({
        provide: LoggerService,
        useClass: LoggerService,
      });

      interface UserService {
        config: ConfigService;
        logger: LoggerService;
      }

      const USER_SERVICE = createStringToken<UserService>('USER_SERVICE');
      testContainer.register({
        provide: USER_SERVICE,
        useFactory: (config: ConfigService, logger: LoggerService) => ({
          config,
          logger,
        }),
        inject: [ConfigService, LoggerService],
      });

      const userService = testContainer.resolve(USER_SERVICE);
      expect(userService.config).toBeInstanceOf(ConfigService);
      expect(userService.logger).toBeInstanceOf(LoggerService);
    });
  });

  describe('Resolution - Value Providers', () => {
    it('should resolve value provider', () => {
      const CONFIG = createStringToken<{ port: number }>('CONFIG');
      const config = { port: 8080 };

      testContainer.register({
        provide: CONFIG,
        useValue: config,
      });

      const resolved = testContainer.resolve(CONFIG);
      expect(resolved).toBe(config);
    });

    it('should always return same value instance', () => {
      const CONFIG = createStringToken<{ port: number }>('CONFIG');
      const config = { port: 8080 };

      testContainer.register({
        provide: CONFIG,
        useValue: config,
        scope: Scope.TRANSIENT, // Should be ignored for value providers
      });

      const resolved1 = testContainer.resolve(CONFIG);
      const resolved2 = testContainer.resolve(CONFIG);
      expect(resolved1).toBe(resolved2);
      expect(resolved1).toBe(config);
    });
  });

  describe('Resolution - Existing/Alias Providers', () => {
    it('should resolve alias to actual implementation', () => {
      testContainer.register({
        provide: LoggerService,
        useClass: LoggerService,
      });

      testContainer.register({
        provide: LOGGER,
        useExisting: LoggerService,
      });

      const logger1 = testContainer.resolve(LoggerService);
      const logger2 = testContainer.resolve(LOGGER);

      expect(logger1).toBe(logger2);
    });
  });

  describe('resolveOptional', () => {
    it('should return instance if registered', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      const config = testContainer.resolveOptional(ConfigService);
      expect(config).toBeInstanceOf(ConfigService);
    });

    it('should return undefined if not registered', () => {
      const config = testContainer.resolveOptional(ConfigService);
      expect(config).toBeUndefined();
    });
  });

  describe('resolveAll', () => {
    it('should return array with single instance', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      const configs = testContainer.resolveAll(ConfigService);
      expect(configs).toHaveLength(1);
      expect(configs[0]).toBeInstanceOf(ConfigService);
    });

    it('should return empty array if not registered', () => {
      const configs = testContainer.resolveAll(ConfigService);
      expect(configs).toEqual([]);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies in factory providers', () => {
      const SERVICE_A = createStringToken<{ b: unknown }>('SERVICE_A');
      const SERVICE_B = createStringToken<{ a: unknown }>('SERVICE_B');

      testContainer.register({
        provide: SERVICE_A,
        useFactory: (b: unknown) => ({ b }),
        inject: [SERVICE_B],
      });

      testContainer.register({
        provide: SERVICE_B,
        useFactory: (a: unknown) => ({ a }),
        inject: [SERVICE_A],
      });

      expect(() => testContainer.resolve(SERVICE_A)).toThrow('Circular dependency detected');
    });
  });

  describe('Auto Registration', () => {
    it('should auto-register @Injectable class when enabled', () => {
      const autoContainer = new Container({ autoRegister: true });

      // ConfigService is @Injectable, should auto-register
      const config = autoContainer.resolve(ConfigService);
      expect(config).toBeInstanceOf(ConfigService);
    });

    it('should not auto-register without @Injectable', () => {
      const autoContainer = new Container({ autoRegister: true });

      class NonInjectableService {}

      expect(() => autoContainer.resolve(NonInjectableService)).toThrow('No provider found');
    });

    it('should not auto-register when disabled', () => {
      const noAutoContainer = new Container({ autoRegister: false });

      expect(() => noAutoContainer.resolve(ConfigService)).toThrow('No provider found');
    });
  });

  describe('Hierarchical Containers', () => {
    it('should resolve from parent container', () => {
      const parent = new Container();
      parent.register({ provide: ConfigService, useClass: ConfigService });

      const child = new Container({ parent });
      const config = child.resolve(ConfigService);

      expect(config).toBeInstanceOf(ConfigService);
    });

    it('should override parent registration in child', () => {
      class ParentConfig {
        readonly name = 'parent';
      }

      class ChildConfig {
        readonly name = 'child';
      }

      const CONFIG = createStringToken<{ name: string }>('CONFIG');

      const parent = new Container();
      parent.register({ provide: CONFIG, useValue: new ParentConfig() });

      const child = new Container({ parent });
      child.register({ provide: CONFIG, useValue: new ChildConfig() });

      const parentConfig = parent.resolve(CONFIG);
      const childConfig = child.resolve(CONFIG);

      expect(parentConfig.name).toBe('parent');
      expect(childConfig.name).toBe('child');
    });

    it('should check registration in hierarchy', () => {
      const parent = new Container();
      parent.register({ provide: ConfigService, useClass: ConfigService });

      const child = new Container({ parent });

      expect(child.isRegistered(ConfigService)).toBe(true);
    });

    it('should create child container', () => {
      testContainer.register({ provide: ConfigService, useClass: ConfigService });

      const child = testContainer.createChild();
      const config = child.resolve(ConfigService);

      expect(config).toBeInstanceOf(ConfigService);
    });
  });

  describe('Error Handling', () => {
    it('should throw for unregistered token', () => {
      expect(() => testContainer.resolve(ConfigService)).toThrow(VeloxError);
      expect(() => testContainer.resolve(ConfigService)).toThrow('No provider found');
    });

    it('should include token name in error', () => {
      try {
        testContainer.resolve(ConfigService);
      } catch (error) {
        expect(error).toBeInstanceOf(VeloxError);
        expect((error as VeloxError).message).toContain('ConfigService');
      }
    });

    it('should throw for async factory in sync resolution', () => {
      testContainer.register({
        provide: DATABASE,
        useFactory: async () => ({ query: () => [] }),
      });

      expect(() => testContainer.resolve(DATABASE)).toThrow('Async factory');
    });
  });

  describe('Async Resolution', () => {
    it('should resolve async factory', async () => {
      testContainer.register({
        provide: DATABASE,
        useFactory: async () => ({
          query: (sql: string) => [`async: ${sql}`],
        }),
      });

      const db = await testContainer.resolveAsync(DATABASE);
      expect(db.query('SELECT 1')).toEqual(['async: SELECT 1']);
    });

    it('should cache singleton from async resolution', async () => {
      let callCount = 0;

      testContainer.register({
        provide: DATABASE,
        useFactory: async () => {
          callCount++;
          return { query: () => [] };
        },
        scope: Scope.SINGLETON,
      });

      await testContainer.resolveAsync(DATABASE);
      await testContainer.resolveAsync(DATABASE);

      expect(callCount).toBe(1);
    });

    it('should create new instances for transient async', async () => {
      let callCount = 0;

      testContainer.register({
        provide: DATABASE,
        useFactory: async () => {
          callCount++;
          return { query: () => [] };
        },
        scope: Scope.TRANSIENT,
      });

      await testContainer.resolveAsync(DATABASE);
      await testContainer.resolveAsync(DATABASE);

      expect(callCount).toBe(2);
    });

    it('should inject dependencies into async factory', async () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      testContainer.register({
        provide: DATABASE,
        useFactory: async (config: ConfigService) => ({
          query: () => [`port: ${config.port}`],
        }),
        inject: [ConfigService],
      });

      const db = await testContainer.resolveAsync(DATABASE);
      expect(db.query('')).toEqual(['port: 3030']);
    });
  });

  describe('Container Management', () => {
    it('should clear instances', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
        scope: Scope.SINGLETON,
      });

      const instance1 = testContainer.resolve(ConfigService);
      testContainer.clearInstances();
      const instance2 = testContainer.resolve(ConfigService);

      expect(instance1).not.toBe(instance2);
    });

    it('should reset container', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      testContainer.reset();

      expect(testContainer.isRegistered(ConfigService)).toBe(false);
    });

    it('should provide debug info', () => {
      testContainer.register({
        provide: ConfigService,
        useClass: ConfigService,
      });

      const info = testContainer.getDebugInfo();

      expect(info.providerCount).toBe(1);
      expect(info.providers).toHaveLength(1);
      expect(info.providers[0]).toContain('class');
      expect(info.providers[0]).toContain('ConfigService');
    });
  });

  describe('Token Types', () => {
    it('should work with class tokens', () => {
      testContainer.register({ provide: ConfigService, useClass: ConfigService });
      const config = testContainer.resolve(ConfigService);
      expect(config).toBeInstanceOf(ConfigService);
    });

    it('should work with string tokens', () => {
      const TOKEN = createStringToken<number>('MY_NUMBER');
      testContainer.register({ provide: TOKEN, useValue: 42 });
      const value = testContainer.resolve(TOKEN);
      expect(value).toBe(42);
    });

    it('should work with symbol tokens', () => {
      const TOKEN = createSymbolToken<string>('MY_STRING');
      testContainer.register({ provide: TOKEN, useValue: 'hello' });
      const value = testContainer.resolve(TOKEN);
      expect(value).toBe('hello');
    });
  });

  describe('Provider getProvider', () => {
    it('should return provider for registered token', () => {
      testContainer.register({ provide: ConfigService, useClass: ConfigService });
      const provider = testContainer.getProvider(ConfigService);

      expect(provider).toBeDefined();
      expect(provider?.type).toBe('class');
    });

    it('should return undefined for unregistered token', () => {
      const provider = testContainer.getProvider(ConfigService);
      expect(provider).toBeUndefined();
    });

    it('should return provider from parent', () => {
      const parent = new Container();
      parent.register({ provide: ConfigService, useClass: ConfigService });

      const child = new Container({ parent });
      const provider = child.getProvider(ConfigService);

      expect(provider).toBeDefined();
    });
  });
});
