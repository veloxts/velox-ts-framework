/**
 * Preset type definitions for ecosystem package configuration.
 */

import type { CachePluginOptions } from '@veloxts/cache';
import type { EventsPluginOptions } from '@veloxts/events';
import type { MailPluginOptions } from '@veloxts/mail';
import type { QueuePluginOptions } from '@veloxts/queue';
import type { SchedulerPluginOptions } from '@veloxts/scheduler';
import type { StoragePluginOptions } from '@veloxts/storage';

/**
 * Supported environments for preset selection.
 */
export type Environment = 'development' | 'test' | 'production';

// ============================================================================
// Auth Preset Types
// ============================================================================

/**
 * JWT configuration for auth presets.
 * Secrets are NOT included - they must be set via environment variables.
 */
export interface AuthJwtPreset {
  /**
   * Access token expiration.
   * Defaults vary by environment:
   * - development: '15m'
   * - test: '1h'
   * - production: '5m' (more secure)
   */
  accessTokenExpiry?: string;

  /**
   * Refresh token expiration.
   * Defaults vary by environment:
   * - development: '7d'
   * - test: '7d'
   * - production: '1d' (more secure)
   */
  refreshTokenExpiry?: string;

  /** Token issuer (optional) */
  issuer?: string;

  /** Token audience (optional) */
  audience?: string;
}

/**
 * Rate limiting configuration for auth presets.
 */
export interface AuthRateLimitPreset {
  /**
   * Maximum requests per window.
   * Defaults vary by environment:
   * - development: 100
   * - test: 1000
   * - production: 5 (strict)
   */
  max?: number;

  /**
   * Time window in milliseconds.
   * @default 900000 (15 minutes)
   */
  windowMs?: number;
}

/**
 * Session configuration for auth presets.
 */
export interface AuthSessionPreset {
  /**
   * Session TTL in seconds.
   * Defaults vary by environment:
   * - development: 604800 (7 days)
   * - test: 3600 (1 hour)
   * - production: 14400 (4 hours)
   */
  ttl?: number;

  /**
   * Enable sliding expiration (reset TTL on activity).
   * @default true
   */
  sliding?: boolean;

  /**
   * Absolute session timeout in seconds.
   * @default 604800 (7 days)
   */
  absoluteTimeout?: number;
}

/**
 * Cookie configuration for auth presets.
 */
export interface AuthCookiePreset {
  /**
   * Secure flag for cookies (HTTPS only).
   * Defaults vary by environment:
   * - development: false
   * - test: false
   * - production: true (required for security)
   */
  secure?: boolean;

  /**
   * SameSite attribute for cookies.
   * Defaults vary by environment:
   * - development: 'lax'
   * - test: 'lax'
   * - production: 'strict' (more secure)
   */
  sameSite?: 'strict' | 'lax' | 'none';

  /**
   * HttpOnly flag for cookies.
   * @default true (prevents XSS access)
   */
  httpOnly?: boolean;
}

/**
 * Auth preset configuration.
 * Provides environment-aware defaults for authentication settings.
 *
 * Note: Secrets (jwt.secret, jwt.refreshSecret) are NOT configurable via presets.
 * They must be set via environment variables for security:
 * - JWT_SECRET
 * - JWT_REFRESH_SECRET
 */
export interface AuthPreset {
  /** JWT configuration (expiry, issuer, audience) */
  jwt?: AuthJwtPreset;

  /** Rate limiting for auth endpoints */
  rateLimit?: AuthRateLimitPreset;

  /** Session configuration */
  session?: AuthSessionPreset;

  /** Cookie configuration */
  cookie?: AuthCookiePreset;
}

// ============================================================================
// Ecosystem Preset
// ============================================================================

/**
 * Complete ecosystem preset configuration.
 * Each key corresponds to an ecosystem package.
 */
export interface EcosystemPreset {
  cache?: CachePluginOptions;
  queue?: QueuePluginOptions;
  mail?: MailPluginOptions;
  storage?: StoragePluginOptions;
  scheduler?: SchedulerPluginOptions;
  events?: EventsPluginOptions;

  /**
   * Auth preset configuration.
   * Provides environment-aware defaults for JWT, rate limiting, sessions, and cookies.
   *
   * @example
   * ```typescript
   * await usePresets(app, {
   *   overrides: {
   *     auth: {
   *       jwt: { accessTokenExpiry: '30m' },
   *       rateLimit: { max: 10 },
   *     },
   *   },
   * });
   * ```
   */
  auth?: AuthPreset;
}

/**
 * Partial overrides for ecosystem presets.
 * Allows users to customize specific package configurations.
 */
export type PresetOverrides = {
  [K in keyof EcosystemPreset]?: Partial<EcosystemPreset[K]>;
};

/**
 * Options for preset plugin registration.
 */
export interface PresetOptions {
  /**
   * Target environment. Defaults to NODE_ENV detection.
   */
  env?: Environment;

  /**
   * Override specific package configurations.
   * Merged with the base preset for the environment.
   */
  overrides?: PresetOverrides;

  /**
   * Only register these packages (allowlist).
   * If not specified, all packages with valid configurations are registered.
   */
  only?: (keyof EcosystemPreset)[];

  /**
   * Exclude these packages from registration (blocklist).
   */
  except?: (keyof EcosystemPreset)[];

  /**
   * Silent mode - suppress preset registration logs.
   * @default false
   */
  silent?: boolean;
}
