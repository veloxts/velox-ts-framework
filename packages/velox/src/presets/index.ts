/**
 * Environment-aware presets for VeloxTS ecosystem packages.
 *
 * Automatically configure cache, queue, mail, storage, events, and scheduler
 * based on the current environment (NODE_ENV).
 *
 * @example
 * ```typescript
 * import { veloxApp, usePresets } from '@veloxts/velox';
 *
 * const app = await veloxApp({ port: 3030 });
 *
 * // One line configures all ecosystem packages
 * await usePresets(app);
 *
 * // Development: memory cache, sync queue, log mail, local storage
 * // Production: redis cache, bullmq queue, resend mail, s3 storage
 * ```
 *
 * @packageDocumentation
 */

// Preset configurations
export {
  developmentPreset,
  getPreset,
  presets,
  productionPreset,
  testPreset,
} from './defaults.js';
// Environment detection
export {
  detectEnvironment,
  isDevelopment as isDevEnvironment,
  isProduction as isProdEnvironment,
  isTest as isTestEnvironment,
  validateEnvironment,
} from './env.js';
// Merge utility
export { mergeDeep } from './merge.js';
// Plugin registration
export { registerEcosystemPlugins, usePresets } from './plugin.js';
// Types
export type {
  EcosystemPreset,
  Environment,
  PresetOptions,
  PresetOverrides,
} from './types.js';
