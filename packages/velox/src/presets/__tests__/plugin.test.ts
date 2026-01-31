import type { VeloxApp } from '@veloxts/core';
import { describe, expect, it, vi } from 'vitest';

import { developmentPreset } from '../defaults.js';
import { registerEcosystemPlugins } from '../plugin.js';

describe('Plugin Registration', () => {
  describe('registerEcosystemPlugins', () => {
    it('should throw when both only and except options are provided', async () => {
      const mockApp = { register: vi.fn() } as unknown as VeloxApp;

      await expect(
        registerEcosystemPlugins(mockApp, developmentPreset, {
          only: ['cache'],
          except: ['mail'],
        })
      ).rejects.toThrow('Cannot use both "only" and "except" options simultaneously');

      expect(mockApp.register).not.toHaveBeenCalled();
    });

    it('should not throw validation error with only option alone', async () => {
      const mockApp = { register: vi.fn() } as unknown as VeloxApp;

      // Will fail on package import, but that's expected - we just want to verify
      // that the validation doesn't throw
      try {
        await registerEcosystemPlugins(mockApp, developmentPreset, {
          only: ['cache'],
          silent: true,
        });
      } catch (error) {
        // Expected to fail on package import, but should NOT be the validation error
        expect((error as Error).message).not.toContain('only');
        expect((error as Error).message).not.toContain('except');
      }
    });

    it('should not throw validation error with except option alone', async () => {
      const mockApp = { register: vi.fn() } as unknown as VeloxApp;

      // Will fail on package import, but that's expected - we just want to verify
      // that the validation doesn't throw
      try {
        await registerEcosystemPlugins(mockApp, developmentPreset, {
          except: ['cache'],
          silent: true,
        });
      } catch (error) {
        // Expected to fail on package import, but should NOT be the validation error
        expect((error as Error).message).not.toContain('only');
        expect((error as Error).message).not.toContain('except');
      }
    });

    it('should not throw with no filter options', async () => {
      const mockApp = { register: vi.fn() } as unknown as VeloxApp;

      // Will fail on package import, but that's expected
      try {
        await registerEcosystemPlugins(mockApp, developmentPreset, {
          silent: true,
        });
      } catch (error) {
        // Expected to fail on package import, not validation
        expect((error as Error).message).not.toContain('Cannot use both "only" and "except"');
      }
    });
  });
});
