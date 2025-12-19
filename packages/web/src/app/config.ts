/**
 * Configuration utilities for VeloxTS web applications
 */

import type { ResolvedVeloxWebConfig, VeloxWebConfig } from '../types.js';

/**
 * Default configuration values
 */
const defaults: ResolvedVeloxWebConfig = {
  port: 3030,
  host: 'localhost',
  apiBase: '/api',
  trpcBase: '/trpc',
  buildBase: '/_build',
  pagesDir: 'app/pages',
  layoutsDir: 'app/layouts',
  actionsDir: 'app/actions',
  dev: process.env.NODE_ENV !== 'production',
};

/**
 * Resolves partial configuration with defaults
 */
export function resolveConfig(config: VeloxWebConfig = {}): ResolvedVeloxWebConfig {
  return {
    port: config.port ?? defaults.port,
    host: config.host ?? defaults.host,
    apiBase: normalizeBasePath(config.apiBase ?? defaults.apiBase),
    trpcBase: normalizeBasePath(config.trpcBase ?? defaults.trpcBase),
    buildBase: normalizeBasePath(config.buildBase ?? defaults.buildBase),
    pagesDir: config.pagesDir ?? defaults.pagesDir,
    layoutsDir: config.layoutsDir ?? defaults.layoutsDir,
    actionsDir: config.actionsDir ?? defaults.actionsDir,
    dev: config.dev ?? defaults.dev,
  };
}

/**
 * Normalizes a base path to ensure it starts with / and has no trailing /
 */
function normalizeBasePath(path: string): string {
  // Ensure starts with /
  let normalized = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing /
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Validates the configuration and throws on invalid values
 */
export function validateConfig(config: ResolvedVeloxWebConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  if (!config.apiBase.startsWith('/')) {
    throw new Error(`API base must start with /: ${config.apiBase}`);
  }

  if (!config.trpcBase.startsWith('/')) {
    throw new Error(`tRPC base must start with /: ${config.trpcBase}`);
  }

  if (!config.buildBase.startsWith('/')) {
    throw new Error(`Build base must start with /: ${config.buildBase}`);
  }

  // Check for conflicting base paths
  const bases = [config.apiBase, config.trpcBase, config.buildBase];
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      if (bases[i] === bases[j]) {
        throw new Error(`Conflicting base paths: ${bases[i]}`);
      }
      if (bases[i].startsWith(`${bases[j]}/`) || bases[j].startsWith(`${bases[i]}/`)) {
        throw new Error(`Nested base paths are not allowed: ${bases[i]} and ${bases[j]}`);
      }
    }
  }
}

/**
 * Gets the effective configuration from environment variables
 */
export function getEnvConfig(): Partial<VeloxWebConfig> {
  const config: Partial<VeloxWebConfig> = {};

  if (process.env.PORT) {
    const port = Number.parseInt(process.env.PORT, 10);
    if (!Number.isNaN(port)) {
      config.port = port;
    }
  }

  if (process.env.HOST) {
    config.host = process.env.HOST;
  }

  if (process.env.NODE_ENV) {
    config.dev = process.env.NODE_ENV !== 'production';
  }

  return config;
}
