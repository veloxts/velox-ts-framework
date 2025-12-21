/**
 * @veloxts/core - DI Container Unit Tests
 * Tests container registration, resolution, and lifecycle management
 *
 * NOTE: These tests work with Vitest/esbuild which does NOT support
 * `emitDecoratorMetadata`. Therefore, tests use factory providers with
 * explicit inject arrays instead of automatic constructor injection.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Container, container, Injectable, Scope, token } from '../di/index.js';
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

const DATABASE = token<DatabaseClient>('DATABASE');
const LOGGER = token.symbol<LoggerService>('LOGGER');

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
      const CONFIG = token<{ port: number }>('CONFIG');

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

      const CONFIG_ALIAS = token<ConfigService>('CONFIG_ALIAS');
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

      const USER_SERVICE = token<UserService>('USER_SERVICE');
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
      const CONFIG = token<{ port: number }>('CONFIG');
      const config = { port: 8080 };

      testContainer.register({
        provide: CONFIG,
        useValue: config,
      });

      const resolved = testContainer.resolve(CONFIG);
      expect(resolved).toBe(config);
    });

    it('should always return same value instance', () => {
      const CONFIG = token<{ port: number }>('CONFIG');
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
      const SERVICE_A = token<{ b: unknown }>('SERVICE_A');
      const SERVICE_B = token<{ a: unknown }>('SERVICE_B');

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

      const CONFIG = token<{ name: string }>('CONFIG');

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
      const TOKEN = token<number>('MY_NUMBER');
      testContainer.register({ provide: TOKEN, useValue: 42 });
      const value = testContainer.resolve(TOKEN);
      expect(value).toBe(42);
    });

    it('should work with symbol tokens', () => {
      const TOKEN = token.symbol<string>('MY_STRING');
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

  describe('REQUEST Scope Resolution', () => {
    let onRequestHook: ((request: unknown) => Promise<void>) | null = null;
    let onResponseHook: ((request: unknown) => Promise<void>) | null = null;

    function setupFastifyMock(c: Container) {
      onRequestHook = null;
      onResponseHook = null;

      const mockServer = {
        addHook: vi.fn((name: string, handler: (request: unknown) => Promise<void>) => {
          if (name === 'onRequest') onRequestHook = handler;
          if (name === 'onResponse') onResponseHook = handler;
        }),
      };

      c.attachToFastify(mockServer as never);
    }

    it('should resolve request-scoped service within request context', async () => {
      @Injectable({ scope: Scope.REQUEST })
      class RequestScopedService {
        readonly id = Math.random();
      }

      const REQUEST_TOKEN = token<RequestScopedService>('REQUEST_SERVICE');
      testContainer.register({
        provide: REQUEST_TOKEN,
        useClass: RequestScopedService,
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      // Simulate request lifecycle
      const mockRequest = {};
      await onRequestHook?.(mockRequest);

      // Resolve within request context
      const instance1 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest as never });
      const instance2 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest as never });

      // Same instance within same request
      expect(instance1).toBe(instance2);

      // Cleanup
      await onResponseHook?.(mockRequest);
    });

    it('should create new instance for different requests', async () => {
      @Injectable({ scope: Scope.REQUEST })
      class RequestScopedService {
        readonly id = Math.random();
      }

      const REQUEST_TOKEN = token<RequestScopedService>('REQUEST_SERVICE_2');
      testContainer.register({
        provide: REQUEST_TOKEN,
        useClass: RequestScopedService,
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      // First request
      const mockRequest1 = {};
      await onRequestHook?.(mockRequest1);
      const instance1 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest1 as never });
      await onResponseHook?.(mockRequest1);

      // Second request
      const mockRequest2 = {};
      await onRequestHook?.(mockRequest2);
      const instance2 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest2 as never });
      await onResponseHook?.(mockRequest2);

      // Different instances for different requests
      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('should throw when resolving request-scoped outside request', () => {
      const REQUEST_TOKEN = token<object>('REQUEST_SERVICE_3');
      testContainer.register({
        provide: REQUEST_TOKEN,
        useFactory: () => ({ value: 'test' }),
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      // No request context
      expect(() => testContainer.resolve(REQUEST_TOKEN)).toThrow(
        'Cannot resolve request-scoped service outside of request context'
      );
    });

    it('should resolve request-scoped factory provider', async () => {
      let callCount = 0;
      const REQUEST_TOKEN = token<{ count: number }>('REQUEST_FACTORY');

      testContainer.register({
        provide: REQUEST_TOKEN,
        useFactory: () => {
          callCount++;
          return { count: callCount };
        },
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      const mockRequest = {};
      await onRequestHook?.(mockRequest);

      const instance1 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest as never });
      const instance2 = testContainer.resolve(REQUEST_TOKEN, { request: mockRequest as never });

      // Factory called once, cached for request
      expect(callCount).toBe(1);
      expect(instance1).toBe(instance2);

      await onResponseHook?.(mockRequest);
    });
  });

  describe('Async Resolution with Optional Dependencies', () => {
    it('should resolve async factory with optional dependency returning undefined', async () => {
      const OPTIONAL_DEP = token<{ value: string }>('OPTIONAL_DEP');
      const SERVICE = token<{ dep: { value: string } | undefined }>('SERVICE_WITH_OPTIONAL');

      // OPTIONAL_DEP is NOT registered

      testContainer.register({
        provide: SERVICE,
        useFactory: async () => {
          const dep = testContainer.resolveOptional(OPTIONAL_DEP);
          return { dep };
        },
      });

      const instance = await testContainer.resolveAsync(SERVICE);
      expect(instance.dep).toBeUndefined();
    });

    it('should handle async factory with missing dependency', async () => {
      const DEP_TOKEN = token<{ value: number }>('ASYNC_DEP');
      const SERVICE_TOKEN = token<{ dep: { value: number } | undefined }>('SERVICE_WITH_ASYNC_DEP');

      // DEP_TOKEN is NOT registered - use resolveOptional in factory
      testContainer.register({
        provide: SERVICE_TOKEN,
        useFactory: async () => {
          const dep = testContainer.resolveOptional(DEP_TOKEN);
          return { dep };
        },
      });

      const instance = await testContainer.resolveAsync(SERVICE_TOKEN);
      expect(instance.dep).toBeUndefined();
    });

    it('should resolve async factory with available dependency', async () => {
      const DEP_TOKEN = token<{ value: number }>('ASYNC_DEP_AVAILABLE');
      const SERVICE_TOKEN = token<{ dep: { value: number } }>('SERVICE_WITH_AVAILABLE_DEP');

      // Register the dependency
      testContainer.register({
        provide: DEP_TOKEN,
        useValue: { value: 42 },
      });

      // Factory uses inject array for explicit dependency injection
      testContainer.register({
        provide: SERVICE_TOKEN,
        useFactory: async (dep: { value: number }) => ({ dep }),
        inject: [DEP_TOKEN],
      });

      const instance = await testContainer.resolveAsync(SERVICE_TOKEN);
      expect(instance.dep).toEqual({ value: 42 });
    });

    it('should handle async factory with multiple dependencies', async () => {
      const DEP_A = token<{ a: string }>('DEP_A');
      const DEP_B = token<{ b: number }>('DEP_B');
      const COMBINED = token<{ a: string; b: number }>('COMBINED');

      testContainer.register({
        provide: DEP_A,
        useFactory: async () => ({ a: 'hello' }),
      });

      testContainer.register({
        provide: DEP_B,
        useValue: { b: 100 },
      });

      testContainer.register({
        provide: COMBINED,
        useFactory: async (depA: { a: string }, depB: { b: number }) => ({
          a: depA.a,
          b: depB.b,
        }),
        inject: [DEP_A, DEP_B],
      });

      const instance = await testContainer.resolveAsync(COMBINED);
      expect(instance).toEqual({ a: 'hello', b: 100 });
    });
  });

  describe('Container.createContext', () => {
    it('should create a resolution context from request', () => {
      const mockRequest = { id: 'test-request-123' };
      const context = Container.createContext(mockRequest as never);

      expect(context).toEqual({ request: mockRequest });
    });

    it('should create context that works with request-scoped resolution', async () => {
      const REQUEST_TOKEN = token<object>('CONTEXT_TEST_SERVICE');

      testContainer.register({
        provide: REQUEST_TOKEN,
        useFactory: () => ({ data: 'test' }),
        scope: Scope.REQUEST,
      });

      // Setup Fastify hooks
      let onRequestHook: ((request: unknown) => Promise<void>) | null = null;
      const mockServer = {
        addHook: vi.fn((name: string, handler: (request: unknown) => Promise<void>) => {
          if (name === 'onRequest') onRequestHook = handler;
        }),
      };
      testContainer.attachToFastify(mockServer as never);

      const mockRequest = { url: '/test' };
      await onRequestHook?.(mockRequest);

      // Use Container.createContext to create context
      const context = Container.createContext(mockRequest as never);
      const instance = testContainer.resolve(REQUEST_TOKEN, context);

      expect(instance).toEqual({ data: 'test' });
    });
  });

  describe('attachToFastify', () => {
    it('should return the container for chaining', () => {
      const mockServer = {
        addHook: vi.fn(),
      };

      const result = testContainer.attachToFastify(mockServer as never);
      expect(result).toBe(testContainer);
    });
  });

  describe('Async REQUEST Scope Resolution', () => {
    let onRequestHook: ((request: unknown) => Promise<void>) | null = null;
    let onResponseHook: ((request: unknown) => Promise<void>) | null = null;

    function setupFastifyMock(c: Container) {
      onRequestHook = null;
      onResponseHook = null;

      const mockServer = {
        addHook: vi.fn((name: string, handler: (request: unknown) => Promise<void>) => {
          if (name === 'onRequest') onRequestHook = handler;
          if (name === 'onResponse') onResponseHook = handler;
        }),
      };

      c.attachToFastify(mockServer as never);
    }

    it('should resolve async request-scoped service', async () => {
      const REQUEST_TOKEN = token<{ id: number }>('ASYNC_REQUEST_SERVICE');
      let callCount = 0;

      testContainer.register({
        provide: REQUEST_TOKEN,
        useFactory: async () => {
          callCount++;
          return { id: callCount };
        },
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      const mockRequest = {};
      await onRequestHook?.(mockRequest);

      // First resolution creates instance
      const instance1 = await testContainer.resolveAsync(REQUEST_TOKEN, {
        request: mockRequest as never,
      });
      // Second resolution returns cached instance
      const instance2 = await testContainer.resolveAsync(REQUEST_TOKEN, {
        request: mockRequest as never,
      });

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);

      await onResponseHook?.(mockRequest);
    });

    it('should throw when resolving async request-scoped outside request', async () => {
      const REQUEST_TOKEN = token<object>('ASYNC_REQUEST_SERVICE_2');

      testContainer.register({
        provide: REQUEST_TOKEN,
        useFactory: async () => ({ data: 'test' }),
        scope: Scope.REQUEST,
      });

      setupFastifyMock(testContainer);

      await expect(testContainer.resolveAsync(REQUEST_TOKEN)).rejects.toThrow(
        'Cannot resolve request-scoped service outside of request context'
      );
    });
  });

  describe('Async useExisting Provider', () => {
    it('should resolve async existing/alias provider', async () => {
      const ORIGINAL = token<{ value: string }>('ORIGINAL_ASYNC');
      const ALIAS = token<{ value: string }>('ALIAS_ASYNC');

      testContainer.register({
        provide: ORIGINAL,
        useFactory: async () => ({ value: 'original' }),
      });

      testContainer.register({
        provide: ALIAS,
        useExisting: ORIGINAL,
      });

      const original = await testContainer.resolveAsync(ORIGINAL);
      const alias = await testContainer.resolveAsync(ALIAS);

      expect(original).toBe(alias);
      expect(alias.value).toBe('original');
    });
  });

  describe('Async Class Instantiation', () => {
    it('should resolve async class provider', async () => {
      @Injectable()
      class AsyncService {
        readonly timestamp = Date.now();
      }

      testContainer.register({
        provide: AsyncService,
        useClass: AsyncService,
      });

      const instance = await testContainer.resolveAsync(AsyncService);
      expect(instance).toBeInstanceOf(AsyncService);
      expect(typeof instance.timestamp).toBe('number');
    });

    it('should cache singleton from async class resolution', async () => {
      @Injectable()
      class AsyncSingletonService {
        readonly id = Math.random();
      }

      testContainer.register({
        provide: AsyncSingletonService,
        useClass: AsyncSingletonService,
        scope: Scope.SINGLETON,
      });

      const instance1 = await testContainer.resolveAsync(AsyncSingletonService);
      const instance2 = await testContainer.resolveAsync(AsyncSingletonService);

      expect(instance1).toBe(instance2);
    });

    it('should create new instances for transient async class', async () => {
      @Injectable()
      class AsyncTransientService {
        readonly id = Math.random();
      }

      testContainer.register({
        provide: AsyncTransientService,
        useClass: AsyncTransientService,
        scope: Scope.TRANSIENT,
      });

      const instance1 = await testContainer.resolveAsync(AsyncTransientService);
      const instance2 = await testContainer.resolveAsync(AsyncTransientService);

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });
});
