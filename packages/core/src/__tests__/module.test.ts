/**
 * @veloxts/core - Module System Tests
 * Tests defineModule() factory and isVeloxModule() type guard
 */

import { describe, expect, it } from 'vitest';

import { defineModule, isVeloxModule } from '../module/index.js';

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
