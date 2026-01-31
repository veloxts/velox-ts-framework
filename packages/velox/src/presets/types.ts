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
