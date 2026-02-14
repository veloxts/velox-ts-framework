/**
 * Preset plugin for automatic ecosystem package registration.
 */

import { createLogger, type VeloxApp } from '@veloxts/core';

import { getPreset } from './defaults.js';
import { detectEnvironment } from './env.js';
import { type DeepPartial, mergeDeep } from './merge.js';
import type { AuthPreset, EcosystemPreset, Environment, PresetOptions } from './types.js';

const log = createLogger('velox');

/**
 * Package registration metadata.
 */
interface PackageInfo {
  name: string;
  pluginExport: string;
  defaultDriver: string;
}

/**
 * Extract the driver name from a package config object.
 */
function getDriver(config: unknown, defaultDriver: string): string {
  if (config !== null && typeof config === 'object' && 'driver' in config) {
    const driver = (config as { driver: unknown }).driver;
    if (typeof driver === 'string') return driver;
  }
  return defaultDriver;
}

/**
 * All ecosystem packages that can be registered.
 */
const PACKAGES: Record<keyof EcosystemPreset, PackageInfo> = {
  cache: { name: '@veloxts/cache', pluginExport: 'cachePlugin', defaultDriver: 'memory' },
  queue: { name: '@veloxts/queue', pluginExport: 'queuePlugin', defaultDriver: 'sync' },
  mail: { name: '@veloxts/mail', pluginExport: 'mailPlugin', defaultDriver: 'log' },
  storage: { name: '@veloxts/storage', pluginExport: 'storagePlugin', defaultDriver: 'local' },
  events: { name: '@veloxts/events', pluginExport: 'eventsPlugin', defaultDriver: 'ws' },
  scheduler: { name: '@veloxts/scheduler', pluginExport: 'schedulerPlugin', defaultDriver: 'cron' },
  auth: { name: '@veloxts/auth', pluginExport: 'authPlugin', defaultDriver: 'jwt' },
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
      const module = await import(info.name);
      const plugin = module[info.pluginExport];

      if (!plugin) {
        throw new Error(`Plugin export '${info.pluginExport}' not found`);
      }

      await app.register(plugin(config));

      if (!options?.silent) {
        log.info(`  ✓ ${info.name} [${getDriver(config, info.defaultDriver)}]`);
      }
    } catch (error) {
      const err = error as Error & { code?: string };

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

  // Merge each package's overrides with its base preset
  const finalPreset: EcosystemPreset = { ...basePreset };

  if (options.overrides) {
    for (const key of Object.keys(options.overrides) as (keyof EcosystemPreset)[]) {
      const base = basePreset[key];
      const override = options.overrides[key];
      if (base && override) {
        // Partial<T> is compatible with DeepPartial<T> at the first level
        (finalPreset as Record<string, unknown>)[key] = mergeDeep(
          base,
          override as DeepPartial<typeof base>
        );
      }
    }
  }

  if (!options.silent) {
    log.info(`\nVeloxTS Ecosystem Presets [${env}]`);
  }

  await registerEcosystemPlugins(app, finalPreset, options);

  if (!options.silent) {
    log.info('');
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
