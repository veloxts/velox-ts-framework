/**
 * Preset plugin for automatic ecosystem package registration.
 */

import type { VeloxApp } from '@veloxts/core';

import { getPreset } from './defaults.js';
import { detectEnvironment } from './env.js';
import { mergeDeep } from './merge.js';
import type { EcosystemPreset, PresetOptions } from './types.js';

/**
 * Package registration metadata.
 */
interface PackageInfo {
  name: string;
  importPath: string;
  pluginExport: string;
  getDriver: (config: unknown) => string;
}

const PACKAGES: Record<keyof EcosystemPreset, PackageInfo> = {
  cache: {
    name: '@veloxts/cache',
    importPath: '@veloxts/cache',
    pluginExport: 'cachePlugin',
    getDriver: (c) => (c as { driver?: string })?.driver ?? 'memory',
  },
  queue: {
    name: '@veloxts/queue',
    importPath: '@veloxts/queue',
    pluginExport: 'queuePlugin',
    getDriver: (c) => (c as { driver?: string })?.driver ?? 'sync',
  },
  mail: {
    name: '@veloxts/mail',
    importPath: '@veloxts/mail',
    pluginExport: 'mailPlugin',
    getDriver: (c) => (c as { driver?: string })?.driver ?? 'log',
  },
  storage: {
    name: '@veloxts/storage',
    importPath: '@veloxts/storage',
    pluginExport: 'storagePlugin',
    getDriver: (c) => (c as { driver?: string })?.driver ?? 'local',
  },
  events: {
    name: '@veloxts/events',
    importPath: '@veloxts/events',
    pluginExport: 'eventsPlugin',
    getDriver: (c) => (c as { driver?: string })?.driver ?? 'ws',
  },
  scheduler: {
    name: '@veloxts/scheduler',
    importPath: '@veloxts/scheduler',
    pluginExport: 'schedulerPlugin',
    getDriver: () => 'cron',
  },
};

/**
 * Register ecosystem plugins based on preset configuration.
 *
 * Dynamically imports packages to avoid hard dependencies.
 * Only registered packages need to be installed.
 */
export async function registerEcosystemPlugins(
  app: VeloxApp,
  preset: EcosystemPreset,
  options?: Pick<PresetOptions, 'only' | 'except' | 'silent'>
): Promise<void> {
  // Validate options - only and except are mutually exclusive
  if (options?.only && options?.except) {
    throw new Error(
      'Cannot use both "only" and "except" options simultaneously. Use one or the other.'
    );
  }

  const packages = Object.keys(preset) as (keyof EcosystemPreset)[];

  // Apply filters
  const packagesToRegister = packages.filter((pkg) => {
    if (options?.only && !options.only.includes(pkg)) return false;
    if (options?.except?.includes(pkg)) return false;
    return preset[pkg] !== undefined;
  });

  for (const pkg of packagesToRegister) {
    const config = preset[pkg];
    if (!config) continue;

    const info = PACKAGES[pkg];

    try {
      // Dynamic import to avoid hard dependency
      const module = await import(info.importPath);
      const plugin = module[info.pluginExport];

      if (!plugin) {
        throw new Error(`Plugin export '${info.pluginExport}' not found`);
      }

      await app.register(plugin(config));

      if (!options?.silent) {
        const driver = info.getDriver(config);
        console.log(`  ✓ ${info.name} [${driver}]`);
      }
    } catch (error) {
      const err = error as Error & { code?: string };

      // Check if it's a module not found error
      if (err.message?.includes('Cannot find module') || err.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(
          `Package ${info.name} is not installed. Install it with: pnpm add ${info.name}`
        );
      }

      throw new Error(`Failed to register ${info.name}: ${err.message}`);
    }
  }
}

/**
 * Apply presets to a VeloxTS application.
 *
 * Automatically configures ecosystem packages based on the current environment
 * (NODE_ENV) with sensible defaults. Override specific packages as needed.
 *
 * @example
 * ```typescript
 * import { veloxApp } from '@veloxts/velox';
 * import { usePresets } from '@veloxts/velox';
 *
 * const app = await veloxApp({ port: 3030 });
 *
 * // Auto-configure based on NODE_ENV
 * await usePresets(app);
 *
 * // Or with overrides
 * await usePresets(app, {
 *   overrides: {
 *     mail: { driver: 'smtp', config: { host: 'localhost' } }
 *   }
 * });
 * ```
 */
export async function usePresets(app: VeloxApp, options: PresetOptions = {}): Promise<void> {
  const env = options.env ?? detectEnvironment();
  const basePreset = getPreset(env);

  // Merge overrides with base preset using type-safe helper
  const merge = <T>(base: T | undefined, override: Partial<T> | undefined): T | undefined => {
    if (!base) return undefined;
    if (!override) return base;
    return mergeDeep(
      base as unknown as Record<string, unknown>,
      override as unknown as Record<string, unknown>
    ) as T;
  };

  const finalPreset: EcosystemPreset = {
    cache: merge(basePreset.cache, options.overrides?.cache),
    queue: merge(basePreset.queue, options.overrides?.queue),
    mail: merge(basePreset.mail, options.overrides?.mail),
    storage: merge(basePreset.storage, options.overrides?.storage),
    events: merge(basePreset.events, options.overrides?.events),
    scheduler: merge(basePreset.scheduler, options.overrides?.scheduler),
  };

  if (!options.silent) {
    console.log(`\n📦 VeloxTS Ecosystem Presets [${env}]`);
  }

  await registerEcosystemPlugins(app, finalPreset, options);

  if (!options.silent) {
    console.log('');
  }
}
