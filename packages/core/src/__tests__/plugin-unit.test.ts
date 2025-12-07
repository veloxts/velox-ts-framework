/**
 * @veloxts/core - Plugin System Unit Tests
 * Tests plugin definition, validation, and type guards
 */

import { describe, expect, it } from 'vitest';

import type { VeloxPlugin } from '../plugin.js';
import { definePlugin, isVeloxPlugin, validatePluginMetadata } from '../plugin.js';

describe('Plugin - Unit Tests', () => {
  describe('definePlugin', () => {
    it('should define a valid plugin', () => {
      const plugin = definePlugin({
        name: 'test-plugin',
        version: '1.0.0',
        async register() {},
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.register).toBe('function');
    });

    it('should define a plugin with dependencies', () => {
      const plugin = definePlugin({
        name: 'dependent-plugin',
        version: '2.0.0',
        dependencies: ['@veloxts/orm', '@veloxts/validation'],
        async register() {},
      });

      expect(plugin.dependencies).toEqual(['@veloxts/orm', '@veloxts/validation']);
    });

    it('should define a plugin with typed options', () => {
      interface MyOptions {
        apiKey: string;
        timeout?: number;
      }

      const plugin = definePlugin<MyOptions>({
        name: 'typed-plugin',
        version: '1.0.0',
        async register(server, options) {
          // Options should be typed as MyOptions
          const key: string = options.apiKey;
          const timeout: number | undefined = options.timeout;
          expect(key).toBeDefined();
          expect(timeout).toBeDefined();
        },
      });

      expect(plugin.name).toBe('typed-plugin');
    });

    it('should return the same plugin object', () => {
      const original = {
        name: 'test',
        version: '1.0.0',
        async register() {},
      };

      const defined = definePlugin(original);

      expect(defined).toBe(original);
    });

    it('should throw for plugin without name', () => {
      expect(() =>
        definePlugin({
          name: '',
          version: '1.0.0',
          async register() {},
        })
      ).toThrow('Plugin must have a non-empty name');
    });

    it('should throw for plugin without version', () => {
      expect(() =>
        definePlugin({
          name: 'test',
          version: '',
          async register() {},
        })
      ).toThrow('Plugin "test" must have a version');
    });

    it('should throw for plugin without register function', () => {
      expect(() =>
        definePlugin({
          name: 'test',
          version: '1.0.0',
          register: undefined as never,
        })
      ).toThrow('Plugin "test" must have a register function');
    });
  });

  describe('validatePluginMetadata', () => {
    it('should validate a valid plugin', () => {
      const plugin = {
        name: 'valid-plugin',
        version: '1.0.0',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).not.toThrow();
    });

    it('should validate a plugin with dependencies', () => {
      const plugin = {
        name: 'valid-plugin',
        version: '1.0.0',
        dependencies: ['dep1', 'dep2'],
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).not.toThrow();
    });

    it('should throw for plugin with empty name', () => {
      const plugin = {
        name: '',
        version: '1.0.0',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin must have a non-empty name');
    });

    it('should throw for plugin with whitespace-only name', () => {
      const plugin = {
        name: '   ',
        version: '1.0.0',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin must have a non-empty name');
    });

    it('should throw for plugin with missing name', () => {
      const plugin = {
        version: '1.0.0',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin must have a non-empty name');
    });

    it('should throw for plugin with non-string name', () => {
      const plugin = {
        name: 123 as unknown as string,
        version: '1.0.0',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin must have a non-empty name');
    });

    it('should throw for plugin with empty version', () => {
      const plugin = {
        name: 'test',
        version: '',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin "test" must have a version');
    });

    it('should throw for plugin with whitespace-only version', () => {
      const plugin = {
        name: 'test',
        version: '   ',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin "test" must have a version');
    });

    it('should throw for plugin with missing version', () => {
      const plugin = {
        name: 'test',
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin "test" must have a version');
    });

    it('should throw for plugin with non-string version', () => {
      const plugin = {
        name: 'test',
        version: 1.0 as unknown as string,
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow('Plugin "test" must have a version');
    });

    it('should throw for plugin with missing register function', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" must have a register function'
      );
    });

    it('should throw for plugin with non-function register', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        register: 'not a function' as never,
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" must have a register function'
      );
    });

    it('should throw for plugin with non-array dependencies', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: 'not-an-array' as never,
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" dependencies must be an array'
      );
    });

    it('should throw for plugin with non-string dependency', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: ['valid', 123 as unknown as string, 'also-valid'],
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" has invalid dependency: dependencies must be non-empty strings'
      );
    });

    it('should throw for plugin with empty string dependency', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: ['valid', '', 'also-valid'],
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" has invalid dependency: dependencies must be non-empty strings'
      );
    });

    it('should throw for plugin with whitespace-only dependency', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: ['valid', '   ', 'also-valid'],
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).toThrow(
        'Plugin "test" has invalid dependency: dependencies must be non-empty strings'
      );
    });

    it('should validate plugin with empty dependencies array', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: [],
        async register() {},
      };

      expect(() => validatePluginMetadata(plugin)).not.toThrow();
    });
  });

  describe('isVeloxPlugin', () => {
    it('should return true for valid plugin objects', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        async register() {},
      };

      expect(isVeloxPlugin(plugin)).toBe(true);
    });

    it('should return true for plugin with dependencies', () => {
      const plugin = {
        name: 'test',
        version: '1.0.0',
        dependencies: ['dep1'],
        async register() {},
      };

      expect(isVeloxPlugin(plugin)).toBe(true);
    });

    it('should return true for plugin created with definePlugin', () => {
      const plugin = definePlugin({
        name: 'test',
        version: '1.0.0',
        async register() {},
      });

      expect(isVeloxPlugin(plugin)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isVeloxPlugin(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isVeloxPlugin(undefined)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isVeloxPlugin('string')).toBe(false);
      expect(isVeloxPlugin(123)).toBe(false);
      expect(isVeloxPlugin(true)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isVeloxPlugin({})).toBe(false);
    });

    it('should return false for object missing name', () => {
      expect(
        isVeloxPlugin({
          version: '1.0.0',
          async register() {},
        })
      ).toBe(false);
    });

    it('should return false for object missing version', () => {
      expect(
        isVeloxPlugin({
          name: 'test',
          async register() {},
        })
      ).toBe(false);
    });

    it('should return false for object missing register', () => {
      expect(
        isVeloxPlugin({
          name: 'test',
          version: '1.0.0',
        })
      ).toBe(false);
    });

    it('should return false for object with non-string name', () => {
      expect(
        isVeloxPlugin({
          name: 123,
          version: '1.0.0',
          async register() {},
        })
      ).toBe(false);
    });

    it('should return false for object with non-string version', () => {
      expect(
        isVeloxPlugin({
          name: 'test',
          version: 123,
          async register() {},
        })
      ).toBe(false);
    });

    it('should return false for object with non-function register', () => {
      expect(
        isVeloxPlugin({
          name: 'test',
          version: '1.0.0',
          register: 'not a function',
        })
      ).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isVeloxPlugin([])).toBe(false);
      expect(isVeloxPlugin([1, 2, 3])).toBe(false);
    });

    it('should return false for Error instances', () => {
      expect(isVeloxPlugin(new Error('test'))).toBe(false);
    });

    it('should return true even with empty string name (validation is separate)', () => {
      // isVeloxPlugin only checks structure, not validity
      const plugin = {
        name: '',
        version: '1.0.0',
        async register() {},
      };

      expect(isVeloxPlugin(plugin)).toBe(true);
    });

    it('should return true even with empty string version (validation is separate)', () => {
      // isVeloxPlugin only checks structure, not validity
      const plugin = {
        name: 'test',
        version: '',
        async register() {},
      };

      expect(isVeloxPlugin(plugin)).toBe(true);
    });
  });

  describe('Plugin Type Inference', () => {
    it('should infer plugin options type correctly', () => {
      interface CustomOptions {
        apiKey: string;
        timeout: number;
      }

      const plugin: VeloxPlugin<CustomOptions> = {
        name: 'test',
        version: '1.0.0',
        async register(server, options) {
          // TypeScript should know options is CustomOptions
          const key: string = options.apiKey;
          const timeout: number = options.timeout;
          expect(key).toBeDefined();
          expect(timeout).toBeDefined();
        },
      };

      expect(plugin.name).toBe('test');
    });

    it('should work with optional plugin options', () => {
      interface OptionalOptions {
        debug?: boolean;
        level?: string;
      }

      const plugin: VeloxPlugin<OptionalOptions> = {
        name: 'test',
        version: '1.0.0',
        async register(server, options) {
          // TypeScript should know these are optional
          const debug: boolean | undefined = options.debug;
          const level: string | undefined = options.level;
          expect(debug).toBeDefined();
          expect(level).toBeDefined();
        },
      };

      expect(plugin.name).toBe('test');
    });
  });
});
