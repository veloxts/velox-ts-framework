/**
 * Preset plugin for automatic ecosystem package registration.
 */

import type { VeloxApp } from '@veloxts/core';

import { getPreset } from './defaults.js';
import { detectEnvironment } from './env.js';
import { type DeepPartial, mergeDeep } from './merge.js';
import type { AuthPreset, EcosystemPreset, Environment, PresetOptions } from './types.js';

/**
 * Package registration metadata.
 */
interface PackageInfo {
  name: string;
  importPath: string;
  pluginExport: string;
  getDriver: (config: unknown) => string;
}

/**
 * All ecosystem packages that can be registered.
 */
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
  auth: {
    name: '@veloxts/auth',
    importPath: '@veloxts/auth',
    pluginExport: 'authPlugin',
    getDriver: () => 'jwt',
  },
};

/**
 * Packages that require special handling and are NOT auto-registered.
 * Auth requires secrets from environment variables.
 */
const SPECIAL_PACKAGES: Set<keyof EcosystemPreset> = new Set(['auth']);

/**
 * Register ecosystem plugins based on preset configuration.
 *
 * Dynamically imports packages to avoid hard dependencies.
 * Only registered packages need to be installed.
 *
 * Note: Auth is NOT auto-registered because it requires secrets.
 * Use getAuthPreset() to get environment-aware defaults for manual auth setup.
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

  // Apply filters, excluding special packages that need manual setup
  const packagesToRegister = packages.filter((pkg) => {
    // Skip special packages (like auth) that need manual configuration
    if (SPECIAL_PACKAGES.has(pkg)) return false;
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
 * Note: Auth is NOT auto-registered because it requires secrets.
 * Use getAuthPreset() to get environment-aware defaults for manual auth setup.
 *
 * @example
 * ```typescript
 * import { veloxApp, getServerConfig, usePresets, getAuthPreset } from '@veloxts/velox';
 * import { authPlugin } from '@veloxts/auth';
 *
 * const app = await veloxApp(getServerConfig());
 *
 * // Auto-configure ecosystem packages
 * await usePresets(app);
 *
 * // Manually configure auth with secrets + preset defaults
 * await app.register(authPlugin({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     refreshSecret: process.env.JWT_REFRESH_SECRET,
 *     ...getAuthPreset().jwt,
 *   },
 *   rateLimit: getAuthPreset().rateLimit,
 * }));
 * ```
 */
export async function usePresets(app: VeloxApp, options: PresetOptions = {}): Promise<void> {
  const env = options.env ?? detectEnvironment();
  const basePreset = getPreset(env);

  // Merge overrides with base preset using type-safe helper
  // Partial<T> is assignable to DeepPartial<T> for single-level overrides
  const merge = <T extends object>(
    base: T | undefined,
    override: Partial<T> | undefined
  ): T | undefined => {
    if (!base) return undefined;
    if (!override) return base;
    // Partial<T> is compatible with DeepPartial<T> at the first level
    return mergeDeep(base, override as DeepPartial<T>);
  };

  const finalPreset: EcosystemPreset = {
    cache: merge(basePreset.cache, options.overrides?.cache),
    queue: merge(basePreset.queue, options.overrides?.queue),
    mail: merge(basePreset.mail, options.overrides?.mail),
    storage: merge(basePreset.storage, options.overrides?.storage),
    events: merge(basePreset.events, options.overrides?.events),
    scheduler: merge(basePreset.scheduler, options.overrides?.scheduler),
    auth: merge(basePreset.auth, options.overrides?.auth),
  };

  if (!options.silent) {
    console.log(`\n📦 VeloxTS Ecosystem Presets [${env}]`);
  }

  await registerEcosystemPlugins(app, finalPreset, options);

  if (!options.silent) {
    console.log('');
  }
}

/**
 * Get environment-aware auth preset configuration.
 *
 * Returns configuration defaults for JWT, rate limiting, sessions, and cookies
 * based on the current environment. Secrets are NOT included - they must be
 * provided separately via environment variables.
 *
 * @param env - Target environment (defaults to NODE_ENV detection)
 * @param overrides - Override specific settings
 * @returns Auth preset configuration
 *
 * @example
 * ```typescript
 * import { getAuthPreset } from '@veloxts/velox';
 * import { authPlugin } from '@veloxts/auth';
 *
 * // Get environment-aware auth defaults
 * const authPreset = getAuthPreset();
 *
 * // Combine with your secrets
 * await app.register(authPlugin({
 *   jwt: {
 *     secret: process.env.JWT_SECRET!,
 *     refreshSecret: process.env.JWT_REFRESH_SECRET,
 *     ...authPreset.jwt,
 *   },
 *   rateLimit: authPreset.rateLimit,
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // With custom overrides
 * const authPreset = getAuthPreset('production', {
 *   jwt: { accessTokenExpiry: '10m' },
 *   rateLimit: { max: 10 },
 * });
 * ```
 */
export function getAuthPreset(env?: Environment, overrides?: Partial<AuthPreset>): AuthPreset {
  const environment = env ?? detectEnvironment();
  const basePreset = getPreset(environment);
  const authPreset = basePreset.auth ?? {};

  if (!overrides) {
    return authPreset;
  }

  return mergeDeep(authPreset, overrides);
}
