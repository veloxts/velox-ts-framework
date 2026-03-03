/**
 * @veloxts/core - Module System Tests
 * Tests defineModule() factory and isVeloxModule() type guard
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VeloxApp, veloxApp } from '../app.js';
import { createModulePlugin, defineModule, isVeloxModule } from '../module/index.js';
import type { VeloxModule } from '../module/types.js';

describe('defineModule()', () => {
  it('should create a module with name and empty config', () => {
    const mod = defineModule('billing', {});
    expect(mod.name).toBe('billing');
    expect(mod.config).toEqual({});
  });

  it('should preserve services config', () => {
    const factory = () => ({ track: () => {} });
    const mod = defineModule('analytics', {
      services: {
        tracker: { factory },
      },
    });
    expect(mod.config.services).toBeDefined();
    expect(mod.config.services?.tracker.factory).toBe(factory);
  });

  it('should preserve middleware config', () => {
    const middleware = async () => {};
    const mod = defineModule('auth', {
      middleware: [middleware],
    });
    expect(mod.config.middleware).toHaveLength(1);
    expect(mod.config.middleware?.[0]).toBe(middleware);
  });

  it('should preserve prefix config', () => {
    const mod = defineModule('billing', { prefix: '/pay' });
    expect(mod.config.prefix).toBe('/pay');
  });

  it('should allow false prefix to disable auto-prefix', () => {
    const mod = defineModule('billing', { prefix: false });
    expect(mod.config.prefix).toBe(false);
  });

  it('should preserve boot and shutdown callbacks', () => {
    const boot = async () => {};
    const shutdown = async () => {};
    const mod = defineModule('billing', { boot, shutdown });
    expect(mod.config.boot).toBe(boot);
    expect(mod.config.shutdown).toBe(shutdown);
  });

  it('should throw on empty name', () => {
    expect(() => defineModule('', {})).toThrow('Module must have a non-empty name');
  });

  it('should throw on whitespace-only name', () => {
    expect(() => defineModule('  ', {})).toThrow('Module must have a non-empty name');
  });

  it('should freeze the config', () => {
    const mod = defineModule('billing', { prefix: '/pay' });
    expect(Object.isFrozen(mod.config)).toBe(true);
  });

  it('should preserve the literal name type', () => {
    const mod = defineModule('billing', {});
    // This verifies the const generic — mod.name is 'billing', not string
    const name: 'billing' = mod.name;
    expect(name).toBe('billing');
  });
});

describe('isVeloxModule()', () => {
  it('should return true for a valid module', () => {
    const mod = defineModule('test', {});
    expect(isVeloxModule(mod)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isVeloxModule(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isVeloxModule(undefined)).toBe(false);
  });

  it('should return false for plain objects', () => {
    expect(isVeloxModule({})).toBe(false);
    expect(isVeloxModule({ name: 'foo' })).toBe(false);
    expect(isVeloxModule({ name: 'foo', config: {} })).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isVeloxModule('string')).toBe(false);
    expect(isVeloxModule(42)).toBe(false);
    expect(isVeloxModule(true)).toBe(false);
  });

  it('should return false for objects with wrong brand value', () => {
    const fake = { [Symbol.for('velox:module')]: 'not-true' };
    expect(isVeloxModule(fake)).toBe(false);
  });
});

describe('createModulePlugin()', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should create a registrable Fastify plugin from a module', () => {
    const mod = defineModule('billing', {});
    const plugin = createModulePlugin(mod);
    expect(typeof plugin).toBe('function');
  });

  it('should create services during registration', async () => {
    const factoryFn = vi.fn(() => ({ value: 42 }));
    const mod = defineModule('test', {
      services: { counter: { factory: factoryFn } },
    });

    app = await veloxApp({ port: 0, logger: false });
    const plugin = createModulePlugin(mod);
    await app.server.register(plugin);
    await app.start({ silent: true });

    expect(factoryFn).toHaveBeenCalledOnce();
  });

  it('should inject services into request context', async () => {
    const mod = defineModule('test', {
      services: { greeting: { factory: () => 'hello from module' } },
      prefix: false,
      routes: async (server) => {
        server.get('/test', async (request) => {
          return { value: (request as unknown as Record<string, unknown>).greeting };
        });
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const response = await app.server.inject({ method: 'GET', url: '/test' });
    expect(response.json()).toEqual({ value: 'hello from module' });
  });

  it('should apply module middleware as onRequest hooks', async () => {
    const middlewareCalled = vi.fn();
    const mod = defineModule('test', {
      middleware: [
        async () => {
          middlewareCalled();
        },
      ],
      prefix: false,
      routes: async (server) => {
        server.get('/test', async () => ({ ok: true }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    await app.server.inject({ method: 'GET', url: '/test' });
    expect(middlewareCalled).toHaveBeenCalledOnce();
  });

  it('should register routes with auto-prefix from module name', async () => {
    const mod = defineModule('billing', {
      routes: async (server) => {
        server.get('/invoices', async () => ({ invoices: [] }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const response = await app.server.inject({ method: 'GET', url: '/billing/invoices' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ invoices: [] });
  });

  it('should support custom prefix', async () => {
    const mod = defineModule('billing', {
      prefix: '/pay',
      routes: async (server) => {
        server.get('/invoices', async () => ({ ok: true }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const res = await app.server.inject({ method: 'GET', url: '/pay/invoices' });
    expect(res.statusCode).toBe(200);
  });

  it('should support prefix: false for no prefix', async () => {
    const mod = defineModule('billing', {
      prefix: false,
      routes: async (server) => {
        server.get('/invoices', async () => ({ ok: true }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const res = await app.server.inject({ method: 'GET', url: '/invoices' });
    expect(res.statusCode).toBe(200);
  });

  it('should call close() on services during server shutdown', async () => {
    const closeFn = vi.fn();
    const mod = defineModule('test', {
      services: {
        conn: {
          factory: () => ({ connected: true }),
          close: closeFn,
        },
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });
    await app.stop();

    expect(closeFn).toHaveBeenCalledOnce();
    expect(closeFn).toHaveBeenCalledWith({ connected: true });
    app = null; // Already stopped
  });

  it('should handle async service factories', async () => {
    const mod = defineModule('test', {
      services: {
        asyncService: {
          factory: async () => ({ ready: true }),
        },
      },
      prefix: false,
      routes: async (server) => {
        server.get('/test', async (request) => {
          return { value: (request as unknown as Record<string, unknown>).asyncService };
        });
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const response = await app.server.inject({ method: 'GET', url: '/test' });
    expect(response.json()).toEqual({ value: { ready: true } });
  });

  it('should call onServicesResolved callback with resolved services', async () => {
    const resolvedCallback = vi.fn();
    const mod = defineModule('test', {
      services: {
        svc: { factory: () => ({ value: 42 }) },
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod, resolvedCallback));
    await app.start({ silent: true });

    expect(resolvedCallback).toHaveBeenCalledOnce();
    expect(resolvedCallback).toHaveBeenCalledWith({ svc: { value: 42 } });
  });

  it('should ensure prefix has leading slash', async () => {
    const mod = defineModule('billing', {
      prefix: 'pay', // no leading slash
      routes: async (server) => {
        server.get('/invoices', async () => ({ ok: true }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    await app.server.register(createModulePlugin(mod));
    await app.start({ silent: true });

    const res = await app.server.inject({ method: 'GET', url: '/pay/invoices' });
    expect(res.statusCode).toBe(200);
  });
});

describe('app.module()', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should register a module on the app', async () => {
    const mod = defineModule('billing', {
      routes: async (server) => {
        server.get('/invoices', async () => ({ invoices: [] }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });

    const response = await app.server.inject({
      method: 'GET',
      url: '/billing/invoices',
    });
    expect(response.statusCode).toBe(200);
  });

  it('should return the app for chaining', async () => {
    app = await veloxApp({ port: 0, logger: false });
    const result = app.module(defineModule('test', {}));
    expect(result).toBe(app);
  });

  it('should call boot() after ready but before listen', async () => {
    const bootFn = vi.fn();
    const mod = defineModule('test', {
      services: {
        svc: { factory: () => ({ ready: true }) },
      },
      boot: bootFn,
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });

    expect(bootFn).toHaveBeenCalledOnce();
    expect(bootFn).toHaveBeenCalledWith({ svc: { ready: true } });
  });

  it('should call shutdown() during stop', async () => {
    const shutdownFn = vi.fn();
    const mod = defineModule('test', {
      services: {
        svc: { factory: () => ({ active: true }) },
      },
      shutdown: shutdownFn,
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });
    await app.stop();

    expect(shutdownFn).toHaveBeenCalledOnce();
    expect(shutdownFn).toHaveBeenCalledWith({ svc: { active: true } });
    app = null; // Already stopped
  });

  it('should throw when registering duplicate module names', async () => {
    app = await veloxApp({ port: 0, logger: false });
    app.module(defineModule('billing', {}));
    const ref = app;

    expect(() => ref.module(defineModule('billing', {}))).toThrow(
      'Module "billing" is already registered'
    );
  });

  it('should support multiple modules', async () => {
    const billingMod = defineModule('billing', {
      routes: async (server) => {
        server.get('/status', async () => ({ module: 'billing' }));
      },
    });
    const inventoryMod = defineModule('inventory', {
      routes: async (server) => {
        server.get('/status', async () => ({ module: 'inventory' }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(billingMod).module(inventoryMod);
    await app.start({ silent: true });

    const billing = await app.server.inject({ method: 'GET', url: '/billing/status' });
    const inventory = await app.server.inject({ method: 'GET', url: '/inventory/status' });

    expect(billing.json()).toEqual({ module: 'billing' });
    expect(inventory.json()).toEqual({ module: 'inventory' });
  });

  it('should execute boot hooks in registration order', async () => {
    const order: string[] = [];

    const modA = defineModule('a', {
      services: { s: { factory: () => 'A' } },
      boot: async () => {
        order.push('a');
      },
    });
    const modB = defineModule('b', {
      services: { s: { factory: () => 'B' } },
      boot: async () => {
        order.push('b');
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(modA).module(modB);
    await app.start({ silent: true });

    expect(order).toEqual(['a', 'b']);
  });

  it('should throw for non-module values', async () => {
    app = await veloxApp({ port: 0, logger: false });
    const ref = app;
    expect(() => ref.module({} as VeloxModule)).toThrow(
      'Invalid module: must be created via defineModule()'
    );
  });
});

describe('Module Integration — full lifecycle', () => {
  let app: VeloxApp | null = null;

  afterEach(async () => {
    if (app?.isRunning) {
      await app.stop();
    }
    app = null;
  });

  it('should execute full lifecycle: factory → boot → middleware → handler → shutdown → close', async () => {
    const order: string[] = [];

    const mod = defineModule('lifecycle', {
      services: {
        tracker: {
          factory: () => {
            order.push('factory');
            return { events: [] as string[] };
          },
          close: () => {
            order.push('close');
          },
        },
      },
      middleware: [
        async () => {
          order.push('middleware');
        },
      ],
      routes: async (server) => {
        server.get('/ping', async (request) => {
          order.push('handler');
          const tracker = (request as unknown as Record<string, { events: string[] }>).tracker;
          tracker.events.push('pinged');
          return { pong: true };
        });
      },
      boot: async (services) => {
        order.push('boot');
        services.tracker.events.push('booted');
      },
      shutdown: async () => {
        order.push('shutdown');
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });

    const response = await app.server.inject({
      method: 'GET',
      url: '/lifecycle/ping',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ pong: true });

    await app.stop();
    app = null;

    expect(order).toEqual(['factory', 'boot', 'middleware', 'handler', 'shutdown', 'close']);
  });

  it('should support multiple modules with independent services and routes', async () => {
    const billingMod = defineModule('billing', {
      services: {
        rate: { factory: () => 0.1 },
      },
      routes: async (server) => {
        server.get('/calculate', async (request) => {
          const rate = (request as unknown as Record<string, unknown>).rate;
          return { tax: rate };
        });
      },
    });

    const inventoryMod = defineModule('inventory', {
      services: {
        stock: { factory: () => 42 },
      },
      routes: async (server) => {
        server.get('/count', async (request) => {
          const stock = (request as unknown as Record<string, unknown>).stock;
          return { stock };
        });
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(billingMod).module(inventoryMod);
    await app.start({ silent: true });

    const billingRes = await app.server.inject({ method: 'GET', url: '/billing/calculate' });
    const inventoryRes = await app.server.inject({ method: 'GET', url: '/inventory/count' });

    expect(billingRes.json()).toEqual({ tax: 0.1 });
    expect(inventoryRes.json()).toEqual({ stock: 42 });
  });

  it('should work with modules that have no services', async () => {
    const mod = defineModule('static', {
      routes: async (server) => {
        server.get('/health', async () => ({ status: 'ok' }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });

    const res = await app.server.inject({ method: 'GET', url: '/static/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('should allow module middleware to block requests', async () => {
    const mod = defineModule('protected', {
      middleware: [
        async (_request, reply) => {
          reply.status(403).send({ error: 'Forbidden' });
        },
      ],
      routes: async (server) => {
        server.get('/secret', async () => ({ data: 'classified' }));
      },
    });

    app = await veloxApp({ port: 0, logger: false });
    app.module(mod);
    await app.start({ silent: true });

    const res = await app.server.inject({ method: 'GET', url: '/protected/secret' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Forbidden' });
  });
});
