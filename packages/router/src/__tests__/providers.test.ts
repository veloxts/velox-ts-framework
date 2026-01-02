/**
 * Tests for Router DI Providers
 *
 * Validates:
 * - Factory providers create correct service instances
 * - registerRouterProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Provider dependencies are correctly resolved
 */

import { Container, Scope } from '@veloxts/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import {
  appRouterProvider,
  registerRouterProviders,
  trpcInstanceProvider,
  trpcPluginOptionsProvider,
} from '../providers.js';
import {
  APP_ROUTER,
  PROCEDURE_COLLECTIONS,
  REST_ADAPTER_CONFIG,
  ROUTER_CONFIG,
  TRPC_INSTANCE,
  TRPC_PLUGIN_OPTIONS,
} from '../tokens.js';

// Test procedure collections
const testUserProcedures = defineProcedures('users', {
  getUser: procedure()
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ({ id: input.id, name: 'Test User' })),

  listUsers: procedure().query(async () => [{ id: '1', name: 'User 1' }]),

  createUser: procedure()
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
});

const testPostProcedures = defineProcedures('posts', {
  getPost: procedure()
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => ({ id: input.id, title: 'Test Post' })),

  listPosts: procedure().query(async () => [{ id: '1', title: 'Post 1' }]),
});

describe('Router DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('trpcInstanceProvider', () => {
    it('creates tRPC instance', () => {
      container.register(trpcInstanceProvider());

      const t = container.resolve(TRPC_INSTANCE);

      expect(t).toBeDefined();
      expect(typeof t.router).toBe('function');
      expect(typeof t.procedure).toBe('object');
    });

    it('provider has SINGLETON scope', () => {
      const provider = trpcInstanceProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      container.register(trpcInstanceProvider());

      const t1 = container.resolve(TRPC_INSTANCE);
      const t2 = container.resolve(TRPC_INSTANCE);

      expect(t1).toBe(t2);
    });

    it('creates functional tRPC instance that can build routers', () => {
      container.register(trpcInstanceProvider());

      const t = container.resolve(TRPC_INSTANCE);
      const router = t.router({
        hello: t.procedure.query(() => 'Hello World'),
      });

      expect(router).toBeDefined();
    });

    it('has empty inject array (no dependencies)', () => {
      const provider = trpcInstanceProvider();

      expect(provider.inject).toEqual([]);
    });
  });

  describe('appRouterProvider', () => {
    beforeEach(() => {
      container.register(trpcInstanceProvider());
      container.register({
        provide: PROCEDURE_COLLECTIONS,
        useValue: [testUserProcedures, testPostProcedures],
      });
    });

    it('creates app router from procedure collections', () => {
      container.register(appRouterProvider());

      const router = container.resolve(APP_ROUTER);

      expect(router).toBeDefined();
    });

    it('provider has SINGLETON scope', () => {
      const provider = appRouterProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('returns same instance on multiple resolves', () => {
      container.register(appRouterProvider());

      const router1 = container.resolve(APP_ROUTER);
      const router2 = container.resolve(APP_ROUTER);

      expect(router1).toBe(router2);
    });

    it('injects TRPC_INSTANCE and PROCEDURE_COLLECTIONS', () => {
      const provider = appRouterProvider();

      expect(provider.inject).toContain(TRPC_INSTANCE);
      expect(provider.inject).toContain(PROCEDURE_COLLECTIONS);
    });

    it('throws if TRPC_INSTANCE is not registered', () => {
      const freshContainer = new Container();
      freshContainer.register({
        provide: PROCEDURE_COLLECTIONS,
        useValue: [testUserProcedures],
      });
      freshContainer.register(appRouterProvider());

      expect(() => freshContainer.resolve(APP_ROUTER)).toThrow(
        'No provider found for: TRPC_INSTANCE'
      );
    });

    it('throws if PROCEDURE_COLLECTIONS is not registered', () => {
      const freshContainer = new Container();
      freshContainer.register(trpcInstanceProvider());
      freshContainer.register(appRouterProvider());

      expect(() => freshContainer.resolve(APP_ROUTER)).toThrow(
        'No provider found for: PROCEDURE_COLLECTIONS'
      );
    });
  });

  describe('trpcPluginOptionsProvider', () => {
    beforeEach(() => {
      container.register(trpcInstanceProvider());
      container.register({
        provide: PROCEDURE_COLLECTIONS,
        useValue: [testUserProcedures],
      });
      container.register({
        provide: ROUTER_CONFIG,
        useValue: { rpcPrefix: '/trpc' },
      });
      container.register(appRouterProvider());
    });

    it('creates tRPC plugin options', () => {
      container.register(trpcPluginOptionsProvider());

      const options = container.resolve(TRPC_PLUGIN_OPTIONS);

      expect(options).toBeDefined();
      expect(options.prefix).toBe('/trpc');
      expect(options.router).toBeDefined();
    });

    it('provider has SINGLETON scope', () => {
      const provider = trpcPluginOptionsProvider();

      expect(provider.scope).toBe(Scope.SINGLETON);
    });

    it('uses custom prefix from config', () => {
      container.register({
        provide: ROUTER_CONFIG,
        useValue: { rpcPrefix: '/rpc' },
      });
      container.register(trpcPluginOptionsProvider());

      const options = container.resolve(TRPC_PLUGIN_OPTIONS);

      expect(options.prefix).toBe('/rpc');
    });

    it('uses default prefix when not specified', () => {
      container.register({
        provide: ROUTER_CONFIG,
        useValue: {},
      });
      container.register(trpcPluginOptionsProvider());

      const options = container.resolve(TRPC_PLUGIN_OPTIONS);

      expect(options.prefix).toBe('/trpc');
    });

    it('injects APP_ROUTER and ROUTER_CONFIG', () => {
      const provider = trpcPluginOptionsProvider();

      expect(provider.inject).toContain(APP_ROUTER);
      expect(provider.inject).toContain(ROUTER_CONFIG);
    });
  });

  describe('registerRouterProviders', () => {
    it('registers all router providers at once', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures, testPostProcedures],
        apiPrefix: '/api',
        rpcPrefix: '/trpc',
      });

      expect(container.isRegistered(ROUTER_CONFIG)).toBe(true);
      expect(container.isRegistered(PROCEDURE_COLLECTIONS)).toBe(true);
      expect(container.isRegistered(REST_ADAPTER_CONFIG)).toBe(true);
      expect(container.isRegistered(TRPC_INSTANCE)).toBe(true);
      expect(container.isRegistered(APP_ROUTER)).toBe(true);
      expect(container.isRegistered(TRPC_PLUGIN_OPTIONS)).toBe(true);
    });

    it('config values are accessible from container', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
        apiPrefix: '/v1',
        rpcPrefix: '/rpc',
      });

      const routerConfig = container.resolve(ROUTER_CONFIG);
      const restConfig = container.resolve(REST_ADAPTER_CONFIG);
      const collections = container.resolve(PROCEDURE_COLLECTIONS);

      expect(routerConfig.apiPrefix).toBe('/v1');
      expect(routerConfig.rpcPrefix).toBe('/rpc');
      expect(restConfig.prefix).toBe('/v1');
      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('users');
    });

    it('services are fully functional after bulk registration', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures, testPostProcedures],
      });

      const t = container.resolve(TRPC_INSTANCE);
      const router = container.resolve(APP_ROUTER);

      // tRPC instance should work
      expect(typeof t.router).toBe('function');

      // Router should be created
      expect(router).toBeDefined();
    });

    it('handles empty procedures array', () => {
      registerRouterProviders(container, {
        procedures: [],
      });

      // Core services should still be registered
      expect(container.isRegistered(ROUTER_CONFIG)).toBe(true);
      expect(container.isRegistered(TRPC_INSTANCE)).toBe(true);

      // App router should NOT be registered (no procedures)
      expect(container.isRegistered(APP_ROUTER)).toBe(false);
    });

    it('handles no procedures provided', () => {
      registerRouterProviders(container, {});

      // Core services should still be registered
      expect(container.isRegistered(ROUTER_CONFIG)).toBe(true);
      expect(container.isRegistered(TRPC_INSTANCE)).toBe(true);

      // App router should NOT be registered
      expect(container.isRegistered(APP_ROUTER)).toBe(false);
    });

    it('uses default prefixes when not specified', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
      });

      const restConfig = container.resolve(REST_ADAPTER_CONFIG);
      const pluginOptions = container.resolve(TRPC_PLUGIN_OPTIONS);

      expect(restConfig.prefix).toBe('/api');
      expect(pluginOptions.prefix).toBe('/trpc');
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking TRPC_INSTANCE after registration', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
      });

      // Create a mock tRPC instance
      const mockTRPC = {
        router: vi.fn().mockReturnValue({}),
        procedure: { query: vi.fn(), mutation: vi.fn() },
      };

      container.register({ provide: TRPC_INSTANCE, useValue: mockTRPC });

      const t = container.resolve(TRPC_INSTANCE);

      expect(t).toBe(mockTRPC);
    });

    it('allows mocking APP_ROUTER after registration', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
      });

      const mockRouter = { users: {} };
      container.register({ provide: APP_ROUTER, useValue: mockRouter });

      const router = container.resolve(APP_ROUTER);

      expect(router).toBe(mockRouter);
    });

    it('child container can override parent registrations', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
      });

      const childContainer = container.createChild();

      // Create a mock tRPC instance for the child
      const mockTRPC = {
        router: vi.fn().mockReturnValue({}),
        procedure: { query: vi.fn(), mutation: vi.fn() },
      };

      childContainer.register({ provide: TRPC_INSTANCE, useValue: mockTRPC });

      const parentT = container.resolve(TRPC_INSTANCE);
      const childT = childContainer.resolve(TRPC_INSTANCE);

      expect(childT).toBe(mockTRPC);
      expect(parentT).not.toBe(mockTRPC);
    });

    it('child container inherits parent registrations', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures],
      });

      const childContainer = container.createChild();

      // Should resolve from parent
      const t = childContainer.resolve(TRPC_INSTANCE);
      const router = childContainer.resolve(APP_ROUTER);

      expect(t).toBeDefined();
      expect(router).toBeDefined();
    });
  });

  describe('Provider Injection Dependencies', () => {
    it('trpcInstanceProvider has no dependencies', () => {
      const provider = trpcInstanceProvider();

      expect(provider.inject).toEqual([]);
    });

    it('appRouterProvider depends on TRPC_INSTANCE and PROCEDURE_COLLECTIONS', () => {
      const provider = appRouterProvider();

      expect(provider.inject).toEqual([TRPC_INSTANCE, PROCEDURE_COLLECTIONS]);
    });

    it('trpcPluginOptionsProvider depends on APP_ROUTER and ROUTER_CONFIG', () => {
      const provider = trpcPluginOptionsProvider();

      expect(provider.inject).toEqual([APP_ROUTER, ROUTER_CONFIG]);
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered token', () => {
      expect(() => container.resolve(TRPC_INSTANCE)).toThrow(
        'No provider found for: TRPC_INSTANCE'
      );
    });

    it('throws when resolving APP_ROUTER without dependencies', () => {
      container.register(appRouterProvider());

      expect(() => container.resolve(APP_ROUTER)).toThrow('No provider found for: TRPC_INSTANCE');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete router flow works with DI-provided services', () => {
      registerRouterProviders(container, {
        procedures: [testUserProcedures, testPostProcedures],
        apiPrefix: '/api',
        rpcPrefix: '/trpc',
      });

      const t = container.resolve(TRPC_INSTANCE);
      const router = container.resolve(APP_ROUTER);
      const options = container.resolve(TRPC_PLUGIN_OPTIONS);

      // tRPC instance should be functional
      expect(typeof t.router).toBe('function');

      // Router should be created from both collections
      expect(router).toBeDefined();

      // Plugin options should have correct config
      expect(options.prefix).toBe('/trpc');
      expect(options.router).toBe(router);
    });

    it('multiple containers can have independent service instances', () => {
      const container1 = new Container();
      const container2 = new Container();

      registerRouterProviders(container1, {
        procedures: [testUserProcedures],
        rpcPrefix: '/trpc1',
      });

      registerRouterProviders(container2, {
        procedures: [testPostProcedures],
        rpcPrefix: '/trpc2',
      });

      const t1 = container1.resolve(TRPC_INSTANCE);
      const t2 = container2.resolve(TRPC_INSTANCE);

      // Different instances
      expect(t1).not.toBe(t2);

      // Different routers
      const router1 = container1.resolve(APP_ROUTER);
      const router2 = container2.resolve(APP_ROUTER);
      expect(router1).not.toBe(router2);

      // Different plugin options
      const options1 = container1.resolve(TRPC_PLUGIN_OPTIONS);
      const options2 = container2.resolve(TRPC_PLUGIN_OPTIONS);
      expect(options1.prefix).toBe('/trpc1');
      expect(options2.prefix).toBe('/trpc2');
    });
  });
});
