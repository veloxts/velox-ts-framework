/**
 * Environment-aware presets for VeloxTS ecosystem packages and server configuration.
 *
 * Provides two complementary APIs:
 * - `getServerConfig()` - Environment-aware server configuration (construction-time)
 * - `usePresets()` - Automatic ecosystem plugin registration (runtime)
 *
 * @example
 * ```typescript
 * import { veloxApp, getServerConfig, usePresets } from '@veloxts/velox';
 *
 * // Environment-aware server configuration
 * const app = await veloxApp(getServerConfig());
 *
 * // Auto-configure ecosystem packages
 * await usePresets(app);
 *
 * await app.start();
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Preset Configurations
// ============================================================================

export {
  developmentPreset,
  getPreset,
  presets,
  productionPreset,
  testPreset,
} from './defaults.js';

// ============================================================================
// Server Configuration
// ============================================================================

export type { ServerConfigOverrides } from './server.js';
export { getServerConfig, getServerPreset, serverPresets } from './server.js';

// ============================================================================
// Security Validation
// ============================================================================

export type {
  SecurityRequirements,
  SecurityValidationIssue,
  ValidationResult,
} from './validate.js';
export {
  isWeakSecret,
  validateAuthSecrets,
  validateSecurity,
  validateSecurityOrThrow,
} from './validate.js';

// ============================================================================
// Environment Detection
// ============================================================================

export {
  detectEnvironment,
  isDevelopment as isDevEnvironment,
  isProduction as isProdEnvironment,
  isTest as isTestEnvironment,
  validateEnvironment,
} from './env.js';

// ============================================================================
// Plugin Registration
// ============================================================================

export { getAuthPreset, registerEcosystemPlugins, usePresets } from './plugin.js';

// ============================================================================
// Utilities
// ============================================================================

export { mergeDeep } from './merge.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Auth preset types
  AuthCookiePreset,
  AuthJwtPreset,
  AuthPreset,
  AuthRateLimitPreset,
  AuthSessionPreset,
  // Ecosystem types
  EcosystemPreset,
  Environment,
  PresetOptions,
  PresetOverrides,
} from './types.js';
